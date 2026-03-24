/**
 * /api/matches/upcoming
 *
 * Fetches full season upcoming matches from European unlimited API competitions
 * (Football-Data.org) for the next 365 days (entire season)
 */

import { NextResponse } from "next/server";
import type { Match } from "@/types";

const FD_BASE = "https://api.football-data.org/v4";

const FD_COMPETITIONS = [
  { code: "CL",  leagueId: 2,   name: "Champions League",  country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  { code: "EL",  leagueId: 3,   name: "Europa League",     country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  { code: "EC",  leagueId: 4,   name: "Euro Championship", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/4.png"   },
  { code: "WC",  leagueId: 1,   name: "FIFA World Cup",    country: "World",   logo: "https://media.api-sports.io/football/leagues/1.png"   },
  { code: "PL",  leagueId: 39,  name: "Premier League",    country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  { code: "PD",  leagueId: 140, name: "La Liga",           country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  { code: "SA",  leagueId: 135, name: "Serie A",           country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",        country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",           country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
];

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
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

async function fetchEuropeanUpcoming(fdKey: string): Promise<Match[]> {
  const today = localDate();
  const dateFrom = today;
  const dateTo = addDays(today, 365); // Full season (365 days ahead)

  const results = await Promise.allSettled(
    FD_COMPETITIONS.map(comp =>
      fetch(
        `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED,TIMED`,
        {
          headers: { "X-Auth-Token": fdKey },
          next: { revalidate: 300 },
        }
      )
        .then(r => r.json())
        .then(data => {
          const matches = (data.matches ?? []) as any[];
          return matches.map(f => ({
            id: f.id,
            date: f.utcDate,
            status: (FD_STATUS_MAP[f.status] ?? "NS") as Match["status"],
            homeTeam: { id: f.homeTeam.id, name: f.homeTeam.shortName ?? f.homeTeam.name, logo: f.homeTeam.crest ?? "" },
            awayTeam: { id: f.awayTeam.id, name: f.awayTeam.shortName ?? f.awayTeam.name, logo: f.awayTeam.crest ?? "" },
            score: { home: null, away: null },
            halfTimeScore: { home: null, away: null },
            league: { id: comp.leagueId, name: comp.name, logo: comp.logo, country: comp.country },
            source: "euro" as const,
            statistics: [],
            events: [],
            venue: f.venue ?? undefined,
            referee: f.referees?.[0]?.name ?? undefined,
          }));
        })
        .catch(() => [])
    )
  );

  const allMatches: Match[] = results
    .filter((r) => r.status === "fulfilled")
    .flatMap((r) => (r as any).value ?? []);

  // Sort by date, then by priority competitions
  return allMatches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export async function GET() {
  try {
    const fdKey = process.env.FOOTBALL_DATA_API_KEY;
    if (!fdKey) {
      return NextResponse.json({ matches: [], error: "Missing API key" }, { status: 400 });
    }

    const matches = await fetchEuropeanUpcoming(fdKey);

    return NextResponse.json({ matches, count: matches.length });
  } catch (err: any) {
    console.error("[upcoming-matches]", err.message);
    return NextResponse.json(
      { matches: [], error: err.message },
      { status: 500 }
    );
  }
}
