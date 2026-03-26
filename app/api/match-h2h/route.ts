import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache, TTL } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";

async function fetchH2hDirect(h2h: string, key: string) {
  const res  = await fetch(`${AS_BASE}/fixtures/headtohead?h2h=${h2h}&last=10`, {
    headers: { "x-apisports-key": key }, cache: "no-store",
  });
  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("h2h API errors:", data.errors);
    throw new Error(JSON.stringify(data.errors));
  }

  return (data.response ?? []).map((f: any) => ({
    id:       f.fixture.id,
    date:     f.fixture.date,
    status:   f.fixture.status?.short,
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    league:   { name: f.league.name, logo: f.league.logo },
  }));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const h2h = url.searchParams.get("h2h");
  if (!h2h) return NextResponse.json({ error: "Missing h2h" }, { status: 400 });

  const cacheKey = `h2h:${h2h}`;
  
  // Try Redis first
  try {
    const redisData = await getCached(cacheKey);
    if (redisData) return NextResponse.json(redisData, { headers: { "X-Cache": "REDIS" } });
  } catch (err) {
    console.warn("[h2h] Redis check failed (non-blocking):", err);
  }
  
  const cached   = getCache(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

  const key = process.env.FOOTBALL_DATA_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const fixtures = await flock(
      `match-h2h:${h2h}`,
      () => fetchH2hDirect(h2h, key),
      24 * 60 * 60 * 1000 // 24-hour cache for H2H stats
    );
    
    setCache(cacheKey, fixtures, TTL.PAST);
    
    // Cache to Redis
    try {
      await setCached(cacheKey, fixtures, TTL.PAST / 1000);
    } catch (redisErr) {
      console.warn("[h2h] Redis cache failed (non-blocking):", redisErr);
    }
    
    return NextResponse.json(fixtures, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("h2h error:", err);
    return NextResponse.json([], { status: 200 });
  }
}