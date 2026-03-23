/**
 * /api/matches?date=YYYY-MM-DD
 *
 * Dual API strategy:
 * - football-data.org → European leagues (unlimited, parallel fetches)
 * - api-football      → African/NPFL only (100/day, skip if exhausted)
 *
 * Fallback: if today returns zero matches, automatically fetches the next
 * 7 days of upcoming European fixtures and returns them with isFallback: true.
 *
 * Caching: uses Next.js built-in fetch revalidation (no external cache needed).
 *
 * Response shape: { matches: Match[], isFallback: boolean, fallbackReason?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";

const FD_COMPETITIONS = [
  { code: "CL",  leagueId: 2,   name: "Champions League",  country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  { code: "EL",  leagueId: 3,   name: "Europa League",     country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  { code: "EC",  leagueId: 4,   name: "Euro Championship", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/4.png"   },
  { code: "WC",  leagueId: 1,   name: "FIFA World Cup",    country: "World",   logo: "https://media.api-sports.io/football/leagues/1.png"   },
  { code: "PL",  leagueId: 39,  name: "Premier League",    country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  { code: "PD",  leagueId: 140, name: "La Liga",           country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  { code: "SA",  leagueId: 135, name: "Serie A",           country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",        country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",           country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
];

const PRIORITY: Record<number, number> = {
  2:1, 3:2, 848:3, 4:4, 1:5,
  39:6, 140:7, 135:8, 78:9, 61:10,
  88:11, 94:12, 144:13, 12:14, 20:15, 6:16,
  399:17, 288:18, 167:19, 13:26, 11:27, 71:28,
};

const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};
const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon",
  "Cape Verde","Congo","DR Congo","Egypt","Ethiopia","Gabon","Ghana","Guinea",
  "Ivory Coast","Kenya","Libya","Madagascar","Mali","Morocco","Mozambique",
  "Namibia","Niger","Nigeria","Rwanda","Senegal","Sierra Leone","South Africa",
  "Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe","Africa",
]);
const EU_COUNTRIES = new Set([
  "England","Spain","Italy","Germany","France","Europe","World",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function localDate(): string {
  // Lagos = UTC+1
  const d = new Date(Date.now() + 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const aLive = a.status === "LIVE" || a.status === "HT";
    const bLive = b.status === "LIVE" || b.status === "HT";
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    const aPri = PRIORITY[a.league?.id] ?? 50;
    const bPri = PRIORITY[b.league?.id] ?? 50;
    if (aPri !== bPri) return aPri - bPri;
    if (a.status === "FT" && b.status !== "FT") return -1;
    if (a.status !== "FT" && b.status === "FT") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// ── European fetcher (one date) ───────────────────────────────────────────────

async function fetchEuropeanForDate(date: string, fdKey: string): Promise<Match[]> {
  const results = await Promise.allSettled(
    FD_COMPETITIONS.map(comp =>
      fetch(
        `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
        {
          headers: { "X-Auth-Token": fdKey },
          // Cache for 5 min on live days, longer on past/future
          next: { revalidate: 300 },
        }
      ).then(async res => {
        if (!res.ok) return [] as Match[];
        const data = await res.json();
        return (data.matches ?? []).map((m: any): Match => ({
          id: m.id,
          date: m.utcDate,
          status: (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
          homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
          awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
          score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
          league: { id: comp.leagueId, name: comp.name, logo: comp.logo, country: comp.country },
          source: "euro",
        }));
      }).catch(() => [] as Match[])
    )
  );
  const all: Match[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);
  // Guard: skip any entry with a missing league (prevents downstream crashes)
  return all.filter(m => m?.league?.id != null);
}

// ── Upcoming European fetcher (fallback) ──────────────────────────────────────
// Called only when today has zero matches from both APIs.

async function fetchUpcomingEuropean(fromDate: string, fdKey: string, days = 7): Promise<Match[]> {
  const all: Match[] = [];
  for (let i = 1; i <= days; i++) {
    const date    = addDays(fromDate, i);
    const matches = await fetchEuropeanForDate(date, fdKey);
    const upcoming = matches.filter(m => m.status === "NS" || m.status === "PST");
    all.push(...upcoming);
    if (all.length >= 40) break; // enough to fill the page
  }
  return all.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

// ── African fetcher ───────────────────────────────────────────────────────────

async function fetchAfrican(
  date: string,
  afKey: string
): Promise<{ matches: Match[]; exhausted: boolean }> {
  try {
    const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
      headers: { "x-apisports-key": afKey },
      cache: "no-store",
    });

    const remaining = parseInt(res.headers.get("x-apisports-requests-remaining") ?? "99");
    console.log(`[AF] quota remaining: ${remaining}`);

    if (!res.ok)               return { matches: [], exhausted: false };
    const data = await res.json();
    if (data.errors?.requests) return { matches: [], exhausted: true };
    if (remaining <= 0)        return { matches: [], exhausted: true };

    const matches: Match[] = (data.response ?? [])
      .filter((f: any) => !EU_COUNTRIES.has(f.league?.country ?? ""))
      .map((f: any): Match => ({
        id: f.fixture.id,
        date: f.fixture.date,
        status: (AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS") as Match["status"],
        homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
        awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
        score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
        league: { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
        source: AFRICAN_COUNTRIES.has(f.league?.country ?? "") ? "africa" : "euro",
      }));

    return { matches, exhausted: false };
  } catch {
    return { matches: [], exhausted: false };
  }
}

// ── Response type (exported so MatchesClient can import it) ───────────────────

export interface MatchesApiResponse {
  matches: Match[];
  isFallback: boolean;
  fallbackReason?: "african_quota_exceeded" | "african_empty" | "african_error";
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const today      = localDate();
  const date       = new URL(req.url).searchParams.get("date") ?? today;
  const isPastDate = date < today;

  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  try {
    // ── Fetch both APIs in parallel ───────────────────────────────────────────
    const [euMatches, afResult] = await Promise.all([
      fdKey ? fetchEuropeanForDate(date, fdKey) : Promise.resolve([]),
      afKey ? fetchAfrican(date, afKey)         : Promise.resolve({ matches: [], exhausted: false }),
    ]);

    const allMatches = sortMatches([...euMatches, ...afResult.matches]);

    // ── Normal case: we have matches ──────────────────────────────────────────
    if (allMatches.length > 0) {
      const payload: MatchesApiResponse = { matches: allMatches, isFallback: false };
      return NextResponse.json(payload, {
        headers: {
          "X-Total":        String(allMatches.length),
          "X-EU":           String(euMatches.length),
          "X-AF":           String(afResult.matches.length),
          "X-AF-Exhausted": String(afResult.exhausted),
        },
      });
    }

    // ── Zero matches on a past date — return empty (don't show upcoming) ──────
    if (isPastDate) {
      return NextResponse.json({ matches: [], isFallback: false } as MatchesApiResponse);
    }

    // ── Fallback: today is empty — fetch upcoming European fixtures ────────────
    const upcomingMatches = fdKey
      ? await fetchUpcomingEuropean(date, fdKey, 7)
      : [];

    const fallbackReason: MatchesApiResponse["fallbackReason"] = afResult.exhausted
      ? "african_quota_exceeded"
      : "african_empty";

    const fallbackPayload: MatchesApiResponse = {
      matches:       upcomingMatches,
      isFallback:    true,
      fallbackReason,
    };

    return NextResponse.json(fallbackPayload, {
      headers: {
        "X-Fallback":     "true",
        "X-Fallback-Why": fallbackReason,
        "X-Total":        String(upcomingMatches.length),
        "X-AF-Exhausted": String(afResult.exhausted),
      },
    });

  } catch (err: any) {
    console.error("[matches] Fatal:", err);
    return NextResponse.json(
      { matches: [], isFallback: false } as MatchesApiResponse,
      { status: 200 }
    );
  }
}