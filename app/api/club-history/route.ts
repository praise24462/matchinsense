/**
 * /api/club-history?teamId=33&leagueId=39&season=2025&source=euro
 *
 * QUOTA MANAGEMENT STRATEGY:
 * - Cache every team for 24 hours — 1000 users visiting same team = 4 API calls total
 * - Tab-based lazy loading — only fetch what the user needs
 * - Graceful degradation — shows whatever data is available even if some calls fail
 * - source=fd uses football-data.org (unlimited) instead of api-football
 */

import { NextRequest, NextResponse } from "next/server";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";

// ── 24-hour in-memory cache ───────────────────────────────────────────────────
// This is the key to quota management — same team = 1 fetch per day
const memCache = new Map<string, { data: any; expiresAt: number }>();

function cacheGet(key: string) {
  const e = memCache.get(key);
  if (!e || Date.now() > e.expiresAt) { memCache.delete(key); return null; }
  return e.data;
}
function cacheSet(key: string, data: any, ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

const TTL_24H = 24 * 60 * 60 * 1000;
const TTL_1H  =  1 * 60 * 60 * 1000;

const STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const FD_LEAGUE_MAP: Record<string, { leagueId: number; name: string; country: string; logo: string }> = {
  PL:  { leagueId: 39,  name: "Premier League",   country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  PD:  { leagueId: 140, name: "La Liga",           country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  SA:  { leagueId: 135, name: "Serie A",           country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  BL1: { leagueId: 78,  name: "Bundesliga",        country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  FL1: { leagueId: 61,  name: "Ligue 1",           country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  EL:  { leagueId: 3,   name: "Europa League",     country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
};

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

// ── Helper: safe fetch with timeout ──────────────────────────────────────────
async function safeFetch(url: string, headers: Record<string, string>): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers, cache: "no-store", signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── api-football: full club data ──────────────────────────────────────────────
async function fetchAfClubHistoryDirect(teamId: string, leagueId: string, season: string, apiKey: string) {
  console.log(`[club-history] Fetching AF data for team ${teamId}, league ${leagueId}, season ${season}`);

  // Fire all 4 calls in parallel — uses 4 quota but only once per 24h thanks to cache
  const [statsData, fixturesData, standingsData, teamData] = await Promise.all([
    safeFetch(`${AS_BASE}/teams/statistics?team=${teamId}&league=${leagueId}&season=${season}`,
      { "x-apisports-key": apiKey }),
    safeFetch(`${AS_BASE}/fixtures?team=${teamId}&league=${leagueId}&season=${season}&last=15`,
      { "x-apisports-key": apiKey }),
    safeFetch(`${AS_BASE}/standings?league=${leagueId}&season=${season}`,
      { "x-apisports-key": apiKey }),
    safeFetch(`${AS_BASE}/teams?id=${teamId}`,
      { "x-apisports-key": apiKey }),
  ]);

  // ── Team info ─────────────────────────────────────────────────────────────
  let teamInfo = null;
  const t = teamData?.response?.[0];
  if (t) teamInfo = {
    id: t.team.id, name: t.team.name, logo: t.team.logo ?? "",
    country: t.team.country ?? "", founded: t.team.founded ?? 0,
    venue: {
      name: t.venue?.name ?? "", city: t.venue?.city ?? "",
      capacity: t.venue?.capacity ?? 0, image: t.venue?.image ?? "",
    },
  };

  // ── Season stats ──────────────────────────────────────────────────────────
  let seasonStats = null;
  const s = statsData?.response;
  if (s && s.fixtures?.played?.total > 0) {
    seasonStats = {
      played:   s.fixtures?.played?.total ?? 0,
      wins:     s.fixtures?.wins?.total ?? 0,
      draws:    s.fixtures?.draws?.total ?? 0,
      losses:   s.fixtures?.loses?.total ?? 0,
      goalsFor:      s.goals?.for?.total?.total ?? 0,
      goalsAgainst:  s.goals?.against?.total?.total ?? 0,
      cleanSheets:   s.clean_sheet?.total ?? 0,
      failedToScore: s.failed_to_score?.total ?? 0,
      form: (s.form ?? "").slice(-10),
      biggestWin:  s.biggest?.wins?.home || s.biggest?.wins?.away || "-",
      biggestLoss: s.biggest?.loses?.home || s.biggest?.loses?.away || "-",
      avgGoalsFor:     s.goals?.for?.average?.total ?? "0",
      avgGoalsAgainst: s.goals?.against?.average?.total ?? "0",
      lineups: (s.lineups ?? []).slice(0, 3).map((l: any) => ({ formation: l.formation, played: l.played })),
    };
  }

  // ── Fixtures ──────────────────────────────────────────────────────────────
  let recentResults: any[] = [];
  let nextFixtures:  any[] = [];
  const fixtures = fixturesData?.response ?? [];
  const now = Date.now();

  const mapFixture = (f: any) => ({
    id:       f.fixture.id,
    date:     f.fixture.date,
    status:   STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS",
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
    score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    league:   { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
    isHome:   f.teams.home.id === Number(teamId),
  });

  recentResults = fixtures
    .filter((f: any) => new Date(f.fixture.date).getTime() < now)
    .sort((a: any, b: any) => new Date(b.fixture.date).getTime() - new Date(a.fixture.date).getTime())
    .slice(0, 10).map(mapFixture);

  nextFixtures = fixtures
    .filter((f: any) => new Date(f.fixture.date).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime())
    .slice(0, 5).map(mapFixture);

  // ── Full standings ────────────────────────────────────────────────────────
  let standing = null;
  let fullTable: any[] = [];
  const allGroups = standingsData?.response?.[0]?.league?.standings ?? [];

  for (const group of allGroups) {
    const rows = group.map((s: any) => ({
      rank: s.rank, teamId: s.team.id, teamName: s.team.name, teamLogo: s.team.logo,
      points: s.points, played: s.all?.played ?? 0,
      wins: s.all?.win ?? 0, draws: s.all?.draw ?? 0, losses: s.all?.lose ?? 0,
      goalsFor: s.all?.goals?.for ?? 0, goalsAgainst: s.all?.goals?.against ?? 0,
      goalsDiff: s.goalsDiff, form: s.form ?? "",
      description: s.description ?? "", isSelected: s.team.id === Number(teamId),
    }));
    if (fullTable.length === 0) fullTable = rows;
    else fullTable = [...fullTable, ...rows];

    const row = group.find((s: any) => s.team.id === Number(teamId));
    if (row && !standing) {
      standing = {
        rank: row.rank, points: row.points, goalsDiff: row.goalsDiff,
        form: row.form, description: row.description,
        played: row.all?.played ?? 0, wins: row.all?.win ?? 0,
        draws: row.all?.draw ?? 0, losses: row.all?.lose ?? 0,
        goalsFor: row.all?.goals?.for ?? 0, goalsAgainst: row.all?.goals?.against ?? 0,
      };
    }
  }

  return { teamInfo, seasonStats, recentResults, nextFixtures, standing, fullTable, season, leagueId: Number(leagueId) };
}

async function fetchAfClubHistory(teamId: string, leagueId: string, season: string, apiKey: string) {
  return flock(
    `club-history:af:${teamId}:${leagueId}:${season}`,
    () => fetchAfClubHistoryDirect(teamId, leagueId, season, apiKey),
    24 * 60 * 60 * 1000 // 24-hour cache for club history
  );
}

// ── football-data.org: for FD teams ──────────────────────────────────────────
async function fetchFdClubHistory(teamId: string, season: number, fdKey: string) {
  const [teamData, matchesData] = await Promise.all([
    safeFetch(`${FD_BASE}/teams/${teamId}`, { "X-Auth-Token": fdKey }),
    safeFetch(`${FD_BASE}/teams/${teamId}/matches?season=${season}&limit=20`, { "X-Auth-Token": fdKey }),
  ]);

  let teamInfo = null;
  if (teamData) {
    const compCode = teamData.runningCompetitions?.[0]?.code ?? "PL";
    teamInfo = {
      id: teamData.id, name: teamData.name, logo: teamData.crest ?? "",
      country: teamData.area?.name ?? "", founded: teamData.founded ?? 0,
      venue: { name: teamData.venue ?? "", city: "", capacity: 0, image: "" },
    };
  }

  const all = matchesData?.matches ?? [];
  const now = Date.now();
  const teamIdNum = Number(teamId);

  const mapMatch = (m: any) => {
    const comp = m.competition?.code ?? "";
    const league = FD_LEAGUE_MAP[comp] ?? { leagueId: 0, name: m.competition?.name ?? "", country: "", logo: "" };
    return {
      id: m.id, date: m.utcDate,
      status: FD_STATUS_MAP[m.status] ?? "NS",
      homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
      awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
      score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
      league: { id: league.leagueId, name: league.name, logo: league.logo, country: league.country },
      isHome: m.homeTeam.id === teamIdNum,
    };
  };

  const recentResults = all
    .filter((m: any) => new Date(m.utcDate).getTime() < now && m.status === "FINISHED")
    .sort((a: any, b: any) => new Date(b.utcDate).getTime() - new Date(a.utcDate).getTime())
    .slice(0, 10).map(mapMatch);

  const nextFixtures = all
    .filter((m: any) => new Date(m.utcDate).getTime() >= now)
    .sort((a: any, b: any) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    .slice(0, 5).map(mapMatch);

  // Calculate season stats from match results
  const finished = all.filter((m: any) => m.status === "FINISHED");
  let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0, cs = 0, fts = 0;
  for (const m of finished) {
    const isHome = m.homeTeam.id === teamIdNum;
    const myG  = isHome ? (m.score?.fullTime?.home ?? 0) : (m.score?.fullTime?.away ?? 0);
    const oppG = isHome ? (m.score?.fullTime?.away ?? 0) : (m.score?.fullTime?.home ?? 0);
    gf += myG; ga += oppG;
    if (myG > oppG) wins++;
    else if (myG === oppG) draws++;
    else losses++;
    if (oppG === 0) cs++;
    if (myG === 0) fts++;
  }
  const played = finished.length;
  const seasonStats = played > 0 ? {
    played, wins, draws, losses, goalsFor: gf, goalsAgainst: ga,
    cleanSheets: cs, failedToScore: fts,
    form: finished.slice(-10).map((m: any) => {
      const isHome = m.homeTeam.id === teamIdNum;
      const myG  = isHome ? (m.score?.fullTime?.home ?? 0) : (m.score?.fullTime?.away ?? 0);
      const oppG = isHome ? (m.score?.fullTime?.away ?? 0) : (m.score?.fullTime?.home ?? 0);
      return myG > oppG ? "W" : myG === oppG ? "D" : "L";
    }).join(""),
    biggestWin: "-", biggestLoss: "-",
    avgGoalsFor:     played > 0 ? (gf / played).toFixed(2) : "0",
    avgGoalsAgainst: played > 0 ? (ga / played).toFixed(2) : "0",
    lineups: [],
  } : null;

  return {
    teamInfo, seasonStats, recentResults, nextFixtures,
    standing: null, fullTable: [], season: String(season), leagueId: 0,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamId   = searchParams.get("teamId");
  const leagueId = searchParams.get("leagueId") ?? "39";
  const season   = searchParams.get("season") ?? String(new Date().getFullYear());
  const source   = searchParams.get("source") ?? "";

  if (!teamId) return NextResponse.json({ error: "teamId required" }, { status: 400 });

  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  const useFd = source === "fd" && fdKey;

  // Cache key — same team+league+season always hits cache for 24h
  const cacheKey = `club:${teamId}:${leagueId}:${season}:${useFd ? "fd" : "af"}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[club-history] CACHE HIT: ${cacheKey}`);
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  console.log(`[club-history] CACHE MISS: ${cacheKey} — using ${useFd ? "FD" : "AF"} API`);

  try {
    let result;

    if (useFd) {
      result = await fetchFdClubHistory(teamId, Number(season), fdKey);
      // FD data cached for 1 hour (more dynamic)
      cacheSet(cacheKey, result, TTL_1H);
    } else {
      if (!afKey) return NextResponse.json({ error: "FOOTBALL_API_KEY not configured" }, { status: 500 });
      result = await fetchAfClubHistory(teamId, leagueId, season, afKey);
      // AF data cached for 24 hours — this is the KEY to quota management
      // 100 different teams visited = 400 calls. Same team visited 1000 times = 4 calls.
      cacheSet(cacheKey, result, TTL_24H);
    }

    return NextResponse.json(result, {
      headers: {
        "X-Cache": "MISS",
        "X-Cache-TTL": useFd ? "3600" : "86400",
      }
    });

  } catch (err: any) {
    console.error("[club-history]", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}