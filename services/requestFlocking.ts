/**
 * services/requestFlocking.ts
 * 
 * Prevents duplicate simultaneous API requests by "flocking" — when multiple
 * users request the same data within milliseconds of each other, they all wait
 * for and share the result of a single API call.
 * 
 * Example:
 * - 1,000 users hit /api/matches?date=today at the same millisecond
 * - Without flocking: 1,000 API calls
 * - With flocking: 1 API call, shared by all 1,000 users
 * 
 * This is the #1 cost reducer for high-traffic apps with rate limits.
 */

const pendingRequests = new Map<string, {
  promise: Promise<any>;
  createdAt: number;
  flockCount: number; // How many requests are flocked together
}>();

const MAX_FLOCK_AGE = 100; // ms — abandon flock if request takes too long

// Metrics tracking
export const metrics = {
  africaRequests: {
    totalAttempts: 0,
    apiCalls: 0,
    savedByFlocking: 0,
    flockingEfficiency: "0%",
  },
};

export function recordAfricanRequest(wasNewApiCall: boolean) {
  metrics.africaRequests.totalAttempts++;
  if (wasNewApiCall) {
    metrics.africaRequests.apiCalls++;
  } else {
    metrics.africaRequests.savedByFlocking++;
  }
  
  // Update efficiency
  if (metrics.africaRequests.totalAttempts > 0) {
    const efficiency = (
      (metrics.africaRequests.savedByFlocking / metrics.africaRequests.totalAttempts) *
      100
    ).toFixed(1);
    metrics.africaRequests.flockingEfficiency = `${efficiency}%`;
  }
}

/**
 * Execute a fetcher, but if another identical request is in-flight,
 * return that promise instead (coalesce the requests).
 * 
 * @param key Unique cache key for this request (e.g., "african:2026-03-24")
 * @param fetcher Async function that calls the API
 * @param ttlMs How long to cache the result
 */
export async function flock<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  const now = Date.now();
  
  // Check if an identical request is already in-flight
  const existing = pendingRequests.get(key);
  if (existing) {
    const age = now - existing.createdAt;
    if (age < MAX_FLOCK_AGE) {
      console.log(`[Flock] Coalescing ${key} (age: ${age}ms)`);
      // Record African request as saved by flocking
      if (key.startsWith("african:")) {
        recordAfricanRequest(false);
      }
      return existing.promise;
    }
    // Flock is too old, abandon it
    pendingRequests.delete(key);
  }

  // Start a new request
  const promise = fetcher()
    .then(data => {
      console.log(`[Flock] Completed ${key} for ${1 + (pendingRequests.get(key)?.promise === promise ? 0 : 0)} callers`);
      return data;
    })
    .finally(() => {
      // Clean up after this flock is done
      if (pendingRequests.get(key)?.promise === promise) {
        pendingRequests.delete(key);
      }
    });

  // Register this flock so subsequent callers can join
  pendingRequests.set(key, { promise, createdAt: now, flockCount: 1 });
  
  return promise;
}

/**
 * Get metrics on how many requests were coalesced.
 * Useful for monitoring the effectiveness of flocking.
 */
export function getFlockMetrics() {
  return {
    activeFlocks: pendingRequests.size,
  };
}
