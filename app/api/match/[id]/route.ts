/**
 * /api/match/[id]
 *
 * Cached match detail — first user fetches, everyone else gets cache.
 *
 * TTL:
 *   Live match   → 60s
 *   Finished     → 10 min
 *   Upcoming     → 5 min
 *
 * ID routing:
 *   < 600,000  → football-data.org
 *   >= 600,000 → api-football
 */

import { NextRequest, NextResponse } from "next/server";
import type { MatchDetails, MatchStatistic, MatchEvent } from "@/types";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";

// ── In-memory cache ───────────────────────────────────────────────────────
interface CacheEntry { data: MatchDetails; expiresAt: number; }
const memCache = new Map<string, CacheEntry>();

function cacheGet(key: string): MatchDetails | null {
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key: string, data: MatchDetails, ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function getTtlForStatus(status: string): number {
  if (status === "LIVE" || status === "HT") return 60 * 1000;
  if (status === "FT") return 10 * 60 * 1000;
  return 5 * 60 * 1000;
}

// ── In-flight dedup ───────────────────────────────────────────────────────
const inFlight = new Map<string, Promise<MatchDetails>>();

async function fetchWithDedup(key: string, fetcher: () => Promise<MatchDetails>): Promise<MatchDetails> {
  if (inFlight.has(key)) return inFlight.get(key)!;
  const promise = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ── Status maps ───────────────────────────────────────────────────────────
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

const FD_LEAGUE_MAP: Record<string, { leagueId: number; name: string; country: string }> = {
  PL:  { leagueId: 39,  name: "Premier League",   country: "England" },
  PD:  { leagueId: 140, name: "La Liga",           country: "Spain"   },
  SA:  { leagueId: 135, name: "Serie A",           country: "Italy"   },
  BL1: { leagueId: 78,  name: "Bundesliga",        country: "Germany" },
  FL1: { leagueId: 61,  name: "Ligue 1",           country: "France"  },
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe"  },
  EL:  { leagueId: 3,   name: "Europa League",     country: "Europe"  },
};

const STAT_LABELS: [string, string][] = [
  ["Ball Possession","Possession"],["Total Shots","Shots"],
  ["Shots on Goal","Shots on Target"],["Shots off Goal","Shots off Target"],
  ["Blocked Shots","Blocked Shots"],["Corner Kicks","Corners"],
  ["Fouls","Fouls"],["Yellow Cards","Yellow Cards"],["Red Cards","Red Cards"],
  ["Offsides","Offsides"],["Goalkeeper Saves","Saves"],
  ["Total passes","Passes"],["Passes accurate","Accurate Passes"],
  ["passes %","Pass Accuracy"],["expected_goals","xG"],
];

// ── football-data.org fetch ───────────────────────────────────────────────
async function fetchFromFD(matchId: string, apiKey: string): Promise<MatchDetails> {
  const res = await fetch(`${FD_BASE}/matches/${matchId}`, {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FD ${res.status}`);
  const m = await res.json();
  if (!m?.homeTeam) throw new Error("Match not found");

  const comp = m.competition?.code ?? "";
  const league = FD_LEAGUE_MAP[comp] ?? {
    leagueId: 0, name: m.competition?.name ?? "", country: m.area?.name ?? "",
  };

  return {
    id:       m.id,
    date:     m.utcDate,
    status:   (FD_STATUS_MAP[m.status] ?? "NS") as MatchDetails["status"],
    homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
    awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
    score:    { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
    halfTimeScore: { home: m.score?.halfTime?.home ?? null, away: m.score?.halfTime?.away ?? null },
    league:   { id: league.leagueId, name: league.name, logo: "", country: league.country },
    source:   "euro",
    statistics: [],
    events:     [],
    venue:    m.venue ?? undefined,
    referee:  m.referees?.[0]?.name ?? undefined,
  };
}

// ── api-football fetch ────────────────────────────────────────────────────
async function fetchFromAF(matchId: string, apiKey: string): Promise<MatchDetails> {
  const [fixtureRes, statsRes] = await Promise.all([
    fetch(`${AS_BASE}/fixtures?id=${matchId}`, {
      headers: { "x-apisports-key": apiKey }, cache: "no-store",
    }),
    fetch(`${AS_BASE}/fixtures/statistics?fixture=${matchId}`, {
      headers: { "x-apisports-key": apiKey }, cache: "no-store",
    }),
  ]);

  if (!fixtureRes.ok) throw new Error(`AF ${fixtureRes.status}`);
  const fd = await fixtureRes.json();
  if (fd.errors && Object.keys(fd.errors).length > 0) throw new Error(JSON.stringify(fd.errors));

  const f = fd.response?.[0];
  if (!f) throw new Error("Match not found");

  const events: MatchEvent[] = (f.events ?? []).map((e: any): MatchEvent | null => {
    const team: "home"|"away" = e.team?.id === f.teams.home.id ? "home" : "away";
    const minute = e.time?.elapsed ?? 0;
    if (e.type === "Goal") {
      if (e.detail === "Own Goal") return { minute, type:"OwnGoal", team: team==="home"?"away":"home", player: e.player?.name??"", detail:"Own Goal" };
      if (e.detail === "Penalty") return { minute, type:"Penalty", team, player: e.player?.name??"", detail:"Penalty" };
      return { minute, type:"Goal", team, player: e.player?.name??"", detail: e.assist?.name?`Assist: ${e.assist.name}`:undefined };
    }
    if (e.type === "Card") return { minute, type:"Card", team, player: e.player?.name??"", detail: e.detail==="Yellow Card"?"YELLOW":e.detail==="Red Card"?"RED":"YELLOW_RED" };
    if (e.type === "subst") return { minute, type:"Substitution", team, player: e.player?.name??"", detail: e.assist?.name?`Off: ${e.assist.name}`:undefined };
    return null;
  }).filter(Boolean) as MatchEvent[];

  let statistics: MatchStatistic[] = [];
  if (statsRes.ok) {
    const sd = await statsRes.json();
    const sa = sd.response ?? [];
    const hs: Record<string,any> = {}, as_: Record<string,any> = {};
    for (const s of (sa[0]?.statistics ?? [])) hs[s.type] = s.value;
    for (const s of (sa[1]?.statistics ?? [])) as_[s.type] = s.value;
    statistics = STAT_LABELS
      .filter(([k]) => hs[k] !== undefined || as_[k] !== undefined)
      .map(([k, label]): MatchStatistic => ({ label, home: hs[k] ?? null, away: as_[k] ?? null }));
  }

  return {
    id:        f.fixture.id,
    date:      f.fixture.date,
    status:    (AS_STATUS_MAP[f.fixture?.status?.short ?? "NS"] ?? "NS") as MatchDetails["status"],
    homeTeam:  { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
    awayTeam:  { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
    score:     { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    halfTimeScore: { home: f.score?.halftime?.home ?? null, away: f.score?.halftime?.away ?? null },
    league:    { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
    source:    "euro",
    statistics, events,
    venue:    f.fixture?.venue?.name ?? undefined,
    referee:  f.fixture?.referee ?? undefined,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await context.params;
  if (!matchId || isNaN(Number(matchId)))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  const cacheKey = `match:${matchId}`;

  // ── Serve from cache ────────────────────────────────────────────────────
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  try {
    const isFdMatch = Number(matchId) < 600000;

    const match = await fetchWithDedup(cacheKey, () =>
      isFdMatch && fdKey
        ? fetchFromFD(matchId, fdKey)
        : fetchFromAF(matchId, afKey)
    );

    // Cache with status-aware TTL
    cacheSet(cacheKey, match, getTtlForStatus(match.status));

    return NextResponse.json(match, { headers: { "X-Cache": "MISS" } });

  } catch (err: any) {
    console.error(`[match/${matchId}]`, err.message);
    if (err.message === "Match not found")
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to load match" }, { status: 500 });
  }
}