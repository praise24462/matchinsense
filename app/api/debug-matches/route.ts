import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url  = new URL(req.url);
  const date = url.searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const key  = process.env.FOOTBALL_DATA_API_KEY ?? "";

  if (!key) return NextResponse.json({ error: "No FOOTBALL_DATA_API_KEY" });

  try {
    // Check health
    let healthStatus: any = null;
    let healthError: any = null;
    try {
      const protocol = req.nextUrl.protocol;
      const host = req.headers.get("host") || "localhost:3000";
      const healthUrl = `${protocol}//${host}/api/health`;
      const healthRes = await fetch(healthUrl);
      healthStatus = await healthRes.json();
    } catch (e: any) {
      healthError = e.message;
    }

    const res  = await fetch(`https://v3.football.api-sports.io/fixtures?date=${date}`, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });
    const raw  = await res.json();
    const fixtures = raw.response ?? [];

    // Also check what /api/matches returns
    let matchesResponse: any = null;
    let matchesError: any = null;
    let matchesStatus: number = 0;
    try {
      const protocol = req.nextUrl.protocol;
      const host = req.headers.get("host") || "localhost:3000";
      const matchesUrl = `${protocol}//${host}/api/matches?date=${date}`;
      const matchesRes = await fetch(matchesUrl);
      matchesStatus = matchesRes.status;
      matchesResponse = await matchesRes.json();
    } catch (e: any) {
      matchesError = e.message;
    }

    return NextResponse.json({
      date,
      health: {
        status: healthStatus,
        error: healthError,
      },
      apiCall: {
        httpStatus:    res.status,
        apiErrors:     raw.errors,
        total:         raw.results,
        fixtureCount:  fixtures.length,
        quotaRemaining: res.headers.get("x-ratelimit-requests-remaining"),
      },
      matchesEndpoint: {
        status: matchesStatus,
        response: matchesResponse?.slice ? matchesResponse.slice(0, 3) : matchesResponse, // Show first 3 matches only
        error: matchesError,
        isArray: Array.isArray(matchesResponse),
      },
      todaysMatches: fixtures.map((f: any) => ({
        id: f.id,
        league: { id: f.league.id, name: f.league.name, country: f.league.country },
        home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
        away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
        status: f.fixture.status,
        timestamp: f.fixture.timestamp,
        dateTime: f.fixture.date,
      })).slice(0, 50), // Show first 50 matches
      nigerianFixtureCount: fixtures.filter((f: any) => f.league?.country === "Nigeria").length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message });
  }
}