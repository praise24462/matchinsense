// ─────────────────────────────────────────────────────────────────────────────
// services/europeanApi.ts
//
// Adapter for football-data.org (European competitions).
// - Free tier: unlimited requests, but rate-limited to 10 req/min.
// - Used as the PRIMARY source for European matches AND as the FALLBACK
//   when the African API quota is exceeded or returns no matches.
// - When used as fallback, we fetch the next 7 days of fixtures so the
//   user always sees something useful.
// ─────────────────────────────────────────────────────────────────────────────

import type { NormalizedMatch, MatchStatus } from "@/types/matches";

// ── Raw API types ─────────────────────────────────────────────────────────────

interface FDOTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

interface FDOScore {
  winner: string | null;
  duration: string;
  fullTime: { home: number | null; away: number | null };
  halfTime: { home: number | null; away: number | null };
}

interface FDOCompetition {
  id: number;
  name: string;
  emblem: string;
  code: string;
}

interface FDOMatch {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: FDOTeam;
  awayTeam: FDOTeam;
  score: FDOScore;
  competition: FDOCompetition;
  venue?: string;
  minute?: number;
}

interface FDOResponse {
  count: number;
  matches: FDOMatch[];
  errorCode?: number;
  message?: string;
}

// ── Competition codes ─────────────────────────────────────────────────────────
// football-data.org free tier supports these competition codes.
// All are included by default; remove any you don't need.

export const EUROPEAN_COMPETITION_CODES = [
  "PL",   // Premier League
  "CL",   // UEFA Champions League
  "PD",   // La Liga
  "SA",   // Serie A
  "BL1",  // Bundesliga
  "FL1",  // Ligue 1
  "ELC",  // Championship
  "PPL",  // Primeira Liga
  "DED",  // Eredivisie
  "BSA",  // Brasileirão (bonus — useful when African slots exhausted)
  "WC",   // FIFA World Cup
  "EC",   // European Championship
] as const;

const COMPETITIONS_PARAM = EUROPEAN_COMPETITION_CODES.join(",");

// ── Helpers ───────────────────────────────────────────────────────────────────

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const STATUS_MAP: Record<string, MatchStatus> = {
  SCHEDULED: "SCHEDULED",
  TIMED: "TIMED",
  IN_PLAY: "IN_PLAY",
  PAUSED: "PAUSED",
  EXTRA_TIME: "IN_PLAY",
  PENALTY_SHOOTOUT: "IN_PLAY",
  FINISHED: "FINISHED",
  SUSPENDED: "SUSPENDED",
  POSTPONED: "POSTPONED",
  CANCELLED: "CANCELLED",
  AWARDED: "FINISHED",
};

function mapStatus(raw: string): MatchStatus {
  return STATUS_MAP[raw] ?? "SCHEDULED";
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchFDO(url: string): Promise<FDOResponse | null> {
  const token = process.env.FOOTBALL_DATA_API_KEY;
  if (!token) {
    console.error("[europeanApi] FOOTBALL_DATA_API_KEY env var is missing.");
    return null;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "X-Auth-Token": token },
      next: { revalidate: 300 }, // cache for 5 minutes
    });
  } catch (err) {
    console.error("[europeanApi] Network error:", err);
    return null;
  }

  if (!res.ok) {
    console.error(`[europeanApi] HTTP ${res.status} — ${url}`);
    return null;
  }

  try {
    return (await res.json()) as FDOResponse;
  } catch {
    console.error("[europeanApi] Failed to parse JSON.");
    return null;
  }
}

function normalizeMatch(m: FDOMatch): NormalizedMatch {
  return {
    id: `eu-${m.id}`,
    source: "european",
    utcDate: m.utcDate,
    status: mapStatus(m.status),
    matchday: m.matchday,
    minute: m.minute ?? null,
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name,
      shortName: m.homeTeam.shortName,
      crest: m.homeTeam.crest,
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name,
      shortName: m.awayTeam.shortName,
      crest: m.awayTeam.crest,
    },
    score: {
      fullTime: m.score.fullTime,
      halfTime: m.score.halfTime,
    },
    competition: {
      id: m.competition.id,
      name: m.competition.name,
      emblem: m.competition.emblem,
    },
    venue: m.venue,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch European matches for a specific date.
 * Used for the normal European tab / primary source.
 */
export async function fetchEuropeanMatchesForDate(
  date: string
): Promise<NormalizedMatch[]> {
  const url = `https://api.football-data.org/v4/matches?date=${date}&competitions=${COMPETITIONS_PARAM}`;
  const data = await fetchFDO(url);
  if (!data || !data.matches) return [];
  return data.matches.map(normalizeMatch);
}

/**
 * Fetch upcoming European fixtures for the next `days` days starting from today.
 * This is the FALLBACK payload shown when African API has no matches.
 *
 * @param fromDate  Start date (today) in YYYY-MM-DD
 * @param days      How many days ahead to look (default: 7)
 */
export async function fetchUpcomingEuropeanMatches(
  fromDate: string,
  days = 7
): Promise<NormalizedMatch[]> {
  const start = new Date(fromDate);
  const end = addDays(start, days);
  const dateTo = toISODate(end);

  const url =
    `https://api.football-data.org/v4/matches` +
    `?dateFrom=${fromDate}&dateTo=${dateTo}` +
    `&competitions=${COMPETITIONS_PARAM}` +
    `&status=SCHEDULED,TIMED`; // only upcoming fixtures in fallback

  const data = await fetchFDO(url);
  if (!data || !data.matches) return [];

  // Sort ascending by kick-off time so nearest matches appear first
  return data.matches
    .map(normalizeMatch)
    .sort(
      (a, b) =>
        new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime()
    );
}