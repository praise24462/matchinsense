/**
 * quotaCache.ts — Shared cache for all api-football calls
 * 
 * TTLs designed to preserve the 100/day quota:
 * - Match detail (live):     60 seconds
 * - Match detail (finished): 7 days (never changes)
 * - Match detail (upcoming): 1 hour
 * - Lineups:                 6 hours
 * - Today's matches:         5 minutes if live, 10 minutes if not
 * - Past matches:            7 days
 * - Team/club history:       24 hours
 */

interface Entry { data: any; expiresAt: number; }
const store = new Map<string, Entry>();

export function qcGet<T>(key: string): T | null {
  const e = store.get(key);
  if (!e || Date.now() > e.expiresAt) { store.delete(key); return null; }
  return e.data as T;
}

export function qcSet(key: string, data: any, ttlMs: number) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// TTL helpers
export const QC_TTL = {
  LIVE:      60 * 1000,           // 1 min
  UPCOMING:  60 * 60 * 1000,      // 1 hour
  FINISHED:  7 * 24 * 60 * 60 * 1000, // 7 days — never changes
  LINEUPS:   6 * 60 * 60 * 1000,  // 6 hours
  STANDINGS: 24 * 60 * 60 * 1000, // 24 hours
  TEAM:      24 * 60 * 60 * 1000, // 24 hours
  MATCHES_LIVE: 60 * 1000,        // 1 min
  MATCHES_IDLE: 10 * 60 * 1000,   // 10 min
  MATCHES_PAST: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export function ttlForStatus(status: string): number {
  if (["FT","AET","PEN","AWD","WO"].includes(status)) return QC_TTL.FINISHED;
  if (["LIVE","HT"].includes(status)) return QC_TTL.LIVE;
  return QC_TTL.UPCOMING;
}