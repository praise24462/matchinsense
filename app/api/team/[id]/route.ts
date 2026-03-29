/**
 * /api/team/[id]?type=results|upcoming&source=euro|africa|af|fd
 *
 * source=af  → api-football (all popular teams from popularTeams.ts)
 * source=fd  → football-data.org (teams from FD matches)
 * source=euro/africa → api-football (legacy)
 * no source  → detect by ID: if team found in popular teams list, use AF
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { flock } from "@/services/requestFlocking";
import { dbGet, dbSet } from "@/services/dbCache";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";
const TEAM_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST",
  CANCELLED:"CANC", SUSPENDED:"PST",
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

function utcDateOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}

// ── api-football: full season fixtures for a team ─────────────────────────
async function fetchAfTeam(teamId: string, type: string, apiKey: string) {
  const now = new Date();
  const season = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  // Get team info + fixtures in parallel
  const [teamRes, fixturesRes] = await Promise.all([
    fetch(`${AS_BASE}/teams?id=${teamId}`, {
      headers: { "x-apisports-key": apiKey }, cache: "no-store",
    }),
    fetch(`${AS_BASE}/fixtures?team=${teamId}&season=${season}`, {
      headers: { "x-apisports-key": apiKey }, cache: "no-store",
    }),
  ]);

  // Team info
  let teamInfo = null;
  if (teamRes.ok) {
    const td = await teamRes.json();
    const t = td.response?.[0];
    if (t) teamInfo = {
      id: t.team.id, name: t.team.name, logo: t.team.logo ?? "",
      country: t.team.country ?? "", founded: t.team.founded ?? 0,
      leagueId: 39, // will be overridden from fixtures
    };
  }

  // Fixtures
  let matches: Match[] = [];
  if (fixturesRes.ok) {
    const fd = await fixturesRes.json();
    const all = fd.response ?? [];
    const nowMs = Date.now();

    // Detect primary league from most common league in fixtures
    const leagueCounts: Record<number, number> = {};
    for (const f of all) {
      const lid = f.league?.id;
      if (lid) leagueCounts[lid] = (leagueCounts[lid] ?? 0) + 1;
    }
    const primaryLeagueId = Object.entries(leagueCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (primaryLeagueId && teamInfo) teamInfo.leagueId = Number(primaryLeagueId);

    const filtered = all
      .filter((f: any) => {
        const t = new Date(f.fixture.date).getTime();
        const s = f.fixture.status?.short ?? "";
        const DONE = new Set(["FT","AET","PEN","AWD","WO"]);
        const COMING = new Set(["NS","TBD"]);
        return type === "upcoming" ? COMING.has(s) && t >= nowMs : DONE.has(s) && t < nowMs;
      })
      .sort((a: any, b: any) => {
        const at = new Date(a.fixture.date).getTime();
        const bt = new Date(b.fixture.date).getTime();
        return type === "upcoming" ? at - bt : bt - at;
      })
      .slice(0, type === "upcoming" ? 5 : 10);

    matches = filtered.map((f: any): Match => ({
      id:       f.fixture.id,
      date:     f.fixture.date,
      status:   (AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS") as Match["status"],
      homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
      awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
      score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
      league:   { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
      source:   "european",
    }));
  }

  return { matches, teamInfo, type };
}

// ── football-data.org: for teams from FD matches ──────────────────────────
async function fetchFdTeam(teamId: string, type: string, apiKey: string) {
  const now = new Date();
  const season = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

  const [teamRes, matchesRes] = await Promise.all([
    fetch(`${FD_BASE}/teams/${teamId}`, {
      headers: { "X-Auth-Token": apiKey }, cache: "no-store",
    }),
    fetch(`${FD_BASE}/teams/${teamId}/matches?season=${season}&limit=20`, {
      headers: { "X-Auth-Token": apiKey }, cache: "no-store",
    }),
  ]);

  let teamInfo = null;
  if (teamRes.ok) {
    const td = await teamRes.json();
    const compCode = td.runningCompetitions?.[0]?.code ?? "PL";
    const league = FD_LEAGUE_MAP[compCode] ?? FD_LEAGUE_MAP["PL"];
    teamInfo = {
      id: td.id, name: td.name, logo: td.crest ?? "",
      country: td.area?.name ?? "", founded: td.founded ?? 0,
      leagueId: league.leagueId,
    };
  }

  let matches: Match[] = [];
  if (matchesRes.ok) {
    const md = await matchesRes.json();
    const all = md.matches ?? [];
    const nowMs = Date.now();

    matches = all
      .filter((m: any) => {
        const t = new Date(m.utcDate).getTime();
        return type === "upcoming" ? t >= nowMs : t < nowMs && m.status === "FINISHED";
      })
      .sort((a: any, b: any) => {
        const at = new Date(a.utcDate).getTime();
        const bt = new Date(b.utcDate).getTime();
        return type === "upcoming" ? at - bt : bt - at;
      })
      .slice(0, type === "upcoming" ? 5 : 10)
      .map((m: any): Match => {
        const comp = m.competition?.code ?? "";
        const league = FD_LEAGUE_MAP[comp] ?? { leagueId: 0, name: m.competition?.name ?? "", country: "", logo: "" };
        return {
          id: m.id, date: m.utcDate,
          status: (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
          homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
          awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
          score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
          league: { id: league.leagueId, name: league.name, logo: league.logo, country: league.country },
          source: "european",
        };
      });
  }

  return { matches, teamInfo, type };
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const p = await Promise.resolve(context.params);
  const id = p.id;
  const url = new URL(req.url);
  const type   = url.searchParams.get("type")   ?? "results";
  const source = url.searchParams.get("source") ?? "";

  if (!id || isNaN(Number(id)))
    return NextResponse.json({ message: "Invalid team ID" }, { status: 400 });

  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  const now = new Date();
  const season = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const cacheKey = `team:${source || 'auto'}:${id}:${type}:${season}`;

  // Check persistent DB cache first (survives server restarts)
  try {
    const cached = await dbGet<any>(cacheKey);
    if (cached) {
      console.log(`[team/${id}] Cache HIT`);
      return NextResponse.json(cached, { headers: { "X-Cache": "DB-HIT" } });
    }
  } catch (cacheErr: any) {
    console.warn(`[team/${id}] Cache read failed:`, cacheErr.message);
  }

  // source=fd means this team came from football-data.org match
  // everything else (euro, africa, af, or no source) = api-football
  const useFd = source === "fd" && fdKey;

  try {
    let result;
    if (useFd) {
      result = await fetchFdTeam(id, type, fdKey);
    } else {
      // Use flocking to reduce API quota for African teams
      result = await flock(
        `team:af:${id}:${type}:${season}`,
        () => fetchAfTeam(id, type, afKey),
        TEAM_CACHE_TTL
      );
    }

    // Cache result in persistent DB (24h TTL)
    try {
      await dbSet(cacheKey, result, TEAM_CACHE_TTL);
    } catch (cacheErr: any) {
      console.warn(`[team/${id}] Cache write failed:`, cacheErr.message);
      // Continue without caching - don't fail the request
    }

    return NextResponse.json(result, { headers: { "X-Cache": "MISS" } });
  } catch (err: any) {
    console.error(`[team/${id}]`, err.message);
    return NextResponse.json({ message: err?.message ?? "Failed" }, { status: 500 });
  }
}