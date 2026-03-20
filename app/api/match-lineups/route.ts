/**
 * /api/match-lineups?fixture=ID
 * Returns starting XI + substitutes for both teams.
 * Cached 10min (FT) or 60s (live).
 */
import { NextRequest, NextResponse } from "next/server";
import { getCache, setCache, TTL } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";

const AS_BASE = "https://v3.football.api-sports.io";

export async function GET(req: NextRequest) {
  const url       = new URL(req.url);
  const fixtureId = url.searchParams.get("fixture");
  if (!fixtureId) return NextResponse.json({ error: "Missing fixture" }, { status: 400 });

  const cacheKey = `lineups:${fixtureId}`;
  
  // Try Redis first
  try {
    const redisData = await getCached(cacheKey);
    if (redisData) return NextResponse.json(redisData, { headers: { "X-Cache": "REDIS" } });
  } catch (err) {
    console.warn("[lineups] Redis check failed (non-blocking):", err);
  }
  
  const cached   = getCache(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

  const key = process.env.FOOTBALL_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const res  = await fetch(`${AS_BASE}/fixtures/lineups?fixture=${fixtureId}`, {
      headers: { "x-apisports-key": key }, cache: "no-store",
    });
    const data = await res.json();
    const lineups = data.response ?? [];
    setCache(cacheKey, lineups, TTL.DETAIL_FT);
    
    // Cache to Redis
    try {
      await setCached(cacheKey, lineups, TTL.DETAIL_FT / 1000);
    } catch (redisErr) {
      console.warn("[lineups] Redis cache failed (non-blocking):", redisErr);
    }
    
    return NextResponse.json(lineups, { headers: { "X-Cache": "MISS" } });
  } catch (err) {
    console.error("lineups error:", err);
    return NextResponse.json([], { status: 200 });
  }
}