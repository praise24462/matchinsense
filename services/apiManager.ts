/**
 * services/apiManager.ts
 *
 * ARCHITECTURE FOR 100,000 USERS
 * ─────────────────────────────────────────────────────────────────────
 * The key insight: ALL users share ONE cached result.
 *
 *   User 1 hits /api/matches → fetches API → stores in cache → returns in 800ms
 *   Users 2–100,000 hit /api/matches → read from cache → return in <5ms
 *
 * This means:
 *   - football-data.org  : ~48 calls/day (1 per 30min, unlimited anyway)
 *   - api-sports.io      : ~8 calls/day  (1 per 6h idle, 1 per 5min live)
 *   - Both APIs handle 100,000 users because they only see 1 request each
 *
 * CACHE TTL RULES:
 *   Past dates     → 24h  (scores never change)
 *   Future dates   → 2h   (lineup changes)
 *   Today idle     → 30min (no live matches)
 *   Today live     → 3min  (scores updating)
 *   AS idle        → 6h   (protects 100/day quota)
 *   AS live        → 5min
 *   Standings      → 6h
 *   H2H            → 24h  (historical, never changes)
 *   Team stats     → 4h
 *   Match detail FT→ 24h
 *   Match detail NS→ 30min
 *   Match detail   → 90s  (live)
 */

export const MIN  = 60_000;
export const HOUR = 3_600_000;

// ── In-memory cache ───────────────────────────────────────────────────────────
// Serverless note: each Netlify function instance has its own memory.
// With Next.js ISR (revalidate) this isn't needed for page data,
// but it prevents duplicate calls within the same lambda invocation.

interface Entry<T> { data: T; expiresAt: number; cachedAt: number }
const store = new Map<string, Entry<unknown>>();

function get<T>(key: string): T | null {
  const e = store.get(key) as Entry<T> | undefined;
  if (!e) return null;
  if (Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.data;
}
function set<T>(key: string, data: T, ttl: number) {
  store.set(key, { data, expiresAt: Date.now() + ttl, cachedAt: Date.now() });
}

// ── Deduplication ─────────────────────────────────────────────────────────────
// If 1000 users hit the API at the same millisecond (cold cache),
// only ONE upstream call is made. All others wait and share the result.

const inflight = new Map<string, Promise<unknown>>();

async function once<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number
): Promise<{ data: T; fromCache: boolean }> {
  const hit = get<T>(key);
  if (hit !== null) return { data: hit, fromCache: true };
  const data = await once(key, fetcher);
  set(key, data, ttl);
  return { data, fromCache: false };
}

// ── TTLs ──────────────────────────────────────────────────────────────────────

export function fdTTL(hasLive: boolean, dateIso: string): number {
  const today = lagosDate();
  if (dateIso < today) return 24 * HOUR;
  if (dateIso > today) return 2  * HOUR;
  return hasLive ? 3 * MIN : 30 * MIN;
}
export function asTTL(hasLive: boolean): number {
  return hasLive ? 5 * MIN : 6 * HOUR;
}
export function standingsTTL() { return 6 * HOUR; }
export function h2hTTL()       { return 24 * HOUR; }
export function teamTTL()      { return 4 * HOUR; }
export function matchDetailTTL(status: string): number {
  if (["FT","AET","PEN","PST","CANC"].includes(status)) return 24 * HOUR;
  if (["NS","TBD"].includes(status)) return 30 * MIN;
  return 90_000; // live
}

export function lagosDate(): string {
  return new Date(Date.now() + 3_600_000).toISOString().split("T")[0];
}

export function getCacheStats() {
  const now = Date.now();
  return {
    size: store.size,
    entries: [...store.entries()].map(([k, v]) => ({
      key: k,
      expiresInSec: Math.round((v.expiresAt - now) / 1000),
      ageSec: Math.round((now - v.cachedAt) / 1000),
    })),
  };
}
