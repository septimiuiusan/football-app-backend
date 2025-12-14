// src/services/footballData.ts
import axios from "axios";
// All competitions you want the app to track
// ⚠️ These are API-Football league IDs. If any is wrong, adjust.
export const TRACKED_LEAGUES = [
    { code: "EPL", name: "Premier League", apiLeagueId: 39 },
    { code: "LA_LIGA", name: "La Liga", apiLeagueId: 140 },
    { code: "SERIE_A", name: "Serie A", apiLeagueId: 135 },
    { code: "BUNDES", name: "Bundesliga", apiLeagueId: 78 },
    { code: "LIGUE_1", name: "Ligue 1", apiLeagueId: 61 },
    { code: "ROU_L1", name: "Romanian Liga 1", apiLeagueId: 283 },
    { code: "UCL", name: "Champions League", apiLeagueId: 2 },
    { code: "UEL", name: "Europa League", apiLeagueId: 3 },
    { code: "UECL", name: "Conference League", apiLeagueId: 848 },
];
const api = axios.create({
    baseURL: "https://api-football-v1.p.rapidapi.com/v3",
    headers: {
        "X-RapidAPI-Key": process.env.FOOTBALL_API_KEY || "",
        "X-RapidAPI-Host": process.env.FOOTBALL_API_HOST || "",
    },
    timeout: 8000,
});
function toDateString(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}
function getRange(daysAhead) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + daysAhead);
    return { from: toDateString(start), to: toDateString(end) };
}
/**
 * Get fixtures for ALL tracked competitions between *today* and
 * today + daysAhead (inclusive).
 *
 * This returns a plain JS object; index.ts decides how to map it
 * into the shape the mobile app expects.
 */
export async function getTrackedFixturesNextDays(daysAhead) {
    const { from, to } = getRange(daysAhead);
    const season = new Date().getFullYear(); // adjust if needed
    const allFixtures = [];
    for (const league of TRACKED_LEAGUES) {
        try {
            const res = await api.get("/fixtures", {
                params: {
                    league: league.apiLeagueId,
                    season,
                    from,
                    to,
                },
            });
            const fixtures = res.data?.response || [];
            fixtures.forEach((f) => {
                allFixtures.push({
                    externalId: String(f.fixture.id),
                    leagueCode: league.code,
                    leagueName: league.name,
                    utcDate: f.fixture.date,
                    homeTeam: {
                        name: f.teams.home.name,
                        shortName: f.teams.home.name,
                    },
                    awayTeam: {
                        name: f.teams.away.name,
                        shortName: f.teams.away.name,
                    },
                });
            });
        }
        catch (err) {
            console.error(`API-FOOTBALL error for league ${league.code}:`, err.response?.data || err.message || err);
            // continue with other leagues
        }
    }
    allFixtures.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime());
    return allFixtures;
}
