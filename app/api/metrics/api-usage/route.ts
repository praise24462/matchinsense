import type { NextRequest } from "next/server";

/**
 * GET /api/metrics/api-usage
 * 
 * Tracks API request patterns to show you how much quota you're saving.
 * Useful for monitoring flocking effectiveness.
 */

interface ApiMetrics {
  timestamp: string;
  africaRequests: {
    totalAttempts: number;
    apiCalls: number;
    savedByFlocking: number;
    flockingEfficiency: string; // percentage saved
  };
}

// In-memory metrics (resets on server restart)
const metrics: ApiMetrics = {
  timestamp: new Date().toISOString(),
  africaRequests: {
    totalAttempts: 0,
    apiCalls: 0,
    savedByFlocking: 0,
    flockingEfficiency: "0%",
  },
};

// Track a new API call
export function recordApiCall(source: "african" | "european", wasCached: boolean) {
  if (source === "african") {
    metrics.africaRequests.totalAttempts++;
    if (!wasCached) {
      metrics.africaRequests.apiCalls++;
    } else {
      metrics.africaRequests.savedByFlocking++;
    }

    // Update efficiency percentage
    if (metrics.africaRequests.totalAttempts > 0) {
      const efficiency = (
        (metrics.africaRequests.savedByFlocking / metrics.africaRequests.totalAttempts) *
        100
      ).toFixed(1);
      metrics.africaRequests.flockingEfficiency = `${efficiency}%`;
    }
  }
}

// Export for external use
export function getMetrics() {
  return metrics;
}

export async function GET(request: NextRequest) {
  return Response.json(metrics, {
    headers: {
      "cache-control": "no-store",
    },
  });
}
