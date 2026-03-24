import type { NextRequest } from "next/server";
import { metrics } from "@/services/requestFlocking";

/**
 * GET /api/metrics/api-usage
 * 
 * Tracks API request patterns to show you how much quota you're saving.
 * Useful for monitoring flocking effectiveness.
 */

export async function GET(request: NextRequest) {
  const timestamp = new Date().toISOString();
  
  return Response.json({
    timestamp,
    africaRequests: {
      totalAttempts: metrics.africaRequests.totalAttempts,
      apiCalls: metrics.africaRequests.apiCalls,
      savedByFlocking: metrics.africaRequests.savedByFlocking,
      flockingEfficiency: metrics.africaRequests.flockingEfficiency,
    },
  }, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
