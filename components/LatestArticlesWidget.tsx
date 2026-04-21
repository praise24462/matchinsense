"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Article {
  id: string;
  title: string;
  slug: string;
  homeTeam: string;
  awayTeam: string;
  league: string;
  wordCount: number;
  publishedAt: string;
  metaDescription?: string;
}

export function LatestArticlesWidget() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchArticles = async () => {
      try {
        const res = await fetch("/api/blog/articles?limit=3");
        const data = await res.json();
        setArticles(data.articles || []);
      } catch (error) {
        console.error("Failed to fetch articles:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchArticles();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "24px", textAlign: "center", color: "var(--text-3)" }}>
        Loading articles...
      </div>
    );
  }

  if (articles.length === 0) {
    return null;
  }

  return (
    <section style={{ marginBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--accent)", margin: 0 }}>
          Latest Articles
        </h2>
        <Link href="/blog" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
          View all →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/blog/${article.slug}`}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-lg)",
              padding: "20px",
              textDecoration: "none",
              transition: "all 0.2s ease",
              display: "flex",
              flexDirection: "column",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--accent)";
              el.style.background = "var(--bg-1)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--border)";
              el.style.background = "var(--bg-card)";
            }}
          >
            {/* Match Info */}
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
                {article.league}
              </p>
              <p style={{ fontSize: 12, color: "var(--text-2)", margin: "4px 0 0 0" }}>
                {article.homeTeam} vs {article.awayTeam}
              </p>
            </div>

            {/* Title */}
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 12px", lineHeight: 1.4, flexGrow: 1 }}>
              {article.title}
            </h3>

            {/* Meta */}
            <div style={{ display: "flex", gap: 8, fontSize: 11, color: "var(--text-3)" }}>
              <span>
                {new Date(article.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
              <span>•</span>
              <span>{article.wordCount} words</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
