import { NextRequest, NextResponse } from "next/server";
import { cachedFetch, standingsTTL } from "@/services/apiManager";

const AS_BASE = "https://v3.football.api-sports.io";

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const league = url.searchParams.get("league");
  const season = url.searchParams.get("season");
  if (!league || !season) return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // api-sports.io key — standings come from AS, not FD
  const asKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!asKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const { data: standings, fromCache } = await cachedFetch(
      `as:standings:${league}:${season}`,
      async () => {
        const res = await fetch(`${AS_BASE}/standings?league=${league}&season=${season}`, {
          headers: { "x-apisports-key": asKey },
          cache: "no-store",
        });
        const data = await res.json();
        if (data.errors && Object.keys(data.errors).length > 0) {
          throw new Error(JSON.stringify(data.errors));
        }
        return data.response?.[0]?.league?.standings?.[0] ?? [];
      },
      standingsTTL() // 6 hours — standings only change after a match
    );

    return NextResponse.json(standings, {
      headers: { "X-Cache": fromCache ? "HIT" : "MISS" },
    });
  } catch (err) {
    console.error("[standings] error:", err);
    return NextResponse.json([], { status: 200 });
  }
}
