"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import type { Match } from "@/types";
import { ALL_POPULAR_TEAMS } from "@/data/popularTeams";
import styles from "./team.module.scss";

// ── Season constants (module level, not inside component) ─────────────────────
const _now = new Date();
const CURRENT_SEASON = _now.getMonth() >= 6 ? _now.getFullYear() : _now.getFullYear() - 1;
const SEASONS = [CURRENT_SEASON, CURRENT_SEASON - 1, CURRENT_SEASON - 2];

// ── helpers ───────────────────────────────────────────────────────────────────
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
}

function getResult(m: Match, teamId: number): "W" | "L" | "D" | null {
  if (m.status !== "FT") return null;
  const h = m.score.home ?? 0, a = m.score.away ?? 0;
  const isHome = m.homeTeam.id === teamId;
  const mine = isHome ? h : a, opp = isHome ? a : h;
  if (mine > opp) return "W";
  if (mine < opp) return "L";
  return "D";
}

function groupByLeague(matches: Match[]) {
  const map = new Map<number, { name: string; logo: string; matches: Match[] }>();
  for (const m of matches) {
    if (!map.has(m.league.id))
      map.set(m.league.id, { name: m.league.name, logo: m.league.logo, matches: [] });
    map.get(m.league.id)!.matches.push(m);
  }
  return [...map.values()];
}

// ── inner component ───────────────────────────────────────────────────────────
function TeamPageInner() {
  const { id }       = useParams<{ id: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tab          = (searchParams.get("tab") ?? "results") as "results" | "upcoming";

  const teamId   = parseInt(id, 10);
  const teamInfo = ALL_POPULAR_TEAMS.find(t => t.id === teamId);

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [logoErr, setLogoErr] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null); setMatches([]);
    try {
      const res  = await fetch(`/api/team/${id}?type=${tab}`);
      const data = await res.json();
      if (!res.ok) { setError(data?.message ?? "Failed to load"); return; }
      setMatches(data.matches ?? []);
    } catch {
      setError("Unable to reach server.");
    } finally {
      setLoading(false);
    }
  }, [id, tab]);

  useEffect(() => { load(); }, [load]);

  const setTab = (t: "results" | "upcoming") => router.push(`/team/${id}?tab=${t}`);
  const groups = groupByLeague(matches);

  return (
    <div className={styles.page}>

      {/* Back bar */}
      <div className={styles.topBar}>
        <button className={styles.back} onClick={() => router.push("/matches")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          All Matches
        </button>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          {teamInfo && !logoErr ? (
            <Image src={teamInfo.logo} alt={teamInfo.name} width={80} height={80}
              className={styles.heroLogo} onError={() => setLogoErr(true)} />
          ) : (
            <div className={styles.heroLogoFallback}>{(teamInfo?.shortName ?? "?")[0]}</div>
          )}
          <div className={styles.heroText}>
            <h1 className={styles.heroName}>{teamInfo?.name ?? `Team ${id}`}</h1>
            <div className={styles.heroMeta}>
              <span className={styles.heroBadge}>{teamInfo?.country ?? "Club"}</span>
              <span className={styles.heroLeague}>{teamInfo?.league}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button className={`${styles.tab} ${tab === "results"  ? styles.tabActive : ""}`} onClick={() => setTab("results")}>Results</button>
        <button className={`${styles.tab} ${tab === "upcoming" ? styles.tabActive : ""}`} onClick={() => setTab("upcoming")}>Fixtures</button>
      </div>

      {/* Season bar removed — free plan only supports 3-day window */}

      {/* Content */}
      <div className={styles.content}>
        {loading && (
          <div className={styles.skeleton}>
            {Array.from({ length: 15 }).map((_, i) => <div key={i} className={styles.skeletonRow}/>)}
          </div>
        )}

        {!loading && error && <div className={styles.empty}>{error}</div>}

        {!loading && !error && matches.length === 0 && (
          <div className={styles.empty}>
            No {tab === "results" ? "recent results" : "upcoming fixtures"} found.<br/>
            <span style={{fontSize:"12px", opacity:0.6}}>Showing yesterday &amp; today for results, today &amp; tomorrow for fixtures.</span>
          </div>
        )}

        {!loading && !error && groups.map(group => (
          <div key={group.name} className={styles.compGroup}>
            <div className={styles.compHeader}>
              {group.logo && (
                <Image src={group.logo} alt="" width={18} height={18} className={styles.compLogo}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <span className={styles.compName}>{group.name}</span>
              <span className={styles.compCount}>{group.matches.length} matches</span>
            </div>

            {group.matches.map(m => {
              const isHome  = m.homeTeam.id === teamId;
              const myTeam  = isHome ? m.homeTeam : m.awayTeam;
              const oppTeam = isHome ? m.awayTeam : m.homeTeam;
              const myScore = isHome ? m.score.home : m.score.away;
              const opScore = isHome ? m.score.away : m.score.home;
              const result  = getResult(m, teamId);
              const isWin   = result === "W";
              const isLose  = result === "L";

              return (
                <Link key={m.id} href={`/match/${m.id}?source=${m.source}`} className={styles.matchRow}>
                  <div className={styles.matchDate}>
                    <span className={styles.matchDateDay}>{fmtDay(m.date)}</span>
                    <span>{fmtWeekday(m.date)}</span>
                  </div>
                  <div className={styles.matchTeams}>
                    <div className={styles.matchTeamRow}>
                      {myTeam.logo && (
                        <Image src={myTeam.logo} alt="" width={16} height={16} className={styles.teamLogo}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <span className={styles.teamNameMain}>{myTeam.name}</span>
                      <span className={styles.homeAwayBadge}>{isHome ? "H" : "A"}</span>
                    </div>
                    <div className={styles.matchTeamRow}>
                      {oppTeam.logo && (
                        <Image src={oppTeam.logo} alt="" width={16} height={16} className={styles.teamLogo}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <span className={styles.teamNameOpp}>{oppTeam.name}</span>
                    </div>
                  </div>
                  <div className={styles.matchScores}>
                    <span className={`${styles.scoreVal} ${isWin ? styles.scoreWin : isLose ? styles.scoreLose : ""}`}>
                      {m.status === "NS" ? "–" : (myScore ?? "–")}
                    </span>
                    <span className={`${styles.scoreVal} ${isLose ? styles.scoreWin : isWin ? styles.scoreLose : ""}`}>
                      {m.status === "NS" ? "–" : (opScore ?? "–")}
                    </span>
                  </div>
                  <div className={styles.matchResult}>
                    {result ? (
                      <span className={`${styles.resultBadge} ${isWin ? styles.win : isLose ? styles.lose : styles.draw}`}>
                        {result}
                      </span>
                    ) : m.status === "NS" ? (
                      <span className={styles.kickoff}>{fmtTime(m.date)}</span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamPageInner />
    </Suspense>
  );
}