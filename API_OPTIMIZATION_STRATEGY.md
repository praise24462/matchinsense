# African API: Scale 100 Calls/Day to 100,000 Users

## The Math
- **100 API calls/day** limit
- **100,000 users/day** potential users
- **Goal**: 1 API call per 1,000 users served

---

## Current Setup Assessment
✅ **Already Have:**
- In-memory TTL-based caching (apiCache.ts)
- Request deduplication via Next.js fetch cache
- Proper cache TTLs (5 min for today, 6 hours for future)

❌ **Gaps to Fix:**
- No request batching/coalescing between simultaneous requests
- No distributed cache awareness (if multi-instance deployment)
- Premium leagues getting equal quota share as less-popular ones
- No user-level throttling

---

## 6-Tier Strategy (Prioritized by Impact)

### TIER 1: Request Coalescing (80% cost reduction 🚀)
**Problem**: If 1,000 users hit `/matches?date=today` within same 5-min window:
- Without coalescing: 1,000+ API calls
- With coalescing: 1 API call, shared to all

**Solution - Implement Request Flocking:**

```typescript
// services/requestFlocking.ts
const pendingRequests = new Map<string, Promise<any>>();

export async function flock<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number
): Promise<T> {
  // Return existing pending request if one is in-flight
  if (pendingRequests.has(key)) {
    console.log(`[Flock] Waiting for ${key}...`);
    return pendingRequests.get(key)!;
  }

  // Start new request
  const promise = fetcher()
    .then(data => {
      setCache(key, data, ttlMs);
      return data;
    })
    .finally(() => {
      pendingRequests.delete(key);
    });

  pendingRequests.set(key, promise);
  return promise;
}
```

**Usage in African API:**
```typescript
export async function fetchAfricanMatches(date: string): Promise<AfricanApiOutcome> {
  return flock(
    `african:${date}`,
    async () => {
      // Existing fetch logic...
    },
    TTL.TODAY_IDLE
  );
}
```

**Impact**: Reduces concurrent requests by 99%

---

### TIER 2: Lazy-Load African Data (70% cost reduction)
**Problem**: Fetching African data on every page load even if user never scrolls to it

**Solution**: Only fetch IF user is on specific routes/scrolls to African section

```typescript
// app/api/matches/route.ts - Current: ALWAYS fetches African data
// New: ONLY fetch if user explicitly requests it

// Option A: Separate endpoint
GET /api/african-matches?date=2026-03-24  // Only called on-demand

// Option B: Route parameter
GET /api/matches?date=2026-03-24&includeAfrican=true
```

**Estimate**: 60% of users never interact with African leagues → 60% call reduction

---

### TIER 3: Tiered League Priority (50% cost reduction)
**Problem**: All African leagues get same API quota allocation

**Solution**: Cache tiers based on popularity

```typescript
const LEAGUE_TIER = {
  TIER_1: [6, 20, 21, 323],           // CAF + NPFL - 60% cache hit
  TIER_2: [169, 288, 233],             // Ghana, SA, Egypt - 30% cache hit
  TIER_3: [200],                       // Others - 10% cache hit (lower TTL)
};

export const TTL_BY_LEAGUE = {
  [TIER_1]: 12 * HOUR,  // Top leagues: cache longer
  [TIER_2]: 6 * HOUR,
  [TIER_3]: 2 * HOUR,   // Niche leagues: shorter cache
};
```

**Impact**: Tier 1 hits never need fresh fetches after first call

---

### TIER 4: Batch Requests into Single API Call (40% cost reduction)
**Problem**: Fetching matches separately for each league wastes quota

**Solution**: Use API's league filtering to batch requests

```typescript
// BEFORE: 7 separate calls
async function fetchByLeague(leagueIds: number[]) {
  const results = await Promise.all(
    leagueIds.map(lid => 
      fetch(`/fixtures?leagueId=${lid}&date=${date}`)
    )
  );
  // 7 calls executed
}

// AFTER: 1 call (API-Sports supports comma-separated leagueId)
async function fetchAllLeagues(date: string) {
  const leagues = AFRICAN_LEAGUE_IDS.join(',');
  return fetch(`/fixtures?leagueId=${leagues}&date=${date}`);
  // 1 call executed
}
```

**Implementation**: Update `africanApi.ts` to use league batch parameter

---

### TIER 5: Shared Cache with Redis (30% cost reduction)
**Problem**: Each server instance maintains separate in-memory cache

**Solution**: Use Redis for cross-instance cache (you already have redisCache.ts)

```typescript
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<{ data: T; hit: "mem" | "redis" | "miss" }> {
  // Check in-memory first
  const fromMem = memGet<T>(key);
  if (fromMem !== null) return { data: fromMem, hit: "mem" };

  // Check Redis second
  const fromRedis = await redisGet<T>(key);
  if (fromRedis !== null) {
    memSet(key, fromRedis, ttlMs); // Hydrate local cache
    return { data: fromRedis, hit: "redis" };
  }

  // Fetch fresh
  const data = await fetcher();
  await redisSet(key, data, Math.floor(ttlMs / 1000));
  memSet(key, data, ttlMs);
  return { data, hit: "miss" };
}
```

---

### TIER 6: Stale Data Fallback (25% cost reduction)
**Problem**: Cache miss = API call even if old data exists

**Solution**: Serve stale data + revalidate in background

```typescript
// When cache expired but still returning data
const STALE_TTL = 24 * HOUR;  // Keep stale data for a full day

export async function withStaleCallback<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
  onStale?: (data: T) => void
): Promise<T> {
  const cached = memGet<T>(key);
  if (cached !== null) return cached;

  // Data expired — try to get stale version
  const stale = memGet<T>(`${key}:stale`);
  if (stale !== null) {
    onStale?.(stale);
    
    // Revalidate in background
    fetcher()
      .then(fresh => {
        memSet(key, fresh, ttlMs);
        memSet(`${key}:stale`, fresh, STALE_TTL);
      })
      .catch(err => console.error(`[Stale] Revalidation failed:`, err));
    
    return stale; // Serve immediately
  }

  // No data at all — must fetch
  const data = await fetcher();
  memSet(key, data, ttlMs);
  memSet(`${key}:stale`, data, STALE_TTL);
  return data;
}
```

---

## Summary: Cost Reduction by Tier

| Tier | Strategy | Reduction | Cumulative |
|------|----------|-----------|------------|
| 1 | Request Coalescing | 80% | **80%** |
| 2 | Lazy-Load Data | 70% | **94%** |
| 3 | Tiered Priority | 50% | **97%** |
| 4 | Batch Requests | 40% | **98.8%** |
| 5 | Shared Redis Cache | 30% | **99.6%** |
| 6 | Stale Fallback | 25% | **99.9%** |

---

## Implementation Priority

### Phase 1 (Do First - 2 hours):
1. ✅ **Request Coalescing** - Biggest impact, simplest code
2. ✅ **Lazy-Load** - Add `?includeAfrican=true` route param

### Phase 2 (Do Second - 3 hours):
3. ✅ **Tiered Caching** - Adjust TTLs by league popularity
4. ✅ **Batch Requests** - Update API call to use comma-separated IDs

### Phase 3 (Do Third - 1 hour):
5. ✅ **Redis Integration** - Connect shared cache layer
6. ✅ **Stale Fallback** - Background revalidation

---

## Expected Results

**Before Optimization:**
- 100 users → ~50 API calls
- 100,000 users → **50,000 calls/day** (⚠️ QUOTA EXCEEDED)

**After Tier 1 Only:**
- 100 users → 1 API call (Request Coalescing)
- 100,000 users → **100 calls/day** ✅ **Within Quota**

**With All Tiers:**
- 100,000 users → **1-2 calls/day** (Extreme efficiency)

---

## Monitoring

Add to your app to track savings:

```typescript
// lib/apiMetrics.ts
export const apiMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  
  recordHit(type: 'mem' | 'redis' | 'miss') {
    this.totalRequests++;
    if (type === 'mem') this.cacheHits++;
    else if (type === 'redis') this.cacheHits++;
    else this.cacheMisses++;
  },
  
  get hitRate() {
    return (this.cacheHits / this.totalRequests * 100).toFixed(1) + '%';
  }
};
```

Access at `/api/metrics` to verify your strategies work! 📊
