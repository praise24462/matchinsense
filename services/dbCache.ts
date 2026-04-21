/**
 * dbCache.ts — Database-persisted cache (async interface)
 * 
 * Wraps apiCache to provide async interface for server-side caching
 * persisted across all server instances
 */

import { getCache, setCache, ttlForStatus as getTtlForStatus } from "./apiCache";

export function ttlForStatus(status: string): number {
  return getTtlForStatus(status);
}

export async function dbGet<T>(key: string): Promise<T | null> {
  return getCache<T>(key);
}

export async function dbSet<T>(
  key: string,
  data: T,
  ttlMs: number,
): Promise<void> {
  setCache(key, data, ttlMs);
}
