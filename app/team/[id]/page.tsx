"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/types";
import { ALL_POPULAR_TEAMS } from "@/data/popularTeams";
import styles from "./team.module.scss";

const _now = new Date();
const CURRENT_SEASON = _now.getMonth() >= 6 ? _now.getFullYear() : _now.getFullYear() - 1;
const SEASONS = [CURRENT_SEASON, CURRENT_SEASON - 1, CURRENT_SEASON - 2];

interface TeamInfo {
  id: number; name: string; logo: string; country: string; founded: number;
  venue: { name: string; city: string; capacity: number; image: string };
}
interface SeasonStats {
  played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; cleanSheets: number;
  failedToScore: number; form: string;
  biggestWin: string; biggestLoss: string;
  avgGoalsFor: string; avgGoalsAgainst: string;
  lineups: { formation: string; played: number }[];
}
interface Standing {
  rank: number; points: number; goalsDiff: number; form: string;
  description: string; played: number; wins: number; draws: number;
  losses: number; goalsFor: number; goalsAgainst: number;
}
interface TableRow {
  rank: number; teamId: number; teamName: string; teamLogo: string;
  points: number; played: number; wins: number; draws: number; losses: number;
  goalsFor: number; goalsAgainst: number; goalsDiff: number;
  form: string; description: string; isSelected: boolean;
}
interface ClubHistory {
  teamInfo: TeamInfo | null;
  seasonStats: SeasonStats | null;
  recentResults: any[];
  nextFixtures: any[];
  standing: Standing | null;
  fullTable: TableRow[];
  season: string;
  leagueId: number;
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}
function fmtWeekday(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short" }).toUpperCase();
}

function FormDot({ char }: { char: string }) {
  const bg = char === "W" ? "rgba(34,197,94,0.18)" : char === "L" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)";
  const color = char === "W" ? "#22c55e" : char === "L" ? "#ef4444" : "#6b7280";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:22, height:22, borderRadius:4, background:bg, color, fontSize:10, fontWeight:800, fontFamily:"var(--font-mono)" }}>
      {char}
    </span>
  );
}

function StatBar({ label, val, max }: { label: string; val: number; max: number }) {
  const pct = max > 0 ? Math.min((val / max) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:12, color:"var(--text-2)" }}>{label}</span>
        <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", fontFamily:"var(--font-mono)" }}>{val}</span>
      </div>
      <div style={{ height:5, background:"var(--bg-card-hi)", borderRadius:3 }}>
        <div style={{ height:"100%", width:`${pct}%`, background:"var(--accent)", borderRadius:3, transition:"width 0.6s ease" }} />
      </div>
    </div>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:10, padding:16, marginBottom:12 }}>
      {title && <div style={{ fontSize:10, fontFamily:"var(--font-mono)", color:"var(--text-3)", letterSpacing:"0.14em", textTransform:"uppercase", marginBottom:12 }}>{title}</div>}
      {children}
    </div>
  );
}

// ── Full league table ─────────────────────────────────────────────────────────
function LeagueTable({ rows, selectedTeamId }: { rows: TableRow[]; selectedTeamId: number }) {
  const descColors: Record<string, string> = {
    "Champions League": "#22c55e",
    "Europa League": "#f59e0b",
    "Conference League": "#06b6d4",
    "Relegation": "#ef4444",
    "Promotion": "#22c55e",
  };

  function descColor(desc: string) {
    for (const [k, v] of Object.entries(descColors)) {
      if (desc?.includes(k)) return v;
    }
    return "transparent";
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
        <thead>
          <tr style={{ borderBottom:"1px solid var(--border)" }}>
            {["#","Club","P","W","D","L","GF","GA","GD","Pts","Form"].map((h, i) => (
              <th key={h} style={{
                padding: "8px 6px",
                textAlign: i <= 1 ? "left" : "center",
                fontSize: 10, fontFamily:"var(--font-mono)",
                color:"var(--text-3)", fontWeight:600,
                letterSpacing:"0.08em", whiteSpace:"nowrap",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMe = row.teamId === selectedTeamId;
            const leftBorderColor = descColor(row.description);
            return (
              <tr key={row.teamId} style={{
                background: isMe ? "rgba(255,75,43,0.08)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
                borderLeft: `3px solid ${isMe ? "var(--accent)" : leftBorderColor !== "transparent" ? leftBorderColor : "transparent"}`,
                transition: "background 0.1s",
                cursor: "pointer",
              }}
              onClick={() => window.location.href = `/team/${row.teamId}`}
              >
                <td style={{ padding:"10px 6px 10px 8px", fontFamily:"var(--font-mono)", fontWeight: isMe ? 800 : 500, color: isMe ? "var(--accent)" : "var(--text-3)" }}>
                  {row.rank}
                </td>
                <td style={{ padding:"10px 6px", minWidth:140 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    {row.teamLogo && (
                      <img src={row.teamLogo} alt="" width={18} height={18} style={{ objectFit:"contain", flexShrink:0 }} />
                    )}
                    <span style={{ fontWeight: isMe ? 700 : 500, color: isMe ? "var(--text)" : "var(--text-2)", whiteSpace:"nowrap" }}>
                      {row.teamName}
                    </span>
                  </div>
                </td>
                <td style={{ padding:"10px 6px", textAlign:"center", color:"var(--text-3)" }}>{row.played}</td>
                <td style={{ padding:"10px 6px", textAlign:"center", color:"#22c55e" }}>{row.wins}</td>
                <td style={{ padding:"10px 6px", textAlign:"center", color:"var(--text-3)" }}>{row.draws}</td>
                <td style={{ padding:"10px 6px", textAlign:"center", color:"#ef4444" }}>{row.losses}</td>
                <td style={{ padding:"10px 6px", textAlign:"center" }}>{row.goalsFor}</td>
                <td style={{ padding:"10px 6px", textAlign:"center" }}>{row.goalsAgainst}</td>
                <td style={{ padding:"10px 6px", textAlign:"center", color: row.goalsDiff > 0 ? "#22c55e" : row.goalsDiff < 0 ? "#ef4444" : "var(--text-3)" }}>
                  {row.goalsDiff > 0 ? "+" : ""}{row.goalsDiff}
                </td>
                <td style={{ padding:"10px 6px", textAlign:"center", fontWeight: 800, fontFamily:"var(--font-mono)", color: isMe ? "var(--accent)" : "var(--text)" }}>
                  {row.points}
                </td>
                <td style={{ padding:"10px 6px" }}>
                  <div style={{ display:"flex", gap:2 }}>
                    {(row.form ?? "").slice(-5).split("").map((c, i) => (
                      <span key={i} style={{
                        width:14, height:14, borderRadius:3, fontSize:8, fontWeight:800,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        background: c==="W" ? "rgba(34,197,94,0.2)" : c==="L" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
                        color: c==="W" ? "#22c55e" : c==="L" ? "#ef4444" : "#6b7280",
                        fontFamily:"var(--font-mono)",
                      }}>{c}</span>
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div style={{ padding:"12px 8px", display:"flex", gap:16, flexWrap:"wrap" }}>
        {[
          { color:"#22c55e", label:"Champions League" },
          { color:"#f59e0b", label:"Europa League" },
          { color:"#06b6d4", label:"Conference League" },
          { color:"#ef4444", label:"Relegation" },
        ].map(({ color, label }) => (
          <div key={label} style={{ display:"flex", alignItems:"center", gap:5 }}>
            <div style={{ width:10, height:10, borderRadius:2, background:color }} />
            <span style={{ fontSize:10, color:"var(--text-3)" }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Match list ────────────────────────────────────────────────────────────────
function MatchList({ matches, teamId, type }: { matches: any[]; teamId: number; type: "results" | "fixtures" }) {
  if (matches.length === 0) return (
    <div className={styles.empty}>No {type === "results" ? "recent results" : "upcoming fixtures"} found.</div>
  );
  return (
    <div>
      {matches.map((m: any) => {
        const isHome  = m.isHome ?? (m.homeTeam.id === teamId);
        const myTeam  = isHome ? m.homeTeam : m.awayTeam;
        const oppTeam = isHome ? m.awayTeam : m.homeTeam;
        const myScore = isHome ? m.score?.home : m.score?.away;
        const opScore = isHome ? m.score?.away : m.score?.home;
        const isFT = m.status === "FT";
        const isNS = m.status === "NS";
        let result: "W"|"L"|"D"|null = null;
        if (isFT && myScore !== null && opScore !== null)
          result = myScore > opScore ? "W" : myScore < opScore ? "L" : "D";

        return (
          <Link key={m.id} href={`/match/${m.id}?source=euro`} className={styles.matchRow}>
            <div className={styles.matchDate}>
              <span className={styles.matchDateDay}>{fmtDay(m.date)}</span>
              <span>{fmtWeekday(m.date)}</span>
            </div>
            <div className={styles.matchTeams}>
              <div className={styles.matchTeamRow}>
                {myTeam.logo && <img src={myTeam.logo} alt="" width={16} height={16} className={styles.teamLogo} />}
                <span className={styles.teamNameMain}>{myTeam.name}</span>
                <span className={styles.homeAwayBadge}>{isHome ? "H" : "A"}</span>
              </div>
              <div className={styles.matchTeamRow}>
                {oppTeam.logo && <img src={oppTeam.logo} alt="" width={16} height={16} className={styles.teamLogo} />}
                <span className={styles.teamNameOpp}>{oppTeam.name}</span>
              </div>
            </div>
            <div className={styles.matchScores}>
              <span className={`${styles.scoreVal} ${result==="W"?styles.scoreWin:result==="L"?styles.scoreLose:""}`}>
                {isNS ? "–" : (myScore ?? "–")}
              </span>
              <span className={`${styles.scoreVal} ${result==="L"?styles.scoreWin:result==="W"?styles.scoreLose:""}`}>
                {isNS ? "–" : (opScore ?? "–")}
              </span>
            </div>
            <div className={styles.matchResult}>
              {result ? (
                <span className={`${styles.resultBadge} ${result==="W"?styles.win:result==="L"?styles.lose:styles.draw}`}>{result}</span>
              ) : isNS ? (
                <span className={styles.kickoff}>{fmtTime(m.date)}</span>
              ) : null}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function TeamPageInner() {
  const { id }       = useParams<{ id: string }>();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const tab    = (searchParams.get("tab") ?? "overview") as "overview"|"results"|"fixtures"|"stats"|"table";
  const source = searchParams.get("source") ?? "";

  const teamId = parseInt(id, 10);
  // Immediate fallback from local data — shows name/logo before API responds
  const localTeam = ALL_POPULAR_TEAMS.find(t => t.id === teamId);
  const [history,  setHistory]  = useState<ClubHistory | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [season,   setSeason]   = useState(CURRENT_SEASON);
  const [leagueId, setLeagueId] = useState<number | null>(null);
  const [logoErr,  setLogoErr]  = useState(false);

  const [fdTeamInfo, setFdTeamInfo] = useState<{name:string;logo:string;country:string;founded:number;leagueId:number;venue?:{name:string;city:string;capacity:number;image:string}} | null>(null);

  const loadHistory = useCallback(async (lgId: number, seas: number, src: string) => {
    try {
      const res  = await fetch(`/api/club-history?teamId=${teamId}&leagueId=${lgId}&season=${seas}${src ? `&source=${src}` : ""}`);
      const data = await res.json();
      if (res.ok) setHistory(data);
      else setError(data?.error ?? "Failed to load history");
    } catch { setError("Unable to reach server."); }
  }, [teamId]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(null);
      setHistory(null);
      try {
        const src = source || "euro";
        const res  = await fetch(`/api/team/${id}?type=results&source=${src}`);
        const data = await res.json();
        if (cancelled) return;

        // Always try to get team info for name/logo display
        const teamData = data.teamInfo;
        if (teamData) {
          setFdTeamInfo(teamData);
        }

        // Detect league from fixtures or teamInfo
        const matches: Match[] = data.matches ?? [];
        let lg: number;
        if (teamData?.leagueId) {
          lg = teamData.leagueId;
        } else if (matches.length > 0) {
          const lgCounts: Record<number,number> = {};
          for (const m of matches) lgCounts[m.league.id] = (lgCounts[m.league.id]??0)+1;
          lg = Number(Object.entries(lgCounts).sort((a,b)=>b[1]-a[1])[0]?.[0] ?? "39");
        } else {
          lg = 39; // default Premier League
        }
        setLeagueId(lg);
        await loadHistory(lg, season, src);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Unable to reach server.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [id, source]);  // only re-run when id or source changes

  // Separate effect for season changes (after initial load)
  const [initialLoad, setInitialLoad] = useState(true);
  useEffect(() => {
    if (initialLoad) { setInitialLoad(false); return; }
    if (!leagueId) return;
    setLoading(true);
    loadHistory(leagueId, season, source || "euro").finally(() => setLoading(false));
  }, [season]);

  function setTab(t: typeof tab) { router.push(`/team/${id}?tab=${t}${source ? `&source=${source}` : ""}`); }
  function changeSeason(s: number) { setSeason(s); }

  const team = history?.teamInfo ?? fdTeamInfo ?? (localTeam ? {
    id: localTeam.id,
    name: localTeam.name,
    logo: localTeam.logo,
    country: localTeam.country,
    founded: 0,
    venue: { name: "", city: "", capacity: 0, image: "" },
  } : null);
  const stats   = history?.seasonStats;
  const standing = history?.standing;
  const fullTable = history?.fullTable ?? [];

  const TABS = [
    { id: "overview", label: "Overview" },
    { id: "results",  label: "Results"  },
    { id: "fixtures", label: "Fixtures" },
    { id: "stats",    label: "Stats"    },
    { id: "table",    label: "Table"    },
  ] as const;

  return (
    <div className={styles.page}>

      <div className={styles.topBar}>
        <button className={styles.back} onClick={() => router.back()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
      </div>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          {team?.logo && !logoErr ? (
            <img src={team.logo} alt={team.name} width={80} height={80} className={styles.heroLogo} onError={() => setLogoErr(true)} />
          ) : (
            <div className={styles.heroLogoFallback}>{(team?.name ?? `T${id}`)[0]}</div>
          )}
          <div className={styles.heroText}>
            <h1 className={styles.heroName}>{team?.name ?? `Team ${id}`}</h1>
            <div className={styles.heroMeta}>
              {team?.country  && <span className={styles.heroBadge}>{team.country}</span>}
              {team?.founded  && <span className={styles.heroLeague}>Est. {team.founded}</span>}
              {team && 'venue' in team && team.venue?.name && (
                <span className={styles.heroLeague}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {(team as any).venue.name}
                </span>
              )}
            </div>
            {stats?.form && (
              <div style={{ display:"flex", gap:4, marginTop:10, flexWrap:"wrap" }}>
                {stats.form.split("").map((c, i) => <FormDot key={i} char={c} />)}
              </div>
            )}
          </div>
          {standing && (
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", background:"rgba(255,75,43,0.1)", border:"1px solid rgba(255,75,43,0.3)", borderRadius:8, padding:"10px 16px", flexShrink:0 }}>
              <span style={{ fontSize:28, fontWeight:900, color:"var(--accent)", fontFamily:"var(--font-mono)", lineHeight:1 }}>{standing.rank}</span>
              <span style={{ fontSize:9, color:"var(--text-3)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginTop:3 }}>POSITION</span>
              <span style={{ fontSize:13, fontWeight:700, color:"var(--text)", marginTop:4 }}>{standing.points} pts</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id} className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Season selector */}
      <div className={styles.seasonBar}>
        <span className={styles.seasonLabel}>Season</span>
        {SEASONS.map(s => (
          <button key={s} className={`${styles.seasonBtn} ${season === s ? styles.seasonBtnActive : ""}`} onClick={() => changeSeason(s)}>
            {s}/{String(s + 1).slice(2)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {loading && (
          <div className={styles.skeleton}>
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className={styles.skeletonRow}/>)}
          </div>
        )}

        {!loading && error && <div className={styles.empty}>{error}</div>}

        {/* OVERVIEW */}
        {!loading && !error && tab === "overview" && (
          <div style={{ padding:"16px 20px 32px", display:"flex", flexDirection:"column", gap:0 }}>
            {stats ? (
              <>
                {/* Summary grid */}
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:12 }}>
                  {[
                    { label:"Played", val:stats.played },
                    { label:"Wins",   val:stats.wins,   accent:true },
                    { label:"Draws",  val:stats.draws },
                    { label:"Losses", val:stats.losses },
                  ].map(({ label, val, accent }) => (
                    <div key={label} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:22, fontWeight:900, color:accent?"var(--accent)":"var(--text)", fontFamily:"var(--font-mono)" }}>{val}</div>
                      <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"var(--font-mono)", letterSpacing:"0.1em", marginTop:3 }}>{label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
                  {[
                    { label:"Goals For",    val:stats.goalsFor },
                    { label:"Goals Against",val:stats.goalsAgainst },
                    { label:"Clean Sheets", val:stats.cleanSheets },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:20, fontWeight:800, color:"var(--text)", fontFamily:"var(--font-mono)" }}>{val}</div>
                      <div style={{ fontSize:9, color:"var(--text-3)", fontFamily:"var(--font-mono)", letterSpacing:"0.08em", marginTop:3 }}>{label.toUpperCase()}</div>
                    </div>
                  ))}
                </div>

                <Card title="Averages per game">
                  <div style={{ display:"flex", gap:24 }}>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:"var(--accent)" }}>{stats.avgGoalsFor}</div>
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Goals scored</div>
                    </div>
                    <div>
                      <div style={{ fontSize:20, fontWeight:800, color:"var(--text-2)" }}>{stats.avgGoalsAgainst}</div>
                      <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Goals conceded</div>
                    </div>
                  </div>
                </Card>

                {(stats.biggestWin !== "-" || stats.biggestLoss !== "-") && (
                  <Card title="Biggest results">
                    <div style={{ display:"flex", gap:24 }}>
                      {stats.biggestWin !== "-" && (
                        <div>
                          <div style={{ fontSize:20, fontWeight:800, color:"#22c55e" }}>{stats.biggestWin}</div>
                          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Biggest win</div>
                        </div>
                      )}
                      {stats.biggestLoss !== "-" && (
                        <div>
                          <div style={{ fontSize:20, fontWeight:800, color:"#ef4444" }}>{stats.biggestLoss}</div>
                          <div style={{ fontSize:11, color:"var(--text-3)", marginTop:2 }}>Biggest loss</div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {stats.lineups.length > 0 && (
                  <Card title="Preferred formations">
                    <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                      {stats.lineups.map(l => (
                        <div key={l.formation} style={{ background:"var(--bg-card-hi)", border:"1px solid var(--border)", borderRadius:6, padding:"8px 14px", textAlign:"center" }}>
                          <div style={{ fontSize:16, fontWeight:800, color:"var(--accent)", fontFamily:"var(--font-mono)" }}>{l.formation}</div>
                          <div style={{ fontSize:10, color:"var(--text-3)" }}>{l.played}x used</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            ) : <div className={styles.empty}>No season data available.</div>}

            {team && 'venue' in team && (team as TeamInfo)?.venue?.name && (
              <Card title="Stadium">
                {(team as TeamInfo).venue.image && (
                  <img src={(team as TeamInfo).venue.image} alt={(team as TeamInfo).venue.name} style={{ width:"100%", borderRadius:6, marginBottom:10, maxHeight:160, objectFit:"cover" }} />
                )}
                <div style={{ fontSize:15, fontWeight:700, color:"var(--text)" }}>{(team as TeamInfo).venue.name}</div>
                <div style={{ fontSize:12, color:"var(--text-3)", marginTop:4 }}>{(team as TeamInfo).venue.city}</div>
                {(team as TeamInfo).venue.capacity > 0 && (
                  <div style={{ fontSize:12, color:"var(--text-3)", marginTop:2 }}>Capacity: {(team as TeamInfo).venue.capacity.toLocaleString()}</div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* RESULTS */}
        {!loading && !error && tab === "results" && (
          <MatchList matches={history?.recentResults ?? []} teamId={teamId} type="results" />
        )}

        {/* FIXTURES */}
        {!loading && !error && tab === "fixtures" && (
          <MatchList matches={history?.nextFixtures ?? []} teamId={teamId} type="fixtures" />
        )}

        {/* STATS */}
        {!loading && !error && tab === "stats" && (
          <div style={{ padding:"16px 20px 32px" }}>
            {stats ? (
              <>
                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-3)", letterSpacing:"0.14em", marginBottom:14 }}>ATTACK</div>
                <StatBar label="Goals scored"       val={stats.goalsFor}              max={Math.max(stats.goalsFor, stats.goalsAgainst, 1)} />
                <StatBar label="Avg goals per game" val={parseFloat(stats.avgGoalsFor)} max={5} />
                <StatBar label="Failed to score"    val={stats.failedToScore}          max={stats.played} />

                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-3)", letterSpacing:"0.14em", marginBottom:14, marginTop:24 }}>DEFENCE</div>
                <StatBar label="Goals conceded"        val={stats.goalsAgainst}              max={Math.max(stats.goalsFor, stats.goalsAgainst, 1)} />
                <StatBar label="Clean sheets"          val={stats.cleanSheets}               max={stats.played} />
                <StatBar label="Avg conceded per game" val={parseFloat(stats.avgGoalsAgainst)} max={5} />

                <div style={{ fontSize:11, fontFamily:"var(--font-mono)", color:"var(--text-3)", letterSpacing:"0.14em", marginBottom:14, marginTop:24 }}>RESULTS</div>
                <StatBar label="Wins"   val={stats.wins}   max={stats.played} />
                <StatBar label="Draws"  val={stats.draws}  max={stats.played} />
                <StatBar label="Losses" val={stats.losses} max={stats.played} />
              </>
            ) : (
            <div className={styles.empty} style={{padding:"40px 20px", textAlign:"center"}}>
              <div style={{fontSize:32, marginBottom:12}}>📊</div>
              <div style={{fontSize:15, fontWeight:700, color:"var(--text)", marginBottom:8}}>Stats unavailable</div>
              <div style={{fontSize:13, color:"var(--text-3)"}}>API quota exhausted. Resets at 1 AM Lagos time.</div>
            </div>
          )}
          </div>
        )}

        {/* TABLE */}
        {!loading && !error && tab === "table" && (
          <div>
            {fullTable.length > 0 ? (
              <LeagueTable rows={fullTable} selectedTeamId={teamId} />
            ) : (
              <div className={styles.empty}>League table not available for this season.</div>
            )}
          </div>
        )}
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