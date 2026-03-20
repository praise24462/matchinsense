/**
 * apiCache.ts — Three-layer cache for api-sports.io
 *
 * Layer 1: In-process memory Map       (sub-ms, lives per Node process)
 * Layer 2: Upstash Redis               (persists across restarts, shared across all server instances)
 * Layer 3: Football API (fetcher)      (last resort, costs 1 API request)
 *
 * With Redis, ALL users share the same cache — 1 API call serves unlimited users.
 *
 * TTL budget (100 req/day free plan):
 *   Past dates        → 24 h
 *   Future dates      →  6 h
 *   Today, no live    →  5 min (~12 req/day)
 *   Today, live games → 90 sec (~40 req during match window)
 *   Match detail FT   → 10 min
 *   Match detail NS   →  5 min
 *   Match detail LIVE → 60 sec
 */

// ── TTL constants ─────────────────────────────────────────────────────────────
const SEC  = 1000;
const MIN  = 60 * SEC;
const HOUR = 60 * MIN;

export const TTL = {
  PAST:        24 * HOUR,
  FUTURE:       6 * HOUR,
  TODAY_IDLE:   5 * MIN,
  TODAY_LIVE:  90 * SEC,
  DETAIL_FT:  10 * MIN,
  DETAIL_NS:   5 * MIN,
  DETAIL_LIVE: 60 * SEC,
  TEAM:        10 * MIN,
};

export function ttlForDate(dateIso: string, hasLive: boolean): number {
  const d     = new Date();
  const today = d.toISOString().split("T")[0];
  if (dateIso < today) return TTL.PAST;
  if (dateIso > today) return TTL.FUTURE;
  return hasLive ? TTL.TODAY_LIVE : TTL.TODAY_IDLE;
}

export function ttlForStatus(status: string): number {
  if (["FT","AET","PEN","AWD","WO"].includes(status)) return TTL.DETAIL_FT;
  if (["NS","TBD","PST","CANC"].includes(status))     return TTL.DETAIL_NS;
  return TTL.DETAIL_LIVE;
}

// ── Layer 1: In-memory store ──────────────────────────────────────────────────
interface MemEntry<T> { data: T; expiresAt: number; }
const memStore = new Map<string, MemEntry<unknown>>();

function memGet<T>(key: string): T | null {
  const entry = memStore.get(key) as MemEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.data;
}
function memSet<T>(key: string, data: T, ttlMs: number): void {
  memStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ── Layer 2: Upstash Redis ────────────────────────────────────────────────────
// Falls back gracefully if env vars are missing (e.g. local dev without Redis)

let redis: any = null;

async function getRedis() {
  if (redis) return redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null; // No Redis configured — skip layer 2
  try {
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({ url, token });
    return redis;
  } catch {
    return null;
  }
}

async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const r = await getRedis();
    if (!r) return null;
    const val = await r.get(`se:${key}`);
    return val as T | null;
  } catch {
    return null;
  }
}

async function redisSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const r = await getRedis();
    if (!r) return;
    const ttlSec = Math.max(1, Math.floor(ttlMs / 1000));
    await r.set(`se:${key}`, data, { ex: ttlSec });
  } catch {
    // Silently fail — Redis is a cache, not a database
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getCache<T>(key: string): T | null {
  return memGet<T>(key);
}

export function setCache<T>(key: string, data: T, ttlMs: number): void {
  memSet(key, data, ttlMs);
}

export function clearCache(key?: string): void {
  if (key) memStore.delete(key);
  else memStore.clear();
}

/**
 * withCache — three-layer fetch:
 *   1. Memory (instant, same process)
 *   2. Redis  (fast, shared across all users and server instances)
 *   3. fetcher() → football API (costs 1 API request, populates both layers)
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<{ data: T; hit: "mem" | "redis" | "miss" }> {
  // Layer 1: memory
  const fromMem = memGet<T>(key);
  if (fromMem !== null) return { data: fromMem, hit: "mem" };

  // Layer 2: Redis
  const fromRedis = await redisGet<T>(key);
  if (fromRedis !== null) {
    memSet(key, fromRedis, ttlMs); // warm memory layer
    return { data: fromRedis, hit: "redis" };
  }

  // Layer 3: actual API call
  const data = await fetcher();
  memSet(key, data, ttlMs);
  await redisSet(key, data, ttlMs); // async, don't await failure
  return { data, hit: "miss" };
}