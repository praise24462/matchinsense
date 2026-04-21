import { generateFootballArticle } from "@/services/contentGenerator";
import type { MatchData } from "@/services/contentGenerator";

/**
 * POST /api/generate-article
 * 
 * Generates SEO-optimized football content from match data
 * 
 * Request body:
 * {
 *   "homeTeam": "Arsenal",
 *   "awayTeam": "Chelsea",
 *   "league": "Premier League",
 *   "homeForm": "W W D W",
 *   "awayForm": "L D W L",
 *   "homeStats": { "shots": 15, "possession": 62, ... },
 *   "awayStats": { "shots": 7, "possession": 38, ... },
 *   "isUpcoming": true
 * }
 */
export async function POST(request: Request) {
  try {
    const body: MatchData = await request.json();

    // Validate required fields
    if (!body.homeTeam || !body.awayTeam || !body.league) {
      return Response.json(
        { error: "Missing required fields: homeTeam, awayTeam, league" },
        { status: 400 }
      );
    }

    // Generate article
    const article = generateFootballArticle(body);

    return Response.json(
      {
        success: true,
        article: {
          title: article.title,
          slug: article.slug,
          markdown: article.markdown,
          html: article.html,
          keywords: article.keywords,
          wordCount: article.wordCount,
          metadata: {
            introduction: article.introduction,
            keyStats: article.keyStats,
            analysis: article.analysis,
            prediction: article.prediction,
            implications: article.implications,
            conclusion: article.conclusion,
          },
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      { error: "Failed to generate article", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/generate-article
 * 
 * Returns example articles for testing
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const example = searchParams.get("example");

  if (example === "list") {
    return Response.json(
      {
        examples: [
          {
            name: "Arsenal vs Chelsea",
            key: "arsenal-vs-chelsea",
          },
          {
            name: "Manchester City vs Liverpool",
            key: "man-city-vs-liverpool",
          },
          {
            name: "Real Madrid vs Barcelona",
            key: "real-madrid-vs-barcelona",
          },
          {
            name: "PSV vs Ajax",
            key: "psv-vs-ajax",
          },
        ],
      },
      { status: 200 }
    );
  }

  // Return API documentation
  return Response.json(
    {
      endpoint: "/api/generate-article",
      description: "Generates SEO-optimized football blog articles from match data",
      methods: {
        POST: {
          description: "Generate article from match data",
          requestBody: {
            homeTeam: "string (required)",
            awayTeam: "string (required)",
            league: "string (required)",
            homeForm: "string (optional, e.g., 'W W D L')",
            awayForm: "string (optional)",
            homeStats: {
              shots: "number",
              possession: "number",
              foulsCommitted: "number",
              corners: "number",
            },
            awayStats: {
              shots: "number",
              possession: "number",
              foulsCommitted: "number",
              corners: "number",
            },
            isUpcoming: "boolean (optional, default: false)",
            recentResult: {
              score: "string (e.g., '2-1')",
              winner: "string",
            },
          },
          responseFormat: {
            title: "SEO-optimized article title",
            slug: "URL-friendly slug",
            markdown: "Full article in markdown",
            html: "Full article in HTML",
            keywords: "Array of SEO keywords",
            wordCount: "Total word count",
          },
        },
        GET: {
          description: "Get API documentation or example articles",
          queryParams: {
            example: "Set to 'list' to see available examples",
          },
        },
      },
      example: {
        request: {
          method: "POST",
          url: "/api/generate-article",
          body: {
            homeTeam: "Arsenal",
            awayTeam: "Chelsea",
            league: "Premier League",
            homeForm: "W W D W",
            awayForm: "L D W L",
            homeStats: {
              shots: 15,
              possession: 62,
            },
            awayStats: {
              shots: 7,
              possession: 38,
            },
            isUpcoming: true,
          },
        },
      },
    },
    { status: 200 }
  );
}
