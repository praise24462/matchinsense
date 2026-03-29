/**
 * GET /api/matches/african?date=YYYY-MM-DD
 *
 * ✨ LAZY-LOADED African matches (on-demand only)
 *
 * Fetches from api-sports.io ONLY when user explicitly requests African match data.
 * This avoids wasting quota on users who don't care about African leagues.
 *
 * Usage:
 * - Call when user navigates to African teams/leagues
 * - Conserves the 100 calls/day quota
 * - Request flocking coalesces simultaneous requests
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";
import { flock } from "@/services/requestFlocking";

const AS_BASE = "https://v3.football.api-sports.io";

const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon",
  "Cape Verde","Congo","DR Congo","Egypt","Ethiopia","Gabon","Ghana","Guinea",
  "Ivory Coast","Kenya","Libya","Madagascar","Mali","Morocco","Mozambique",
  "Namibia","Niger","Nigeria","Rwanda","Senegal","Sierra Leone","South Africa",
  "Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe","Africa",
]);

const PRIORITY: Record<number, number> = {
  6: 1,              // Africa Cup of Nations
  20: 2,             // CAF Champions League
  21: 3,             // CAF Confederation Cup
  323: 4,            // NPFL (Nigeria)
  169: 5,            // Ghana Premier League
  288: 6,            // PSL (South Africa)
};

interface AfricanMatchesResponse {
  matches: Match[];
  quota: { remaining: number; limit: number };
  source: "api-sports.io";
}

async function fetchAfricanDirect(
  date: string,
  apiKey: string
): Promise<AfricanMatchesResponse> {
  try {
    const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });

    const remaining = parseInt(res.headers.get("x-apisports-requests-remaining") ?? "0");
    const limit = 100;

    if (!res.ok) {
      return { matches: [], quota: { remaining, limit }, source: "api-sports.io" };
    }

    const data = await res.json();

    // Check for quota exhaustion in response body
    if (data.errors?.requests || remaining <= 0) {
      console.warn(`[African API] Quota exhausted. Remaining: ${remaining}`);
      return { matches: [], quota: { remaining, limit }, source: "api-sports.io" };
    }

    // Filter to African competitions only
    const matches: Match[] = (data.response ?? [])
      .filter((f: any) => AFRICAN_COUNTRIES.has(f.league?.country ?? ""))
      .map((f: any): Match => ({
        id: f.fixture.id,
        date: f.fixture.date,
        status: (AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS") as Match["status"],
        homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
        awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
        score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
        league: { 
          id: f.league.id, 
          name: f.league.name, 
          logo: f.league.logo ?? "", 
          country: f.league.country ?? "" 
        },
        source: "africa",
      }))
      .sort((a: Match, b: Match) => {
        // Live matches first
        const aLive = a.status === "LIVE" || a.status === "HT";
        const bLive = b.status === "LIVE" || b.status === "HT";
        if (aLive && !bLive) return -1;
        if (!aLive && bLive) return 1;
        
        // Then by league priority
        const aPri = PRIORITY[a.league?.id] ?? 99;
        const bPri = PRIORITY[b.league?.id] ?? 99;
        if (aPri !== bPri) return aPri - bPri;
        
        // Then by status (FT before NS)
        if (a.status === "FT" && b.status !== "FT") return -1;
        if (a.status !== "FT" && b.status === "FT") return 1;
        
        // Finally by time
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

    return { matches, quota: { remaining, limit }, source: "api-sports.io" };
  } catch (err) {
    console.error("[African API] Network error:", err);
    return { 
      matches: [], 
      quota: { remaining: 0, limit: 100 }, 
      source: "api-sports.io" 
    };
  }
}

async function fetchAfricanWithFlocking(
  date: string,
  apiKey: string
): Promise<AfricanMatchesResponse> {
  return flock(
    `african-matches:${date}`,
    () => fetchAfricanDirect(date, apiKey),
    5 * 60 * 1000 // 5-minute cache
  );
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date");
  
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid or missing date. Use format: YYYY-MM-DD" },
      { status: 400 }
    );
  }

  const apiKey = process.env.FOOTBALL_API_KEY;
  
  if (!apiKey) {
    console.error("[African API] FOOTBALL_API_KEY env var is missing");
    return NextResponse.json(
      { 
        matches: [], 
        quota: { remaining: 0, limit: 100 },
        source: "api-sports.io",
        error: "API key not configured"
      },
      { status: 503 }
    );
  }

  try {
    const result = await fetchAfricanWithFlocking(date, apiKey);
    
    return NextResponse.json(result, {
      headers: {
        "X-Total": String(result.matches.length),
        "X-Quota-Remaining": String(result.quota.remaining),
        "X-Source": "api-sports.io",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    });
  } catch (err: any) {
    console.error("[African API] Fatal:", err);
    return NextResponse.json(
      { 
        matches:[], 
        quota: { remaining: 0, limit: 100 },
        source: "api-sports.io",
        error: "Failed to fetch African matches"
      },
      { status: 500 }
    );
  }
}
