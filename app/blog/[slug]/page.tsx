import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export async function generateMetadata(
  { params }: { params: { slug: string } },
  parent: any
): Promise<Metadata> {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/blog/articles?search=${params.slug}`, {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    const article = data.articles?.[0];

    if (!article) {
      return { title: "Article Not Found" };
    }

    return {
      title: article.title,
      description: article.metaDescription || `${article.homeTeam} vs ${article.awayTeam} analysis`,
      keywords: article.keywords?.split(",").map((k: string) => k.trim()) || [],
      openGraph: {
        title: article.title,
        description: article.metaDescription || `${article.homeTeam} vs ${article.awayTeam}`,
        type: "article",
        publishedTime: article.publishedAt,
        authors: ["MatchInsense"],
      },
    };
  } catch (error) {
    return { title: "Article Not Found" };
  }
}

export async function generateStaticParams() {
  try {
    const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/blog/articles?limit=100`, {
      next: { revalidate: 86400 }, // Revalidate once per day
    });
    const data = await res.json();
    const articles = data.articles || [];

    return articles.map((article: any) => ({
      slug: article.slug,
    }));
  } catch (error) {
    return [];
  }
}

export default async function ArticlePage({ params }: { params: { slug: string } }) {
  let article: any = null;
  let relatedArticles: any[] = [];

  try {
    // Fetch main article
    const res = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/blog/articles?limit=1&search=${params.slug}`, {
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    article = data.articles?.[0];

    if (!article) {
      notFound();
    }

    // Fetch related articles (same league or teams)
    const relRes = await fetch(`${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/blog/articles?limit=3&league=${article.league}`, {
      next: { revalidate: 3600 },
    });
    const relData = await relRes.json();
    relatedArticles = (relData.articles || []).filter((a: any) => a.slug !== article.slug).slice(0, 3);
  } catch (error) {
    console.error("Error fetching article:", error);
    notFound();
  }

  return (
    <div style={{ minHeight: "100vh", paddingTop: "56px", background: "var(--bg)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-1)", padding: "40px 20px 32px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <Link
            href="/blog"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 13, fontWeight: 600, textDecoration: "none", marginBottom: 16 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to Blog
          </Link>

          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginBottom: 10 }}>
            {article.league}
          </p>

          <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 800, color: "var(--text)", margin: "0 0 12px" }}>
            {article.title}
          </h1>

          <div style={{ display: "flex", gap: 12, fontSize: 13, color: "var(--text-2)" }}>
            <span>
              {article.publishedAt
                ? new Date(article.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : ""}
            </span>
            <span>•</span>
            <span>{article.wordCount} words</span>
            <span>•</span>
            <span>{article.views} views</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        <article
          style={{
            fontSize: 15,
            lineHeight: 1.8,
            color: "var(--text-2)",
          }}
          dangerouslySetInnerHTML={{ __html: article.htmlContent || article.content }}
        />

        {/* Article Footer */}
        <div
          style={{
            marginTop: 60,
            paddingTop: 32,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => {
              const url = `${typeof window !== "undefined" ? window.location.href : ""}`;
              navigator.clipboard.writeText(url);
              alert("Link copied!");
            }}
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              transition: "all 0.2s",
            }}
          >
            Share Article
          </button>
          <Link
            href="/blog"
            style={{
              flex: 1,
              padding: "10px 16px",
              background: "var(--accent)",
              border: "none",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
              textAlign: "center",
              transition: "all 0.2s",
            }}
          >
            View More Articles
          </Link>
        </div>
      </div>

      {/* Related Articles */}
      {relatedArticles.length > 0 && (
        <div style={{ background: "var(--bg-1)", borderTop: "1px solid var(--border)", marginTop: 60, padding: "40px 20px" }}>
          <div style={{ maxWidth: 720, margin: "0 auto" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 24, margin: "0 0 24px" }}>
              Related Articles
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {relatedArticles.map((related) => (
                <Link
                  key={related.id}
                  href={`/blog/${related.slug}`}
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-lg)",
                    padding: "16px",
                    textDecoration: "none",
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <p style={{ fontSize: 11, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
                    {related.league}
                  </p>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginBottom: 8, margin: "0 0 8px" }}>
                    {related.homeTeam} vs {related.awayTeam}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--text-2)", marginTop: "auto", margin: "auto 0 0 0" }}>
                    {new Date(related.publishedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
