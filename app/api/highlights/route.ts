/**
 * /api/highlights?home=X&away=Y&league=Z&date=YYYY-MM-DD
 *
 * Finds a YouTube highlight video for a finished match.
 * Uses YouTube's public search — no API key required.
 * Searches for the most relevant highlight video and returns its videoId.
 */

import { NextRequest, NextResponse } from "next/server";

// Simple in-memory cache — highlights don't change once uploaded
const cache = new Map<string, { videoId: string | null; at: number }>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export async function GET(req: NextRequest) {
  const url    = new URL(req.url);
  const home   = url.searchParams.get("home") ?? "";
  const away   = url.searchParams.get("away") ?? "";
  const league = url.searchParams.get("league") ?? "";
  const date   = url.searchParams.get("date") ?? "";

  if (!home || !away) return NextResponse.json({ videoId: null });

  const cacheKey = `${home}:${away}:${date}`;
  const cached   = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return NextResponse.json({ videoId: cached.videoId });
  }

  // Build search query — most specific first
  const matchYear = date ? new Date(date).getFullYear() : new Date().getFullYear();
  const query     = `${home} vs ${away} highlights ${matchYear}`;

  try {
    // Scrape YouTube search results page — no API key needed
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      next: { revalidate: 1800 }, // 30 min Next.js cache
    });

    if (!res.ok) {
      cache.set(cacheKey, { videoId: null, at: Date.now() });
      return NextResponse.json({ videoId: null });
    }

    const html = await res.text();

    // Extract videoIds from YouTube's initial data JSON embedded in the page
    const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/g);
    if (!match || match.length === 0) {
      cache.set(cacheKey, { videoId: null, at: Date.now() });
      return NextResponse.json({ videoId: null });
    }

    // Get unique video IDs (first few are most relevant)
    const ids = [...new Set(match.map(m => m.replace(/"videoId":"/, "").replace(/"/, "")))];

    // Pick the first one — YouTube's ranking puts the best match first
    const videoId = ids[0] ?? null;

    cache.set(cacheKey, { videoId, at: Date.now() });
    return NextResponse.json({ videoId });

  } catch (err) {
    console.error("highlights error:", err);
    cache.set(cacheKey, { videoId: null, at: Date.now() });
    return NextResponse.json({ videoId: null });
  }
}