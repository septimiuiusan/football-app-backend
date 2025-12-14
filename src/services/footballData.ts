// src/services/footballData.ts

const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const RAPID_KEY = process.env.RAPIDAPI_FOOTBALL_KEY;
const RAPID_HOST =
  process.env.RAPIDAPI_FOOTBALL_HOST || "api-football-v1.p.rapidapi.com";

if (!RAPID_KEY) {
  console.error("❌ RAPIDAPI_FOOTBALL_KEY missing in .env");
}

const BASE_URL = "https://api-football-v1.p.rapidapi.com/v3";

// Only these two competitions now
//  - UEL  = Europa League (id = 3)
//  - UECL = Europa Conference League (id = 848)
const TRACKED_LEAGUES = [
  { code: "UEL", id: 3 },
  { code: "UECL", id: 848 },
];

// Adjust this if needed
const CURRENT_SEASON = 2024;

// --------------------------------------------------
// Helpers
// --------------------------------------------------
function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function fetchFixturesForLeague(
  league: { code: string; id: number },
  from: string,
  to: string
) {
  try {
    const res = await axios.get(`${BASE_URL}/fixtures`, {
      params: {
        league: league.id,
        season: CURRENT_SEASON,
        from,
        to,
      },
      headers: {
        "X-RapidAPI-Key": RAPID_KEY,
        "X-RapidAPI-Host": RAPID_HOST,
      },
      timeout: 5000,
    });

    const list = res.data?.response || [];

    return list.map((fx: any) => ({
      id: fx.fixture.id,
      utcDate: fx.fixture.date,
      homeTeam: {
        id: fx.teams.home.id,
        name: fx.teams.home.name,
        shortName: fx.teams.home.name,
      },
      awayTeam: {
        id: fx.teams.away.id,
        name: fx.teams.away.name,
        shortName: fx.teams.away.name,
      },
      _appLeagueCode: league.code,
    }));
  } catch (err: any) {
    console.error(
      `API-FOOTBALL error for league ${league.code}:`,
      err.response?.data || err.message || err
    );
    return [];
  }
}

// --------------------------------------------------
// Public functions used by index.ts
// --------------------------------------------------

// This is the main one: games from today to today+daysAhead
async function getTopLeaguesFixturesNextDays(daysAhead: number) {
  const now = new Date();

  const from = formatDate(now);
  const toDate = new Date(now);
  toDate.setDate(toDate.getDate() + daysAhead);
  const to = formatDate(toDate);

  const all: any[] = [];

  for (const lg of TRACKED_LEAGUES) {
    const fixtures = await fetchFixturesForLeague(lg, from, to);
    all.push(...fixtures);
  }

  all.sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
  );

  return all;
}

// Used by /api/debug/ucl-fixtures – here we just return today's UEL+UECL fixtures
async function getTodayUclFixtures() {
  return getTopLeaguesFixturesNextDays(0);
}

// Alias so your existing index.ts code still works
async function getTrackedFixturesNextDays(daysAhead: number) {
  return getTopLeaguesFixturesNextDays(daysAhead);
}

module.exports = {
  getTodayUclFixtures,
  getTopLeaguesFixturesNextDays,
  getTrackedFixturesNextDays,
};