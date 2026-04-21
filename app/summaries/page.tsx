"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import styles from "./summaries.module.scss";

interface StoredSummary {
  id: string;
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  score: string;
  competition: string;
  type: "preview" | "report" | "prediction";
  text: string;
  createdAt: string;
  source: string;
}

function loadSummaries(): StoredSummary[] {
  try { return JSON.parse(localStorage.getItem("matchinsense_summaries") ?? "[]"); }
  catch { return []; }
}

const TYPE_LABELS = { preview: "AI Preview", report: "Match Report", prediction: "Prediction" };
const TYPE_COLORS = { preview: styles.typePreview, report: styles.typeReport, prediction: styles.typePrediction };

// ── Custom confirm dialog ─────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, onConfirm, onCancel, danger = false,
}: {
  title: string; message: string;
  onConfirm: () => void; onCancel: () => void; danger?: boolean;
}) {
  return (
    <div className={styles.dialogOverlay} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()}>
        <div className={styles.dialogIcon}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </div>
        <h3 className={styles.dialogTitle}>{title}</h3>
        <p className={styles.dialogMessage}>{message}</p>
        <div className={styles.dialogActions}>
          <button className={styles.dialogCancel} onClick={onCancel}>Cancel</button>
          <button className={`${styles.dialogConfirm} ${danger ? styles.dialogDanger : ""}`} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SummariesPage() {
  const [summaries, setSummaries] = useState<StoredSummary[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [filter, setFilter]       = useState<"all" | "preview" | "report" | "prediction">("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showClearAll, setShowClearAll] = useState(false);

  const reload = useCallback(() => {
    setSummaries(loadSummaries());
  }, []);

  useEffect(() => {
    // Load on mount
    reload();

    // Reload whenever localStorage changes (works across same-tab navigation too)
    const onStorage = (e: StorageEvent) => {
      if (e.key === "matchinsense_summaries" || e.key === null) reload();
    };

    // Reload when tab becomes visible (user switches back to this tab)
    const onVisible = () => {
      if (document.visibilityState === "visible") reload();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", reload);

    return () => {
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);

  function confirmDelete(id: string) {
    setDeleteTarget(id);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const updated = summaries.filter(s => s.id !== deleteTarget);
    setSummaries(updated);
    localStorage.setItem("matchinsense_summaries", JSON.stringify(updated));
    setDeleteTarget(null);
  }

  function handleClearAll() {
    setSummaries([]);
    localStorage.removeItem("matchinsense_summaries");
    setShowClearAll(false);
  }

  const filtered = summaries.filter(s => filter === "all" || s.type === filter);

  return (
    <div className={styles.page}>
      <div className={styles.container}>

        {/* Header */}
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>AI Reports</h1>
            <p className={styles.subtitle}>Previews, match reports and predictions you've generated</p>
          </div>
          {summaries.length > 0 && (
            <button className={styles.clearBtn} onClick={() => setShowClearAll(true)}>Clear all</button>
          )}
        </div>

        {/* Filter tabs */}
        {summaries.length > 0 && (
          <div className={styles.filters}>
            {(["all", "preview", "report", "prediction"] as const).map(f => (
              <button key={f}
                className={`${styles.filterBtn} ${filter === f ? styles.filterActive : ""}`}
                onClick={() => setFilter(f)}>
                {f === "all" ? `All (${summaries.length})` : TYPE_LABELS[f]}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {summaries.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No AI reports yet</h2>
            <p className={styles.emptyText}>Open any match and tap <strong>Generate</strong> on the AI Preview, Match Report or Prediction — it saves here automatically.</p>
            <Link href="/" className={styles.browseBtn}>Browse matches →</Link>
          </div>
        )}

        {/* List */}
        {filtered.length > 0 && (
          <div className={styles.list}>
            {filtered.map(s => (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardMeta}>
                    <span className={`${styles.typeBadge} ${TYPE_COLORS[s.type]}`}>{TYPE_LABELS[s.type]}</span>
                    <span className={styles.competition}>{s.competition}</span>
                  </div>
                  <div className={styles.cardActions}>
                    <span className={styles.cardDate}>
                      {new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </span>
                    <button className={styles.deleteBtn} onClick={() => confirmDelete(s.id)} title="Delete report">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M3 6h18M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <div className={styles.matchLine}>
                  <span className={styles.teams}>{s.homeTeam} vs {s.awayTeam}</span>
                  {s.score && <span className={styles.score}>{s.score}</span>}
                </div>

                <div className={`${styles.textWrap} ${expanded === s.id ? styles.textExpanded : ""}`}>
                  <p className={styles.text}>{s.text}</p>
                </div>

                <div className={styles.cardFooter}>
                  <button className={styles.expandBtn} onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                    {expanded === s.id ? "Show less ↑" : "Read more ↓"}
                  </button>
                  <Link href={`/match/${s.matchId}?source=${s.source}`} className={styles.viewMatchBtn}>
                    View match →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {filtered.length === 0 && summaries.length > 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyText}>No {TYPE_LABELS[filter as keyof typeof TYPE_LABELS]} reports saved yet.</p>
          </div>
        )}
      </div>

      {/* Delete single report dialog */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete this report?"
          message="This AI report will be permanently removed from your device. This cannot be undone."
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          danger
        />
      )}

      {/* Clear all dialog */}
      {showClearAll && (
        <ConfirmDialog
          title="Delete all reports?"
          message="All saved AI reports will be permanently deleted from your device. This cannot be undone."
          onConfirm={handleClearAll}
          onCancel={() => setShowClearAll(false)}
          danger
        />
      )}
    </div>
  );
}