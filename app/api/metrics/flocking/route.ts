/**
 * /api/metrics/flocking
 * 
 * Shows request flocking and caching metrics
 * Useful for monitoring API quota savings
 */

import { NextResponse } from "next/server";
import { metrics } from "@/services/requestFlocking";

export async function GET() {
  return NextResponse.json({
    flockingMetrics: {
      africaRequests: metrics.africaRequests,
      summary: `${metrics.africaRequests.savedByFlocking} requests saved out of ${metrics.africaRequests.totalAttempts} attempts (${metrics.africaRequests.flockingEfficiency} efficiency)`,
      explanation: "Flocking coalesces simultaneous identical requests into one API call. Each request that was coalesced saves one API quota unit.",
    },
    quotaImpact: {
      totalApiCalls: metrics.africaRequests.apiCalls,
      quotaLimit: 100,
      quotaRemaining: 100 - metrics.africaRequests.apiCalls,
      message: `Used ${metrics.africaRequests.apiCalls} of 100 daily quota for African API`,
    },
  });
}
