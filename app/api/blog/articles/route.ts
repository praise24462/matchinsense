import { db } from "@/services/prisma";

/**
 * GET /api/blog/articles
 * Get all published articles with pagination
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const league = searchParams.get("league");
    const search = searchParams.get("search");

    const skip = (page - 1) * limit;

    // Build filter
    const where: any = {
      publishedAt: { not: null },
    };

    if (league) {
      where.league = league;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { content: { contains: search, mode: "insensitive" } },
        { homeTeam: { contains: search, mode: "insensitive" } },
        { awayTeam: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get articles
    const articles = await db.blogArticle.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        homeTeam: true,
        awayTeam: true,
        league: true,
        wordCount: true,
        views: true,
        publishedAt: true,
        metaDescription: true,
      },
    });

    // Get total count
    const total = await db.blogArticle.count({ where });

    return Response.json({
      success: true,
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[/api/blog/articles] Error:", error);
    return Response.json({ error: "Failed to fetch articles", details: String(error) }, { status: 500 });
  }
}
