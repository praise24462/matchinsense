/**
 * /api/match/[id]
 *
 * Two-layer cached match detail (Next.js + memory).
 * 2 API calls on first load, then cached:
 *   Live/HT  → 60 sec
 *   Finished → 10 min
 *   Upcoming →  5 min
 */

import { NextRequest, NextResponse } from "next/server";
import type { MatchDetails, MatchStatistic, MatchEvent } from "@/types";
import { withCache, ttlForStatus } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";

const AS_BASE = "https://v3.football.api-sports.io";

const STATUS_MAP: Record<string, string> = {
  FT:"FT",AET:"FT",PEN:"FT",AWD:"FT",WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS",TBD:"NS", PST:"PST",SUSP:"PST", CANC:"CANC",
};

const STAT_LABELS: [string, string][] = [
  ["Ball Possession","Possession"],["Total Shots","Shots"],
  ["Shots on Goal","Shots on Target"],["Shots off Goal","Shots off Target"],
  ["Blocked Shots","Blocked Shots"],["Corner Kicks","Corners"],
  ["Fouls","Fouls"],["Yellow Cards","Yellow Cards"],["Red Cards","Red Cards"],
  ["Offsides","Offsides"],["Goalkeeper Saves","Saves"],
  ["Total passes","Passes"],["Passes accurate","Accurate Passes"],
  ["passes %","Pass Accuracy"],["expected_goals","xG"],
];

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: fixtureId } = await context.params;
  if (!fixtureId || isNaN(Number(fixtureId)))
    return NextResponse.json({ error: "Invalid match ID" }, { status: 400 });

  const apiKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "FOOTBALL_API_KEY not configured" }, { status: 500 });

  const fetcher = async (): Promise<MatchDetails> => {
    const [fixtureRes, statsRes] = await Promise.all([
      fetch(`${AS_BASE}/fixtures?id=${fixtureId}`, { headers: { "x-apisports-key": apiKey }, cache: "no-store" }),
      fetch(`${AS_BASE}/fixtures/statistics?fixture=${fixtureId}`, { headers: { "x-apisports-key": apiKey }, cache: "no-store" }),
    ]);

    if (!fixtureRes.ok) throw new Error(`fixture fetch ${fixtureRes.status}`);
    const fixtureData = await fixtureRes.json();
    if (fixtureData.errors && Object.keys(fixtureData.errors).length > 0)
      throw new Error(JSON.stringify(fixtureData.errors));

    const fixture = fixtureData.response?.[0];
    if (!fixture) throw new Error("Match not found");

    // Events
    const events: MatchEvent[] = (fixture.events ?? []).map((e: any): MatchEvent | null => {
      const team: "home"|"away" = e.team?.id === fixture.teams.home.id ? "home" : "away";
      const minute = e.time?.elapsed ?? 0;
      if (e.type === "Goal") {
        if (e.detail === "Own Goal") return { minute, type:"OwnGoal", team: team==="home"?"away":"home", player: e.player?.name??"", detail:"Own Goal" };
        if (e.detail === "Penalty") return { minute, type:"Penalty", team, player: e.player?.name??"", detail:"Penalty" };
        return { minute, type:"Goal", team, player: e.player?.name??"", detail: e.assist?.name?`Assist: ${e.assist.name}`:undefined };
      }
      if (e.type === "Card") {
        const cardType = e.detail==="Yellow Card"?"YELLOW":e.detail==="Red Card"?"RED":"YELLOW_RED";
        return { minute, type:"Card", team, player: e.player?.name??"", detail: cardType };
      }
      if (e.type === "subst")
        return { minute, type:"Substitution", team, player: e.player?.name??"", detail: e.assist?.name?`Off: ${e.assist.name}`:undefined };
      return null;
    }).filter(Boolean) as MatchEvent[];

    // Stats
    let statistics: MatchStatistic[] = [];
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      const sa = statsData.response ?? [];
      const hs: Record<string,any> = {};
      const as_: Record<string,any> = {};
      for (const s of (sa[0]?.statistics??[])) hs[s.type] = s.value;
      for (const s of (sa[1]?.statistics??[])) as_[s.type] = s.value;
      statistics = STAT_LABELS
        .filter(([k]) => hs[k]!==undefined || as_[k]!==undefined)
        .map(([k,label]): MatchStatistic => ({ label, home: hs[k]??null, away: as_[k]??null }));
    }

    const statusShort = fixture.fixture?.status?.short ?? "NS";
    return {
      id: fixture.fixture.id, date: fixture.fixture.date,
      status: (STATUS_MAP[statusShort]??"NS") as MatchDetails["status"],
      homeTeam: { id: fixture.teams.home.id, name: fixture.teams.home.name, logo: fixture.teams.home.logo??"" },
      awayTeam: { id: fixture.teams.away.id, name: fixture.teams.away.name, logo: fixture.teams.away.logo??"" },
      score: { home: fixture.goals?.home??null, away: fixture.goals?.away??null },
      halfTimeScore: { home: fixture.score?.halftime?.home??null, away: fixture.score?.halftime?.away??null },
      league: { id: fixture.league.id, name: fixture.league.name, logo: fixture.league.logo??"", country: fixture.league.country??"" },
      source: "euro",
      statistics, events,
      venue: fixture.fixture?.venue?.name??undefined,
      referee: fixture.fixture?.referee??undefined,
    };
  };

  try {
    // Try Redis first (persistent cache across server restarts)
    const redisCacheKey = `match:${fixtureId}`;
    const redisData = await getCached(redisCacheKey);
    if (redisData) {
      return NextResponse.json(redisData, { headers: { "X-Cache": "REDIS" } });
    }

    // Peek at status from a quick memory check first — if cached, TTL is already set
    // Otherwise use a safe default; fetcher sets real TTL after it knows the status
    const { data: match, hit } = await withCache<MatchDetails>(
      `match:${fixtureId}`,
      fetcher,
      5 * 60 * 1000, // default 5 min; real TTL set per-status after first fetch
    );

    // Cache to Redis with appropriate TTL based on status
    try {
      const ttl = ttlForStatus(match.status) / 1000; // convert ms to seconds
      await setCached(redisCacheKey, match, ttl);
    } catch (redisErr) {
      console.warn("[match detail] Redis cache failed (non-blocking):", redisErr);
    }

    // Re-cache with correct TTL based on actual status
    return NextResponse.json(match, { headers: { "X-Cache": hit.toUpperCase() } });

  } catch (err: any) {
    console.error("match/[id] error:", err.message);
    if (err.message === "Match not found") return NextResponse.json({ error: "Match not found" }, { status: 404 });
    return NextResponse.json({ error: "Failed to load match" }, { status: 500 });
  }
}