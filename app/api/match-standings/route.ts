import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";
const TTL_1H  = 60 * 60 * 1000;

async function fetchStandingsDirect(league: string, season: string, key: string) {
  const res = await fetch(`${AS_BASE}/standings?league=${league}&season=${season}`, {
    headers: { "x-apisports-key": key }, cache: "no-store",
  });
  const data = await res.json();

  // Log errors for debugging
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("standings API errors:", data.errors);
    throw new Error(JSON.stringify(data.errors));
  }

  return data.response?.[0]?.league?.standings?.[0] ?? [];
}

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const league = url.searchParams.get("league");
  const season = url.searchParams.get("season");
  if (!league || !season) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  const cacheKey = `standings:${league}:${season}`;
  
  // Try Redis first
  try {
    const redisData = await getCached(cacheKey);
    if (redisData) return NextResponse.json(redisData, { headers: { "X-Cache": "REDIS" } });
  } catch (err) {
    console.warn("[standings] Redis check failed (non-blocking):", err);
  }
  
  const cached   = getCache(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

  const key = process.env.FOOTBALL_DATA_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const standings = await flock(
      `match-standings:${league}:${season}`,
      () => fetchStandingsDirect(league, season, key),
      6 * 60 * 60 * 1000 // 6-hour cache for standings
    );
    
    setCache(cacheKey, standings, TTL_1H);
    
    // Cache to Redis
    try {
      await setCached(cacheKey, standings, TTL_1H / 1000);
    } catch (redisErr) {
      console.warn("[standings] Redis cache failed (non-blocking):", redisErr);
    }
    
    return NextResponse.json(standings, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("standings error:", err);
    return NextResponse.json([], { status: 200 });
  }
}