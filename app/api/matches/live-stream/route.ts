/**
 * GET /api/matches/live-stream?date=YYYY-MM-DD
 *
 * Server-Sent Events endpoint for real-time match updates.
 * - Sends an initial snapshot immediately
 * - Polls api-sports.io every 30s for changes
 * - Pushes score diffs + goal/card events to the client
 * - Sends heartbeats every 90s to keep Netlify connections alive
 */

import { NextRequest } from "next/server";
import type { Match } from "@/types";

const FD_BASE = "https://api.football-data.org/v4";
const AS_BASE = "https://v3.football.api-sports.io";
const POLL_MS = 30_000;
const LIVE_STATUSES = new Set(["1H", "2H", "HT", "ET", "P", "BT", "LIVE"]);

// football-data.org European leagues
const FD_COMPS: Record<string, { leagueId: number; name: string; country: string; logo: string }> = {
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/2.png"   },
  EL:  { leagueId: 3,   name: "Europa League",      country: "Europe",      logo: "https://media.api-sports.io/football/leagues/3.png"   },
  ECL: { leagueId: 848, name: "Conference League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/848.png" },
  WC:  { leagueId: 1,   name: "FIFA World Cup",     country: "World",       logo: "https://media.api-sports.io/football/leagues/1.png"   },
  EC:  { leagueId: 4,   name: "Euro Championship",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/4.png"   },
  PL:  { leagueId: 39,  name: "Premier League",     country: "England",     logo: "https://media.api-sports.io/football/leagues/39.png"  },
  PD:  { leagueId: 140, name: "La Liga",            country: "Spain",       logo: "https://media.api-sports.io/football/leagues/140.png" },
  SA:  { leagueId: 135, name: "Serie A",            country: "Italy",       logo: "https://media.api-sports.io/football/leagues/135.png" },
  BL1: { leagueId: 78,  name: "Bundesliga",         country: "Germany",     logo: "https://media.api-sports.io/football/leagues/78.png"  },
  FL1: { leagueId: 61,  name: "Ligue 1",            country: "France",      logo: "https://media.api-sports.io/football/leagues/61.png"  },
  ELC: { leagueId: 10,  name: "Championship",       country: "England",     logo: "https://media.api-sports.io/football/leagues/10.png"  },
  PPL: { leagueId: 94,  name: "Primeira Liga",      country: "Portugal",    logo: "https://media.api-sports.io/football/leagues/94.png"  },
  DED: { leagueId: 88,  name: "Eredivisie",         country: "Netherlands", logo: "https://media.api-sports.io/football/leagues/88.png"  },
  BSA: { leagueId: 71,  name: "Brasileirão",        country: "Brazil",      logo: "https://media.api-sports.io/football/leagues/71.png"  },
};
const FD_CODES = Object.keys(FD_COMPS).join(",");

// Map api-sports.io status codes to the app's Match status shape
const AS_STATUS_MAP: Record<string, string> = {
  FT: "FT", AET: "FT", PEN: "FT", AWD: "FT", WO: "FT",
  "1H": "LIVE", "2H": "LIVE", ET: "LIVE", BT: "LIVE", P: "LIVE", LIVE: "LIVE",
  HT: "HT", NS: "NS", TBD: "NS", PST: "PST", SUSP: "PST", CANC: "CANC",
};

const FD_STATUS: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

// ─── Fetch helpers ────────────────────────────────────────────────────────────

function lagosDate(): string {
  const now = new Date();
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return lagos.toISOString().split("T")[0];
}

// Fetch European matches from football-data.org
async function fetchFDMatches(date: string): Promise<Match[]> {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  if (!fdKey) return [];

  try {
    const res = await fetch(
      `${FD_BASE}/matches?competitions=${FD_CODES}&dateFrom=${date}&dateTo=${date}`,
      {
        headers: { "X-Auth-Token": fdKey },
        cache: "no-store",
      }
    );

    if (!res.ok) return [];

    const data = await res.json();
    if (data.errorCode) {
      console.error(`[FD Live] API error ${data.errorCode}: ${data.message}`);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.matches ?? []).map((m: any): Match => {
      const code = m.competition?.code ?? "";
      const meta = FD_COMPS[code] ?? {
        leagueId: m.competition?.id ?? 0,
        name: m.competition?.name ?? "Unknown",
        country: m.area?.name ?? "",
        logo: m.competition?.emblem ?? "",
      };
      return {
        id: m.id,
        date: m.utcDate,
        status: (FD_STATUS[m.status] ?? "NS") as Match["status"],
        homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
        awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
        score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
        league: { id: meta.leagueId, name: meta.name, logo: meta.logo, country: meta.country },
        source: "european",
      };
    }).filter((m: Match) => m.league?.id && m.league.id !== 0);
  } catch (err) {
    console.error("[FD Live] exception:", err);
    return [];
  }
}

// Fetch all matches (European + African) from api-sports.io
async function fetchASMatches(date: string): Promise<Match[]> {
  const key = process.env.FOOTBALL_API_KEY ?? "";
  if (!key) return [];

  const allLeagues = [
    // European
    2, 3, 848, 1, 4,         // CL, EL, ECL, WC, Euro
    39, 140, 135, 78, 61,    // Top 5 European
    10, 94, 88, 71,          // Other major
    815, 825,                // Euro/WC Qualifiers
    // African
    6, 20, 21,               // CAF / AFCON
    323, 169, 288, 233, 200, // African domestic
    824, 910,                // WC Qualifiers CAF, Friendlies
  ];

  try {
    const url = `${AS_BASE}/fixtures?date=${date}&timezone=Africa/Lagos`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      cache: "no-store",
    });

    if (!res.ok) return [];

    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      console.warn("[AS Live] errors:", json.errors);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.response ?? []).filter((f: any) => allLeagues.includes(f.league?.id)).map((f: any): Match => ({
      id: f.fixture.id,
      date: f.fixture.date,
      status: (AS_STATUS_MAP[f.fixture.status.short] ?? "NS") as Match["status"],
      homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
      awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
      score: { home: f.goals.home, away: f.goals.away },
      league: {
        id: f.league.id,
        name: f.league.name,
        logo: f.league.logo,
        country: f.league.country,
      },
      source: "african" as const,
    }));
  } catch (err) {
    console.error("[AS Live] exception:", err);
    return [];
  }
}

// Combine and sort matches from both sources
async function fetchAllMatches(date: string): Promise<Match[]> {
  const [fdMatches, asMatches] = await Promise.all([
    fetchFDMatches(date),
    fetchASMatches(date),
  ]);
  return [...fdMatches, ...asMatches];
}

// ─── Diff helpers ─────────────────────────────────────────────────────────────

interface GoalEvent {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  notification: {
    title: string;
    body: string;
    tag: string;
  };
}

interface DiffResult {
  updated: Match[];
  goals: GoalEvent[];
}

function diffMatches(prev: Map<number, Match>, next: Match[]): DiffResult {
  const updated: Match[] = [];
  const goals: GoalEvent[] = [];

  for (const m of next) {
    const old = prev.get(m.id);
    if (!old) { updated.push(m); continue; }

    const scoreChanged =
      old.score.home !== m.score.home ||
      old.score.away !== m.score.away ||
      old.status !== m.status;

    if (!scoreChanged) continue;

    updated.push(m);

    const homeGoals = (m.score.home ?? 0) - (old.score.home ?? 0);
    const awayGoals = (m.score.away ?? 0) - (old.score.away ?? 0);

    if (homeGoals > 0 || awayGoals > 0) {
      goals.push({
        matchId: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeScore: m.score.home ?? 0,
        awayScore: m.score.away ?? 0,
        notification: {
          title: `⚽ GOAL! ${m.homeTeam.name} ${m.score.home ?? 0}–${m.score.away ?? 0} ${m.awayTeam.name}`,
          body: `Live score update`,
          tag: `goal-${m.id}-${m.score.home}-${m.score.away}`,
        },
      });
    }
  }

  return { updated, goals };
}

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? lagosDate();
  let cancelled = false;

  const headers = new Headers({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Netlify / nginx: disable response buffering
  });

  const enc = new TextEncoder();
  let prevMap = new Map<number, Match>();
  let heartbeatTick = 0;

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: string) {
        try {
          controller.enqueue(enc.encode(payload));
        } catch {
          cancelled = true;
        }
      }

      // ── 1. Initial snapshot ───────────────────────────────────────────────
      try {
        const matches = await fetchAllMatches(date);
        prevMap = new Map(matches.map((m) => [m.id, m]));
        send(sse({ type: "initial", matches, ts: Date.now() }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Fetch error";
        send(sse({ type: "error", message, ts: Date.now() }));
        controller.close();
        return;
      }

      // ── 2. Poll loop ──────────────────────────────────────────────────────
      async function poll() {
        if (cancelled) return;

        heartbeatTick++;
        // Heartbeat every 3 polls (~90s) to keep the TCP connection alive
        if (heartbeatTick % 3 === 0) {
          send(sse({ type: "heartbeat", ts: Date.now() }));
        }

        try {
          // Only hit live endpoint when we know there are live matches
          const hasLive = [...prevMap.values()].some((m) =>
            LIVE_STATUSES.has(m.status)
          );

          // If no live matches, fetch full day but less urgently
          const next = await fetchAllMatches(date);
          const { updated, goals } = diffMatches(prevMap, next);

          if (updated.length > 0) {
            // Update our snapshot
            for (const m of next) prevMap.set(m.id, m);

            send(sse({ type: "update", matches: [...prevMap.values()], ts: Date.now() }));
          }

          for (const g of goals) {
            send(sse({ type: "goal", event: g, ts: Date.now() }));
          }

          // If nothing is live, slow down polling to conserve API quota
          const nextDelay = hasLive ? POLL_MS : POLL_MS * 2;
          if (!cancelled) setTimeout(poll, nextDelay);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Poll error";
          console.error("[live-stream] poll error:", message);
          // Don't close on transient errors — retry next cycle
          if (!cancelled) setTimeout(poll, POLL_MS);
        }
      }

      setTimeout(poll, POLL_MS);

      // ── 3. Cleanup on disconnect ──────────────────────────────────────────
      request.signal.addEventListener("abort", () => {
        cancelled = true;
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, { headers });
}
