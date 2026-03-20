"use client";
import { useState } from "react";
import styles from "./PreviewBox.module.scss";

interface Props {
  preview: string | null;
  loading: boolean;
  error?: string | null;
  generatedAt?: string | null;
  onGenerate: () => void;
}

export default function PreviewBox({ preview, loading, error, generatedAt, onGenerate }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
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
          <h3 className={styles.title}>Match Preview</h3>
          {timeLabel && <span className={styles.timestamp}>Generated {timeLabel}</span>}
        </div>
        <div className={styles.headerActions}>
          {preview && (
            <button className={styles.iconBtn} onClick={onGenerate} title="Regenerate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1018 0 9 9 0 00-9-9 9 9 0 00-6.36 2.64"/><polyline points="3 3 3 9 9 9"/>
              </svg>
            </button>
          )}
          {preview && (
            <button className={styles.iconBtn} onClick={handleCopy} title="Copy">
              {copied
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {!preview && !loading && (
          <div className={styles.idle}>
            <div className={styles.idleIcon}>
              {/* Eye / telescope icon */}
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </div>
            <p className={styles.idleTitle}>Before kick-off analysis</p>
            <p className={styles.idleText}>
              Get a journalist-style preview — storylines, key battles, form guide and a final prediction.
            </p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              Generate Preview
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.dots}><span /><span /><span /></div>
            <p className={styles.loadingLabel}>Scouting the teams…</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorState}>
            <p className={styles.errorText}>⚠ {error}</p>
            <button className={styles.generateBtn} onClick={onGenerate}>Try Again</button>
          </div>
        )}

        {preview && !loading && (
          <div className={styles.content}>
            {preview.split("\n\n").filter(Boolean).map((para, i) => (
              <p key={i} className={styles.para}>{para}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
