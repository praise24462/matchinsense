"use client";
import { useState } from "react";
import Button from "@/components/Button/Button";
import styles from "./SummaryBox.module.scss";

interface Props {
  summary: string | null;
  loading: boolean;
  error?: string | null;
  generatedAt?: string | null;
  onGenerate: () => void;
}

export default function SummaryBox({ summary, loading, error, generatedAt, onGenerate }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!summary) return;
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.chip}>AI</span>
          <h3 className={styles.title}>Match Report</h3>
          {timeLabel && <span className={styles.timestamp}>Generated {timeLabel}</span>}
        </div>
        <div className={styles.headerActions}>
          {summary && (
            <button className={styles.iconBtn} onClick={onGenerate} title="Regenerate">
              <RefreshIcon />
            </button>
          )}
          {summary && (
            <button className={styles.iconBtn} onClick={handleCopy} title="Copy">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {!summary && !loading && (
          <div className={styles.idle}>
            <div className={styles.idleIcon}><SparkleIcon /></div>
            <p className={styles.idleTitle}>Match Report</p>
            <p className={styles.idleText}>
              Get an AI-powered match narrative — goals, tactics, and a full breakdown in seconds.
            </p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              <BoltIcon />
              Generate AI Report
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.dots}><span /><span /><span /></div>
            <p className={styles.loadingLabel}>Analysing match data…</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.idleErrorState}>
            <p style={{color:"var(--red)",fontSize:"13px",marginBottom:"12px"}}>⚠ {error}</p>
            <button className={styles.generateBtn} onClick={onGenerate}>Try Again</button>
          </div>
        )}

        {summary && !loading && (
          <div className={styles.summaryContent}>
            {summary.split("\n\n").filter(Boolean).map((para, i) => (
              <div key={i} className={styles.paragraph}>{para}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1018 0 9 9 0 00-9-9 9 9 0 00-6.36 2.64"/><polyline points="3 3 3 9 9 9"/>
    </svg>
  );
}
function SparkleIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}
