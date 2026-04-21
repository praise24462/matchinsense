/**
 * Blog Article Scheduler
 * 
 * Automatically generates and publishes articles daily
 * Call this service to start the scheduler
 * 
 * Usage:
 * import { startDailyArticleScheduler } from '@/services/blogScheduler'
 * startDailyArticleScheduler()
 */

import { db } from "@/services/prisma";
import { generateFootballArticle } from "@/services/contentGenerator";
import type { MatchData } from "@/services/contentGenerator";

/**
 * Get upcoming matches from the database
 * These will be turned into preview articles
 */
async function getUpcomingMatchesForContent(): Promise<MatchData[]> {
  try {
    // Get matches for the next 7 days
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const matches = await db.match.findMany({
      where: {
        kickoff: {
          gte: now,
          lte: sevenDaysLater,
        },
        status: { in: ["NOT_STARTED", "SCHEDULED"] },
      },
      orderBy: { kickoff: "asc" },
      take: 3, // Generate 3 articles per day max
    });

    return matches.map((match) => ({
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      league: match.leagueName,
      matchDate: match.kickoff.toISOString(),
      isUpcoming: true,
      homeStats: {
        possession: 55,
        shots: 12,
      },
      awayStats: {
        possession: 45,
        shots: 10,
      },
    }));
  } catch (error) {
    console.error("Error fetching upcoming matches:", error);
    return [];
  }
}

/**
 * Get recently completed matches for analysis articles
 */
async function getRecentlyCompletedMatches(): Promise<MatchData[]> {
  try {
    // Get matches completed in the last 24 hours
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const matches = await db.match.findMany({
      where: {
        updatedAt: {
          gte: yesterday,
          lte: now,
        },
        status: "FINISHED",
      },
      orderBy: { kickoff: "desc" },
      take: 2, // Generate 2 analysis articles per day
    });

    return matches.map((match) => ({
      homeTeam: match.homeTeamName,
      awayTeam: match.awayTeamName,
      league: match.leagueName,
      matchDate: match.kickoff.toISOString(),
      isUpcoming: false,
      recentResult: {
        score: `${match.scoreHome}-${match.scoreAway}`,
        winner: match.scoreHome! > match.scoreAway! ? match.homeTeamName : match.scoreAway! > match.scoreHome! ? match.awayTeamName : "draw",
      },
    }));
  } catch (error) {
    console.error("Error fetching completed matches:", error);
    return [];
  }
}

/**
 * Publish article to database
 */
async function publishArticle(matchData: MatchData): Promise<{ success: boolean; slug?: string; error?: string }> {
  try {
    // Generate article
    const article = generateFootballArticle(matchData);

    // Check if already exists
    const existing = await db.blogArticle.findUnique({
      where: { slug: article.slug },
    });

    if (existing) {
      return { success: false, error: "Article already exists" };
    }

    // Save article
    await db.blogArticle.create({
      data: {
        title: article.title,
        slug: article.slug,
        content: article.markdown,
        htmlContent: article.html,
        homeTeam: matchData.homeTeam,
        awayTeam: matchData.awayTeam,
        league: matchData.league,
        keywords: article.keywords.join(", "),
        wordCount: article.wordCount,
        isUpcoming: matchData.isUpcoming !== false,
        matchDate: matchData.matchDate ? new Date(matchData.matchDate) : null,
        metaDescription: article.introduction.substring(0, 160),
        publishedAt: new Date(),
      },
    });

    return { success: true, slug: article.slug };
  } catch (error) {
    console.error("Error publishing article:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Run daily scheduler
 * Should be called once when the app starts (in middleware or layout)
 */
export function startDailyArticleScheduler() {
  // Run at 10 AM every day
  const scheduleDaily = () => {
    const now = new Date();
    const target = new Date(now);
    target.setHours(10, 0, 0, 0);

    // If it's already past 10 AM, schedule for tomorrow
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }

    const timeUntilNextRun = target.getTime() - now.getTime();

    console.log(`[Blog Scheduler] Next run scheduled in ${Math.round(timeUntilNextRun / 1000 / 60)} minutes`);

    setTimeout(async () => {
      await runDailyArticleGeneration();
      // Reschedule for next day
      scheduleDaily();
    }, timeUntilNextRun);
  };

  scheduleDaily();
}

/**
 * Execute daily article generation
 */
export async function runDailyArticleGeneration() {
  console.log("[Blog Scheduler] Starting daily article generation...");

  try {
    const [upcomingMatches, completedMatches] = await Promise.all([
      getUpcomingMatchesForContent(),
      getRecentlyCompletedMatches(),
    ]);

    const allMatches = [...upcomingMatches, ...completedMatches];

    if (allMatches.length === 0) {
      console.log("[Blog Scheduler] No matches found to generate articles");
      return;
    }

    console.log(`[Blog Scheduler] Generating ${allMatches.length} articles...`);

    // Publish articles
    const results = await Promise.all(allMatches.map((match) => publishArticle(match)));

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    console.log(`[Blog Scheduler] Complete: ${successful} published, ${failed} failed`);

    results.forEach((result, index) => {
      if (result.success) {
        console.log(`  ✓ ${result.slug}`);
      } else {
        console.log(`  ✗ ${result.error}`);
      }
    });
  } catch (error) {
    console.error("[Blog Scheduler] Error during generation:", error);
  }
}

/**
 * Manual trigger for testing
 * Call this function to immediately generate and publish articles
 */
export async function triggerArticleGeneration() {
  console.log("[Blog Scheduler] Manual trigger started");
  await runDailyArticleGeneration();
}
