import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache, TTL } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";

const AS_BASE = "https://v3.football.api-sports.io";

interface TeamForm {
  matches: Array<{
    id: number;
    date: string;
    opponent: string;
    result: "W" | "L" | "D";
    score: string;
    isHome: boolean;
  }>;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  homeWins: number;
  awayWins: number;
  totalMatches: number;
}

interface FormComparison {
  h2h: { wins: number; losses: number; draws: number };
  homeTeam: {
    form: TeamForm;
    winPercentage: number;
    homeWinPercentage: number;
    goalDiffPerMatch: number;
  };
  awayTeam: {
    form: TeamForm;
    winPercentage: number;
    awayWinPercentage: number;
    goalDiffPerMatch: number;
  };
}

async function fetchTeamFixtures(teamId: number, limit: number = 10) {
  const key = process.env.FOOTBALL_API_KEY ?? "";
  const res = await fetch(`${AS_BASE}/fixtures?team=${teamId}&last=${limit}&status=FT`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const data = await res.json();
  return (data.response ?? []).map((f: any) => ({
    id: f.fixture.id,
    date: f.fixture.date,
    homeTeamId: f.teams.home.id,
    awayTeamId: f.teams.away.id,
    homeTeamName: f.teams.home.name,
    awayTeamName: f.teams.away.name,
    homeGoals: f.goals?.home ?? 0,
    awayGoals: f.goals?.away ?? 0,
  }));
}

function calculateForm(fixtures: any[], teamId: number): TeamForm {
  const matches = fixtures.map((f: any) => {
    const isHome = f.homeTeamId === teamId;
    const teamGoals = isHome ? f.homeGoals : f.awayGoals;
    const opponentGoals = isHome ? f.awayGoals : f.homeGoals;
    const opponentName = isHome ? f.awayTeamName : f.homeTeamName;

    let result: "W" | "L" | "D";
    if (teamGoals > opponentGoals) result = "W";
    else if (teamGoals < opponentGoals) result = "L";
    else result = "D";

    return {
      id: f.id,
      date: f.date,
      opponent: opponentName,
      result,
      score: `${teamGoals}-${opponentGoals}`,
      isHome,
    };
  });

  const wins = matches.filter(m => m.result === "W").length;
  const losses = matches.filter(m => m.result === "L").length;
  const draws = matches.filter(m => m.result === "D").length;
  const homeMatches = matches.filter(m => m.isHome);
  const awayMatches = matches.filter(m => !m.isHome);
  const homeWins = homeMatches.filter(m => m.result === "W").length;
  const awayWins = awayMatches.filter(m => m.result === "W").length;

  let goalsFor = 0,
    goalsAgainst = 0;
  matches.forEach(m => {
    const [gf, ga] = m.score.split("-").map(Number);
    goalsFor += gf;
    goalsAgainst += ga;
  });

  return {
    matches,
    wins,
    losses,
    draws,
    goalsFor,
    goalsAgainst,
    homeWins,
    awayWins,
    totalMatches: matches.length,
  };
}

function calculateH2H(
  homeFixtures: any[],
  awayFixtures: any[],
  homeTeamId: number,
  awayTeamId: number
): { wins: number; losses: number; draws: number } {
  const h2hMatches = homeFixtures.filter(
    f => (f.homeTeamId === homeTeamId && f.awayTeamId === awayTeamId) ||
         (f.homeTeamId === awayTeamId && f.awayTeamId === homeTeamId)
  );

  let wins = 0,
    losses = 0,
    draws = 0;

  h2hMatches.forEach(f => {
    const isHome = f.homeTeamId === homeTeamId;
    const teamGoals = isHome ? f.homeGoals : f.awayGoals;
    const opponentGoals = isHome ? f.awayGoals : f.homeGoals;

    if (teamGoals > opponentGoals) wins++;
    else if (teamGoals < opponentGoals) losses++;
    else draws++;
  });

  return { wins, losses, draws };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const homeTeamId = url.searchParams.get("homeTeamId");
  const awayTeamId = url.searchParams.get("awayTeamId");

  if (!homeTeamId || !awayTeamId)
    return NextResponse.json({ error: "Missing homeTeamId or awayTeamId" }, { status: 400 });

  const cacheKey = `form-comparison:${homeTeamId}:${awayTeamId}`;

  // Try Redis first
  try {
    const redisData = await getCached(cacheKey);
    if (redisData) return NextResponse.json(redisData, { headers: { "X-Cache": "REDIS" } });
  } catch (err) {
    console.warn("[form-comparison] Redis check failed:", err);
  }

  const cached = getCache(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

  try {
    const [homeFixtures, awayFixtures] = await Promise.all([
      fetchTeamFixtures(parseInt(homeTeamId)),
      fetchTeamFixtures(parseInt(awayTeamId)),
    ]);

    const homeForm = calculateForm(homeFixtures, parseInt(homeTeamId));
    const awayForm = calculateForm(awayFixtures, parseInt(awayTeamId));
    const h2h = calculateH2H(homeFixtures, awayFixtures, parseInt(homeTeamId), parseInt(awayTeamId));

    const result: FormComparison = {
      h2h,
      homeTeam: {
        form: homeForm,
        winPercentage: homeForm.totalMatches > 0 ? (homeForm.wins / homeForm.totalMatches) * 100 : 0,
        homeWinPercentage:
          homeForm.totalMatches > 0
            ? (homeForm.homeWins / homeForm.matches.filter(m => m.isHome).length) * 100
            : 0,
        goalDiffPerMatch:
          homeForm.totalMatches > 0 ? (homeForm.goalsFor - homeForm.goalsAgainst) / homeForm.totalMatches : 0,
      },
      awayTeam: {
        form: awayForm,
        winPercentage: awayForm.totalMatches > 0 ? (awayForm.wins / awayForm.totalMatches) * 100 : 0,
        awayWinPercentage:
          awayForm.totalMatches > 0
            ? (awayForm.awayWins / awayForm.matches.filter(m => !m.isHome).length) * 100
            : 0,
        goalDiffPerMatch:
          awayForm.totalMatches > 0 ? (awayForm.goalsFor - awayForm.goalsAgainst) / awayForm.totalMatches : 0,
      },
    };

    // Cache with 6-hour TTL
    setCache(cacheKey, result, TTL.FUTURE);

    try {
      await setCached(cacheKey, result, 6 * 60 * 60 * 1000); // 6 hours
    } catch (err) {
      console.warn("[form-comparison] Redis cache failed:", err);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[form-comparison] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch form data" },
      { status: 500 }
    );
  }
}
