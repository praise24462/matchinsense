# Redis Caching Implementation

## What Was Done

Your app now has **persistent server-side caching** using Upstash Redis. This solves the "Daily limit reached" problem by caching API responses once and serving them to all users.

## How It Works

### Tier 1: In-Memory Cache (Already Existed)
- Serves cached data to repeat visitors in the same server session
- Resets when the server restarts
- Limited to one server instance

### Tier 2: Redis Cache (NEWLY ADDED)
- **Persistent** across server restarts
- **Shared** across all users and server instances
- Upstash free tier: 10,000 requests/day
- Your app now makes **1 API call per cache period**, then all users read from Redis

## Files Updated

1. **`services/redisCache.ts`** (NEW)
   - Created Redis client with Upstash credentials
   - `getCached(key)` — retrieve cached data
   - `setCached(key, value, ttlSeconds)` — store data with TTL

2. **`app/api/matches/route.ts`**
   - Added Redis check before in-memory cache
   - Caches all match data with appropriate TTL

3. **`app/api/match/[id]/route.ts`**
   - Caches individual match details with status-based TTL
   - Live: 60s, Live HT: 60s, Finished: 10min, Upcoming: 5min

4. **`app/api/match-lineups/route.ts`**
   - Caches team lineups

5. **`app/api/match-h2h/route.ts`**
   - Caches head-to-head data

6. **`app/api/match-standings/route.ts`**
   - Caches league standings (1-hour TTL)

## Setup Required

Your `.env` file **already has** the Redis credentials:
```
UPSTASH_REDIS_REST_URL=https://helpful-hookworm-71982.upstash.io
UPSTASH_REDIS_REST_TOKEN=gQAAAAAAARkuAAIncDEwZTNmZTg0ZjBiMWE0NTlhYmUwZDhjNmQ5MmViNjhlMnAxNzE5ODI
```

**No additional setup needed!** The caching will automatically work on your next deploy.

## Cache Priority

1. **Redis Cache** (persistent, shared)
2. **In-Memory Cache** (single server session)
3. **Football API** (only if both caches miss)

## Monitoring

Check response headers to see which cache was hit:
- `X-Cache: REDIS` — persistent Redis cache hit ✅
- `X-Cache: HIT` — in-memory cache hit ✅
- `X-Cache: MISS` — API call was made

## Result

**Before:** 100 API requests/day
- 1,000 users × 1 request each = quota exceeded immediately

**After:** 100 API requests/day
- 1,000 users read from Redis cache
- Only 1 API call per cache period (5min–1hr)
- Remaining quota available for other requests

## Graceful Degradation

If Redis is unavailable:
- Falls back to in-memory cache (non-blocking)
- If that fails, makes fresh API call
- No user-facing errors

## Optional: Monitor Cache Usage

To see your Redis usage, visit: https://console.upstash.com
