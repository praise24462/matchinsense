"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./saved.module.scss";

// Saved matches now stored in localStorage (no auth required)
interface SavedReport {
  id: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  score: string;
  competition: string;
  type: "preview" | "report" | "prediction";
  text: string;
  source: string;
  createdAt: string;
}

export default function SavedMatchesPage() {
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("matchinsense_summaries");
      const data = raw ? JSON.parse(raw) : [];
      setSaved(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  function handleRemove(id: string) {
    const updated = saved.filter(s => s.id !== id);
    setSaved(updated);
    localStorage.setItem("matchinsense_summaries", JSON.stringify(updated));
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Saved Matches</h1>
            <p className={styles.pageSubtitle}>Your AI reports and bookmarked fixtures</p>
          </div>
          {saved.length > 0 && <span className={styles.countBadge}>{saved.length}</span>}
        </div>

        {loading && (
          <div className={styles.state}>
            <div className={styles.spinner}/>
            <p>Loading…</p>
          </div>
        )}

        {!loading && saved.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔖</div>
            <h2 className={styles.emptyTitle}>No saved matches yet</h2>
            <p className={styles.emptyText}>
              Open any match and generate an AI Report or Prediction — it will be saved here automatically.
            </p>
            <Link href="/" className={styles.browseBtn}>Browse matches →</Link>
          </div>
        )}

        {!loading && saved.length > 0 && (
          <div className={styles.list}>
            {saved.map(s => (
              <div key={s.id} className={styles.card}>
                <Link href={`/match/${s.matchId}?source=${s.source}`} className={styles.matchPreview}>
                  <div className={styles.matchLeague}>
                    <span>{s.competition}</span>
                    <span className={`${styles.statusPill} ${
                      s.type === "report" ? styles.statusFT :
                      s.type === "preview" ? styles.statusNS : styles.statusLive
                    }`}>
                      {s.type === "report" ? "Match Report" : s.type === "preview" ? "Preview" : "Prediction"}
                    </span>
                  </div>
                  <div className={styles.matchBody}>
                    <div className={styles.teamRow}>
                      <span className={styles.teamName}>{s.homeTeam}</span>
                    </div>
                    <div className={styles.scoreBox}>
                      {s.score ? (
                        <span className={styles.scoreDigit}>{s.score}</span>
                      ) : (
                        <span className={styles.scoreVs}>vs</span>
                      )}
                    </div>
                    <div className={`${styles.teamRow} ${styles.teamRowAway}`}>
                      <span className={styles.teamName}>{s.awayTeam}</span>
                    </div>
                  </div>
                  <div className={styles.matchDate}>
                    {new Date(s.createdAt).toLocaleDateString("en-GB", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric"
                    })}
                  </div>
                </Link>
                <button className={styles.removeBtn} onClick={() => handleRemove(s.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}