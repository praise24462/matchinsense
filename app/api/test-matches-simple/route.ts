/**
 * /api/test-matches-simple
 * 
 * Simplified endpoint to test European matches directly
 * Bypasses caching and flocking to isolate the issue
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";

const FD_BASE = "https://api.football-data.org/v4";

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED: "FT",
  IN_PLAY: "LIVE",
  PAUSED: "HT",
  SCHEDULED: "NS",
  TIMED: "NS",
  POSTPONED: "PST",
  CANCELLED: "CANC",
  SUSPENDED: "PST",
};

export async function GET(req: NextRequest) {
  const today = new Date().toISOString().split("T")[0];
  const date = new URL(req.url).searchParams.get("date") ?? today;
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  console.log(`[test-matches-simple] Testing date: ${date}, Key present: ${!!fdKey}`);

  if (!fdKey) {
    return NextResponse.json(
      { error: "FOOTBALL_DATA_API_KEY not configured", date },
      { status: 400 }
    );
  }

  try {
    // Test single competition
    const comp = { code: "PL", name: "Premier League" };
    console.log(`[test-matches-simple] Fetching ${comp.code}...`);

    const res = await fetch(
      `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
      {
        headers: { "X-Auth-Token": fdKey },
        next: { revalidate: 1 },
      }
    );

    console.log(`[test-matches-simple] Response status: ${res.status}`);

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Football-Data API returned ${res.status}`,
          date,
          competition: comp.code,
          url: `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
        },
        { status: res.status }
      );
    }

    const data = await res.json();
    console.log(
      `[test-matches-simple] Response has ${data.matches?.length ?? 0} matches`
    );

    return NextResponse.json(
      {
        success: true,
        date,
        competition: comp.code,
        matchCount: data.matches?.length ?? 0,
        matches: (data.matches ?? [])
          .map((m: any) => ({
            id: m.id,
            teams: `${m.homeTeam.shortName ?? m.homeTeam.name} vs ${m.awayTeam.shortName ?? m.awayTeam.name}`,
            date: m.utcDate,
            status: FD_STATUS_MAP[m.status] ?? "NS",
          }))
          .slice(0, 5),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error(`[test-matches-simple] Error:`, err);
    return NextResponse.json(
      {
        error: err.message,
        stack: err.stack,
      },
      { status: 500 }
    );
  }
}
