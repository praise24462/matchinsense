// ─────────────────────────────────────────────────────────────────────────────
// types/matches.ts
//
// Normalized Match type used across the entire app.
// Both the African (api-sports.io) and European (football-data.org) adapters
// must return data that conforms to this shape so the rest of the app never
// needs to know which API actually provided the data.
// ─────────────────────────────────────────────────────────────────────────────

export type MatchStatus =
  | "SCHEDULED"
  | "LIVE"
  | "IN_PLAY"
  | "PAUSED"
  | "FINISHED"
  | "POSTPONED"
  | "CANCELLED"
  | "SUSPENDED"
  | "TIMED";

export interface TeamInfo {
  id: number | string;
  name: string;
  shortName?: string;
  crest?: string; // logo URL
}

export interface ScoreDetail {
  home: number | null;
  away: number | null;
}

export interface MatchScore {
  fullTime: ScoreDetail;
  halfTime: ScoreDetail;
}

export interface Competition {
  id: number | string;
  name: string;
  emblem?: string;
  country?: string;
}

/** Source of the data — lets the UI render the right badge/label */
export type MatchSource = "african" | "european";

/** A fully normalized match record — used everywhere in the app */
export interface NormalizedMatch {
  id: string;               // unique across both APIs: "af-{id}" | "eu-{id}"
  source: MatchSource;
  utcDate: string;          // ISO-8601 string, e.g. "2025-03-23T15:00:00Z"
  status: MatchStatus;
  matchday?: number | null;
  homeTeam: TeamInfo;
  awayTeam: TeamInfo;
  score: MatchScore;
  competition: Competition;
  venue?: string;
  minute?: number | null;   // live minute, if status === "LIVE" | "IN_PLAY"
}

// ─────────────────────────────────────────────────────────────────────────────
// Result shape returned by the fallback orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export type FallbackReason =
  | "african_quota_exceeded"
  | "african_empty"
  | "african_error";

export interface MatchFallbackResult {
  matches: NormalizedMatch[];
  /**
   * Which source actually produced the matches.
   * "african"  → primary source; no fallback needed.
   * "european" → fallback was triggered; show the banner.
   */
  source: MatchSource;
  isFallback: boolean;
  fallbackReason?: FallbackReason;
  /**
   * Set to true when the user explicitly requested a past date
   * (yesterday or earlier).  In that case the European fallback
   * is skipped and an empty result is returned as-is.
   */
  isPastDate: boolean;
}