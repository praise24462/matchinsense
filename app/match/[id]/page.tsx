"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { MatchDetails, SummaryResponse } from "@/types";
import { generateMatchSummary } from "@/services/aiService";
import MatchStats from "@/components/MatchStats/MatchStats";
import SummaryBox from "@/components/SummaryBox/SummaryBox";
import PreviewBox from "@/components/PreviewBox/PreviewBox";
import PredictionBox from "@/components/PredictionBox/PredictionBox";
// import MatchTimeline from "@/components/MatchTimeline/MatchTimeline"
import styles from "./matchDetail.module.scss";

function saveReportToStorage(report: {
  matchId: number; homeTeam: string; awayTeam: string;
  score: string; competition: string;
  type: "preview" | "report" | "prediction"; text: string; source: string;
}) {
  try {
    const existing = JSON.parse(localStorage.getItem("matchinsense_summaries") ?? "[]");
    const filtered = existing.filter((r: { matchId: number; type: string }) =>
      !(r.matchId === report.matchId && r.type === report.type)
    );
    const entry = { ...report, id: `${report.matchId}-${report.type}`, createdAt: new Date().toISOString() };
    const updated = [entry, ...filtered].slice(0, 50);
    localStorage.setItem("matchinsense_summaries", JSON.stringify(updated));
    // Manually dispatch storage event so same-tab listeners pick it up
    window.dispatchEvent(new StorageEvent("storage", {
      key: "matchinsense_summaries",
      newValue: JSON.stringify(updated),
    }));
  } catch (err) {
    console.error("Failed to save report to localStorage:", err);
  }
}

const STATUS_LABELS: Record<string, string> = {
  FT: "Full Time", LIVE: "Live", HT: "Half Time",
  NS: "Upcoming", PST: "Postponed", CANC: "Cancelled",
};

// ── Highlights Section ────────────────────────────────────────────────────────
function HighlightsSection({ homeTeam, awayTeam, league, date }: {
  homeTeam: string; awayTeam: string; league: string; date: string;
}) {
  const [videoId,  setVideoId]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [playing,  setPlaying]  = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setVideoId(null); setNotFound(false); setPlaying(false);
    fetch(`/api/highlights?home=${encodeURIComponent(homeTeam)}&away=${encodeURIComponent(awayTeam)}&league=${encodeURIComponent(league)}&date=${date}`)
      .then(r => r.json())
      .then(data => { if (data.videoId) setVideoId(data.videoId); else setNotFound(true); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [homeTeam, awayTeam, league, date]);

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Match Highlights
      </h2>
      {loading && <div className={styles.highlightsSkel}><div className={styles.highlightsSkelInner}/></div>}
      {!loading && notFound && (
        <div className={styles.noStats}>
          <div className={styles.noStatsIcon}>🎬</div>
          <p className={styles.noStatsTitle}>Highlights not available yet</p>
          <p className={styles.noStatsSub}>
            Usually uploaded within a few hours of full time.{" "}
            <a href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${homeTeam} vs ${awayTeam} highlights`)}`} target="_blank" rel="noopener noreferrer" className={styles.ytLink}>Search on YouTube →</a>
          </p>
        </div>
      )}
      {!loading && videoId && (
        <div className={styles.highlightsWrap}>
          {!playing ? (
            <div className={styles.highlightThumb} onClick={() => setPlaying(true)}>
              <img src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`} alt="Highlights thumbnail" className={styles.thumbImg}
                onError={e => { (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`; }} />
              <div className={styles.playBtn}><svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>
              <div className={styles.ytBadge}>
                <svg width="16" height="11" viewBox="0 0 16 11" fill="none"><path d="M15.68 1.72A2 2 0 0014.27.3C13.02 0 8 0 8 0S2.98 0 1.73.3A2 2 0 00.32 1.72C0 2.98 0 5.5 0 5.5s0 2.52.32 3.78A2 2 0 001.73 10.7C2.98 11 8 11 8 11s5.02 0 6.27-.3a2 2 0 001.41-1.42C16 8.02 16 5.5 16 5.5s0-2.52-.32-3.78z" fill="#FF0000"/><polygon points="6.4,7.9 10.6,5.5 6.4,3.1" fill="white"/></svg>
                YouTube
              </div>
            </div>
          ) : (
            <div className={styles.iframeWrap}>
              <iframe src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`} title="Match Highlights" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className={styles.iframe}/>
            </div>
          )}
          <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer" className={styles.ytLink}>Watch on YouTube →</a>
        </div>
      )}
    </section>
  );
}

// ── Pitch Lineup ──────────────────────────────────────────────────────────────
function PitchLineup({ home, away }: { home: any; away: any | null }) {
  function parseFormation(formation: string): number[] {
    if (!formation) return [4, 3, 3];
    return formation.split("-").map(Number);
  }
  function buildRows(players: any[], formation: number[]): any[][] {
    const sorted = [...players].sort((a, b) => (a.player?.grid ?? "").localeCompare(b.player?.grid ?? ""));
    const rows: any[][] = [];
    let idx = 0;
    rows.push([sorted[idx++]]);
    for (const count of formation) {
      const row = [];
      for (let i = 0; i < count && idx < sorted.length; i++) row.push(sorted[idx++]);
      rows.push(row);
    }
    return rows;
  }

  const homeFormation = parseFormation(home?.formation ?? "4-3-3");
  const awayFormation = away ? parseFormation(away?.formation ?? "4-3-3") : [];
  const homeRows = buildRows(home?.startXI ?? [], homeFormation);
  const awayRows = away ? buildRows(away?.startXI ?? [], awayFormation).reverse() : [];

  return (
    <div className={styles.pitchWrap}>
      <div className={styles.formationBar}>
        <div className={styles.formationTeam}>
          {home?.team?.logo && <Image src={home.team.logo} alt="" width={16} height={16} style={{objectFit:"contain"}} onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}}/>}
          <span>{home?.team?.name}</span>
          {home?.formation && <span className={styles.formationBadge}>{home.formation}</span>}
        </div>
        {away && (
          <div className={`${styles.formationTeam} ${styles.formationTeamRight}`}>
            {away?.formation && <span className={styles.formationBadge}>{away.formation}</span>}
            <span>{away?.team?.name}</span>
            {away?.team?.logo && <Image src={away.team.logo} alt="" width={16} height={16} style={{objectFit:"contain"}} onError={(e)=>{(e.target as HTMLImageElement).style.display="none"}}/>}
          </div>
        )}
      </div>
      <div className={styles.pitch}>
        <div className={styles.pitchCenter}/><div className={styles.pitchCenterCircle}/><div className={styles.pitchHalfway}/><div className={styles.pitchBoxTop}/><div className={styles.pitchBoxBottom}/>
        <div className={styles.pitchHalf}>
          {homeRows.map((row, ri) => (
            <div key={ri} className={styles.pitchRow}>
              {row.map((p: any, pi: number) => (
                <div key={pi} className={styles.pitchPlayer}>
                  <div className={styles.pitchPlayerDot}><span className={styles.pitchPlayerNum}>{p?.player?.number ?? ""}</span></div>
                  <span className={styles.pitchPlayerName}>{(p?.player?.name ?? "").split(" ").at(-1)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        {away && (
          <div className={`${styles.pitchHalf} ${styles.pitchHalfAway}`}>
            {awayRows.map((row, ri) => (
              <div key={ri} className={styles.pitchRow}>
                {row.map((p: any, pi: number) => (
                  <div key={pi} className={styles.pitchPlayer}>
                    <div className={`${styles.pitchPlayerDot} ${styles.pitchPlayerDotAway}`}><span className={styles.pitchPlayerNum}>{p?.player?.number ?? ""}</span></div>
                    <span className={styles.pitchPlayerName}>{(p?.player?.name ?? "").split(" ").at(-1)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className={styles.subsGrid}>
        <div className={styles.subsList}>
          <div className={styles.subsTitle}>Subs — {home?.team?.name}</div>
          {(home?.substitutes ?? []).map((p: any) => (
            <div key={p.player.id} className={styles.subRow}>
              <span className={styles.subNum}>{p.player.number}</span>
              <span className={styles.subName}>{p.player.name}</span>
              {p.player.pos && <span className={styles.subPos}>{p.player.pos}</span>}
            </div>
          ))}
        </div>
        {away && (
          <div className={styles.subsList}>
            <div className={styles.subsTitle}>Subs — {away?.team?.name}</div>
            {(away?.substitutes ?? []).map((p: any) => (
              <div key={p.player.id} className={styles.subRow}>
                <span className={styles.subNum}>{p.player.number}</span>
                <span className={styles.subName}>{p.player.name}</span>
                {p.player.pos && <span className={styles.subPos}>{p.player.pos}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tabs Section — Info + Line-ups only ───────────────────────────────────────
function TabsSection({ match, isUpcoming, isFinished, isLive,
  summary, summaryTime, summaryLoading, summaryError,
  preview, previewTime, previewLoading, previewError,
  prediction, predictionTime, predictionLoading, predictionError,
  onGenSummary, onGenPreview, onGenPrediction,
}: any) {
  const [tab, setTab] = useState<"info"|"lineups">("info");
  const [lineups, setLineups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const { homeTeam, awayTeam, statistics, events, league } = match;

  async function loadTab(t: string) {
    if (t !== "lineups" || lineups.length > 0) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/match-lineups?fixture=${match.id}`);
      setLineups(await r.json());
    } catch {}
    finally { setLoading(false); }
  }

  function switchTab(t: "info"|"lineups") {
    setTab(t);
    loadTab(t);
  }

  const TABS = [
    { id: "info",    label: "Info" },
    { id: "lineups", label: "Line-ups" },
  ];

  return (
    <div className={styles.tabsWrap}>
      <div className={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id} className={`${styles.tabBtn} ${tab === t.id ? styles.tabBtnActive : ""}`}
            onClick={() => switchTab(t.id as any)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.tabContent}>

        {/* ── INFO tab ── */}
        {tab === "info" && (
          <div className={styles.content}>
            {events.length > 0 && !isUpcoming && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Timeline
                </h2>
                <div className={styles.timeline}>
                  {events.map((ev: any, i: number) => {
                    const isHome = ev.team === "home";
                    const isGoal = ["Goal","OwnGoal","Penalty"].includes(ev.type);
                    const isCard = ev.type === "Card";
                    return (
                      <div key={i} className={`${styles.timelineRow} ${isHome ? styles.timelineHome : styles.timelineAway}`}>
                        {isHome && <div className={styles.timelineLeft}><span className={styles.timelinePlayer}>{ev.player}</span>{ev.detail && <span className={styles.timelineDetail}>{ev.detail}</span>}</div>}
                        <div className={styles.timelineCenter}>
                          <span className={styles.timelineMinute}>{ev.minute}'</span>
                          <div className={`${styles.timelineIcon} ${isGoal ? styles.iconGoal : ""} ${isCard && ev.detail === "YELLOW" ? styles.iconYellow : ""} ${isCard && ev.detail !== "YELLOW" ? styles.iconRed : ""}`}>
                            {isGoal ? "⚽" : isCard ? "🟨" : "↔"}
                          </div>
                        </div>
                        {!isHome && <div className={styles.timelineRight}><span className={styles.timelinePlayer}>{ev.player}</span>{ev.detail && <span className={styles.timelineDetail}>{ev.detail}</span>}</div>}
                        {isHome  && <div className={styles.timelineRight}/>}
                        {!isHome && <div className={styles.timelineLeft}/>}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <div className={styles.aiPanels}>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  {isUpcoming ? "AI Preview" : "AI Match Report"}
                </h2>
                {isUpcoming
                  ? <PreviewBox preview={preview} loading={previewLoading} error={previewError} generatedAt={previewTime} onGenerate={onGenPreview}/>
                  : <SummaryBox summary={summary} loading={summaryLoading} error={summaryError} generatedAt={summaryTime} onGenerate={onGenSummary}/>
                }
              </section>
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                  {isUpcoming ? "AI Prediction" : "AI Insight"}
                </h2>
                <PredictionBox prediction={prediction} loading={predictionLoading} error={predictionError} generatedAt={predictionTime} isUpcoming={isUpcoming} onGenerate={onGenPrediction}/>
              </section>
            </div>

            {!isUpcoming && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Statistics
                </h2>
                {statistics.length > 0
                  ? <MatchStats statistics={statistics} homeTeam={homeTeam.name} awayTeam={awayTeam.name}/>
                  : <div className={styles.noStats}><div className={styles.noStatsIcon}>📊</div><p className={styles.noStatsTitle}>Stats unavailable</p><p className={styles.noStatsSub}>Use the AI Match Report for full analysis.</p></div>
                }
              </section>
            )}

            {isFinished && (
              <HighlightsSection homeTeam={homeTeam.name} awayTeam={awayTeam.name} league={league.name} date={match.date}/>
            )}
          </div>
        )}

        {/* ── LINEUPS tab ── */}
        {tab === "lineups" && (
          <div className={styles.content}>
            {loading && <div className={styles.tabLoading}><div className={styles.spinner}/></div>}
            {!loading && lineups.length === 0 && (
              <div className={styles.tabEmpty}><p>Line-ups not available yet</p><span>Usually released 1 hour before kick-off</span></div>
            )}
            {!loading && lineups.length >= 2 && <PitchLineup home={lineups[0]} away={lineups[1]}/>}
            {!loading && lineups.length === 1 && <PitchLineup home={lineups[0]} away={null}/>}
          </div>
        )}

      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
function MatchDetailInner() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const searchParams = useSearchParams();
  const source   = searchParams.get("source") ?? "euro";

  const [match, setMatch]   = useState<MatchDetails | null>(null);
  const [loadingMatch, setLM] = useState(true);
  const [matchError, setME] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);

  const [summary, setSummary]         = useState<string | null>(null);
  const [summaryTime, setSummaryTime] = useState<string | null>(null);
  const [summaryLoading, setSL]       = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [preview, setPreview]           = useState<string | null>(null);
  const [previewTime, setPreviewTime]   = useState<string | null>(null);
  const [previewLoading, setPL]         = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [prediction, setPrediction]           = useState<string | null>(null);
  const [predictionTime, setPredictionTime]   = useState<string | null>(null);
  const [predictionLoading, setPRL]           = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/match/${id}?source=${source}`)
      .then(async r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setMatch)
      .catch(() => setME("Could not load this match."))
      .finally(() => setLM(false));
  }, [id, source]);

  function handleShare() {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
      .then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); })
      .catch(() => { prompt("Copy match link:", url); });
  }

  async function handleGenSummary() {
    if (!match) return;
    setSL(true); setSummaryError(null);
    try {
      const r: SummaryResponse = await generateMatchSummary({
        matchId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
        score: match.score, halfTimeScore: match.halfTimeScore,
        statistics: match.statistics, events: match.events,
      });
      setSummary(r.summary); setSummaryTime(r.generatedAt);
      saveReportToStorage({ matchId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
        score: `${match.score.home ?? "–"} – ${match.score.away ?? "–"}`, competition: match.league.name, type: "report", text: r.summary, source });
    } catch (e: any) { setSummaryError(e?.message ?? "Failed to generate report"); }
    finally { setSL(false); }
  }

  async function handleGenPreview() {
    if (!match) return;
    setPL(true); setPreviewError(null);
    try {
      const res = await fetch("/api/ai-preview", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name, competition: match.league.name, date: match.date }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Server error");
      setPreview(data.preview); setPreviewTime(data.generatedAt);
      saveReportToStorage({ matchId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
        score: "", competition: match.league.name, type: "preview", text: data.preview, source });
    } catch (e: any) { setPreviewError(e?.message ?? "Failed to generate preview"); }
    finally { setPL(false); }
  }

  async function handleGenPrediction() {
    if (!match) return;
    setPRL(true); setPredictionError(null);
    try {
      const res = await fetch("/api/ai-prediction", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name, competition: match.league.name,
          date: match.date, score: match.score, events: match.events, status: match.status }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? "Server error");
      setPrediction(data.prediction); setPredictionTime(data.generatedAt);
      saveReportToStorage({ matchId: match.id, homeTeam: match.homeTeam.name, awayTeam: match.awayTeam.name,
        score: `${match.score.home ?? "–"} – ${match.score.away ?? "–"}`, competition: match.league.name, type: "prediction", text: data.prediction, source });
    } catch (e: any) { setPredictionError(e?.message ?? "Failed to generate prediction"); }
    finally { setPRL(false); }
  }

  if (loadingMatch) return (
    <div className={styles.page}>
      <div className={styles.loadingWrap}><div className={styles.spinner}/><span className={styles.loadingText}>Loading match…</span></div>
    </div>
  );

  if (matchError || !match) return (
    <div className={styles.page}>
      <div className={styles.errorWrap}>
        <span className={styles.errorIcon}>⚽</span>
        <p className={styles.errorText}>{matchError ?? "Match not found."}</p>
        <button className={styles.backBtn} onClick={() => router.push("/")}>← Back to matches</button>
      </div>
    </div>
  );

  const { homeTeam, awayTeam, score, status, league, statistics, events, date, halfTimeScore, venue, referee } = match;
  const isLive     = status === "LIVE" || status === "HT";
  const isFinished = status === "FT";
  const isUpcoming = status === "NS";
  const homeWin    = isFinished && (score.home ?? 0) > (score.away ?? 0);
  const awayWin    = isFinished && (score.away ?? 0) > (score.home ?? 0);

  const formattedDate = new Date(date).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const kickoff = new Date(date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const homeGoals = events.filter((e: any) => e.team === "home" && ["Goal","OwnGoal","Penalty"].includes(e.type));
  const awayGoals = events.filter((e: any) => e.team === "away" && ["Goal","OwnGoal","Penalty"].includes(e.type));

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button className={styles.back} onClick={() => router.back()}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Matches
        </button>
        <div className={styles.breadcrumb}>
          <Link href="/" className={styles.breadcrumbLink}>{league.name}</Link>
          <span className={styles.breadcrumbSep}>/</span>
          <span>{homeTeam.name} vs {awayTeam.name}</span>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.compBar}>
            {league.logo && <Image src={league.logo} alt="" width={18} height={18} style={{objectFit:"contain"}} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>}
            <span className={styles.compName}>{league.name}</span>
            <span className={styles.compSep}>·</span>
            <span className={styles.compDate}>{formattedDate}</span>
            {!isUpcoming && <><span className={styles.compSep}>·</span><span className={styles.compDate}>{kickoff}</span></>}
          </div>

          <div className={styles.scoreSection}>
            <div className={styles.teamSide}>
              <div className={`${styles.teamCrest} ${homeWin ? styles.teamCrestWinner : ""}`}>
                {homeTeam.logo ? <Image src={homeTeam.logo} alt={homeTeam.name} width={64} height={64} style={{objectFit:"contain"}}/> : <span className={styles.crestFallback}>{homeTeam.name[0]}</span>}
              </div>
              <span className={`${styles.teamName} ${homeWin ? styles.teamNameWinner : ""} ${awayWin ? styles.teamNameLoser : ""}`}>{homeTeam.name}</span>
              {homeGoals.length > 0 && (
                <div className={styles.goalScorers}>
                  {homeGoals.map((g: any, i: number) => (
                    <span key={i} className={styles.scorer}>{g.player.split(" ").at(-1)} {g.minute}'{g.type === "OwnGoal" ? " (og)" : g.type === "Penalty" ? " (p)" : ""}</span>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.centrePiece}>
              {isUpcoming ? (
                <><div className={styles.vsScore}>vs</div><div className={styles.kickoffTime}>{kickoff}</div></>
              ) : (
                <>
                  <div className={styles.mainScore}>
                    <span className={homeWin ? styles.scoreWin : awayWin ? styles.scoreLose : ""}>{score.home ?? "–"}</span>
                    <span className={styles.scoreDash}>–</span>
                    <span className={awayWin ? styles.scoreWin : homeWin ? styles.scoreLose : ""}>{score.away ?? "–"}</span>
                  </div>
                  {halfTimeScore?.home !== null && halfTimeScore?.away !== null && (
                    <div className={styles.htScore}>HT: {halfTimeScore.home} – {halfTimeScore.away}</div>
                  )}
                </>
              )}
              <div className={`${styles.statusChip} ${isLive ? styles.statusChipLive : ""} ${isFinished ? styles.statusChipFt : ""}`}>
                {isLive && <span className={styles.liveDot}/>}
                {STATUS_LABELS[status] ?? status}
              </div>
            </div>

            <div className={`${styles.teamSide} ${styles.teamSideRight}`}>
              <div className={`${styles.teamCrest} ${awayWin ? styles.teamCrestWinner : ""}`}>
                {awayTeam.logo ? <Image src={awayTeam.logo} alt={awayTeam.name} width={64} height={64} style={{objectFit:"contain"}}/> : <span className={styles.crestFallback}>{awayTeam.name[0]}</span>}
              </div>
              <span className={`${styles.teamName} ${awayWin ? styles.teamNameWinner : ""} ${homeWin ? styles.teamNameLoser : ""}`}>{awayTeam.name}</span>
              {awayGoals.length > 0 && (
                <div className={`${styles.goalScorers} ${styles.goalScorersRight}`}>
                  {awayGoals.map((g: any, i: number) => (
                    <span key={i} className={styles.scorer}>{g.player.split(" ").at(-1)} {g.minute}'{g.type === "OwnGoal" ? " (og)" : g.type === "Penalty" ? " (p)" : ""}</span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={styles.metaRow}>
            {venue && <span className={styles.metaItem}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>{venue}</span>}
            {referee && <span className={styles.metaItem}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>{referee}</span>}
            <button className={styles.shareBtn} onClick={handleShare}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
              {shareCopied ? "Copied!" : "Share"}
            </button>
          </div>
        </div>
      </div>

      {/* {!isUpcoming && events.length > 0 && (
        <MatchTimeline events={events} homeTeamName={homeTeam.name} awayTeamName={awayTeam.name} status={status} />
      )} */}

      <TabsSection
        match={match} isUpcoming={isUpcoming} isFinished={isFinished} isLive={isLive}
        summary={summary} summaryTime={summaryTime} summaryLoading={summaryLoading} summaryError={summaryError}
        preview={preview} previewTime={previewTime} previewLoading={previewLoading} previewError={previewError}
        prediction={prediction} predictionTime={predictionTime} predictionLoading={predictionLoading} predictionError={predictionError}
        onGenSummary={handleGenSummary} onGenPreview={handleGenPreview} onGenPrediction={handleGenPrediction}
      />
    </div>
  );
}

export default function MatchDetailPage() {
  return (
    <Suspense fallback={null}>
      <MatchDetailInner/>
    </Suspense>
  );
}