/**
 * /api/matches?date=YYYY-MM-DD
 *
 * SCALABILITY: This endpoint uses Next.js fetch cache (revalidate).
 * The SAME response is served to ALL users until the cache expires.
 * 100,000 users → still only ~48 FD calls/day + ~8 AS calls/day.
 *
 * BUG FIX: football-data.org uses ?dateFrom=&dateTo= NOT ?date=
 * Using ?date= returns 0 matches — that was the missing matches bug.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { lagosDate } from "@/services/apiManager";
import { generateFallbackUpcoming } from "@/services/fallbackMatches";

const FD_BASE = "https://api.football-data.org/v4";
const AS_BASE = "https://v3.football.api-sports.io";

// ── football-data.org  —  CONFIRMED FREE TIER CODES ONLY ─────────────────────
// WARNING: Adding any invalid code (CLI, ASL, GL etc) breaks the entire call
const FD_COMPS: Record<string, { leagueId: number; name: string; country: string; logo: string }> = {
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/2.png"   },
  EL:  { leagueId: 3,   name: "Europa League",      country: "Europe",      logo: "https://media.api-sports.io/football/leagues/3.png"   },
  ECL: { leagueId: 848, name: "Conference League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/848.png" },
  WC:  { leagueId: 1,   name: "FIFA World Cup",     country: "World",       logo: "https://media.api-sports.io/football/leagues/1.png"   },
  EC:  { leagueId: 4,   name: "Euro Championship",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/4.png"   },
  PL:  { leagueId: 39,  name: "Premier League",     country: "England",     logo: "https://media.api-sports.io/football/leagues/39.png"  },
  PD:  { leagueId: 140, name: "La Liga",            country: "Spain",       logo: "https://media.api-sports.io/football/leagues/140.png" },
  SA:  { leagueId: 135, name: "Serie A",            country: "Italy",       logo: "https://media.api-sports.io/football/leagues/135.png" },
  BL1: { leagueId: 78,  name: "Bundesliga",         country: "Germany",     logo: "https://media.api-sports.io/football/leagues/78.png"  },
  FL1: { leagueId: 61,  name: "Ligue 1",            country: "France",      logo: "https://media.api-sports.io/football/leagues/61.png"  },
  ELC: { leagueId: 10,  name: "Championship",       country: "England",     logo: "https://media.api-sports.io/football/leagues/10.png"  },
  PPL: { leagueId: 94,  name: "Primeira Liga",      country: "Portugal",    logo: "https://media.api-sports.io/football/leagues/94.png"  },
  DED: { leagueId: 88,  name: "Eredivisie",         country: "Netherlands", logo: "https://media.api-sports.io/football/leagues/88.png"  },
  BSA: { leagueId: 71,  name: "Brasileirão",        country: "Brazil",      logo: "https://media.api-sports.io/football/leagues/71.png"  },
};
const FD_CODES = Object.keys(FD_COMPS).join(",");

// ── api-sports.io  —  European + African + qualifier leagues ────────────────
const AS_LEAGUES: Record<number, { name: string; country: string; logo: string }> = {
  // European
  2:   { name: "Champions League",        country: "Europe",        logo: "https://media.api-sports.io/football/leagues/2.png"   },
  3:   { name: "Europa League",           country: "Europe",        logo: "https://media.api-sports.io/football/leagues/3.png"   },
  848: { name: "Conference League",       country: "Europe",        logo: "https://media.api-sports.io/football/leagues/848.png" },
  1:   { name: "FIFA World Cup",          country: "World",         logo: "https://media.api-sports.io/football/leagues/1.png"   },
  4:   { name: "Euro Championship",       country: "Europe",        logo: "https://media.api-sports.io/football/leagues/4.png"   },
  39:  { name: "Premier League",          country: "England",       logo: "https://media.api-sports.io/football/leagues/39.png"  },
  140: { name: "La Liga",                 country: "Spain",         logo: "https://media.api-sports.io/football/leagues/140.png" },
  135: { name: "Serie A",                 country: "Italy",         logo: "https://media.api-sports.io/football/leagues/135.png" },
  78:  { name: "Bundesliga",              country: "Germany",       logo: "https://media.api-sports.io/football/leagues/78.png"  },
  61:  { name: "Ligue 1",                 country: "France",        logo: "https://media.api-sports.io/football/leagues/61.png"  },
  10:  { name: "Championship",            country: "England",       logo: "https://media.api-sports.io/football/leagues/10.png"  },
  94:  { name: "Primeira Liga",           country: "Portugal",      logo: "https://media.api-sports.io/football/leagues/94.png"  },
  88:  { name: "Eredivisie",              country: "Netherlands",   logo: "https://media.api-sports.io/football/leagues/88.png"  },
  // African
  323: { name: "NPFL",                    country: "Nigeria",       logo: "https://media.api-sports.io/football/leagues/323.png" },
  288: { name: "PSL",                     country: "South Africa",  logo: "https://media.api-sports.io/football/leagues/288.png" },
  233: { name: "Egyptian Premier League", country: "Egypt",         logo: "https://media.api-sports.io/football/leagues/233.png" },
  200: { name: "Tunisian Ligue 1",        country: "Tunisia",       logo: "https://media.api-sports.io/football/leagues/200.png" },
  20:  { name: "CAF Champions League",    country: "Africa",        logo: "https://media.api-sports.io/football/leagues/20.png"  },
  21:  { name: "CAF Confederation Cup",   country: "Africa",        logo: "https://media.api-sports.io/football/leagues/21.png"  },
  6:   { name: "Africa Cup of Nations",   country: "Africa",        logo: "https://media.api-sports.io/football/leagues/6.png"   },
  169: { name: "Ghana Premier League",    country: "Ghana",         logo: "https://media.api-sports.io/football/leagues/169.png" },
  // Qualifiers
  815: { name: "Euro Qualifiers",         country: "Europe",        logo: "https://media.api-sports.io/football/leagues/815.png" },
  825: { name: "WC Qualifiers UEFA",      country: "Europe",        logo: "https://media.api-sports.io/football/leagues/825.png" },
  824: { name: "WC Qualifiers CAF",       country: "Africa",        logo: "https://media.api-sports.io/football/leagues/824.png" },
  823: { name: "WC Qualifiers CONMEBOL",  country: "South America", logo: "https://media.api-sports.io/football/leagues/823.png" },
  822: { name: "WC Qualifiers CONCACAF",  country: "Americas",      logo: "https://media.api-sports.io/football/leagues/822.png" },
  910: { name: "International Friendlies",country: "World",         logo: "https://media.api-sports.io/football/leagues/910.png" },
};

const PRIORITY: Record<number, number> = {
  2:1, 3:2, 848:3, 1:4, 4:5,
  39:6, 140:7, 135:8, 78:9, 61:10,
  10:11, 94:12, 88:13, 71:14,
  6:15, 20:16, 21:17,
  815:18, 825:19, 824:20, 823:21, 822:22, 910:23,
  323:24, 288:25, 233:26, 200:27, 169:28,
};

const FD_STATUS: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};
const AS_STATUS: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

function sort(arr: Match[]): Match[] {
  return [...arr].sort((a, b) => {
    const al = a.status==="LIVE"||a.status==="HT", bl = b.status==="LIVE"||b.status==="HT";
    if (al!==bl) return al?-1:1;
    const pa=PRIORITY[a.league?.id]??999, pb=PRIORITY[b.league?.id]??999;
    if (pa!==pb) return pa-pb;
    return new Date(a.date).getTime()-new Date(b.date).getTime();
  });
}
function dedup(arr: Match[]): Match[] {
  const s=new Set<number>(); return arr.filter(m=>{if(s.has(m.id))return false;s.add(m.id);return true;});
}
function addDays(iso: string, n: number): string {
  const d=new Date(iso+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().split("T")[0];
}
function hasLive(arr: Match[]): boolean {
  return arr.some(m=>m.status==="LIVE"||m.status==="HT");
}

// ── How Next.js caching works here ───────────────────────────────────────────
// fetch() calls with `next: { revalidate: N }` are cached by Next.js data cache.
// ALL users share the same cached response until it expires.
// This is what makes 100,000 users possible with minimal API calls.

function fdRevalidate(dateIso: string, live: boolean): number {
  const today = lagosDate();
  if (dateIso < today) return 86400;  // Past: 24h
  if (dateIso > today) return 7200;   // Future: 2h
  return live ? 180 : 1800;           // Today: 3min live / 30min idle
}

function asRevalidate(live: boolean): number {
  return live ? 300 : 21600; // 5min live / 6h idle  → ~8 calls/day max
}

// ── API 1: football-data.org (UNLIMITED) ──────────────────────────────────────

async function fetchFD(dateFrom: string, dateTo: string, fdKey: string, statusFilter?: string): Promise<Match[]> {
  const params = new URLSearchParams({ competitions: FD_CODES, dateFrom, dateTo });
  if (statusFilter) params.set("status", statusFilter);

  // IMPORTANT: dateFrom/dateTo are the correct parameters. ?date= does NOT work.
  const url = `${FD_BASE}/matches?${params}`;

  try {
    const res = await fetch(url, {
      headers: { "X-Auth-Token": fdKey },
      // Next.js data cache — shared across ALL requests until revalidate expires
      next: { revalidate: fdRevalidate(dateFrom, false) },
    });

    if (!res.ok) {
      const body = await res.text().catch(()=>"");
      console.error(`[FD] ${res.status}: ${body.slice(0,300)}`);
      return [];
    }

    const data = await res.json();
    if (data.errorCode) {
      console.error(`[FD] API error ${data.errorCode}: ${data.message}`);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.matches ?? []).map((m: any): Match => {
      const code = m.competition?.code ?? "";
      const meta = FD_COMPS[code] ?? {
        leagueId: m.competition?.id ?? 0,
        name: m.competition?.name ?? "Unknown",
        country: m.area?.name ?? "",
        logo: m.competition?.emblem ?? "",
      };
      return {
        id: m.id,
        date: m.utcDate,
        status: (FD_STATUS[m.status] ?? "NS") as Match["status"],
        homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
        awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
        score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
        league: { id: meta.leagueId, name: meta.name, logo: meta.logo, country: meta.country },
        source: "european",
      };
    }).filter((m: Match) => m.league?.id && m.league.id !== 0);
  } catch (err) {
    console.error("[FD] exception:", err);
    return [];
  }
}

// ── API 2: api-sports.io (LIMITED — 100/day) ──────────────────────────────────

async function fetchAS(date: string, asKey: string, live: boolean): Promise<Match[]> {
  const allowed = new Set(Object.keys(AS_LEAGUES).map(Number));
  try {
    const res = await fetch(
      `${AS_BASE}/fixtures?date=${date}&timezone=Africa/Lagos`,
      {
        headers: { "x-apisports-key": asKey },
        // Long revalidate when no live matches → protects daily quota
        next: { revalidate: asRevalidate(live) },
      }
    );

    if (!res.ok) return [];
    const json = await res.json();

    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn("[AS] quota/errors:", json.errors);
      return [];
    }

    const remaining = res.headers.get("x-ratelimit-requests-remaining");
    console.log(`[AS] quota remaining: ${remaining ?? "unknown"}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.response ?? []).filter((f: any) => allowed.has(f.league?.id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((f: any): Match => {
        const meta = AS_LEAGUES[f.league.id] ?? { name: f.league.name, country: f.league.country, logo: f.league.logo };
        return {
          id: f.fixture.id,
          date: f.fixture.date,
          status: (AS_STATUS[f.fixture.status.short] ?? "NS") as Match["status"],
          homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
          awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
          score: { home: f.goals.home ?? null, away: f.goals.away ?? null },
          league: { id: f.league.id, name: meta.name, logo: meta.logo, country: meta.country },
          source: "african",
        };
      });
  } catch (err) {
    console.error("[AS] exception:", err);
    return [];
  }
}

// ── Response type ─────────────────────────────────────────────────────────────

export interface MatchesApiResponse {
  matches: Match[];
  isFallback: boolean;
  isUpcoming: boolean;
  fallbackReason?: string;
  upcomingFromDate?: string;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const today  = lagosDate();
  const date   = new URL(req.url).searchParams.get("date") ?? today;
  const fdKey  = process.env.FOOTBALL_DATA_API_KEY ?? "";
  const asKey  = process.env.FOOTBALL_API_KEY ?? "";

  try {
    // ── Step 1: Fetch today in parallel — 2 calls, both cached ───────────
    const [fdMatches, asMatches] = await Promise.all([
      fdKey ? fetchFD(date, date, fdKey) : [],
      asKey ? fetchAS(date, asKey, false) : [],
    ]);

    const real = dedup(sort([...fdMatches, ...asMatches]));
    console.log(`[matches] ${date}: FD=${fdMatches.length} AS=${asMatches.length} total=${real.length}`);

    // ── Step 2: If live matches, re-fetch AS with short TTL ───────────────
    // Only costs an extra AS call if there ARE live African matches
    if (hasLive(fdMatches) && asKey) {
      const asLive = await fetchAS(date, asKey, true);
      const withLive = dedup(sort([...fdMatches, ...asLive]));
      if (withLive.length >= 3) {
        return NextResponse.json({ matches: withLive, isFallback: false, isUpcoming: false } as MatchesApiResponse);
      }
    }

    // ── Step 3: Enough matches → return ──────────────────────────────────
    if (real.length >= 3) {
      return NextResponse.json({ matches: real, isFallback: false, isUpcoming: false } as MatchesApiResponse);
    }

    // ── Step 4: Quiet day → fetch upcoming 14 days (FD only, cached 2h) ──
    if (fdKey) {
      const from = date <= today ? today : date;
      const to   = addDays(from, 14);
      const upcoming = await fetchFD(from, to, fdKey, "SCHEDULED,TIMED");

      if (upcoming.length > 0) {
        const combined = dedup(sort([...real, ...upcoming]));
        return NextResponse.json({
          matches: combined, isFallback: false, isUpcoming: true,
          upcomingFromDate: upcoming[0]?.date?.split("T")[0],
        } as MatchesApiResponse);
      }
    }

    // ── Step 5: Both APIs empty → static fallback (never blank page) ─────
    const fallback = generateFallbackUpcoming(today, 7);
    return NextResponse.json({ matches: sort(fallback), isFallback: true, isUpcoming: true, fallbackReason: "api_unavailable" } as MatchesApiResponse);

  } catch (err) {
    console.error("[matches] crash:", err);
    return NextResponse.json({ matches: [], isFallback: true, isUpcoming: false, fallbackReason: "server_error" } as MatchesApiResponse);
  }
}
