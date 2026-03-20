/**
 * /api/team/[id]
 *
 * Free plan compatible: fetches team fixtures within the 3-day window only.
 * For results: yesterday + today. For fixtures: today + tomorrow.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { withCache, TTL } from "@/services/apiCache";

const AS_BASE = "https://v3.football.api-sports.io";

const STATUS_MAP: Record<string,string> = {
  FT:"FT",AET:"FT",PEN:"FT",AWD:"FT",WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS",TBD:"NS", PST:"PST",SUSP:"PST", CANC:"CANC",
};

const FINISHED = new Set(["FT","AET","PEN","AWD","WO"]);
const UPCOMING = new Set(["NS","TBD"]);
const LIVE_SET  = new Set(["1H","2H","HT","ET","BT","P","LIVE"]);

function utcDateOffset(offset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{id:string}>|{id:string} }
) {
  const apiKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ message:"FOOTBALL_API_KEY not configured" }, { status:500 });

  const p    = await Promise.resolve(context.params);
  const asId = parseInt(p.id, 10);
  if (isNaN(asId)) return NextResponse.json({ message:"Invalid team ID" }, { status:400 });

  const url    = new URL(req.url);
  const type   = url.searchParams.get("type") ?? "results";

  // Free plan: only 3-day window (yesterday → tomorrow)
  const yesterday = utcDateOffset(-1);
  const today     = utcDateOffset(0);
  const tomorrow  = utcDateOffset(1);

  // For results: fetch yesterday + today. For upcoming: fetch today + tomorrow.
  const from = type === "upcoming" ? today     : yesterday;
  const to   = type === "upcoming" ? tomorrow  : today;

  const cacheKey = `team:${asId}:${type}:${today}`;

  const fetcher = async () => {
    const res = await fetch(
      `${AS_BASE}/fixtures?team=${asId}&from=${from}&to=${to}`,
      { headers:{"x-apisports-key":apiKey}, cache:"no-store" }
    );
    if (!res.ok) throw new Error(`api-sports ${res.status}`);
    const data     = await res.json();
    const fixtures = data.response ?? [];

    const statusSet = type === "upcoming" ? UPCOMING : FINISHED;
    // For results also include live matches
    const matches: Match[] = fixtures
      .filter((f:any) => {
        const s = f.fixture?.status?.short ?? "";
        return statusSet.has(s) || (type === "results" && LIVE_SET.has(s));
      })
      .map((f:any): Match => ({
        id: f.fixture.id, date: f.fixture.date,
        status: (STATUS_MAP[f.fixture?.status?.short??"NS"]??"NS") as Match["status"],
        homeTeam: { id:f.teams.home.id, name:f.teams.home.name, logo:f.teams.home.logo??"" },
        awayTeam: { id:f.teams.away.id, name:f.teams.away.name, logo:f.teams.away.logo??"" },
        score: { home:f.goals?.home??null, away:f.goals?.away??null },
        league: { id:f.league.id, name:f.league.name, logo:f.league.logo??"", country:f.league.country??"" },
        source: "euro",
      }))
      .sort((a:Match,b:Match) => type === "upcoming"
        ? new Date(a.date).getTime()-new Date(b.date).getTime()
        : new Date(b.date).getTime()-new Date(a.date).getTime()
      );

    return { matches, type, from, to };
  };

  try {
    const { data, hit } = await withCache(cacheKey, fetcher, TTL.TEAM);
    return NextResponse.json(data, { headers:{"X-Cache":hit.toUpperCase()} });
  } catch (err:any) {
    console.error("team/[id] error:", err);
    return NextResponse.json({ message: err?.message??"Failed" }, { status:500 });
  }
}