import { db } from "@/services/prisma";
import { generateFootballArticle } from "@/services/contentGenerator";
import type { MatchData } from "@/services/contentGenerator";

/**
 * POST /api/blog/publish
 * Publish a new article from match data
 * 
 * This endpoint is called by the scheduler to publish daily articles
 */
export async function POST(request: Request) {
  try {
    const body: MatchData = await request.json();

    // Validate
    if (!body.homeTeam || !body.awayTeam || !body.league) {
      return Response.json(
        { error: "Missing required fields: homeTeam, awayTeam, league" },
        { status: 400 }
      );
    }

    // Check if article already exists
    const slug = `${body.homeTeam.toLowerCase()}-${body.awayTeam.toLowerCase()}-${
      body.isUpcoming ? "preview" : "analysis"
    }`.replace(/\s+/g, "-");

    const existing = await db.blogArticle.findUnique({
      where: { slug },
    });

    if (existing) {
      return Response.json(
        { error: "Article already exists", slug },
        { status: 409 }
      );
    }

    // Generate article
    const article = generateFootballArticle(body);

    // Save to database
    const savedArticle = await db.blogArticle.create({
      data: {
        title: article.title,
        slug: article.slug,
        content: article.markdown,
        htmlContent: article.html,
        homeTeam: body.homeTeam,
        awayTeam: body.awayTeam,
        league: body.league,
        keywords: article.keywords.join(", "),
        wordCount: article.wordCount,
        isUpcoming: body.isUpcoming !== false,
        matchDate: body.matchDate ? new Date(body.matchDate) : null,
        metaDescription: article.introduction.substring(0, 160),
        publishedAt: new Date(),
      },
    });

    return Response.json(
      {
        success: true,
        article: {
          id: savedArticle.id,
          title: savedArticle.title,
          slug: savedArticle.slug,
          url: `/blog/${savedArticle.slug}`,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error publishing article:", error);
    return Response.json(
      { 
        error: "Failed to publish article",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/blog/publish
 * Get publishing statistics
 */
export async function GET() {
  try {
    const total = await db.blogArticle.count();
    const published = await db.blogArticle.count({
      where: { publishedAt: { not: null } },
    });
    const pending = await db.blogArticle.count({
      where: { publishedAt: null },
    });

    const thisMonth = await db.blogArticle.count({
      where: {
        publishedAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return Response.json({
      stats: {
        total,
        published,
        pending,
        thisMonth,
      },
    });
  } catch (error) {
    return Response.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
