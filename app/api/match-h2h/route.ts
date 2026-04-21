import { NextRequest, NextResponse } from "next/server";
import { cachedFetch, h2hTTL } from "@/services/apiManager";

const AS_BASE = "https://v3.football.api-sports.io";

export async function GET(req: NextRequest) {
  const h2h = new URL(req.url).searchParams.get("h2h");
  if (!h2h) return NextResponse.json({ error: "Missing h2h param" }, { status: 400 });

  const asKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!asKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  try {
    const { data, fromCache } = await cachedFetch(
      `as:h2h:${h2h}`,
      async () => {
        const res = await fetch(`${AS_BASE}/fixtures/headtohead?h2h=${h2h}&last=10`, {
          headers: { "x-apisports-key": asKey },
          cache: "no-store",
        });
        const json = await res.json();
        if (json.errors && Object.keys(json.errors).length > 0) throw new Error(JSON.stringify(json.errors));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (json.response ?? []).map((f: any) => ({
          id:       f.fixture.id,
          date:     f.fixture.date,
          status:   f.fixture.status?.short,
          homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
          awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
          score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
          league:   { name: f.league.name, logo: f.league.logo },
        }));
      },
      h2hTTL() // 24 hours — past H2H results never change
    );

    return NextResponse.json({ matches: data }, {
      headers: { "X-Cache": fromCache ? "HIT" : "MISS" },
    });
  } catch (err) {
    console.error("[h2h] error:", err);
    return NextResponse.json({ matches: [] }, { status: 200 });
  }
}
