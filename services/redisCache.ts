import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function getCached<T>(key: string): Promise<T | null> {
  return await redis.get<T>(key);
}

export async function setCached(key: string, value: any, ttlSeconds = 3600) {
  await redis.set(key, value, { ex: ttlSeconds });
}