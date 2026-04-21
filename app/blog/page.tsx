import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Football Blog — MatchInsense" };

export default async function BlogPage() {
  // Fetch published articles from API
  let articles: any[] = [];
  let error = false;

  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/blog/articles?limit=50`, {
      next: { revalidate: 3600 }, // Revalidate every hour
    });
    const data = await res.json();
    articles = data.articles || [];
  } catch (err) {
    console.error("Failed to fetch articles:", err);
    error = true;
  }

  if (error || articles.length === 0) {
    return (
      <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>
        <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>
              Insights
            </p>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>
              Football Blog
            </h1>
            <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>
              AI-powered match analysis, predictions, and insights updated daily.
            </p>
          </div>
        </div>

        <div style={{ maxWidth: 720, margin: "0 auto", padding: "60px 20px" }}>
          <div style={{ textAlign: "center", color: "var(--text-2)" }}>
            <p style={{ fontSize: 16, marginBottom: 24 }}>No articles yet. Check back soon!</p>
            <Link href="/" style={{ color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>
            Insights
          </p>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 10px" }}>
            Football Blog
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.7, margin: 0 }}>
            AI-powered match analysis, predictions, and insights updated daily.
          </p>
        </div>
      </div>

      {/* Articles Grid */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px 80px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {articles.map((article) => (
            <Link
              key={article.id}
              href={`/blog/${article.slug}`}
              style={{ textDecoration: "none" }}
            >
              <article
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  padding: "24px",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-1)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                }}
              >
                {/* Meta Info */}
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, fontSize: 12, color: "var(--text-3)" }}>
                  <span style={{ fontWeight: 600 }}>{article.league}</span>
                  <span>•</span>
                  <span>
                    {article.publishedAt
                      ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                  <span>•</span>
                  <span>{article.wordCount} words</span>
                </div>

                {/* Title */}
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", margin: "0 0 8px", lineHeight: 1.4 }}>
                  {article.title}
                </h2>

                {/* Match Info */}
                <p style={{ fontSize: 13, color: "var(--text-2)", margin: "0 0 12px" }}>
                  {article.homeTeam} vs {article.awayTeam}
                </p>

                {/* Preview/Description */}
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-2)",
                    lineHeight: 1.6,
                    margin: "0 0 16px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {article.metaDescription ||
                    article.content.substring(0, 150).replace(/<[^>]*>/g, "").trim() + "..."}
                </p>

                {/* Read More */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 13, fontWeight: 600 }}>
                  Read article
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
