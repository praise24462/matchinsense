import MatchesClient from "./MatchesClient";
import type { Match } from "@/types";
import type { MatchesApiResponse } from "@/app/api/matches/route";

export const revalidate = 180;

function lagosDate(): string {
  return new Date(Date.now() + 3_600_000).toISOString().split("T")[0];
}

async function prefetchMatches(): Promise<Match[]> {
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/matches?date=${lagosDate()}`, {
      next: { revalidate: 180 },
    });
    if (!res.ok) return [];
    const data: MatchesApiResponse = await res.json();
    return data.matches ?? [];
  } catch {
    return [];
  }
}

export default async function MatchesPage() {
  const matches = await prefetchMatches();
  return <MatchesClient initialMatches={matches} initialError={null} />;
}
