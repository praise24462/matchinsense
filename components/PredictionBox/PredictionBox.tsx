"use client";
import { useState, useRef } from "react";
import styles from "./PredictionBox.module.scss";

interface Props {
  prediction: string | null;
  loading: boolean;
  error?: string | null;
  generatedAt?: string | null;
  isUpcoming: boolean;
  onGenerate: () => void;
  // Match info for share card
  homeTeam?: string;
  awayTeam?: string;
  competition?: string;
  matchDate?: string;
}

// ── Parse structured AI output ────────────────────────────────────────────────
function parsePrediction(raw: string) {
  const labels = [
    "PREDICTION", "CONFIDENCE", "BEST BET", "REASONING",
    "ALSO CONSIDER", "RESULT VERDICT", "FORM SIGNAL", "NEXT MATCH WATCH",
  ];
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const parsed: { label: string; value: string }[] = [];
  let current: { label: string; value: string } | null = null;
  for (const line of lines) {
    const matched = labels.find(l =>
      line.toUpperCase().startsWith(l + ":") ||
      line.toUpperCase().startsWith("**" + l + ":**")
    );
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

// ── AI Personality Engine ────────────────────────────────────────────────────
function getPersonality(parsed: { label: string; value: string }[]) {
  const prediction = parsed.find(p => p.label === "PREDICTION")?.value ?? "";
  const confidence = parsed.find(p => p.label === "CONFIDENCE")?.value ?? "";
  const reasoning  = parsed.find(p => p.label === "REASONING")?.value ?? "";
  const bestBet    = parsed.find(p => p.label === "BEST BET")?.value ?? "";

  const conf = confidence.toLowerCase();
  const isHigh   = conf.includes("high") || conf.includes("strong") || conf.includes("9") || conf.includes("8");
  const isLow    = conf.includes("low") || conf.includes("unlikely") || conf.includes("5") || conf.includes("4");
  const isMedium = !isHigh && !isLow;

  // Extract key info
  const hasGoals    = bestBet.toLowerCase().includes("over") || bestBet.toLowerCase().includes("goal");
  const hasBothScore = bestBet.toLowerCase().includes("btts") || bestBet.toLowerCase().includes("both team");
  const predLower   = prediction.toLowerCase();
  const isDraw      = predLower.includes("draw") || predLower.includes("tie");
  const isWin       = predLower.includes("win") || predLower.includes("victory");

  // Generate personality message
  let emoji = "⚽";
  let message = "";

  if (isHigh) {
    emoji = "🔥";
    if (isDraw) {
      message = `This one's balanced — a draw feels inevitable here. ${hasGoals ? "Expect goals either way." : "Tight and cagey."}`;
    } else if (isWin) {
      const team = prediction.split(" ")[0];
      message = `${team} look dominant — this is their game to lose. Back them with confidence.`;
    } else {
      message = `The numbers point clearly in one direction. This is a high-confidence call.`;
    }
  } else if (isMedium) {
    emoji = "📊";
    if (hasGoals) {
      message = `Both sides can score — over 2.5 goals is the smart play here.`;
    } else if (hasBothScore) {
      message = `Both teams will want to make their mark. BTTS looks good value.`;
    } else if (isDraw) {
      message = `Neither side holds a clear edge. A draw wouldn't surprise anyone.`;
    } else {
      message = `The odds lean one way, but this isn't nailed on. Bet sensibly.`;
    }
  } else {
    emoji = "⚠️";
    message = `This one's hard to call. ${reasoning ? reasoning.split(".")[0] + "." : "Tread carefully with your stake."}`;
  }

  return { emoji, message, tone: isHigh ? "high" : isMedium ? "medium" : "low" };
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ level }: { level: string }) {
  const norm = level.toLowerCase();
  const cls  = norm.includes("high") ? styles.confHigh
    : norm.includes("medium") || norm.includes("med") ? styles.confMed
    : styles.confLow;
  return <span className={`${styles.confBadge} ${cls}`}>{level}</span>;
}

// ── Share card generator ──────────────────────────────────────────────────────
function generateShareCard(opts: {
  homeTeam: string; awayTeam: string; competition: string;
  prediction: string; confidence: string; bestBet: string;
  emoji: string; message: string; tone: string;
}): Promise<string> {
  return new Promise(resolve => {
    const canvas = document.createElement("canvas");
    canvas.width  = 1080;
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
    ctx.letterSpacing = "4px";
    ctx.fillText("MATCHINSENSE", 60, 100);

    // AI badge
    ctx.fillStyle = "#FF4B2B";
    roundRect(ctx, 60, 118, 60, 28, 5);
    ctx.fill();
    ctx.fillStyle = "#000";
    ctx.font = "bold 14px monospace";
    ctx.fillText("AI", 82, 137);

    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = "14px monospace";
    ctx.fillText("PREDICTION", 130, 137);

    // Competition
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "22px sans-serif";
    ctx.fillText(opts.competition.toUpperCase(), 60, 200);

    // Divider line
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 220); ctx.lineTo(1020, 220); ctx.stroke();

    // Teams
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 72px sans-serif";
    const teamsText = `${opts.homeTeam}  vs  ${opts.awayTeam}`;
    const teamsW = ctx.measureText(teamsText).width;
    ctx.fillText(teamsText, (1080 - teamsW) / 2, 340);

    // VS accent
    ctx.fillStyle = "rgba(255,75,43,0.6)";
    ctx.font = "bold 48px sans-serif";
    const vsText = "vs";
    const homeW = ctx.measureText(opts.homeTeam + "  ").width;
    ctx.font = "bold 72px sans-serif";
    // Redraw VS in accent color
    ctx.fillStyle = "rgba(255,75,43,0.7)";
    ctx.font = "bold 64px sans-serif";
    const vsOnly = `  vs  `;
    const homeOnlyW = ctx.measureText(opts.homeTeam).width;
    ctx.fillText(vsOnly, (1080 - teamsW) / 2 + homeOnlyW, 340);

    // Prediction box
    ctx.fillStyle = "rgba(255,75,43,0.12)";
    roundRect(ctx, 60, 400, 960, 140, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,75,43,0.35)";
    ctx.lineWidth = 1.5;
    roundRect(ctx, 60, 400, 960, 140, 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "16px monospace";
    ctx.fillText("PREDICTION", 90, 435);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText(opts.prediction, 90, 490);

    // Confidence badge
    const confColor = opts.tone === "high" ? "#22c55e" : opts.tone === "medium" ? "#f59e0b" : "#ef4444";
    ctx.fillStyle = confColor + "22";
    roundRect(ctx, 90, 505, 240, 36, 8);
    ctx.fill();
    ctx.strokeStyle = confColor + "80";
    ctx.lineWidth = 1;
    roundRect(ctx, 90, 505, 240, 36, 8);
    ctx.stroke();
    ctx.fillStyle = confColor;
    ctx.font = "bold 18px monospace";
    ctx.fillText(`● ${opts.confidence}`, 108, 528);

    // Best bet
    if (opts.bestBet) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "16px monospace";
      ctx.fillText("BEST BET", 700, 435);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(opts.bestBet, 700, 490);
    }

    // Personality message box
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, 60, 580, 960, 120, 16);
    ctx.fill();

    ctx.font = "52px sans-serif";
    ctx.fillText(opts.emoji, 90, 650);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "26px sans-serif";
    // Word wrap message
    const words = opts.message.split(" ");
    let line = ""; let y = 622;
    for (const word of words) {
      const test = line + word + " ";
      if (ctx.measureText(test).width > 840 && line !== "") {
        ctx.fillText(line, 160, y);
        line = word + " "; y += 36;
      } else { line = test; }
    }
    ctx.fillText(line, 160, y);

    // Disclaimer
    ctx.fillStyle = "rgba(255,255,255,0.2)";
    ctx.font = "18px sans-serif";
    const disc = "For entertainment only — not financial advice";
    const discW = ctx.measureText(disc).width;
    ctx.fillText(disc, (1080 - discW) / 2, 760);

    // Bottom branding
    ctx.strokeStyle = "rgba(255,75,43,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(60, 820); ctx.lineTo(1020, 820); ctx.stroke();

    ctx.fillStyle = "#FF4B2B";
    ctx.font = "bold 24px monospace";
    ctx.fillText("matchinsense.com", 60, 870);

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "20px sans-serif";
    ctx.fillText("AI-Powered Football Intelligence", 60, 900);

    // Pitch pattern bottom right
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.arc(950, 950, 60 + i * 30, 0, Math.PI * 2);
      ctx.stroke();
    }

    resolve(canvas.toDataURL("image/png"));
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

// ── Main Component ────────────────────────────────────────────────────────────
export default function PredictionBox({
  prediction, loading, error, generatedAt, isUpcoming, onGenerate,
  homeTeam = "Home", awayTeam = "Away", competition = "Football", matchDate,
}: Props) {
  const [copied,          setCopied]         = useState(false);
  const [disclaimerOpen,  setDisclaimerOpen] = useState(false);
  const [sharing,         setSharing]        = useState(false);
  const [shareSuccess,    setShareSuccess]   = useState(false);

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  const parsed = prediction ? parsePrediction(prediction) : [];
  const personality = parsed.length > 0 ? getPersonality(parsed) : null;

  const confidence = parsed.find(p => p.label === "CONFIDENCE")?.value ?? "Medium";
  const predValue  = parsed.find(p => p.label === "PREDICTION")?.value ?? "";
  const bestBet    = parsed.find(p => p.label === "BEST BET")?.value ?? "";

  async function handleCopy() {
    if (!prediction) return;
    await navigator.clipboard.writeText(prediction);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  }

  async function handleShare() {
    if (!prediction || !personality) return;
    setSharing(true);
    try {
      const dataUrl = await generateShareCard({
        homeTeam, awayTeam, competition,
        prediction: predValue, confidence, bestBet,
        emoji: personality.emoji, message: personality.message, tone: personality.tone,
      });

      // Try native share first (mobile)
      if (navigator.share) {
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], "matchinsense-prediction.png", { type: "image/png" });
        await navigator.share({
          title: `${homeTeam} vs ${awayTeam} — AI Prediction`,
          text: `${personality.emoji} ${personality.message}\n\nPrediction: ${predValue} | Confidence: ${confidence}\n\nmatchinsense.com`,
          files: [file],
        });
      } else {
        // Desktop: download the image
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `matchinsense-${homeTeam.toLowerCase().replace(/\s/g,"-")}-vs-${awayTeam.toLowerCase().replace(/\s/g,"-")}.png`;
        a.click();
      }
      setShareSuccess(true);
      setTimeout(() => setShareSuccess(false), 3000);
    } catch (e) {
      // User cancelled share — not an error
    }
    setSharing(false);
  }

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
          {prediction && (
            <button
              className={`${styles.shareBtn} ${shareSuccess ? styles.shareBtnSuccess : ""}`}
              onClick={handleShare}
              disabled={sharing}
              title="Share prediction"
            >
              {sharing ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spin}>
                  <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0"/>
                </svg>
              ) : shareSuccess ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              )}
              <span>{sharing ? "Creating…" : shareSuccess ? "Saved!" : "Share"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
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

      {disclaimerOpen && (
        <div className={styles.disclaimerFull}>
          <p><strong>Important:</strong> AI-generated predictions are for <strong>entertainment purposes only</strong> and do not constitute financial, betting, or gambling advice.</p>
          <p>Gambling can be addictive. Visit <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer">BeGambleAware.org</a> for help.</p>
          <p>Must be 18+ to gamble. Please gamble responsibly.</p>
        </div>
      )}

      {/* Body */}
      <div className={styles.body}>
        {!prediction && !loading && (
          <div className={styles.idle}>
            <div className={styles.idleIcon}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
              </svg>
            </div>
            <p className={styles.idleTitle}>{isUpcoming ? "AI Betting Analysis" : "Post-Match Betting Insight"}</p>
            <p className={styles.idleText}>
              {isUpcoming
                ? "Get an AI-generated prediction — best bet, confidence level, key markets and reasoning."
                : "See what this result signals for upcoming fixtures and future markets."}
            </p>
            <button className={styles.generateBtn} onClick={onGenerate}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
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
          <>
            {/* ── AI Personality Banner ── */}
            {personality && (
              <div className={`${styles.personalityBanner} ${styles[`personality_${personality.tone}`]}`}>
                <span className={styles.personalityEmoji}>{personality.emoji}</span>
                <p className={styles.personalityText}>{personality.message}</p>
              </div>
            )}

            {/* ── Structured rows ── */}
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

            {/* ── Share CTA ── */}
            <div className={styles.shareSection}>
              <button
                className={`${styles.shareCta} ${shareSuccess ? styles.shareCtaSuccess : ""}`}
                onClick={handleShare}
                disabled={sharing}
              >
                {sharing ? (
                  "Creating share card…"
                ) : shareSuccess ? (
                  "✓ Prediction card saved!"
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                    </svg>
                    Share Prediction Card
                  </>
                )}
              </button>
              <p className={styles.shareHint}>Generates a shareable image for WhatsApp, Twitter & Instagram</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}