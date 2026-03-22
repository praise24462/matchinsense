/**
 * /api/matches?date=YYYY-MM-DD
 *
 * Built for scale — 100,000 users share the same cached response.
 *
 * Cache strategy:
 *   - In-memory cache (Node.js) — serves all users from same process instantly
 *   - TTL: 60s if live matches, 5min if no live, 1hr for past/future dates
 *   - 1 API call per TTL window regardless of how many users hit the endpoint
 *
 * API strategy:
 *   - football-data.org → European leagues (CL, PL, La Liga, Serie A, BL, L1, EL)
 *   - api-football      → African/NPFL + rest of world (1 call per window)
 */

import { NextRequest, NextResponse } from "next/server";
import type { Match } from "@/types";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";

// ── In-memory cache ───────────────────────────────────────────────────────
interface CacheEntry { data: Match[]; expiresAt: number; }
const memCache = new Map<string, CacheEntry>();

function cacheGet(key: string): Match[] | null {
  const entry = memCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) { memCache.delete(key); return null; }
  return entry.data;
}
function cacheSet(key: string, data: Match[], ttlMs: number) {
  memCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

function getTtl(date: string, hasLive: boolean): number {
  const today = new Date().toISOString().split("T")[0];
  if (date < today) return 60 * 60 * 1000;        // past: 1 hour
  if (date > today) return 30 * 60 * 1000;        // future: 30 min
  return hasLive ? 60 * 1000 : 5 * 60 * 1000;    // today: 60s live, 5min idle
}

// ── Priority sort ─────────────────────────────────────────────────────────
const PRIORITY: Record<number, number> = {
  2: 1, 3: 2, 848: 3,
  39: 4, 140: 5, 135: 6, 78: 7, 61: 8,
  88: 9, 94: 10, 144: 11, 179: 12, 203: 13,
  12: 14, 20: 15, 6: 16,
  399: 17, 288: 18, 167: 19, 200: 20, 233: 21,
  369: 22, 276: 23, 411: 24, 403: 25,
  13: 26, 11: 27, 71: 28, 128: 29,
  98: 30, 292: 31,
  1: 90, 4: 91, 10: 99,
};

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const isLive = (s: string) => s === "LIVE" || s === "HT";
    const aLive = isLive(a.status), bLive = isLive(b.status);
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    const aPri = PRIORITY[a.league.id] ?? 50;
    const bPri = PRIORITY[b.league.id] ?? 50;
    if (aPri !== bPri) return aPri - bPri;
    const isFt = (s: string) => s === "FT";
    if (isFt(a.status) && !isFt(b.status)) return -1;
    if (!isFt(a.status) && isFt(b.status)) return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

// ── football-data.org competitions ────────────────────────────────────────
const FD_COMPETITIONS = [
  { code: "CL",  leagueId: 2,   name: "Champions League", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  { code: "EL",  leagueId: 3,   name: "Europa League",    country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  { code: "PL",  leagueId: 39,  name: "Premier League",   country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  { code: "PD",  leagueId: 140, name: "La Liga",          country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  { code: "SA",  leagueId: 135, name: "Serie A",          country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",       country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",          country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
];

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST",
  CANCELLED:"CANC", SUSPENDED:"PST",
};

const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

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

const EU_COUNTRIES = new Set(["England","Spain","Italy","Germany","France","Europe"]);

function localDate() {
  return new Date().toISOString().split("T")[0];
}

// ── In-flight dedup — prevents multiple concurrent fetches for same key ───
const inFlight = new Map<string, Promise<Match[]>>();

async function fetchWithDedup(key: string, fetcher: () => Promise<Match[]>): Promise<Match[]> {
  // Already fetching this key? Wait for that instead of firing another API call
  if (inFlight.has(key)) {
    console.log(`[cache] Dedup hit for ${key}`);
    return inFlight.get(key)!;
  }
  const promise = fetcher().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ── Fetch European leagues from football-data.org ─────────────────────────
async function fetchEuropean(date: string, apiKey: string): Promise<Match[]> {
  const all: Match[] = [];

  for (const comp of FD_COMPETITIONS) {
    try {
      const res = await fetch(
        `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
        { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
      );

      if (res.status === 429) {
        console.log(`[FD] Rate limited — waiting 12s before retry`);
        await new Promise(r => setTimeout(r, 12000));
        const retry = await fetch(
          `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
          { headers: { "X-Auth-Token": apiKey }, cache: "no-store" }
        );
        if (!retry.ok) continue;
        const d = await retry.json();
        mapFdMatches(d.matches ?? [], comp, all);
        await new Promise(r => setTimeout(r, 700));
        continue;
      }

      if (!res.ok) { console.log(`[FD] ${comp.code}: HTTP ${res.status}`); continue; }

      const data = await res.json();
      mapFdMatches(data.matches ?? [], comp, all);

      // Respect 10 req/min rate limit
      await new Promise(r => setTimeout(r, 700));

    } catch (e: any) {
      console.error(`[FD] ${comp.code} error:`, e?.message);
    }
  }

  console.log(`[FD] ${all.length} European matches for ${date}`);
  return all;
}

function mapFdMatches(fdMatches: any[], comp: typeof FD_COMPETITIONS[0], out: Match[]) {
  for (const m of fdMatches) {
    out.push({
      id:       m.id,
      date:     m.utcDate,
      status:   (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
      homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
      awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
      score:    { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
      league:   { id: comp.leagueId, name: comp.name, logo: comp.logo ?? "", country: comp.country },
      source:   "euro",
    });
  }
}

// ── Fetch African + world matches from api-football ───────────────────────
async function fetchAfrican(date: string, apiKey: string): Promise<{
  matches: Match[];
  quotaRemaining: number;
  quotaExhausted: boolean;
}> {
  const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  const remaining = parseInt(res.headers.get("x-apisports-requests-remaining") ?? "99");
  console.log(`[AF] quota remaining: ${remaining}`);

  if (!res.ok) return { matches: [], quotaRemaining: remaining, quotaExhausted: false };

  const data = await res.json();

  if (data.errors?.requests) {
    return { matches: [], quotaRemaining: 0, quotaExhausted: true };
  }

  const fixtures = data.response ?? [];

  const matches: Match[] = fixtures
    .filter((f: any) => {
      const country = f.league.country ?? "";
      // Keep African + non-EU (South America, Asia etc.) — EU comes from FD
      return AFRICAN_COUNTRIES.has(country) || !EU_COUNTRIES.has(country);
    })
    .map((f: any): Match => ({
      id:       f.fixture.id,
      date:     f.fixture.date,
      status:   (AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS") as Match["status"],
      homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
      awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
      score:    { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
      league:   { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country: f.league.country ?? "" },
      source:   AFRICAN_COUNTRIES.has(f.league.country ?? "") ? "africa" : "euro",
    }));

  console.log(`[AF] ${matches.length} non-EU matches for ${date}`);
  return { matches, quotaRemaining: remaining, quotaExhausted: false };
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ?? localDate();
  const cacheKey = `matches:${date}`;

  // ── Serve from cache if fresh ─────────────────────────────────────────
  const cached = cacheGet(cacheKey);
  if (cached) {
    console.log(`[matches] Cache HIT for ${date} (${cached.length} matches)`);
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "X-Total": String(cached.length) }
    });
  }

  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  if (!afKey && !fdKey) {
    return NextResponse.json({ error: "No API keys configured" }, { status: 500 });
  }

  try {
    // ── Fetch from APIs (deduplicated — concurrent requests share one fetch) ──
    const allMatches = await fetchWithDedup(cacheKey, async () => {
      const [euMatches, afResult] = await Promise.all([
        fdKey ? fetchEuropean(date, fdKey) : Promise.resolve([]),
        afKey ? fetchAfrican(date, afKey)  : Promise.resolve({ matches: [], quotaRemaining: 0, quotaExhausted: false }),
      ]);

      return sortMatches([...euMatches, ...afResult.matches]);
    });

    // ── Cache with smart TTL ──────────────────────────────────────────────
    const hasLive = allMatches.some(m => m.status === "LIVE" || m.status === "HT");
    const ttl = getTtl(date, hasLive);
    cacheSet(cacheKey, allMatches, ttl);

    const ttlSec = Math.round(ttl / 1000);
    console.log(`[matches] MISS for ${date} — ${allMatches.length} matches cached for ${ttlSec}s`);

    return NextResponse.json(allMatches, {
      headers: {
        "X-Cache": "MISS",
        "X-Total": String(allMatches.length),
        "X-TTL":   String(ttlSec),
      }
    });

  } catch (err: any) {
    console.error("[matches] Fatal:", err);
    return NextResponse.json([], { status: 200 });
  }
}