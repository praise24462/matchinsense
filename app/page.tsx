/**
 * Home page — server component that pre-fetches today's matches.
 *
 * WHY THIS IS FAST:
 * - Data is fetched ON THE SERVER before HTML is sent to the browser
 * - No loading spinner on first visit — matches render immediately
 * - Next.js caches this page for 3 minutes (revalidate)
 * - 100,000 users all get the same cached HTML — zero API calls
 *
 * Before: user visits → blank page → fetch /api/matches → 2–4s wait
 * After:  user visits → matches already in HTML → instant
 */

import MatchesClient from "./matches/MatchesClient";
import type { Match } from "@/types";
import type { MatchesApiResponse } from "@/app/api/matches/route";

// Revalidate every 3 minutes — all users share one cached server render
export const revalidate = 180;

function lagosDate(): string {
  return new Date(Date.now() + 3_600_000).toISOString().split("T")[0];
}

async function prefetchMatches(): Promise<{ matches: Match[]; error: string | null }> {
  try {
    const date = lagosDate();
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/matches?date=${date}`, {
      next: { revalidate: 180 }, // same TTL as this page
    });

    if (!res.ok) return { matches: [], error: null };
    const data: MatchesApiResponse = await res.json();
    return { matches: data.matches ?? [], error: null };
  } catch {
    return { matches: [], error: null }; // fail gracefully — client will retry
  }
}

export default async function HomePage() {
  const { matches } = await prefetchMatches();
  return <MatchesClient initialMatches={matches} initialError={null} />;
}
