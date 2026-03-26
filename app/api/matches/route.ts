/**
 * /api/matches?date=YYYY-MM-DD
 *
 * ✨ OPTIMIZED STRATEGY (Mar 2026):
 * - PRIMARY ONLY: Major global competitions with betting/prediction interest
 * - LAZY-LOAD: African matches only on-demand via /api/matches/african
 *
 * Competitions included (betting & prediction focus):
 * - World Cup, Euro Championship (international)
 * - Champions League, Europa League (club)
 * - Top 5 leagues: PL, La Liga, Serie A, Bundesliga, Ligue 1
 * - Secondary markets: Championship, Primeira Liga, Brasileirão
 *
 * Caching: Next.js fetch revalidation 5 minutes
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";

const FD_BASE = "https://api.football-data.org/v4";

/** Major competitions with GLOBAL betting/prediction interest only */
const FD_COMPETITIONS = [
  // ── International Tournaments (Highest Priority) ─────────────────────────
  { code: "WC",  leagueId: 1,   name: "FIFA World Cup",    country: "World",   logo: "https://media.api-sports.io/football/leagues/1.png"   },
  { code: "EC",  leagueId: 4,   name: "Euro Championship", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/4.png"   },
  
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
  // UTC time as fallback
  return new Date().toISOString().split("T")[0];
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
        if (!res.ok) return [] as Match[];
        const data = await res.json();
        return (data.matches ?? []).map((m: any): Match => ({
          id: m.id,
          date: m.utcDate,
          status: (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
          homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
          awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
          score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
          league: { id: comp.leagueId, name: comp.name, logo: comp.logo, country: comp.country },
          source: "euro",
        }));
      }).catch(() => [] as Match[])
    )
  );
  const all: Match[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  // Guard: skip any entry with a missing league (prevents downstream crashes)
  return all.filter(m => m?.league?.id != null);
}

// ✨ Upcoming fetcher removed — frontend handles pagination and date navigation

// ✨ African fetching moved to /api/matches/african (lazy-loaded on-demand)

// ── Response type ────────────────────────────────────────────────────────────

export interface MatchesApiResponse {
  matches: Match[];
  isFallback: boolean;
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const today = localDate();
  const date = new URL(req.url).searchParams.get("date") ?? today;
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  try {
    // ── Fetch MAJOR global competitions ONLY ──────────────────────────────────
    const euMatches = fdKey ? await fetchEuropeanForDate(date, fdKey) : [];

    const payload: MatchesApiResponse = {
      matches: sortMatches(euMatches),
      isFallback: false,
    };

    return NextResponse.json(payload, {
      headers: {
        "X-Total": String(euMatches.length),
        "X-Source": "Major global competitions (football-data.org)",
        "X-Note": "African matches available at /api/matches/african",
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