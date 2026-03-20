/**
 * /api/matches?date=YYYY-MM-DD
 *
 * Read order:
 *   1. Database (Supabase) — zero API calls, serves all users
 *   2. api-sports API     — only if DB has no data for this date
 *
 * The DB is populated by /api/sync (called by cron, not users).
 * This means 1000 users can load today's matches = 0 API calls.
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { prisma } from "@/services/prisma";
import { withCache, ttlForDate } from "@/services/apiCache";
import { getCached, setCached } from "@/services/redisCache";

const AS_BASE = "https://v3.football.api-sports.io";

const PRIORITY: Record<number, number> = {
  2: 1, 3: 2, 848: 3,
  39: 4, 140: 5, 135: 6,
  78: 7, 61: 8, 40: 9,
  94: 10, 88: 11, 144: 12,
  12: 20, 20: 21, 6: 22, 29: 23,
  399: 24, 167: 25, 233: 26, 200: 27,
  288: 28, 369: 29, 152: 30, 357: 31,
  385: 32, 394: 33, 389: 34, 392: 35, 536: 36,
};

const STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const LIVE_STATUSES  = new Set(["LIVE","HT","1H","2H","ET","BT","P"]);
const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon",
  "Cape Verde","Central African Republic","Chad","Comoros","Congo","Djibouti",
  "DR Congo","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia",
  "Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Ivory Coast","Kenya",
  "Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania",
  "Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda",
  "Sao Tome and Principe","Senegal","Sierra Leone","Somalia","South Africa",
  "South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe",
  "Africa",
]);

function localDate() {
  return new Date().toISOString().split("T")[0];
}

function sortMatches(matches: Match[]): Match[] {
  return matches.sort((a, b) => {
    const aPri = PRIORITY[a.league.id] ?? 999;
    const bPri = PRIORITY[b.league.id] ?? 999;
    const aIsPriority = aPri < 999;
    const bIsPriority = bPri < 999;
    if (aIsPriority && bIsPriority) {
      if (aPri !== bPri) return aPri - bPri;
      const aLive = a.status === "LIVE" || a.status === "HT" ? 0 : 1;
      const bLive = b.status === "LIVE" || b.status === "HT" ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    if (aIsPriority) return -1;
    if (bIsPriority) return 1;
    const aLive = a.status === "LIVE" || a.status === "HT" ? 0 : 1;
    const bLive = b.status === "LIVE" || b.status === "HT" ? 0 : 1;
    if (aLive !== bLive) return aLive - bLive;
    const cmp = a.league.country.localeCompare(b.league.country);
    if (cmp !== 0) return cmp;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// Convert DB row → Match type
function dbRowToMatch(row: any): Match {
  return {
    id:       row.id,
    date:     row.kickoff.toISOString(),
    status:   row.status as Match["status"],
    homeTeam: { id: row.homeTeamId, name: row.homeTeamName, logo: row.homeTeamLogo },
    awayTeam: { id: row.awayTeamId, name: row.awayTeamName, logo: row.awayTeamLogo },
    score:    { home: row.scoreHome, away: row.scoreAway },
    league:   { id: row.leagueId, name: row.leagueName, logo: row.leagueLogo, country: row.leagueCountry },
    source:   row.source as "euro" | "africa",
  };
}

// Convert API response → Match type
function parseFixtures(fixtures: any[]): Match[] {
  return fixtures.map((f: any): Match => {
    const leagueId    = f.league.id as number;
    const statusShort = f.fixture.status?.short ?? "NS";
    return {
      id:       f.fixture.id,
      date:     f.fixture.date,
      status:   (STATUS_MAP[statusShort] ?? "NS") as Match["status"],
      homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
      awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
      score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
      league:   { id: leagueId, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
      source:   AFRICAN_COUNTRIES.has(f.league.country ?? "") ? "africa" : "euro",
    };
  });
}

export async function GET(req: NextRequest) {
  const url  = new URL(req.url);
  const date = url.searchParams.get("date") ?? localDate();

  const apiKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "FOOTBALL_API_KEY not configured" }, { status: 500 });

  try {
    // ── Try API with cache (skip DB to avoid connection issues) ──────────────────
    const fetcher = async (): Promise<Match[]> => {
      const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
        headers: { "x-apisports-key": apiKey },
        cache: "no-store",
      });
      
      // Handle quota exceeded (429) — throw so client knows
      if (res.status === 429) {
        throw new Error("QUOTA_EXCEEDED");
      }
      
      if (!res.ok) {
        console.error("api-sports HTTP error:", res.status);
        return [];
      }

      const data = await res.json();
      if (data.errors && Object.keys(data.errors).length > 0) {
        console.error("api-sports API errors:", data.errors);
        return [];
      }
      return sortMatches(parseFixtures(data.response ?? []));
    };

    const hasLive    = false;
    const estimatedTtl = ttlForDate(date, hasLive);
    
    // Try Redis first (persistent cache across server restarts)
    const redisCacheKey = `fixtures:${date}`;
    let redisData: Match[] | null = null;
    
    try {
      redisData = await getCached<Match[]>(redisCacheKey);
      if (redisData && redisData.length > 0) {
        return NextResponse.json(redisData, {
          headers: { "X-Cache": "REDIS", "X-Cache-Date": date },
        });
      }
    } catch (redisErr) {
      console.warn("[matches] Redis read failed, continuing:", redisErr);
    }
    
    // If no Redis cache, fetch from API
    const { data: matches, hit } = await withCache<Match[]>(
      `fixtures:${date}`,
      fetcher,
      estimatedTtl,
    );
    
    // Try to cache to Redis (non-blocking)
    try {
      if (matches && matches.length > 0) {
        await setCached(redisCacheKey, matches, estimatedTtl);
      }
    } catch (redisErr) {
      console.warn("[matches] Redis write failed (non-blocking):", redisErr);
    }
    
    return NextResponse.json(matches, {
      headers: { "X-Cache": hit.toUpperCase(), "X-Cache-Date": date },
    });
  } catch (err: any) {
    console.error("[matches] Route error:", err);
    if (err.message === "QUOTA_EXCEEDED") {
      return NextResponse.json({ error: "QUOTA_EXCEEDED" }, { status: 429 });
    }
    // Return empty array on any error
    return NextResponse.json([], { status: 200 });
  }
}