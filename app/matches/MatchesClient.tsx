"use client";

import { useEffect, useState, useRef, memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/types";
import styles from "./matches.module.scss";

function toLagosIso(date: Date): string {
  // Lagos is UTC+1
  const lagos = new Date(date.getTime() + 60 * 60 * 1000);
  return lagos.toISOString().split("T")[0];
}
function todayIso() {
  return toLagosIso(new Date());
}
function offsetToIso(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toLagosIso(d);
}
function smartDefaultDate() {
  // Use Lagos time (UTC+1) — if before 6am Lagos, show yesterday
  const lagosHour = (new Date().getUTCHours() + 1) % 24;
  if (lagosHour < 6) return offsetToIso(-1);
  return todayIso();
}
function isoLabel(iso: string) {
  if (iso === todayIso())      return "Today";
  if (iso === offsetToIso(1))  return "Tomorrow";
  if (iso === offsetToIso(-1)) return "Yesterday";
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}
function buildCalDays(year: number, month: number) {
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const n = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  return cells;
}
function groupByLeague(matches: Match[]) {
  const map = new Map<number, { leagueId: number; leagueName: string; leagueLogo: string; leagueCountry: string; source: string; matches: Match[] }>();
  for (const m of matches) {
    if (!map.has(m.league.id)) map.set(m.league.id, { leagueId: m.league.id, leagueName: m.league.name, leagueLogo: m.league.logo, leagueCountry: m.league.country, source: m.source, matches: [] });
    map.get(m.league.id)!.matches.push(m);
  }
  return [...map.values()];
}

function CalendarPicker({ selected, onSelect, onClose }: { selected: string; onSelect: (iso: string) => void; onClose: () => void }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  function prevM() { month === 0 ? (setYear(y => y - 1), setMonth(11)) : setMonth(m => m - 1); }
  function nextM() { month === 11 ? (setYear(y => y + 1), setMonth(0)) : setMonth(m => m + 1); }
  const days = buildCalDays(year, month);
  const todayStr = todayIso();
  return (
    <div className={styles.calPicker} ref={ref}>
      <div className={styles.calHead}>
        <button className={styles.calArrow} onClick={prevM}>‹</button>
        <span className={styles.calMonth}>{new Date(year, month).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</span>
        <button className={styles.calArrow} onClick={nextM}>›</button>
      </div>
      <div className={styles.calGrid}>
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map(d => <span key={d} className={styles.calWeekday}>{d}</span>)}
        {days.map((d, i) => {
          if (!d) return <span key={`_${i}`} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          return <button key={i} className={`${styles.calDay} ${iso === todayStr ? styles.calToday : ""} ${iso === selected ? styles.calSelected : ""}`} onClick={() => { onSelect(iso); onClose(); }}>{d}</button>;
        })}
      </div>
    </div>
  );
}

const Logo = memo(function Logo({ src, size, fallback }: { src: string; size: number; fallback?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card-hi)", borderRadius: 3, fontSize: size * 0.5, color: "var(--text-3)", flexShrink: 0 }}>
      {fallback ?? "?"}
    </div>
  );
  // Use plain img — works with SVG crests from football-data.org and api-football
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: "contain", flexShrink: 0, width: size, height: size }}
      onError={() => setErr(true)}
      loading="lazy"
    />
  );
});

const MatchRow = memo(function MatchRow({ match }: { match: Match }) {
  const router  = useRouter();
  const isLive  = match.status === "LIVE" || match.status === "HT";
  const isFT    = match.status === "FT";
  const isNS    = match.status === "NS";
  const homeWin = isFT && (match.score.home ?? 0) > (match.score.away ?? 0);
  const awayWin = isFT && (match.score.away ?? 0) > (match.score.home ?? 0);
  const matchHref = `/match/${match.id}?source=${match.source}`;
  const isFdMatch = match.id < 600000;
  const teamSrc = match.source === "africa" ? "africa" : isFdMatch ? "fd" : "euro";

  // Clicking anywhere on the row goes to match detail
  // EXCEPT clicking team names which goes to team history
  function handleRowClick() {
    router.push(matchHref);
  }

  return (
    <div className={styles.matchRow} onClick={handleRowClick} style={{cursor:"pointer"}}>
      <div className={styles.matchTime}>
        {isLive ? <span className={styles.liveTag}>{match.status}</span>
          : isFT ? <span className={styles.ftTag}>FT</span>
          : isNS ? <span className={styles.nsTime}>{fmtTime(match.date)}</span>
          : <span className={styles.otherStatus}>{match.status}</span>}
      </div>
      <div className={styles.matchTeams}>
        <div className={styles.teamLine}>
          <Logo src={match.homeTeam.logo} size={18} fallback={match.homeTeam.name[0]} />
          <Link href={`/team/${match.homeTeam.id}?source=${teamSrc}`}
            onClick={e => e.stopPropagation()}
            className={`${styles.teamName} ${homeWin ? styles.teamWinner : ""}`}
            style={{textDecoration:"none"}}>
            {match.homeTeam.name}
          </Link>
        </div>
        <div className={styles.teamLine}>
          <Logo src={match.awayTeam.logo} size={18} fallback={match.awayTeam.name[0]} />
          <Link href={`/team/${match.awayTeam.id}?source=${teamSrc}`}
            onClick={e => e.stopPropagation()}
            className={`${styles.teamName} ${awayWin ? styles.teamWinner : ""}`}
            style={{textDecoration:"none"}}>
            {match.awayTeam.name}
          </Link>
        </div>
      </div>
      <div className={styles.matchScore}>
        {isNS ? <span className={styles.scoreDash}>-</span> : (
          <>
            <span className={`${styles.scoreNum} ${homeWin ? styles.scoreWin : ""}`}>{match.score.home ?? "–"}</span>
            <span className={`${styles.scoreNum} ${awayWin ? styles.scoreWin : ""}`}>{match.score.away ?? "–"}</span>
          </>
        )}
      </div>
      <button className={styles.starBtn} onClick={e => e.stopPropagation()} aria-label="Follow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </button>
    </div>
  );
});

type Props = { initialMatches: Match[]; initialError?: string | null };

type GroupData = { leagueId: number; leagueName: string; leagueLogo: string; leagueCountry: string; source: string; matches: Match[] };
const LeagueGroup = memo(function LeagueGroup({ group }: { group: GroupData }) {
  return (
    <div className={styles.leagueGroup}>
      <div className={styles.leagueHead}>
        <Logo src={group.leagueLogo} size={20} />
        <div className={styles.leagueInfo}>
          <span className={styles.leagueName}>{group.leagueName}</span>
          <span className={styles.leagueCountry}>{group.leagueCountry}</span>
        </div>
        <span className={styles.leagueCount}>{group.matches.length}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{color:"var(--text-3)"}}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div className={styles.matchList}>
        {group.matches.map(m => <MatchRow key={m.id} match={m} />)}
      </div>
    </div>
  );
});


export default function MatchesClient({ initialMatches, initialError }: Props) {
  const [matches,      setMatches]      = useState<Match[]>(initialMatches);
  const [loading,      setLoading]      = useState(false);
  const [fetchError,   setFetchError]   = useState<"quota"|"network"|null>(null);
  const [liveOnly,     setLiveOnly]     = useState(false);
  const [selectedDate, setSelectedDate] = useState(smartDefaultDate());
  const [showCal,      setShowCal]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterComp,   setFilterComp]   = useState<string | null>(null);


  const MIN_DATE  = offsetToIso(-2);
  const MAX_DATE  = offsetToIso(1);
  const dateStrip = [-2, -1, 0, 1].map(i => ({ iso: offsetToIso(i), label: isoLabel(offsetToIso(i)) }));

  // Fetch main matches
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setMatches([]);

    fetch(`/api/matches?date=${selectedDate}`)
      .then(r => r.json())
      .then(async data => {
        if (cancelled) return;
        if (Array.isArray(data)) {
          // If today returns 0 matches, auto-load yesterday
          if (data.length === 0 && selectedDate === todayIso()) {
            const yesterday = offsetToIso(-1);
            const res2 = await fetch(`/api/matches?date=${yesterday}`);
            const data2 = await res2.json();
            if (!cancelled && Array.isArray(data2) && data2.length > 0) {
              setMatches(data2);
              setSelectedDate(yesterday);
              return;
            }
          }
          setMatches(data);
        } else {
          // Quota exceeded — auto-load yesterday from cache
          const yesterday = offsetToIso(-1);
          try {
            const res2 = await fetch(`/api/matches?date=${yesterday}`);
            const data2 = await res2.json();
            if (!cancelled && Array.isArray(data2) && data2.length > 0) {
              setMatches(data2);
              setSelectedDate(yesterday);
              return;
            }
          } catch {}
          setFetchError("quota");
        }
      })
      .catch(() => { if (!cancelled) setFetchError("network"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedDate]);



  // Filtered display
  let display = matches;
  if (liveOnly) display = display.filter(m => m.status === "LIVE" || m.status === "HT");
  if (filterComp) display = display.filter(m => String(m.league.id) === filterComp);

  const groups = groupByLeague(display);
  const liveCount = matches.filter(m => m.status === "LIVE" || m.status === "HT").length;

  const INITIAL_GROUPS = 8;
  const BATCH_SIZE     = 10;
  const [visibleCount, setVisibleCount] = useState(INITIAL_GROUPS);
  const sentinelRef    = useRef<HTMLDivElement>(null);
  const groupsLenRef   = useRef(0);

  useEffect(() => { setVisibleCount(INITIAL_GROUPS); }, [selectedDate]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting)
        setVisibleCount(v => Math.min(v + BATCH_SIZE, groupsLenRef.current));
    }, { rootMargin: "400px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  groupsLenRef.current = groups.length;
  const visibleGroups = groups.slice(0, visibleCount);

  // Competitions for search
  // Priority leagues shown first in sidebar, rest alphabetical
  const SIDEBAR_PRIORITY: Record<string, number> = {
    "2": 1, "3": 2, "848": 3,       // UCL, UEL, UECL
    "39": 4, "140": 5, "135": 6,    // PL, La Liga, Serie A
    "78": 7, "61": 8,               // Bundesliga, Ligue 1
    "12": 9, "20": 10, "6": 11,     // CAF CL, CAF CC, AFCON
    "399": 12,                       // NPFL
    "288": 13, "167": 14,           // PSL, Egypt
    "13": 15, "11": 16,             // Copa Libertadores, Copa Sud
    "71": 17, "128": 18,            // Brazil, Argentina
  };

  const allComps = Array.from(
    new Map(matches.map(m => [m.league.id, { code: String(m.league.id), name: m.league.name, country: m.league.country, logo: m.league.logo }])).values()
  ).sort((a, b) => {
    const aPri = SIDEBAR_PRIORITY[a.code] ?? 999;
    const bPri = SIDEBAR_PRIORITY[b.code] ?? 999;
    if (aPri !== bPri) return aPri - bPri;
    return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
  });

  const searchLower = search.toLowerCase();
  const sideComps = searchLower
    ? allComps.filter(c => c.name.toLowerCase().includes(searchLower) || c.country.toLowerCase().includes(searchLower))
    : allComps;

  return (
    <div className={styles.shell}>

      {/* ══ SIDEBAR ══ */}
      <aside className={styles.sidebar}>
        <div className={styles.sideSearch}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search teams, leagues…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>        {/* ── Competitions filter ── */}
        <div className={styles.sideGroup}>
          <div className={styles.sideGroupHead}><span>COMPETITIONS</span></div>
          {sideComps.map(c => (
            <button key={c.code} className={`${styles.sideRow} ${filterComp === c.code ? styles.sideRowActive : ""}`} onClick={() => setFilterComp(filterComp === c.code ? null : c.code)}>
              <Logo src={c.logo} size={20} />
              <div className={styles.sideRowInfo}>
                <span className={styles.sideRowName}>{c.name}</span>
                <span className={styles.sideRowSub}>{c.country}</span>
              </div>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{color:"var(--text-3)",flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          ))}
        </div>
      </aside>

      {/* ══ MAIN ══ */}
      <div className={styles.main}>

        {/* Date bar */}
        <div className={styles.datebar}>
          <button className={`${styles.liveBtn} ${liveOnly ? styles.liveBtnActive : ""}`} onClick={() => setLiveOnly(v => !v)}>
            <span className={styles.liveDot} />
            LIVE{liveCount > 0 && <span className={styles.liveBadge}>{liveCount}</span>}
          </button>

          <button className={styles.dateArrow} disabled={selectedDate <= MIN_DATE} onClick={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd.toISOString().split("T")[0]; })} style={{opacity: selectedDate <= MIN_DATE ? 0.3 : 1}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div className={styles.dateTabs}>
            {dateStrip.map(d => (
              <button key={d.iso} className={`${styles.dateTab} ${selectedDate === d.iso ? styles.dateTabActive : ""}`} onClick={() => setSelectedDate(d.iso)}>
                {d.label}
              </button>
            ))}
          </div>

          <button className={styles.dateArrow} disabled={selectedDate >= MAX_DATE} onClick={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd.toISOString().split("T")[0]; })} style={{opacity: selectedDate >= MAX_DATE ? 0.3 : 1}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <div className={styles.calWrap}>
            <button className={`${styles.calBtn} ${showCal ? styles.calBtnActive : ""}`} onClick={() => setShowCal(v => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            {showCal && <CalendarPicker selected={selectedDate} onSelect={(iso) => { const clamped = iso < MIN_DATE ? MIN_DATE : iso > MAX_DATE ? MAX_DATE : iso; setSelectedDate(clamped); }} onClose={() => setShowCal(false)} />}
          </div>
        </div>

        {/* Filter pill */}
        {filterComp && (() => { const c = allComps.find(x => x.code === filterComp); return c ? (
          <div className={styles.filterPill}><Logo src={c.logo} size={14} /><span>{c.name}</span><button onClick={() => setFilterComp(null)}>✕</button></div>
        ) : null; })()}

        {/* Count bar */}
        {!loading && matches.length > 0 && (
          <div className={styles.countBar}>
            <span className={styles.countLabel}>{isoLabel(selectedDate)}</span>
            <span className={styles.countNum}>{display.length} match{display.length !== 1 ? "es" : ""}</span>
            {liveCount > 0 && <span className={styles.countLive}><span className={styles.liveDot}/>{liveCount} live</span>}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className={styles.skeletons}>
            {Array.from({ length: 3 }).map((_, gi) => (
              <div key={gi} className={styles.skelGroup}>
                <div className={styles.skelGroupHead} />
                {Array.from({ length: 4 }).map((_, mi) => <div key={mi} className={styles.skelRow} />)}
              </div>
            ))}
          </div>
        )}

        {/* Quota / network error */}
        {!loading && fetchError && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⏳</div>
            <h2 className={styles.emptyTitle}>Daily limit reached</h2>
            <p className={styles.emptyText}>The free API plan resets at 1:00 AM Lagos time. Yesterday's matches are still available.</p>
            <button className={styles.emptyBtn} onClick={() => { const y = new Date(); y.setDate(y.getDate()-1); setSelectedDate(y.toISOString().split("T")[0]); }}>
              View yesterday's matches →
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !fetchError && groups.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>📅</div>
            <h2 className={styles.emptyTitle}>{liveOnly ? "No live matches right now" : `No matches on ${isoLabel(selectedDate)}`}</h2>
            <p className={styles.emptyText}>{liveOnly ? "No games are currently in play." : "No fixtures found for this date."}</p>
            {liveOnly && <button className={styles.emptyBtn} onClick={() => setLiveOnly(false)}>Show all matches</button>}
            {!liveOnly && <button className={styles.emptyBtn} onClick={() => { const y = new Date(); y.setDate(y.getDate()-1); setSelectedDate(y.toISOString().split("T")[0]); }}>View yesterday →</button>}
          </div>
        )}

        {/* League groups */}
        {!loading && visibleGroups.map(group => (
          <LeagueGroup key={group.leagueId} group={group} />
        ))}

        {/* Sentinel */}
        {!loading && visibleCount < groups.length && (
          <div ref={sentinelRef} style={{ padding: "12px", textAlign: "center", color: "var(--text-3)", fontSize: "12px" }}>
            Showing {visibleCount} of {groups.length} leagues…
          </div>
        )}
      </div>
    </div>
  );
}