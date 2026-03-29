/**
 * /api/matches?date=YYYY-MM-DD
 *
 * ✨ OPTIMIZED STRATEGY (Mar 2026):
 * - PRIMARY ONLY: Major global competitions with betting/prediction interest
 * - LAZY-LOAD: African matches only on-demand via /api/matches/african
 * - CACHING: Request flocking + DB cache to minimize API quota usage
 *
 * Competitions included (betting & prediction focus):
 * - World Cup, Euro Championship (international)
 * - Champions League, Europa League (club)
 * - Top 5 leagues: PL, La Liga, Serie A, Bundesliga, Ligue 1
 * - Secondary markets: Championship, Primeira Liga, Brasileirão
 *
 * Caching:
 * - Live/In-Play: 60 seconds (changes frequently)
 * - Finished matches: 24 hours (score locked)
 * - Upcoming: 5 minutes (teams/lineups may change)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { fetchAfricanMatches } from "@/services/africanApi";
import { dbGet, dbSet } from "@/services/dbCache";
import { flock } from "@/services/requestFlocking";
import type { NormalizedMatch, FallbackReason } from "@/types/matches";

const FD_BASE = "https://api.football-data.org/v4";

/** Major competitions with GLOBAL betting/prediction interest only */
const FD_COMPETITIONS = [
  // ── International Tournaments (Highest Priority) ─────────────────────────
  { code: "WC",  leagueId: 1,   name: "FIFA World Cup",    country: "World",   logo: "https://media.api-sports.io/football/leagues/1.png"   },
  { code: "EC",  leagueId: 4,   name: "Euro Championship", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/4.png"   },
  
  // ✨ NOTE: World Cup/Euro Qualifiers available via api-sports.io only
  // football-data.org free API doesn't include qualifier competitions
  
  // ── European Club Competitions ───────────────────────────────────────────
  { code: "CL",  leagueId: 2,   name: "Champions League",  country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  { code: "EL",  leagueId: 3,   name: "Europa League",     country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  
  // ── Top 5 European Leagues (Major Betting Markets) ──────────────────────
  { code: "PL",  leagueId: 39,  name: "Premier League",    country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  { code: "PD",  leagueId: 140, name: "La Liga",           country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  { code: "SA",  leagueId: 135, name: "Serie A",           country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",        country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",           country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
  
  // ── Secondary Betting Markets ────────────────────────────────────────────
  { code: "ELC", leagueId: 10,  name: "Championship",      country: "England", logo: "https://media.api-sports.io/football/leagues/10.png"  },
  { code: "PPL", leagueId: 94,  name: "Primeira Liga",     country: "Portugal", logo: "https://media.api-sports.io/football/leagues/94.png" },
  { code: "BSA", leagueId: 71,  name: "Brasileirão",       country: "Brazil",  logo: "https://media.api-sports.io/football/leagues/71.png"  },
];

// ✨ Priority ordering for sorting (by leagueId)
const PRIORITY: Record<number, number> = {
  1:1,    // World Cup
  4:2,    // Euro Championship
  2:3,    // Champions League
  3:4,    // Europa League
  39:5,   // Premier League
  140:6,  // La Liga
  135:7,  // Serie A
  78:8,   // Bundesliga
  61:9,   // Ligue 1
  10:10,  // Championship
  94:11,  // Primeira Liga
  71:12,  // Brasileirão
};

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDate(): string {
  // Get today's date in Lagos timezone (UTC+1)
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  
  // Account for Lagos timezone (UTC+1)
  const utcHour = now.getUTCHours();
  const lagosHour = (utcHour + 1) % 24;
  
  // If Lagos hour rolled to next day, add 1 day
  if (lagosHour < utcHour) {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    return `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
  }
  
  return `${year}-${month}-${day}`;
}

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const aLive = a.status === "LIVE" || a.status === "HT";
    const bLive = b.status === "LIVE" || b.status === "HT";
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    const aPri = PRIORITY[a.league?.id] ?? 50;
    const bPri = PRIORITY[b.league?.id] ?? 50;
    if (aPri !== bPri) return aPri - bPri;
    if (a.status === "FT" && b.status !== "FT") return -1;
    if (a.status !== "FT" && b.status === "FT") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// ── Convert NormalizedMatch to Match ──────────────────────────────────────────

function convertNormalizedMatch(nm: NormalizedMatch): Match {
  // Extract numeric ID from af-{id} format
  let numericId = 0;
  if (nm.id.startsWith('af-')) {
    const extracted = parseInt(nm.id.substring(3)); // Remove 'af-' prefix
    if (!isNaN(extracted) && extracted > 0) {
      numericId = extracted;
    }
  }
  
  if (numericId === 0) {
    console.error(`[convertNormalizedMatch] Failed to extract numeric ID from: ${nm.id}`);
  }

  return {
    id: numericId,
    date: nm.utcDate,
    status: nm.status === "FINISHED" ? "FT" : nm.status === "LIVE" ? "LIVE" : nm.status === "IN_PLAY" ? "LIVE" : "NS",
    homeTeam: {
      id: typeof nm.homeTeam.id === 'string' ? parseInt(nm.homeTeam.id) || 0 : nm.homeTeam.id,
      name: nm.homeTeam.name,
      logo: nm.homeTeam.crest || "",
    },
    awayTeam: {
      id: typeof nm.awayTeam.id === 'string' ? parseInt(nm.awayTeam.id) || 0 : nm.awayTeam.id,
      name: nm.awayTeam.name,
      logo: nm.awayTeam.crest || "",
    },
    score: {
      home: nm.score.fullTime.home,
      away: nm.score.fullTime.away,
    },
    league: {
      id: typeof nm.competition.id === 'string' ? parseInt(nm.competition.id) || 0 : nm.competition.id,
      name: nm.competition.name,
      logo: nm.competition.emblem || "",
      country: nm.competition.country || "",
    },
    source: nm.source === "african" ? "african" : "european",
  };
}

// ── European fetcher (one date) ───────────────────────────────────────────────

async function fetchEuropeanForDate(date: string, fdKey: string): Promise<Match[]> {
  const results = await Promise.allSettled(
    FD_COMPETITIONS.map(comp =>
      fetch(
        `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
        {
          headers: { "X-Auth-Token": fdKey },
          // Cache for 5 min on live days, longer on past/future
          next: { revalidate: 300 },
        }
      ).then(async res => {
        if (!res.ok) {
          console.warn(`[fetchEuropean] ${comp.code} returned ${res.status}`);
          return [] as Match[];
        }
        const data = await res.json();
        const matchCount = data.matches?.length ?? 0;
        console.log(`[fetchEuropean] ${comp.code}: ${matchCount} matches`);
        return (data.matches ?? []).map((m: any): Match => ({
          id: m.id,
          date: m.utcDate,
          status: (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
          homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
          awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
          score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
          league: { id: comp.leagueId, name: comp.name, logo: comp.logo, country: comp.country },
          source: "european",
        }));
      }).catch(e => {
        console.error(`[fetchEuropean] ${comp.code} error:`, e.message);
        return [] as Match[];
      })
    )
  );
  const all: Match[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  // Guard: skip any entry with a missing league (prevents downstream crashes)
  return all.filter(m => m?.league?.id != null);
}

// ── API-Sports fetcher for qualifiers ─────────────────────────────────────────

async function fetchQualifiersFromApiSports(date: string, apiKey: string): Promise<Match[]> {
  if (!apiKey) return [];
  
  console.log(`[fetchQualifiers] Starting fetch for ${date}`);
  
  // ✨ League IDs for international qualifiers & friendlies from api-sports.io
  const QUALIFIER_LEAGUES = [
    // World Cup Qualifiers (regional)
    { id: 821, name: "WC Qualifiers AFC", country: "Asia", logo: "https://media.api-sports.io/football/leagues/821.png" },
    { id: 822, name: "WC Qualifiers CONCACAF", country: "Americas", logo: "https://media.api-sports.io/football/leagues/822.png" },
    { id: 823, name: "WC Qualifiers CONMEBOL", country: "South America", logo: "https://media.api-sports.io/football/leagues/823.png" },
    { id: 824, name: "WC Qualifiers CAF", country: "Africa", logo: "https://media.api-sports.io/football/leagues/824.png" },
    { id: 825, name: "WC Qualifiers UEFA", country: "Europe", logo: "https://media.api-sports.io/football/leagues/825.png" },
    { id: 826, name: "WC Qualifiers OFC", country: "Oceania", logo: "https://media.api-sports.io/football/leagues/826.png" },
    { id: 827, name: "WC Playoffs", country: "World", logo: "https://media.api-sports.io/football/leagues/827.png" },
    
    // Euro Qualifiers
    { id: 815, name: "Euro Qualifiers", country: "Europe", logo: "https://media.api-sports.io/football/leagues/815.png" },
    
    // International Friendlies
    { id: 910, name: "International Friendlies", country: "World", logo: "https://media.api-sports.io/football/leagues/910.png" },
  ];

  const results = await Promise.allSettled(
    QUALIFIER_LEAGUES.map(league =>
      fetch(
        `https://v3.football.api-sports.io/fixtures?league=${league.id}&date=${date}`,
        { headers: { "x-apisports-key": apiKey }, next: { revalidate: 300 } }
      ).then(async res => {
        if (!res.ok) {
          console.warn(`[fetchQualifiers] ${league.name} (${league.id}) returned ${res.status}`);
          return [] as Match[];
        }
        const data = await res.json();
        const fixtures = data.response ?? [];
        console.log(`[fetchQualifiers] ${league.name} (${league.id}): ${fixtures.length} matches`);
        
        return fixtures.map((f: any): Match => ({
          id: f.fixture?.id,
          date: f.fixture?.date,
          status: (FD_STATUS_MAP[f.fixture?.status?.long] ?? "NS") as Match["status"],
          homeTeam: {
            id: f.teams?.home?.id || 0,
            name: f.teams?.home?.name || "Unknown",
            logo: f.teams?.home?.logo || "",
          },
          awayTeam: {
            id: f.teams?.away?.id || 0,
            name: f.teams?.away?.name || "Unknown",
            logo: f.teams?.away?.logo || "",
          },
          score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
          league: { id: league.id, name: league.name, logo: league.logo, country: league.country },
          source: "european",
        }));
      }).catch(e => {
        console.error(`[fetchQualifiers] ${league.name} error:`, e.message);
        return [] as Match[];
      })
    )
  );

  const all: Match[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  return all.filter(m => m?.league?.id != null);
}

// ✨ Upcoming fetcher removed — frontend handles pagination and date navigation

// ✨ African fetching moved to /api/matches/african (lazy-loaded on-demand)

// ── Response type ────────────────────────────────────────────────────────────

export interface MatchesApiResponse {
  matches: Match[];
  isFallback: boolean;
  fallbackReason?: FallbackReason;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const today = localDate();
  const date = new URL(req.url).searchParams.get("date") ?? today;
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  const apiSportsKey = process.env.FOOTBALL_API_KEY ?? "";

  console.log(`[matches] Today: ${today}, Requested: ${date}, Has FD Key: ${!!fdKey}, Has API-Sports Key: ${!!apiSportsKey}`);

  const cacheKey = `matches:${date}`;
  
  try {
    // Try to get from cache first
    try {
      const cached = await dbGet<MatchesApiResponse>(cacheKey);
      if (cached) {
        console.log(`[matches] Cache HIT for ${date}`);
        return NextResponse.json(cached, {
          headers: {
            "X-Cache": "HIT",
            "X-Date": date,
            "X-Total": String(cached.matches.length),
          },
        });
      }
    } catch (cacheErr: any) {
      console.warn(`[matches] Cache read error (continuing):`, cacheErr.message);
    }

    // Not in cache, fetch with request flocking to deduplicate simultaneous requests
    const payload = await flock(
      `matches:fetch:${date}`,
      async () => {
        // ── Fetch from ALL sources in parallel ────
        const [euMatches, qualifierMatches, africanResult] = await Promise.all([
          fdKey ? fetchEuropeanForDate(date, fdKey) : Promise.resolve([]),
          apiSportsKey ? fetchQualifiersFromApiSports(date, apiSportsKey) : Promise.resolve([]),
          apiSportsKey ? fetchAfricanMatches(date) : Promise.resolve({ ok: false, reason: "african_error" }),
        ]);

        const africanMatches = (africanResult as any)?.ok ? (africanResult as any).matches.map(convertNormalizedMatch) : [];
        const allMatches = [...euMatches, ...qualifierMatches, ...africanMatches];
        console.log(`[matches] Total: ${allMatches.length} matches (EU: ${euMatches.length}, Qualifiers: ${qualifierMatches.length}, African: ${africanMatches.length})`);

        return {
          matches: sortMatches(allMatches),
          isFallback: false,
        } as MatchesApiResponse;
      },
      300 // 5 min TTL for simultaneous request dedup
    );

    // Cache the result with TTL based on whether it's today
    try {
      const isToday = date === today;
      const ttl = isToday ? 300 : 3600; // 5 min for today, 1 hour for past/future
      await dbSet(cacheKey, payload, ttl);
      console.log(`[matches] Cached ${date} with TTL ${ttl}s`);
    } catch (cacheErr: any) {
      console.warn(`[matches] Cache write error (continuing):`, cacheErr.message);
    }

    return NextResponse.json(payload, {
      headers: {
        "X-Cache": "MISS",
        "X-Date": date,
        "X-Total": String(payload.matches.length),
        "X-Source": "Major competitions + Qualifiers + African leagues (football-data.org + api-sports.io)",
      },
    });
  } catch (err: any) {
    console.error("[matches] Error:", err);
    return NextResponse.json(
      { matches: [], isFallback: false } as MatchesApiResponse,
      { status: 500 }
    );
  }
}