// src/index.ts
const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");

const authRoutesMod = require("./routes/auth.routes");
const friendsRoutesMod = require("./routes/friends.routes");
const usersRoutesMod = require("./routes/users.routes"); // ✅ add this

const {
  getTrackedFixturesNextDays,
  TRACKED_LEAGUES,
} = require("./services/footballData");

const { fetchLatestFootballNews } = require("./services/footballNewsService");

function pickExport(mod: any) {
  if (!mod) return mod;
  return mod.default || mod;
}

function pickRouter(mod: any) {
  const m = pickExport(mod);

  if (typeof m === "function") return m;
  if (m && typeof m === "object") {
    if (typeof m.router === "function") return m.router;
    if (typeof m.default === "function") return m.default;
    if (typeof m.routes === "function") return m.routes;
  }

  return m;
}

const authRoutes = pickRouter(authRoutesMod);
const friendsRoutes = pickRouter(friendsRoutesMod);
const usersRoutes = pickRouter(usersRoutesMod);

const app = express();

// DEBUG
console.log("authRoutes type:", typeof authRoutes);
console.log("friendsRoutes type:", typeof friendsRoutes);
console.log("usersRoutes type:", typeof usersRoutes);

if (typeof authRoutes !== "function") {
  throw new Error("authRoutes is not a router function. Fix ./routes/auth.routes export.");
}
if (typeof friendsRoutes !== "function") {
  throw new Error("friendsRoutes is not a router function. Fix ./routes/friends.routes export.");
}
if (typeof usersRoutes !== "function") {
  throw new Error("usersRoutes is not a router function. Fix ./routes/users.routes export.");
}

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/users", usersRoutes);   // ✅ FIX
app.use("/api", friendsRoutes);

// ----------------------------
// OPENAI CLIENT
// ----------------------------
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️ OPENAI_API_KEY is not set. AI predictions will fail.");
}

// ----------------------------
// HEALTH
// ----------------------------
app.get("/health", (req: any, res: any) => {
  res.json({ status: "ok" });
});

// ----------------------------
// DEBUG: ALL TRACKED FIXTURES
// GET /api/debug/tracked-fixtures?days=3
// ----------------------------
app.get("/api/debug/tracked-fixtures", async (req: any, res: any) => {
  try {
    const daysParam = req.query.days;
    const daysAhead = daysParam ? parseInt(String(daysParam), 10) : 3;
    const safeDaysAhead = Number.isNaN(daysAhead)
      ? 3
      : Math.max(0, Math.min(7, daysAhead));

    const fixtures = await getTrackedFixturesNextDays(safeDaysAhead);

    res.json({
      leagues: TRACKED_LEAGUES.map((l: any) => ({
        code: l.code,
        name: l.name,
      })),
      daysAhead: safeDaysAhead,
      count: fixtures.length,
      fixtures,
    });
  } catch (err: any) {
    console.error(
      "Tracked fixtures debug error:",
      err.response?.data || err.message || err
    );
    res.status(500).json({ error: "Failed to load tracked fixtures" });
  }
});

// ----------------------------
// AI HELPER
// ----------------------------
async function generatePredictionForMatch(
  homeName: string,
  awayName: string,
  leagueCode: string,
  kickoffIso: string
) {
  const prompt = `
You are a football betting assistant.

Estimate realistic probabilities for this match:

Competition code: ${leagueCode}
Home team: ${homeName}
Away team: ${awayName}
Kickoff (UTC): ${kickoffIso}

Return ONLY valid JSON with this exact structure:

{
  "winner": {
    "homeWinProb": number,
    "drawProb": number,
    "awayWinProb": number,
    "recommended": "HOME" | "DRAW" | "AWAY"
  },
  "doubleChance": {
    "homeOrDrawProb": number,
    "homeOrAwayProb": number,
    "drawOrAwayProb": number,
    "recommended": "1X" | "12" | "X2"
  },
  "goals": {
    "over25Prob": number,
    "under25Prob": number,
    "bttsYesProb": number,
    "bttsNoProb": number,
    "recommendedGoalsMarket": "OVER_2_5" | "UNDER_2_5",
    "recommendedBtts": "YES" | "NO"
  },
  "correctScore": {
    "primaryScore": string,
    "primaryProb": number,
    "secondaryScore": string,
    "secondaryProb": number
  }
}

Rules:
- All probabilities must be between 0 and 1.
- homeWinProb + drawProb + awayWinProb should be around 1.
- All *_Prob fields are probabilities, not percentages.
- correctScore.primaryScore and .secondaryScore must be like "2-1", "1-0", "0-0".
- Do not include any explanation text or comments, only JSON.
`;

  const response = await openai.responses.create({
    model: "gpt-4.1-mini",
    input: prompt,
    response_format: { type: "json_object" },
  });

  const text =
    (response.output &&
      response.output[0] &&
      response.output[0].content &&
      response.output[0].content[0] &&
      response.output[0].content[0].text) ||
    JSON.stringify(response);

  return JSON.parse(text);
}

function isSameDay(dateIso: string, ref: Date): boolean {
  const d = new Date(dateIso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

function scorePrediction(p: {
  winner: { homeWinProb: number; drawProb: number; awayWinProb: number };
  goals: {
    recommendedGoalsMarket: "OVER_2_5" | "UNDER_2_5";
    recommendedBtts: "YES" | "NO";
  };
}) {
  const { homeWinProb, drawProb, awayWinProb } = p.winner;
  const sorted = [homeWinProb, drawProb, awayWinProb].sort((a, b) => b - a);
  const margin = sorted[0] - sorted[1];

  let bonus = 0;
  if (p.goals.recommendedGoalsMarket === "OVER_2_5") bonus += 0.02;
  if (p.goals.recommendedBtts === "YES") bonus += 0.01;

  return margin + bonus;
}

// ----------------------------
// ENDPOINT: UPCOMING PREDICTIONS
// GET /api/predictions/top-leagues/upcoming?days=3
// ----------------------------
app.get("/api/predictions/top-leagues/upcoming", async (req: any, res: any) => {
  try {
    const daysParam = req.query.days;
    const daysAhead = daysParam ? parseInt(String(daysParam), 10) : 3;
    const safeDaysAhead = Number.isNaN(daysAhead)
      ? 3
      : Math.max(0, Math.min(7, daysAhead));

    const fixtures = await getTrackedFixturesNextDays(safeDaysAhead);

    if (!fixtures || fixtures.length === 0) {
      return res.json([]);
    }

    const predictions = await Promise.all(
      fixtures.map(async (m: any) => {
        try {
          const leagueCode = m.leagueCode;

          const ai = await generatePredictionForMatch(
            m.homeTeam.name,
            m.awayTeam.name,
            leagueCode,
            m.utcDate
          );

          return {
            matchId: String(m.externalId ?? m.id),
            league: leagueCode,
            homeTeam: {
              id: String(m.homeTeam.id ?? `${m.externalId}-H`),
              name: m.homeTeam.name,
              shortName:
                m.homeTeam.shortName ||
                m.homeTeam.name.slice(0, 3).toUpperCase(),
            },
            awayTeam: {
              id: String(m.awayTeam.id ?? `${m.externalId}-A`),
              name: m.awayTeam.name,
              shortName:
                m.awayTeam.shortName ||
                m.awayTeam.name.slice(0, 3).toUpperCase(),
            },
            kickoffTime: m.utcDate,
            winner: ai.winner,
            doubleChance: ai.doubleChance,
            goals: ai.goals,
            correctScore: ai.correctScore,
          };
        } catch (err: any) {
          console.error(
            `❗ AI error for ${m.homeTeam.name} vs ${m.awayTeam.name} :`,
            err.response?.data || err.message || err
          );
          return null;
        }
      })
    );

    res.json(predictions.filter(Boolean));
  } catch (err: any) {
    console.error(
      "Top leagues predictions error:",
      err.response?.data || err.message || err
    );
    res.status(500).json({ error: "Failed to generate top leagues predictions" });
  }
});

// ----------------------------
// ENDPOINT: PREDICTION OF THE DAY
// GET /api/predictions/of-the-day
// ----------------------------
app.get("/api/predictions/of-the-day", async (req: any, res: any) => {
  try {
    const fixtures = await getTrackedFixturesNextDays(1);
    const today = new Date();

    const todaysFixtures = fixtures.filter((f: any) => isSameDay(f.utcDate, today));
    if (todaysFixtures.length === 0) return res.status(404).json({ error: "No matches for today" });

    const predictionsWithScore = await Promise.all(
      todaysFixtures.map(async (m: any) => {
        try {
          const leagueCode = m.leagueCode;

          const ai = await generatePredictionForMatch(
            m.homeTeam.name,
            m.awayTeam.name,
            leagueCode,
            m.utcDate
          );

          const s = scorePrediction({ winner: ai.winner, goals: ai.goals });

          return {
            matchId: String(m.externalId ?? m.id),
            league: leagueCode,
            homeTeam: {
              id: String(m.homeTeam.id ?? `${m.externalId}-H`),
              name: m.homeTeam.name,
              shortName:
                m.homeTeam.shortName ||
                m.homeTeam.name.slice(0, 3).toUpperCase(),
            },
            awayTeam: {
              id: String(m.awayTeam.id ?? `${m.externalId}-A`),
              name: m.awayTeam.name,
              shortName:
                m.awayTeam.shortName ||
                m.awayTeam.name.slice(0, 3).toUpperCase(),
            },
            kickoffTime: m.utcDate,
            winner: ai.winner,
            doubleChance: ai.doubleChance,
            goals: ai.goals,
            correctScore: ai.correctScore,
            _score: s,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = predictionsWithScore.filter(Boolean) as any[];
    if (!valid.length) return res.status(500).json({ error: "AI failed for all matches today" });

    valid.sort((a, b) => b._score - a._score);
    const best = valid[0];
    const { _score, ...clean } = best;

    res.json(clean);
  } catch (err: any) {
    console.error("Prediction of the day error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Failed to compute prediction of the day" });
  }
});

// ----------------------------
// ENDPOINT: FOOTBALL NEWS
// GET /api/news/football
// ----------------------------
app.get("/api/news/football", async (req: any, res: any) => {
  try {
    const articles = await fetchLatestFootballNews();
    res.json(articles);
  } catch (err: any) {
    console.error("Football news error:", err.response?.data || err.message || err);
    res.status(500).json({ error: "Failed to load football news" });
  }
});

// ----------------------------
// START SERVER
// ----------------------------
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🔥 Backend running on port ${PORT} (OpenAI predictions, dynamic fixtures)`);
});