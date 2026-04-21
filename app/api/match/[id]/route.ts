/**
 * /api/match/[id] — Match detail with DB cache
 * 
 * Cache strategy (persists across all server instances):
 *   Finished matches: 7 days (score never changes)
 *   Live matches:     60 seconds
 *   Upcoming:         1 hour
 */

import { NextRequest, NextResponse } from "next/server";
import type { MatchDetails, MatchStatistic, MatchEvent } from "@/types";
import { dbGet, dbSet, ttlForStatus } from "@/services/dbCache";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";

const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

// All leagues: European + African (from api-sports.io)
const ALL_LEAGUES: Record<number, { name: string; country: string }> = {
  2:   { name: "Champions League",        country: "Europe"      },
  3:   { name: "Europa League",           country: "Europe"      },
  848: { name: "Conference League",       country: "Europe"      },
  1:   { name: "FIFA World Cup",          country: "World"       },
  4:   { name: "Euro Championship",       country: "Europe"      },
  39:  { name: "Premier League",          country: "England"     },
  140: { name: "La Liga",                 country: "Spain"       },
  135: { name: "Serie A",                 country: "Italy"       },
  78:  { name: "Bundesliga",              country: "Germany"     },
  61:  { name: "Ligue 1",                 country: "France"      },
  10:  { name: "Championship",            country: "England"     },
  94:  { name: "Primeira Liga",           country: "Portugal"    },
  88:  { name: "Eredivisie",              country: "Netherlands" },
  323: { name: "NPFL",                    country: "Nigeria"     },
  288: { name: "PSL",                     country: "South Africa"},
  233: { name: "Egyptian Premier League", country: "Egypt"       },
  200: { name: "Tunisian Ligue 1",        country: "Tunisia"     },
  20:  { name: "CAF Champions League",    country: "Africa"      },
  21:  { name: "CAF Confederation Cup",   country: "Africa"      },
  6:   { name: "Africa Cup of Nations",   country: "Africa"      },
  169: { name: "Ghana Premier League",    country: "Ghana"       },
  815: { name: "Euro Qualifiers",         country: "Europe"      },
  825: { name: "WC Qualifiers UEFA",      country: "Europe"      },
  824: { name: "WC Qualifiers CAF",       country: "Africa"      },
  910: { name: "International Friendlies",country: "World"       },
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

// Unified fetch from api-sports.io (handles all European + African matches)
async function fetchMatch(matchId: string, apiKey: string): Promise<MatchDetails> {
  const [fixtureRes, statsRes] = await Promise.all([
    fetch(`${AS_BASE}/fixtures?id=${matchId}`, { headers: { "x-apisports-key": apiKey }, cache: "no-store" }),
    fetch(`${AS_BASE}/fixtures/statistics?fixture=${matchId}`, { headers: { "x-apisports-key": apiKey }, cache: "no-store" }),
  ]);
  if (!fixtureRes.ok) throw new Error(`Fixture API ${fixtureRes.status}`);
  const fd = await fixtureRes.json();
  if (fd.errors && Object.keys(fd.errors).length > 0) throw new Error(JSON.stringify(fd.errors));
  const f = fd.response?.[0];
  if (!f) throw new Error("Match not found");

  const events: MatchEvent[] = (f.events ?? []).map((e: any): MatchEvent | null => {
    const team: "home"|"away" = e.team?.id === f.teams.home.id ? "home" : "away";
    const minute = e.time?.elapsed ?? 0;
    if (e.type === "Goal") {
      if (e.detail === "Own Goal") return { minute, type:"OwnGoal", team: team==="home"?"away":"home", player: e.player?.name??"", detail:"Own Goal" };
      if (e.detail === "Penalty") return { minute, type:"Penalty", team, player: e.player?.name??"", detail:"Penalty" };
      return { minute, type:"Goal", team, player: e.player?.name??"", detail: e.assist?.name?`Assist: ${e.assist.name}`:undefined };
    }
    if (e.type === "Card") return { minute, type:"Card", team, player: e.player?.name??"", detail: e.detail==="Yellow Card"?"YELLOW":e.detail==="Red Card"?"RED":"YELLOW_RED" };
    if (e.type === "subst") return { minute, type:"Substitution", team, player: e.player?.name??"", detail: e.assist?.name?`Off: ${e.assist.name}`:undefined };
    return null;
  }).filter(Boolean) as MatchEvent[];

  let statistics: MatchStatistic[] = [];
  if (statsRes.ok) {
    const sd = await statsRes.json();
    const sa = sd.response ?? [];
    const hs: Record<string,any> = {}, as_: Record<string,any> = {};
    for (const s of (sa[0]?.statistics ?? [])) hs[s.type] = s.value;
    for (const s of (sa[1]?.statistics ?? [])) as_[s.type] = s.value;
    statistics = STAT_LABELS.filter(([k]) => hs[k]!==undefined||as_[k]!==undefined)
      .map(([k,label]): MatchStatistic => ({ label, home: hs[k]??null, away: as_[k]??null }));
  }

  const league = ALL_LEAGUES[f.league?.id] ?? { name: f.league?.name ?? "Unknown", country: f.league?.country ?? "" };
  const isEuropean = f.league?.id && ([2,3,848,1,4,39,140,135,78,61,10,94,88,815,825,910].includes(f.league.id));

  return {
    id: f.fixture.id, date: f.fixture.date,
    status: (AS_STATUS_MAP[f.fixture?.status?.short ?? "NS"] ?? "NS") as MatchDetails["status"],
    homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
    awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
    score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
    halfTimeScore: { home: f.score?.halftime?.home ?? null, away: f.score?.halftime?.away ?? null },
    league:   { id: f.league?.id ?? 0, name: league.name, logo: f.league?.logo ?? "", country: league.country },
    source: isEuropean ? "european" : "african",
    statistics, events,
    venue: f.fixture?.venue?.name ?? undefined, referee: f.fixture?.referee ?? undefined,
  };
}

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: matchId } = await context.params;
  if (!matchId || isNaN(Number(matchId)))
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const asKey = process.env.FOOTBALL_API_KEY ?? "";
  
  // Check if API key is configured (all matches now use api-sports.io)
  if (!asKey) {
    console.error(`[match/${matchId}] API key not configured`);
    return NextResponse.json({ error: "Server configuration error", details: "Missing API key" }, { status: 500 });
  }

  // Check DB cache first — this works across ALL server instances
  const cacheKey = `match:${matchId}`;
  let cached: MatchDetails | null = null;
  try {
    cached = await dbGet<MatchDetails>(cacheKey);
    if (cached) {
      // For live matches, skip cache
      if (cached.status !== "LIVE" && cached.status !== "HT") {
        return NextResponse.json(cached, { headers: { "X-Cache": "DB-HIT" } });
      }
    }
  } catch (cacheErr: any) {
    console.warn(`[match/${matchId}] Cache read failed:`, cacheErr.message);
    // Continue without cache
  }

  try {
    // Fetch from api-sports.io (handles European + African matches)
    const match = await flock(
      `match:${matchId}`,
      () => fetchMatch(matchId, asKey),
      ttlForStatus("NS")
    );

    if (!match) {
      throw new Error("No match data returned");
    }

    // Cache in DB — finished matches cached 7 days, live 60s, upcoming 1hr
    try {
      const ttl = ttlForStatus(match.status);
      await dbSet(cacheKey, match, ttl);
    } catch (cacheErr: any) {
      console.warn(`[match/${matchId}] Cache write failed:`, cacheErr.message);
      // Continue without cache - don't fail the request
    }

    return NextResponse.json(match, { headers: { "X-Cache": "MISS" } });
  } catch (err: any) {
    const errorMsg = err?.message ?? "Unknown error";
    const errorType = err?.name ?? "Unknown";
    
    console.error(`[match/${matchId}] Error:`, {
      message: errorMsg,
      stack: err?.stack ?? "No stack",
      name: errorType,
      err: err,
    });
    
    if (errorMsg === "Match not found")
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    
    // Ensure response body is always valid JSON
    const responseBody: Record<string, any> = {
      error: "Failed to load match",
      message: errorMsg,
      matchId: matchId,
      type: errorType,
    };
    
    // Add more context for common errors
    if (errorMsg.includes("API key")) {
      responseBody.hint = "API key configuration issue on server";
    } else if (errorMsg.includes("rate limit") || errorMsg.includes("429")) {
      responseBody.hint = "API rate limit exceeded";
    }
    
    return NextResponse.json(responseBody, { status: 500 });
  }
}