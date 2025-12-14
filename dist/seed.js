import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    // wipe old data
    await prisma.prediction.deleteMany();
    await prisma.match.deleteMany();
    await prisma.team.deleteMany();
    await prisma.league.deleteMany();
    // LEAGUES
    const epl = await prisma.league.create({
        data: {
            code: "EPL",
            name: "Premier League",
        },
    });
    const laLiga = await prisma.league.create({
        data: {
            code: "LA_LIGA",
            name: "La Liga",
        },
    });
    // TEAMS
    // EPL
    const arsenal = await prisma.team.create({
        data: {
            name: "Arsenal",
            shortName: "ARS",
            leagueId: epl.id,
        },
    });
    const chelsea = await prisma.team.create({
        data: {
            name: "Chelsea",
            shortName: "CHE",
            leagueId: epl.id,
        },
    });
    const liverpool = await prisma.team.create({
        data: {
            name: "Liverpool",
            shortName: "LIV",
            leagueId: epl.id,
        },
    });
    const manCity = await prisma.team.create({
        data: {
            name: "Man City",
            shortName: "MCI",
            leagueId: epl.id,
        },
    });
    // LA LIGA
    const realMadrid = await prisma.team.create({
        data: {
            name: "Real Madrid",
            shortName: "RMA",
            leagueId: laLiga.id,
        },
    });
    const barcelona = await prisma.team.create({
        data: {
            name: "Barcelona",
            shortName: "BAR",
            leagueId: laLiga.id,
        },
    });
    const atleti = await prisma.team.create({
        data: {
            name: "Atlético Madrid",
            shortName: "ATM",
            leagueId: laLiga.id,
        },
    });
    const sevilla = await prisma.team.create({
        data: {
            name: "Sevilla",
            shortName: "SEV",
            leagueId: laLiga.id,
        },
    });
    // MATCHES + PREDICTIONS
    // 1: Arsenal vs Chelsea
    const match1 = await prisma.match.create({
        data: {
            externalId: "1",
            kickoffTime: new Date("2025-12-10T20:00:00Z"),
            leagueId: epl.id,
            homeTeamId: arsenal.id,
            awayTeamId: chelsea.id,
        },
    });
    await prisma.prediction.create({
        data: {
            matchId: match1.id,
            homeWinProb: 0.58,
            drawProb: 0.22,
            awayWinProb: 0.20,
            winnerPick: "HOME",
            homeOrDrawProb: 0.8,
            homeOrAwayProb: 0.78,
            drawOrAwayProb: 0.42,
            doubleChancePick: "1X",
            over25Prob: 0.62,
            under25Prob: 0.38,
            bttsYesProb: 0.55,
            bttsNoProb: 0.45,
            goalsPick: "OVER_2_5",
            bttsPick: "YES",
        },
    });
    // 2: Liverpool vs Man City
    const match2 = await prisma.match.create({
        data: {
            externalId: "2",
            kickoffTime: new Date("2025-12-10T21:00:00Z"),
            leagueId: epl.id,
            homeTeamId: liverpool.id,
            awayTeamId: manCity.id,
        },
    });
    await prisma.prediction.create({
        data: {
            matchId: match2.id,
            homeWinProb: 0.35,
            drawProb: 0.25,
            awayWinProb: 0.40,
            winnerPick: "AWAY",
            homeOrDrawProb: 0.60,
            homeOrAwayProb: 0.75,
            drawOrAwayProb: 0.65,
            doubleChancePick: "12",
            over25Prob: 0.70,
            under25Prob: 0.30,
            bttsYesProb: 0.68,
            bttsNoProb: 0.32,
            goalsPick: "OVER_2_5",
            bttsPick: "YES",
        },
    });
    // 3: Real Madrid vs Barcelona
    const match3 = await prisma.match.create({
        data: {
            externalId: "3",
            kickoffTime: new Date("2025-12-11T20:00:00Z"),
            leagueId: laLiga.id,
            homeTeamId: realMadrid.id,
            awayTeamId: barcelona.id,
        },
    });
    await prisma.prediction.create({
        data: {
            matchId: match3.id,
            homeWinProb: 0.40,
            drawProb: 0.30,
            awayWinProb: 0.30,
            winnerPick: "HOME",
            homeOrDrawProb: 0.70,
            homeOrAwayProb: 0.70,
            drawOrAwayProb: 0.60,
            doubleChancePick: "1X",
            over25Prob: 0.68,
            under25Prob: 0.32,
            bttsYesProb: 0.65,
            bttsNoProb: 0.35,
            goalsPick: "OVER_2_5",
            bttsPick: "YES",
        },
    });
    // 4: Atlético vs Sevilla
    const match4 = await prisma.match.create({
        data: {
            externalId: "4",
            kickoffTime: new Date("2025-12-11T21:00:00Z"),
            leagueId: laLiga.id,
            homeTeamId: atleti.id,
            awayTeamId: sevilla.id,
        },
    });
    await prisma.prediction.create({
        data: {
            matchId: match4.id,
            homeWinProb: 0.55,
            drawProb: 0.25,
            awayWinProb: 0.20,
            winnerPick: "HOME",
            homeOrDrawProb: 0.80,
            homeOrAwayProb: 0.75,
            drawOrAwayProb: 0.45,
            doubleChancePick: "1X",
            over25Prob: 0.48,
            under25Prob: 0.52,
            bttsYesProb: 0.50,
            bttsNoProb: 0.50,
            goalsPick: "UNDER_2_5",
            bttsPick: "NO",
        },
    });
    console.log("Seed completed");
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
