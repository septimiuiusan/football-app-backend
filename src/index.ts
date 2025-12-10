import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/predictions/today", (req, res) => {
  const data = [
    {
      matchId: "1",
      league: "EPL",
      homeTeam: { id: "arsenal", name: "Arsenal", shortName: "ARS" },
      awayTeam: { id: "chelsea", name: "Chelsea", shortName: "CHE" },
      kickoffTime: "2025-12-10T20:00:00Z",
      winner: {
        homeWinProb: 0.58,
        drawProb: 0.22,
        awayWinProb: 0.20,
        recommended: "HOME"
      },
      doubleChance: {
        homeOrDrawProb: 0.8,
        homeOrAwayProb: 0.78,
        drawOrAwayProb: 0.42,
        recommended: "1X"
      },
      goals: {
        over25Prob: 0.62,
        under25Prob: 0.38,
        bttsYesProb: 0.55,
        bttsNoProb: 0.45,
        recommendedGoalsMarket: "OVER_2_5",
        recommendedBtts: "YES"
      }
    },
    {
      matchId: "2",
      league: "EPL",
      homeTeam: { id: "liverpool", name: "Liverpool", shortName: "LIV" },
      awayTeam: { id: "man_city", name: "Man City", shortName: "MCI" },
      kickoffTime: "2025-12-10T21:00:00Z",
      winner: {
        homeWinProb: 0.35,
        drawProb: 0.25,
        awayWinProb: 0.40,
        recommended: "AWAY"
      },
      doubleChance: {
        homeOrDrawProb: 0.60,
        homeOrAwayProb: 0.75,
        drawOrAwayProb: 0.65,
        recommended: "12"
      },
      goals: {
        over25Prob: 0.70,
        under25Prob: 0.30,
        bttsYesProb: 0.68,
        bttsNoProb: 0.32,
        recommendedGoalsMarket: "OVER_2_5",
        recommendedBtts: "YES"
      }
    },
    {
      matchId: "3",
      league: "LA_LIGA",
      homeTeam: { id: "real_madrid", name: "Real Madrid", shortName: "RMA" },
      awayTeam: { id: "barcelona", name: "Barcelona", shortName: "BAR" },
      kickoffTime: "2025-12-11T20:00:00Z",
      winner: {
        homeWinProb: 0.40,
        drawProb: 0.30,
        awayWinProb: 0.30,
        recommended: "HOME"
      },
      doubleChance: {
        homeOrDrawProb: 0.70,
        homeOrAwayProb: 0.70,
        drawOrAwayProb: 0.60,
        recommended: "1X"
      },
      goals: {
        over25Prob: 0.68,
        under25Prob: 0.32,
        bttsYesProb: 0.65,
        bttsNoProb: 0.35,
        recommendedGoalsMarket: "OVER_2_5",
        recommendedBtts: "YES"
      }
    },
    {
      matchId: "4",
      league: "LA_LIGA",
      homeTeam: { id: "atleti", name: "Atlético Madrid", shortName: "ATM" },
      awayTeam: { id: "sevilla", name: "Sevilla", shortName: "SEV" },
      kickoffTime: "2025-12-11T21:00:00Z",
      winner: {
        homeWinProb: 0.55,
        drawProb: 0.25,
        awayWinProb: 0.20,
        recommended: "HOME"
      },
      doubleChance: {
        homeOrDrawProb: 0.80,
        homeOrAwayProb: 0.75,
        drawOrAwayProb: 0.45,
        recommended: "1X"
      },
      goals: {
        over25Prob: 0.48,
        under25Prob: 0.52,
        bttsYesProb: 0.50,
        bttsNoProb: 0.50,
        recommendedGoalsMarket: "UNDER_2_5",
        recommendedBtts: "NO"
      }
    }
  ];

  res.json(data);
});

app.get("/api/predictions/today", (req, res) => {
  const data = [
    {
      matchId: "1",
      league: "EPL",
      homeTeam: { id: "arsenal", name: "Arsenal", shortName: "ARS" },
      awayTeam: { id: "chelsea", name: "Chelsea", shortName: "CHE" },
      kickoffTime: "2025-12-10T20:00:00Z",
      winner: {
        homeWinProb: 0.58,
        drawProb: 0.22,
        awayWinProb: 0.20,
        recommended: "HOME"
      },
      doubleChance: {
        homeOrDrawProb: 0.8,
        homeOrAwayProb: 0.78,
        drawOrAwayProb: 0.42,
        recommended: "1X"
      },
      goals: {
        over25Prob: 0.62,
        under25Prob: 0.38,
        bttsYesProb: 0.55,
        bttsNoProb: 0.45,
        recommendedGoalsMarket: "OVER_2_5",
        recommendedBtts: "YES"
      }
    }
  ];

  res.json(data);
});

app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});