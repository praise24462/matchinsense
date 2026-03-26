import { NextRequest, NextResponse } from "next/server";
import { qcGet, qcSet, QC_TTL } from "@/services/quotacache";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";

async function fetchLineupsDirect(fixtureId: string, key: string) {
  const res  = await fetch(`${AS_BASE}/fixtures/lineups?fixture=${fixtureId}`, {
    headers: { "x-apisports-key": key }, cache: "no-store",
  });
  const data = await res.json();
  return data.response ?? [];
}

export async function GET(req: NextRequest) {
  const fixtureId = new URL(req.url).searchParams.get("fixture");
  if (!fixtureId) return NextResponse.json({ error: "Missing fixture" }, { status: 400 });

  // Lineups never change after kickoff — cache for 6 hours
  const cacheKey = `lineups:${fixtureId}`;
  const cached = qcGet(cacheKey);
  if (cached) return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });

  const key = process.env.FOOTBALL_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const lineups = await flock(
      `match-lineups:${fixtureId}`,
      () => fetchLineupsDirect(fixtureId, key),
      6 * 60 * 60 * 1000 // 6-hour cache
    );

    qcSet(cacheKey, lineups, QC_TTL.LINEUPS);
    return NextResponse.json(lineups, { headers: { "X-Cache": "MISS" } });
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}