// ─────────────────────────────────────────────────────────────────────────────
// services/matchFallback.ts
//
// The fallback orchestrator.  This is the ONLY function the API route needs
// to call.  All branching logic lives here, keeping the route thin.
//
// Logic:
//   1. Is the requested date in the past (yesterday or earlier)?
//      → Skip African API quota, just return African results (or empty).
//        The European "upcoming" fallback makes no sense for past dates.
//
//   2. Is the requested date today or in the future?
//      a. Try African API.
//      b. If African returns matches → return them (source: "african").
//      c. If African is empty or quota-exceeded → fetch upcoming European
//         fixtures and return them with isFallback: true.
// ─────────────────────────────────────────────────────────────────────────────

import type { MatchFallbackResult } from "@/types/matches";
import { fetchAfricanMatches } from "./africanApi";
import {
  fetchEuropeanMatchesForDate,
  fetchUpcomingEuropeanMatches,
} from "./europeanApi";

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in UTC */
export function getTodayUTC(): string {
  return new Date().toISOString().split("T")[0];
}

/** Returns yesterday's date as YYYY-MM-DD in UTC */
export function getYesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/** True if the given YYYY-MM-DD string is strictly before today (UTC) */
function isDateInPast(date: string): boolean {
  return date < getTodayUTC(); // lexicographic comparison works for ISO dates
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

/**
 * Resolve matches for the given date, with automatic fallback.
 *
 * @param date  YYYY-MM-DD string.  Defaults to today.
 */
export async function resolveMatches(
  date?: string
): Promise<MatchFallbackResult> {
  const targetDate = date ?? getTodayUTC();
  const isPastDate = isDateInPast(targetDate);

  // ── Branch 1: Past date ───────────────────────────────────────────────────
  // For yesterday (or earlier) we show whatever the African API has and do NOT
  // trigger the European upcoming fallback.  If African has nothing for that
  // day, we return an empty result — the UI should already show "View yesterday"
  // navigation, so the user can still go back further.
  if (isPastDate) {
    const africanResult = await fetchAfricanMatches(targetDate);

    if (africanResult.ok) {
      return {
        matches: africanResult.matches,
        source: "african",
        isFallback: false,
        isPastDate: true,
      };
    }

    // Even on past dates, try European results for that date (they will be
    // FINISHED matches — still useful, and it doesn't cost African quota).
    const europeanMatches = await fetchEuropeanMatchesForDate(targetDate);
    if (europeanMatches.length > 0) {
      return {
        matches: europeanMatches,
        source: "european",
        isFallback: true,
        fallbackReason: africanResult.reason,
        isPastDate: true,
      };
    }

    return {
      matches: [],
      source: "african",
      isFallback: false,
      isPastDate: true,
    };
  }

  // ── Branch 2: Today or future date ───────────────────────────────────────
  const africanResult = await fetchAfricanMatches(targetDate);

  if (africanResult.ok && africanResult.matches.length > 0) {
    return {
      matches: africanResult.matches,
      source: "african",
      isFallback: false,
      isPastDate: false,
    };
  }

  // African is empty or quota-exceeded → fetch upcoming European fixtures.
  // We deliberately use `fetchUpcomingEuropeanMatches` rather than
  // `fetchEuropeanMatchesForDate` here because on a day with no African
  // matches the European calendar may also be quiet — showing the next 7
  // days guarantees the user always sees something.
  const fallbackReason = africanResult.ok ? "african_empty" : africanResult.reason;
  const europeanMatches = await fetchUpcomingEuropeanMatches(targetDate, 7);

  return {
    matches: europeanMatches,
    source: "european",
    isFallback: true,
    fallbackReason,
    isPastDate: false,
  };
}