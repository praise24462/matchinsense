"use client";
import { useState } from "react";
import styles from "./PredictionBox.module.scss";

interface Props {
  prediction: string | null;
  loading: boolean;
  error?: string | null;
  generatedAt?: string | null;
  isUpcoming: boolean;
  onGenerate: () => void;
}

// Parse the structured output from the AI into labelled rows
function parsePrediction(raw: string) {
  const labels = [
    "PREDICTION", "CONFIDENCE", "BEST BET", "REASONING", "ALSO CONSIDER",
    "RESULT VERDICT", "FORM SIGNAL", "NEXT MATCH WATCH",
  ];
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed: { label: string; value: string }[] = [];

  let current: { label: string; value: string } | null = null;

  for (const line of lines) {
    const matched = labels.find(l => line.toUpperCase().startsWith(l + ":") || line.toUpperCase().startsWith("**" + l + ":**"));
    if (matched) {
      if (current) parsed.push(current);
      const value = line.replace(new RegExp(`^\\*?\\*?${matched}\\*?\\*?:\\s*`, "i"), "").trim();
      current = { label: matched, value };
    } else if (current) {
      current.value += (current.value ? " " : "") + line;
    }
  }
  if (current) parsed.push(current);

  return parsed.length > 0 ? parsed : [{ label: "ANALYSIS", value: raw }];
}

function ConfidenceBadge({ level }: { level: string }) {
  const normalized = level.toLowerCase();
  const cls = normalized.includes("high") ? styles.confHigh
    : normalized.includes("medium") || normalized.includes("med") ? styles.confMed
    : styles.confLow;
  return <span className={`${styles.confBadge} ${cls}`}>{level}</span>;
}

export default function PredictionBox({ prediction, loading, error, generatedAt, isUpcoming, onGenerate }: Props) {
  const [copied, setCopied] = useState(false);
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);

  async function handleCopy() {
    if (!prediction) return;
    await navigator.clipboard.writeText(prediction);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  const parsed = prediction ? parsePrediction(prediction) : [];

  return (
    <div className={styles.box}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.chip}>AI</span>
          <h3 className={styles.title}>{isUpcoming ? "Bet Prediction" : "Betting Insight"}</h3>
          {timeLabel && <span className={styles.timestamp}>Generated {timeLabel}</span>}
        </div>
        <div className={styles.headerActions}>
          {prediction && (
            <button className={styles.iconBtn} onClick={onGenerate} title="Regenerate">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1018 0 9 9 0 00-9-9 9 9 0 00-6.36 2.64"/><polyline points="3 3 3 9 9 9"/>
              </svg>
            </button>
          )}
          {prediction && (
            <button className={styles.iconBtn} onClick={handleCopy} title="Copy">
              {copied
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              }
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer bar — always visible */}
      <div className={styles.disclaimerBar}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>For entertainment only — not financial advice</span>
        <button className={styles.disclaimerToggle} onClick={() => setDisclaimerOpen(v => !v)}>
          {disclaimerOpen ? "Hide" : "Full disclaimer"}
        </button>
      </div>

      {/* Full disclaimer dropdown */}
      {disclaimerOpen && (
        <div className={styles.disclaimerFull}>
          <p>
            <strong>Important:</strong> AI-generated predictions are for <strong>entertainment purposes only</strong>
            and do not constitute financial, betting, or gambling advice. PitchIntel makes no guarantee of accuracy
            and accepts no liability for any losses incurred. Past performance and AI analysis do not guarantee
            future results.
          </p>
          <p>
            Gambling can be addictive. If you are affected by problem gambling, please seek help.
            Visit <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a> or
            call <strong>0808 8020 133</strong> (UK, free).
          </p>
          <p>Must be 18+ to gamble. Please gamble responsibly.</p>
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        {!prediction && !loading && (
          <div className={styles.idle}>
            <div className={styles.idleIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <p className={styles.idleTitle}>{isUpcoming ? "AI Betting Analysis" : "Post-Match Betting Insight"}</p>
            <p className={styles.idleText}>
              {isUpcoming
                ? "Get an AI-generated prediction — best bet, confidence level, key markets and reasoning."
                : "See what this result signals for upcoming fixtures and future markets."
              }
            </p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
              {isUpcoming ? "Generate Prediction" : "Generate Insight"}
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.dots}><span /><span /><span /></div>
            <p className={styles.loadingLabel}>Analysing betting markets…</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.idle}>
            <p style={{color:"var(--red)",fontSize:"13px",textAlign:"center",marginBottom:"14px"}}>⚠ {error}</p>
            <button className={styles.generateBtn} onClick={onGenerate}>Try Again</button>
          </div>
        )}

        {prediction && !loading && (
          <div className={styles.rows}>
            {parsed.map(({ label, value }, i) => (
              <div key={`${label}-${i}`} className={styles.row}>
                <span className={styles.rowLabel}>{label}</span>
                <div className={styles.rowValue}>
                  {label === "CONFIDENCE"
                    ? <ConfidenceBadge level={value} />
                    : label === "PREDICTION"
                      ? <span className={styles.scoreline}>{value}</span>
                      : label === "BEST BET"
                        ? <span className={styles.bestBet}>{value}</span>
                        : <span>{value}</span>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
