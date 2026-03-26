"use client";
import { useState, useRef } from "react";
import styles from "./PreviewBox.module.scss";

interface Props {
  preview: string | null;
  loading: boolean;
  error?: string | null;
  generatedAt?: string | null;
  onGenerate: () => void;
  // Match info for share card
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  matchDate?: string;
}

// ── AI Personality Engine ────────────────────────────────────────────────────
function getPreviewPersonality(preview: string | null) {
  if (!preview) return { emoji: "📋", message: "Generate a preview to unlock insights.", tone: "neutral" };

  const lower = preview.toLowerCase();
  let emoji = "📺";
  let message = "";
  let tone = "neutral";

  // Detect storyline types and return appropriate tone for styling
  const hasRivalry = lower.includes("rivalry") || lower.includes("grudge") || lower.includes("feud");
  const hasForm = lower.includes("form") || lower.includes("struggling") || lower.includes("flying");
  const hasInjury = lower.includes("injury") || lower.includes("absence") || lower.includes("missing");
  const hasUnderdog = lower.includes("underdog") || lower.includes("upset") || lower.includes("giant-killing");
  const hasClash = lower.includes("clash") || lower.includes("battle") || lower.includes("showdown");
  const hasMomentum = lower.includes("momentum") || lower.includes("turning point") || lower.includes("shift");

  // Generate personality message - feel human, exciting, confident
  if (hasRivalry || hasClash) {
    emoji = "⚡";
    message = `This is going to be spicy. All the ingredients for a memorable match are here.`;
    tone = "rivalry";
  } else if (hasUnderdog) {
    emoji = "🎯";
    message = `This is why we love football. The underdogs are ready to make a statement.`;
    tone = "underdog";
  } else if (hasForm) {
    emoji = "🔥";
    if (lower.includes("flying")) {
      message = `One side is on fire right now — this is their time to shine.`;
    } else if (lower.includes("struggling")) {
      message = `Form matters here. We're watching a team desperate to turn things around.`;
    } else {
      message = `Form is everything in this one. Watch closely.`;
    }
    tone = "form";
  } else if (hasInjury) {
    emoji = "🏥";
    message = `Key absences will shape how this unfolds. It changes the dynamics.`;
    tone = "injury";
  } else if (hasMomentum) {
    emoji = "🚀";
    message = `Something's brewing here. This could be a pivotal moment.`;
    tone = "momentum";
  } else {
    emoji = "🎬";
    message = `All the storylines are set. Time to see it unfold.`;
    tone = "clash";
  }

  return { emoji, message, tone };
}

// ── Round rect helper ──────────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── Share card generator ──────────────────────────────────────────────────────
function generatePreviewShareCard(opts: {
  homeTeam: string;
  awayTeam: string;
  competition: string;
  preview: string;
  emoji: string;
  message: string;
}): Promise<string> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d")!;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
    bg.addColorStop(0, "#0a0a0f");
    bg.addColorStop(1, "#12121a");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1080, 1080);

    // Accent glow top-left
    const glow = ctx.createRadialGradient(200, 200, 0, 200, 200, 500);
    glow.addColorStop(0, "rgba(255,75,43,0.18)");
    glow.addColorStop(1, "rgba(255,75,43,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, 1080, 1080);

    // Border
    ctx.strokeStyle = "rgba(255,75,43,0.4)";
    ctx.lineWidth = 3;
    roundRect(ctx, 24, 24, 1032, 1032, 24);
    ctx.stroke();

    // Top accent bar
    ctx.fillStyle = "#FF4B2B";
    ctx.fillRect(24, 24, 1032, 6);

    // MATCHINSENSE logo text
    ctx.fillStyle = "#FF4B2B";
    ctx.font = "bold 28px monospace";
    ctx.fillText("MATCHINSENSE", 60, 100);

    // AI badge
    ctx.fillStyle = "#FF4B2B";
    roundRect(ctx, 60, 118, 100, 28, 5);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 14px monospace";
    ctx.fillText("AI PREVIEW", 75, 137);

    // Competition
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "22px sans-serif";
    ctx.fillText(opts.competition.toUpperCase(), 60, 200);

    // Divider line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 220);
    ctx.lineTo(1020, 220);
    ctx.stroke();

    // Teams
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px sans-serif";
    const teamsText = `${opts.homeTeam}  vs  ${opts.awayTeam}`;
    const teamsW = ctx.measureText(teamsText).width;
    ctx.fillText(teamsText, (1080 - teamsW) / 2, 340);

    // VS accent
    ctx.fillStyle = "rgba(255,75,43,0.7)";
    ctx.font = "bold 64px sans-serif";
    const homeOnlyW = ctx.measureText(opts.homeTeam).width;
    const vsOnly = `  vs  `;
    ctx.fillText(vsOnly, (1080 - teamsW) / 2 + homeOnlyW, 340);

    // Personality message box
    ctx.fillStyle = "rgba(255,75,43,0.12)";
    roundRect(ctx, 60, 400, 960, 140, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,75,43,0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 60, 400, 960, 140, 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "16px monospace";
    ctx.fillText("ANALYST VIEW", 90, 435);

    ctx.font = "52px sans-serif";
    ctx.fillText(opts.emoji, 90, 490);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "26px sans-serif";
    const words = opts.message.split(" ");
    let line = "";
    let y = 450;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > 800 && line !== "") {
        ctx.fillText(line, 160, y);
        line = word + " ";
        y += 36;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, 160, y);

    // Preview excerpt box
    const previewLines = opts.preview.split("\n").slice(0, 3).join(" ");
    const shortPreview =
      previewLines.substring(0, 200) +
      (previewLines.length > 200 ? "..." : "");

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, 60, 580, 960, 240, 16);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = "18px sans-serif";
    ctx.fillText("KEY INSIGHTS", 90, 625);

    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "22px sans-serif";
    const previewWords = shortPreview.split(" ");
    let previewLine = "";
    let previewY = 670;
    for (const word of previewWords) {
      const test = previewLine + word + " ";
      if (ctx.measureText(test).width > 880 && previewLine !== "") {
        ctx.fillText(previewLine, 90, previewY);
        previewLine = word + " ";
        previewY += 40;
      } else {
        previewLine = test;
      }
    }
    ctx.fillText(previewLine, 90, previewY);

    // Disclaimer
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "18px sans-serif";
    const disc = "For entertainment only — not financial advice";
    const discW = ctx.measureText(disc).width;
    ctx.fillText(disc, (1080 - discW) / 2, 880);

    // Bottom branding
    ctx.strokeStyle = "rgba(255,75,43,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(60, 920);
    ctx.lineTo(1020, 920);
    ctx.stroke();

    ctx.fillStyle = "#FF4B2B";
    ctx.font = "bold 24px monospace";
    ctx.fillText("matchinsense.com", 60, 970);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "20px sans-serif";
    ctx.fillText("AI-Powered Football Intelligence", 60, 1000);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        resolve(url);
      }
    }, "image/png");
  });
}

export default function PreviewBox({
  preview,
  loading,
  error,
  generatedAt,
  onGenerate,
  homeTeam,
  awayTeam,
  competition,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function handleCopy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function handleShare() {
    if (!preview || !homeTeam || !awayTeam || !competition) return;
    setSharing(true);
    try {
      const personality = getPreviewPersonality(preview);
      const imageUrl = await generatePreviewShareCard({
        homeTeam,
        awayTeam,
        competition,
        preview,
        emoji: personality.emoji,
        message: personality.message,
      });

      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${homeTeam}-vs-${awayTeam}-preview.png`;
      link.click();
      URL.revokeObjectURL(imageUrl);
    } catch (err) {
      console.error("[PreviewBox] Share error:", err);
    } finally {
      setSharing(false);
    }
  }

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const personality = getPreviewPersonality(preview);

  return (
    <div className={styles.box}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.chip}>AI</span>
          <h3 className={styles.title}>Match Preview</h3>
          {timeLabel && (
            <span className={styles.timestamp}>Generated {timeLabel}</span>
          )}
        </div>
        <div className={styles.headerActions}>
          {preview && (
            <button
              className={styles.iconBtn}
              onClick={handleShare}
              title="Share Preview"
              disabled={sharing}
            >
              {sharing ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  style={{ animation: "spin 1s linear infinite" }}
                >
                  <circle cx="12" cy="12" r="1" />
                  <circle cx="19" cy="5" r="1" />
                  <circle cx="9" cy="21" r="1" />
                  <line x1="12" y1="13" x2="18.5" y2="5.5" />
                  <line x1="12" y1="13" x2="9" y2="21" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
              )}
            </button>
          )}
          {preview && (
            <button
              className={styles.iconBtn}
              onClick={onGenerate}
              title="Regenerate"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 12a9 9 0 1018 0 9 9 0 00-9-9 9 9 0 00-6.36 2.64" />
                <polyline points="3 3 3 9 9 9" />
              </svg>
            </button>
          )}
          {preview && (
            <button
              className={styles.iconBtn}
              onClick={handleCopy}
              title="Copy"
            >
              {copied ? (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
              )}
            </button>
          )}
        </div>
      </div>

      <div className={styles.body}>
        {!preview && !loading && (
          <div className={styles.idle}>
            <div className={styles.idleIcon}>
              <svg
                width="38"
                height="38"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </div>
            <p className={styles.idleTitle}>Before kick-off analysis</p>
            <p className={styles.idleText}>
              Get a journalist-style preview — storylines, key battles, form guide
              and a final prediction.
            </p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Generate Preview
            </button>
          </div>
        )}

        {loading && (
          <div className={styles.loadingState}>
            <div className={styles.dots}>
              <span />
              <span />
              <span />
            </div>
            <p className={styles.loadingLabel}>Scouting the teams…</p>
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorState}>
            <p className={styles.errorText}>⚠ {error}</p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              Try Again
            </button>
          </div>
        )}

        {preview && !loading && (
          <>
            {/* AI Personality Card */}
            <div className={`${styles.personalityCard} ${styles[`personality_${personality.tone}`]}`}>
              <span className={styles.personalityEmoji}>
                {personality.emoji}
              </span>
              <p className={styles.personalityText}>{personality.message}</p>
            </div>

            {/* Preview Content with Card Sections */}
            <div className={styles.previewContent}>
              {preview
                .split("\n\n")
                .filter(Boolean)
                .map((para, i) => (
                  <div key={i} className={styles.paragraph}>
                    {para}
                  </div>
                ))}
            </div>

            {/* Share Section */}
            <div className={styles.shareSection}>
              <button
                className={styles.shareCta}
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? "Creating share card…" : "📱 Share Preview"}
              </button>
            </div>
          </>
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
