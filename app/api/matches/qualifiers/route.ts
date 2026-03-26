/**
 * /api/matches/qualifiers?date=YYYY-MM-DD
 *
 * ✨ World Cup & Euro Qualifiers (api-sports.io source)
 * - football-data.org free API does NOT include qualifier competitions
 * - Using api-sports.io which has full international qualifier coverage
 * - Cached for 5 minutes with fallback
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";

const APISPORTS_BASE = "https://v3.football.api-sports.io";

const QUALIFIER_LEAGUES = [
  { id: 1, name: "World Cup", country: "World", logo: "https://media.api-sports.io/football/leagues/1.png" },
  { id: 4, name: "Euro Championship", country: "Europe", logo: "https://media.api-sports.io/football/leagues/4.png" },
];

const APISPORTS_STATUS_MAP: Record<string, string> = {
  "Match Finished": "FT",
  "Match Finished After Extra Time": "FT",
  "Match Finished After Penalties": "FT",
  "In Progress": "LIVE",
  "Halftime": "HT",
  "Not Started": "NS",
  "Postponed": "PST",
  "Cancelled": "CANC",
  "Suspended": "PST",
};

function localDate(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

async function fetchQualifiersFromApiSports(date: string, apiKey: string): Promise<Match[]> {
  const results = await Promise.allSettled(
    QUALIFIER_LEAGUES.map(league =>
      fetch(
        `${APISPORTS_BASE}/fixtures?league=${league.id}&date=${date}`,
        {
          headers: { "x-apisports-key": apiKey },
          next: { revalidate: 300 },
        }
      ).then(async res => {
        if (!res.ok) {
          console.warn(`[qualifiers] League ${league.id} returned ${res.status}`);
          return [] as Match[];
        }
        const data = await res.json();
        const fixtures = data.response ?? [];
        console.log(`[qualifiers] ${league.name}: ${fixtures.length} matches`);
        
        return fixtures.map((f: any): Match => {
          const homeTeam = f.teams?.home || {};
          const awayTeam = f.teams?.away || {};
          const goals = f.goals || {};
          
          return {
            id: f.fixture?.id,
            date: f.fixture?.date,
            status: (APISPORTS_STATUS_MAP[f.fixture?.status?.long] ?? "NS") as Match["status"],
            homeTeam: {
              id: homeTeam.id || 0,
              name: homeTeam.name || "Unknown",
              logo: homeTeam.logo || "",
            },
            awayTeam: {
              id: awayTeam.id || 0,
              name: awayTeam.name || "Unknown",
              logo: awayTeam.logo || "",
            },
            score: {
              home: goals.home ?? null,
              away: goals.away ?? null,
            },
            league: {
              id: league.id,
              name: league.name,
              logo: league.logo,
              country: league.country,
            },
            source: "qualifiers",
          };
        });
      }).catch(e => {
        console.error(`[qualifiers] ${league.name} error:`, e.message);
        return [] as Match[];
      })
    )
  );

  const all: Match[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  return all.filter(m => m?.league?.id != null);
}

export interface QualifiersResponse {
  matches: Match[];
  source: string;
}

export async function GET(req: NextRequest) {
  const today = localDate();
  const date = new URL(req.url).searchParams.get("date") ?? today;
  const apiKey = process.env.FOOTBALL_API_KEY ?? "";

  console.log(`[qualifiers] Date: ${date}, Has API Key: ${!!apiKey}`);

  try {
    const qualifiers = apiKey ? await fetchQualifiersFromApiSports(date, apiKey) : [];

    console.log(`[qualifiers] Total: ${qualifiers.length} matches for ${date}`);

    const payload: QualifiersResponse = {
      matches: qualifiers,
      source: "api-sports.io",
    };

    return NextResponse.json(payload, {
      headers: {
        "X-Date": date,
        "X-Total": String(qualifiers.length),
        "X-Source": "World Cup & Euro Qualifiers (api-sports.io)",
      },
    });
  } catch (err: any) {
    console.error("[qualifiers] Error:", err);
    return NextResponse.json(
      { matches: [], source: "error" } as QualifiersResponse,
      { status: 500 }
    );
  }
}
