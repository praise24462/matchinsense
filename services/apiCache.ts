/**
 * apiCache.ts — In-memory cache for API responses
 * Redis removed — using memory cache only (sufficient for our use case)
 */

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
  TEAM:        24 * HOUR,
};

export function ttlForDate(dateIso: string, hasLive: boolean): number {
  const today = new Date().toISOString().split("T")[0];
  if (dateIso < today) return TTL.PAST;
  if (dateIso > today) return TTL.FUTURE;
  return hasLive ? TTL.TODAY_LIVE : TTL.TODAY_IDLE;
}

export function ttlForStatus(status: string): number {
  if (["FT","AET","PEN","AWD","WO"].includes(status)) return TTL.DETAIL_FT;
  if (["NS","TBD","PST","CANC"].includes(status))     return TTL.DETAIL_NS;
  return TTL.DETAIL_LIVE;
}

// ── In-memory store ───────────────────────────────────────────────────────────
interface MemEntry<T> { data: T; expiresAt: number; }
const memStore = new Map<string, MemEntry<unknown>>();

function memGet<T>(key: string): T | null {
  const entry = memStore.get(key) as MemEntry<T> | undefined;
  if (!entry || Date.now() > entry.expiresAt) { memStore.delete(key); return null; }
  return entry.data;
}
function memSet<T>(key: string, data: T, ttlMs: number): void {
  memStore.set(key, { data, expiresAt: Date.now() + ttlMs });
}

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

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number,
): Promise<{ data: T; hit: "mem" | "redis" | "miss" }> {
  const fromMem = memGet<T>(key);
  if (fromMem !== null) return { data: fromMem, hit: "mem" };

  const data = await fetcher();
  memSet(key, data, ttlMs);
  return { data, hit: "miss" };
}