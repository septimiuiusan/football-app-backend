// src/index.ts
const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
const { getTrackedFixturesNextDays, TRACKED_LEAGUES, } = require("./services/footballData");
const { fetchLatestFootballNews, } = require("./services/footballNewsService");
const app = express();
app.use(cors());
app.use(express.json());
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
app.get("/health", (req, res) => {
    res.json({ status: "ok" });
});
// ----------------------------
// DEBUG: ALL TRACKED FIXTURES
// GET /api/debug/tracked-fixtures?days=3
// ----------------------------
app.get("/api/debug/tracked-fixtures", async (req, res) => {
    try {
        const daysParam = req.query.days;
        const daysAhead = daysParam ? parseInt(String(daysParam), 10) : 3;
        const safeDaysAhead = Number.isNaN(daysAhead)
            ? 3
            : Math.max(0, Math.min(7, daysAhead));
        const fixtures = await getTrackedFixturesNextDays(safeDaysAhead);
        res.json({
            leagues: TRACKED_LEAGUES.map((l) => ({
                code: l.code,
                name: l.name,
            })),
            daysAhead: safeDaysAhead,
            count: fixtures.length,
            fixtures,
        });
    }
    catch (err) {
        console.error("Tracked fixtures debug error:", err.response?.data || err.message || err);
        res.status(500).json({ error: "Failed to load tracked fixtures" });
    }
});
// ----------------------------
// AI HELPER
// ----------------------------
async function generatePredictionForMatch(homeName, awayName, leagueCode, kickoffIso) {
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
    const text = (response.output &&
        response.output[0] &&
        response.output[0].content &&
        response.output[0].content[0] &&
        response.output[0].content[0].text) ||
        JSON.stringify(response);
    const parsed = JSON.parse(text);
    return parsed;
}
function isSameDay(dateIso, ref) {
    const d = new Date(dateIso);
    return (d.getFullYear() === ref.getFullYear() &&
        d.getMonth() === ref.getMonth() &&
        d.getDate() === ref.getDate());
}
function scorePrediction(p) {
    const { homeWinProb, drawProb, awayWinProb } = p.winner;
    const sorted = [homeWinProb, drawProb, awayWinProb].sort((a, b) => b - a);
    const margin = sorted[0] - sorted[1];
    let bonus = 0;
    if (p.goals.recommendedGoalsMarket === "OVER_2_5")
        bonus += 0.02;
    if (p.goals.recommendedBtts === "YES")
        bonus += 0.01;
    return margin + bonus;
}
// ----------------------------
// ENDPOINT: UPCOMING PREDICTIONS
// GET /api/predictions/top-leagues/upcoming?days=3
// ----------------------------
app.get("/api/predictions/top-leagues/upcoming", async (req, res) => {
    try {
        const daysParam = req.query.days;
        const daysAhead = daysParam ? parseInt(String(daysParam), 10) : 3;
        const safeDaysAhead = Number.isNaN(daysAhead)
            ? 3
            : Math.max(0, Math.min(7, daysAhead)); // 0–7 days max
        const fixtures = await getTrackedFixturesNextDays(safeDaysAhead);
        if (!fixtures || fixtures.length === 0) {
            console.log("No tracked games in range.");
            return res.json([]);
        }
        console.log(`🔢 Building AI predictions for ${fixtures.length} matches (daysAhead=${safeDaysAhead})`);
        const predictions = await Promise.all(fixtures.map(async (m) => {
            try {
                const leagueCode = m.leagueCode; // "EPL", "LA_LIGA", "SERIE_A", "BUNDES", "LIGUE_1", "ROU_L1", "UCL", "UEL", "UECL"
                const ai = await generatePredictionForMatch(m.homeTeam.name, m.awayTeam.name, leagueCode, m.utcDate);
                return {
                    matchId: String(m.externalId ?? m.id),
                    league: leagueCode,
                    homeTeam: {
                        id: String(m.homeTeam.id ?? `${m.externalId}-H`),
                        name: m.homeTeam.name,
                        shortName: m.homeTeam.shortName ||
                            m.homeTeam.name.slice(0, 3).toUpperCase(),
                    },
                    awayTeam: {
                        id: String(m.awayTeam.id ?? `${m.externalId}-A`),
                        name: m.awayTeam.name,
                        shortName: m.awayTeam.shortName ||
                            m.awayTeam.name.slice(0, 3).toUpperCase(),
                    },
                    kickoffTime: m.utcDate,
                    winner: ai.winner,
                    doubleChance: ai.doubleChance,
                    goals: ai.goals,
                    correctScore: ai.correctScore,
                };
            }
            catch (err) {
                console.error(`❗ AI error for ${m.homeTeam.name} vs ${m.awayTeam.name} :`, err.response?.data || err.message || err);
                return null;
            }
        }));
        const clean = predictions.filter((p) => p !== null);
        res.json(clean);
    }
    catch (err) {
        console.error("Top leagues predictions error:", err.response?.data || err.message || err);
        res
            .status(500)
            .json({ error: "Failed to generate top leagues predictions" });
    }
});
// ----------------------------
// ENDPOINT: PREDICTION OF THE DAY
// GET /api/predictions/of-the-day
// ----------------------------
app.get("/api/predictions/of-the-day", async (req, res) => {
    try {
        const fixtures = await getTrackedFixturesNextDays(1);
        const today = new Date();
        const todaysFixtures = fixtures.filter((f) => isSameDay(f.utcDate, today));
        if (todaysFixtures.length === 0) {
            return res.status(404).json({ error: "No matches for today" });
        }
        const predictionsWithScore = await Promise.all(todaysFixtures.map(async (m) => {
            try {
                const leagueCode = m.leagueCode;
                const ai = await generatePredictionForMatch(m.homeTeam.name, m.awayTeam.name, leagueCode, m.utcDate);
                const s = scorePrediction({
                    winner: ai.winner,
                    goals: ai.goals,
                });
                return {
                    matchId: String(m.externalId ?? m.id),
                    league: leagueCode,
                    homeTeam: {
                        id: String(m.homeTeam.id ?? `${m.externalId}-H`),
                        name: m.homeTeam.name,
                        shortName: m.homeTeam.shortName ||
                            m.homeTeam.name.slice(0, 3).toUpperCase(),
                    },
                    awayTeam: {
                        id: String(m.awayTeam.id ?? `${m.externalId}-A`),
                        name: m.awayTeam.name,
                        shortName: m.awayTeam.shortName ||
                            m.awayTeam.name.slice(0, 3).toUpperCase(),
                    },
                    kickoffTime: m.utcDate,
                    winner: ai.winner,
                    doubleChance: ai.doubleChance,
                    goals: ai.goals,
                    correctScore: ai.correctScore,
                    _score: s,
                };
            }
            catch (err) {
                console.error(`❗ AI error for POTD ${m.homeTeam.name} vs ${m.awayTeam.name} :`, err.response?.data || err.message || err);
                return null;
            }
        }));
        const valid = predictionsWithScore.filter((p) => p !== null);
        if (valid.length === 0) {
            return res
                .status(500)
                .json({ error: "AI failed for all matches today" });
        }
        valid.sort((a, b) => b._score - a._score);
        const best = valid[0];
        const { _score, ...clean } = best;
        res.json(clean);
    }
    catch (err) {
        console.error("Prediction of the day error:", err.response?.data || err.message || err);
        res
            .status(500)
            .json({ error: "Failed to compute prediction of the day" });
    }
});
// ----------------------------
// ENDPOINT: FOOTBALL NEWS
// GET /api/news/football
// ----------------------------
app.get("/api/news/football", async (req, res) => {
    try {
        const articles = await fetchLatestFootballNews();
        res.json(articles);
    }
    catch (err) {
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
