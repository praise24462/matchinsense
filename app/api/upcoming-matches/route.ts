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

const FD_LEAGUE_MAP: Record<string, { leagueId: number; name: string; country: string }> = {
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe"  },
  EL:  { leagueId: 3,   name: "Europa League",     country: "Europe"  },
  EC:  { leagueId: 4,   name: "Euro Championship", country: "Europe"  },
  WC:  { leagueId: 1,   name: "FIFA World Cup",    country: "World"   },
  PL:  { leagueId: 39,  name: "Premier League",    country: "England" },
  PD:  { leagueId: 140, name: "La Liga",           country: "Spain"   },
  SA:  { leagueId: 135, name: "Serie A",           country: "Italy"   },
  BL1: { leagueId: 78,  name: "Bundesliga",        country: "Germany" },
  FL1: { leagueId: 61,  name: "Ligue 1",           country: "France"  },
};

function localDate(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
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

    // Fetch upcoming matches from all European competitions
    const results = await Promise.allSettled(
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
            return matches.map(m => ({
              id: m.id,
              date: m.utcDate,
              status: (FD_STATUS_MAP[m.status] ?? "NS") as any,
              homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
              awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
              score: { home: null, away: null },
              halfTimeScore: { home: null, away: null },
              league: FD_LEAGUE_MAP[comp.code] ?? { leagueId: 0, name: comp.name, country: comp.country },
              source: "euro",
              statistics: [],
              events: [],
            })) as Match[];
          })
          .catch(err => {
            console.error(`[upcoming-matches] Error fetching ${comp.code}:`, err.message);
            return [];
          })
      )
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

    return NextResponse.json(all.slice(0, 30), {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch (err: any) {
    console.error("[upcoming-matches] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch upcoming matches" }, { status: 500 });
  }
}
