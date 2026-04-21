/**
 * GET /api/quota
 * Shows your api-sports.io quota remaining + cache status.
 * Visit this URL after deploying to monitor your daily usage.
 */
import { NextResponse } from "next/server";
import { getCacheStats } from "@/services/apiManager";

export async function GET() {
  const asKey = process.env.FOOTBALL_API_KEY ?? "";

  let quotaInfo = null;
  if (asKey) {
    try {
      // Lightweight call that returns quota in headers
      const res = await fetch("https://v3.football.api-sports.io/status", {
        headers: { "x-apisports-key": asKey },
        cache: "no-store",
      });
      const data = await res.json();
      quotaInfo = {
        account: data.response?.account,
        requests: data.response?.requests,
        subscription: data.response?.subscription,
      };
    } catch {
      quotaInfo = { error: "Could not fetch quota" };
    }
  }

  return NextResponse.json({
    apiSports: quotaInfo,
    cache: getCacheStats(),
    timestamp: new Date().toISOString(),
    tip: "api-sports.io allows 100 requests/day. With 6h caching, you use ~5-10/day.",
  });
}
