/**
 * /api/upcoming-matches
 *
 * Fetches upcoming European fixtures for the next 7 days
 * Uses Football-Data.org API (unlimited)
 *
 * Returns: Match[]
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { dbGet, dbSet } from "@/services/dbCache";
import { flock } from "@/services/requestFlocking";

const FD_BASE = "https://api.football-data.org/v4";

const FD_COMPETITIONS = [
  { code: "CL",  leagueId: 2,   name: "Champions League",  country: "Europe"  },
  { code: "EL",  leagueId: 3,   name: "Europa League",     country: "Europe"  },
  { code: "EC",  leagueId: 4,   name: "Euro Championship", country: "Europe"  },
  { code: "WC",  leagueId: 1,   name: "FIFA World Cup",    country: "World"   },
  { code: "PL",  leagueId: 39,  name: "Premier League",    country: "England" },
  { code: "PD",  leagueId: 140, name: "La Liga",           country: "Spain"   },
  { code: "SA",  leagueId: 135, name: "Serie A",           country: "Italy"   },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",        country: "Germany" },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",           country: "France"  },
];

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

const FD_LEAGUE_MAP: Record<string, { id: number; leagueId: number; name: string; country: string; logo: string }> = {
  CL:  { id: 2,   leagueId: 2,   name: "Champions League",  country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  EL:  { id: 3,   leagueId: 3,   name: "Europa League",     country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  EC:  { id: 4,   leagueId: 4,   name: "Euro Championship", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/4.png"   },
  WC:  { id: 1,   leagueId: 1,   name: "FIFA World Cup",    country: "World",   logo: "https://media.api-sports.io/football/leagues/1.png"   },
  PL:  { id: 39,  leagueId: 39,  name: "Premier League",    country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  PD:  { id: 140, leagueId: 140, name: "La Liga",           country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  SA:  { id: 135, leagueId: 135, name: "Serie A",           country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  BL1: { id: 78,  leagueId: 78,  name: "Bundesliga",        country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  FL1: { id: 61,  leagueId: 61,  name: "Ligue 1",           country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
};

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

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export async function GET(req: NextRequest) {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  if (!fdKey) {
    return NextResponse.json({ error: "Missing API key" }, { status: 500 });
  }

  try {
    const today = localDate();
    const nextWeek = addDays(today, 7);
    const cacheKey = `upcoming-matches:${today}:${nextWeek}`;

    // Try database cache first
    try {
      const cached = await dbGet<Match[]>(cacheKey);
      if (cached) {
        console.log("[upcoming-matches] Cache HIT");
        return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
      }
    } catch (cacheErr) {
      console.warn("[upcoming-matches] Cache read failed:", cacheErr);
    }

    // Use request flocking to deduplicate simultaneous requests
    const results = await flock(
      `upcoming-matches:fetch:${today}`,
      () => Promise.allSettled(
      FD_COMPETITIONS.map(comp =>
        fetch(
          `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${today}&dateTo=${nextWeek}&status=SCHEDULED,TIMED`,
          {
            headers: { "X-Auth-Token": fdKey },
            next: { revalidate: 300 }, // Cache for 5 minutes
          }
        )
          .then(res => {
            if (!res.ok) throw new Error(`FD ${res.status}`);
            return res.json();
          })
          .then(data => {
            const matches = (data.matches ?? []) as any[];
            return matches.map(m => {
              const leagueInfo = FD_LEAGUE_MAP[comp.code] ?? { id: 0, leagueId: 0, name: comp.name, country: comp.country, logo: "" };
              return {
                id: m.id,
                date: m.utcDate,
                status: (FD_STATUS_MAP[m.status] ?? "NS") as any,
                homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
                awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
                score: { home: null, away: null },
                halfTimeScore: { home: null, away: null },
                league: { id: leagueInfo.id, name: leagueInfo.name, country: leagueInfo.country, logo: leagueInfo.logo },
                source: "european",
                statistics: [],
                events: [],
              };
            }) as Match[];
          })
          .catch(err => {
            console.error(`[upcoming-matches] Error fetching ${comp.code}:`, err.message);
            return [];
          })
      )
      ),
      300 // 5 minute flocking TTL
    );

    // Flatten and deduplicate
    const all: Match[] = [];
    const seen = new Set<number>();
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const match of result.value) {
          if (!seen.has(match.id)) {
            all.push(match);
            seen.add(match.id);
          }
        }
      }
    }

    // Sort by date
    all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const sliced = all.slice(0, 30);

    // Cache for 5 minutes (upcoming matches may change frequently)
    try {
      await dbSet(cacheKey, sliced, 300);
    } catch (cacheErr) {
      console.warn("[upcoming-matches] Cache write failed:", cacheErr);
    }

    return NextResponse.json(sliced, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        "X-Cache": "MISS",
      },
    });
  } catch (err: any) {
    console.error("[upcoming-matches] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch upcoming matches" }, { status: 500 });
  }
}
