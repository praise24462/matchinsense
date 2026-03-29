"use client";

import { useEffect, useState, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/types";
import UpcomingMatches from "@/components/UpcomingMatches/UpcomingMatches";
import styles from "./matches.module.scss";
import type { MatchesApiResponse } from "@/app/api/matches/route";

// ── Date helpers ──────────────────────────────────────────────────────────────

function toLagosIso(date: Date): string {
  // Convert to Lagos local date (UTC+1)
  // Create a formatter that uses Africa/Lagos timezone
  const dateStr = new Date(date.getTime() + (60 * 60 * 1000)).toISOString().split("T")[0];
  return dateStr;
}

function todayIso() {
  // Always get today's date in Lagos timezone
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  
  // Account for Lagos timezone (UTC+1)
  const utcHour = now.getUTCHours();
  const lagosHour = (utcHour + 1) % 24;
  
  // If Lagos hour rolled to next day, add 1 day
  if (lagosHour < utcHour) {
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(now.getUTCDate() + 1);
    return `${tomorrow.getUTCFullYear()}-${String(tomorrow.getUTCMonth() + 1).padStart(2, "0")}-${String(tomorrow.getUTCDate()).padStart(2, "0")}`;
  }
  
  return `${year}-${month}-${day}`;
}

function offsetToIso(offset: number) {
  const d = new Date();
  const targetDate = new Date(d.getTime() + (offset * 24 * 60 * 60 * 1000));
  return toLagosIso(targetDate);
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
function fmtDateTimeForMatch(iso: string, today: string): string {
  const matchDate = iso.split("T")[0];
  if (matchDate === today) {
    // Today's match - just show time
    return fmtTime(iso);
  } else {
    // Other day - show day + time (e.g., "Tomorrow 14:30" or "Sun 30 Mar 14:30")
    return `${isoLabel(matchDate)} ${fmtTime(iso)}`;
  }
}
function buildCalDays(year: number, month: number) {
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const n = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDay).fill(null);
  for (let d = 1; d <= n; d++) cells.push(d);
  return cells;
}

// ── FIX 1: guard against missing league before grouping ───────────────────────
function groupByLeague(matches: Match[]) {
  const map = new Map<number, { leagueId: number; leagueName: string; leagueLogo: string; leagueCountry: string; source: string; matches: Match[] }>();
  for (const m of matches) {
    if (m?.league?.id == null) continue; // ← skip only if league.id is null or undefined, not 0
    if (!map.has(m.league.id)) map.set(m.league.id, { leagueId: m.league.id, leagueName: m.league.name, leagueLogo: m.league.logo, leagueCountry: m.league.country, source: m.source, matches: [] });
    map.get(m.league.id)!.matches.push(m);
  }
  return [...map.values()];
}

// ── CalendarPicker ────────────────────────────────────────────────────────────

function CalendarPicker({ selected, onSelect, onClose }: { selected: string; onSelect: (iso: string) => void; onClose: () => void }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
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

// ── Logo ──────────────────────────────────────────────────────────────────────

const Logo = memo(function Logo({ src, size, fallback }: { src: string; size: number; fallback?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card-hi)", borderRadius: 3, fontSize: size * 0.5, color: "var(--text-3)", flexShrink: 0 }}>
      {fallback ?? "?"}
    </div>
  );
  return (
    <img
      src={src} alt="" width={size} height={size}
      style={{ objectFit: "contain", flexShrink: 0, width: size, height: size }}
      onError={() => setErr(true)} loading="lazy"
    />
  );
});

// ── MatchRow ──────────────────────────────────────────────────────────────────

const MatchRow = memo(function MatchRow({ match, today }: { match: Match; today: string }) {
  const router  = useRouter();
  const isLive  = match.status === "LIVE" || match.status === "HT";
  const isFT    = match.status === "FT";
  const isNS    = match.status === "NS";
  const homeWin = isFT && (match.score.home ?? 0) > (match.score.away ?? 0);
  const awayWin = isFT && (match.score.away ?? 0) > (match.score.home ?? 0);
  const matchHref = `/match/${match.id}?source=${match.source}`;
  const isFdMatch = match.id < 600000;
  const teamSrc   = match.source === "african" ? "africa" : isFdMatch ? "fd" : "euro";

  function handleRowClick() { router.push(matchHref); }

  return (
    <div className={styles.matchRow} onClick={handleRowClick} style={{ cursor: "pointer" }}>
      <div className={styles.matchTime}>
        {isLive ? <span className={styles.liveTag}>{match.status}</span>
          : isFT  ? <span className={styles.ftTag}>FT</span>
          : isNS  ? <span className={styles.nsTime}>{fmtDateTimeForMatch(match.date, today)}</span>
          : <span className={styles.otherStatus}>{match.status}</span>}
      </div>
      <div className={styles.matchTeams}>
        <div className={styles.teamLine}>
          <Logo src={match.homeTeam.logo} size={18} fallback={match.homeTeam.name[0]} />
          <Link href={`/team/${match.homeTeam.id}?source=${teamSrc}`}
            onClick={e => e.stopPropagation()}
            className={`${styles.teamName} ${homeWin ? styles.teamWinner : ""}`}
            style={{ textDecoration: "none" }}>
            {match.homeTeam.name}
          </Link>
        </div>
        <div className={styles.teamLine}>
          <Logo src={match.awayTeam.logo} size={18} fallback={match.awayTeam.name[0]} />
          <Link href={`/team/${match.awayTeam.id}?source=${teamSrc}`}
            onClick={e => e.stopPropagation()}
            className={`${styles.teamName} ${awayWin ? styles.teamWinner : ""}`}
            style={{ textDecoration: "none" }}>
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

// ── Match importance scoring ──────────────────────────────────────────────────────
/**
 * Score matches by importance for sorting
 * Higher score = higher importance
 * 
 * Live matches: 1000+
 * Upcoming matches: 500-999 (based on league tier)
 * Finished matches: 0-499 (based on league tier)
 */
function getMatchImportance(match: Match, leaguePriority: Record<number, number>): number {
  const leagueId = match.league.id;
  const basePriority = leaguePriority[leagueId] ?? 100;
  
  // Live/HT matches have highest importance
  if (match.status === "LIVE" || match.status === "HT") {
    return 1000 + (100 - basePriority);
  }
  
  // Upcoming matches next (NS = Not Started)
  if (match.status === "NS") {
    return 500 + (100 - basePriority);
  }
  
  // Finished matches last (FT, PST, CANC, etc.)
  return 100 - basePriority;
}

// ── LeagueGroup ───────────────────────────────────────────────────────────────

type GroupData = { leagueId: number; leagueName: string; leagueLogo: string; leagueCountry: string; source: string; matches: Match[] };

const LeagueGroup = memo(function LeagueGroup({ group, today }: { group: GroupData; today: string }) {
  return (
    <div className={styles.leagueGroup}>
      <div className={styles.leagueHead}>
        <Logo src={group.leagueLogo} size={20} />
        <div className={styles.leagueInfo}>
          <span className={styles.leagueName}>{group.leagueName}</span>
          <span className={styles.leagueCountry}>{group.leagueCountry}</span>
        </div>
        <span className={styles.leagueCount}>{group.matches.length}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--text-3)" }}><polyline points="9 18 15 12 9 6"/></svg>
      </div>
      <div className={styles.matchList}>
        {group.matches.map(m => <MatchRow key={m.id} match={m} today={today} />)}
      </div>
    </div>
  );
});

// ── FallbackBanner ────────────────────────────────────────────────────────────

const FALLBACK_MESSAGES: Record<string, { title: string; body: string }> = {
  african_quota_exceeded: {
    title: "No African matches today",
    body:  "We've hit our daily limit for African fixture data. Here are upcoming European fixtures instead.",
  },
  african_empty: {
    title: "No African matches today",
    body:  "There are no African fixtures scheduled for today. Here are upcoming European fixtures instead.",
  },
  african_error: {
    title: "African data temporarily unavailable",
    body:  "We couldn't retrieve African fixtures right now. Here are upcoming European fixtures instead.",
  },
};

function FallbackBanner({ reason }: { reason?: MatchesApiResponse["fallbackReason"] }) {
  const msg = reason ? (FALLBACK_MESSAGES[reason] ?? FALLBACK_MESSAGES.african_empty) : FALLBACK_MESSAGES.african_empty;
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: "10px",
      padding: "10px 14px", margin: "0 0 12px",
      background: "rgba(245, 166, 35, 0.08)",
      border: "1px solid rgba(245, 166, 35, 0.25)",
      borderLeft: "3px solid #f5a623",
      borderRadius: "6px",
    }} role="status">
      <span style={{ fontSize: "16px", lineHeight: 1, flexShrink: 0, marginTop: "2px" }}>🌍</span>
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#f5a623", marginBottom: "2px", letterSpacing: "0.03em" }}>
          {msg.title}
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-2)", lineHeight: 1.5 }}>
          {msg.body}
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

type Props = { initialMatches: Match[]; initialError?: string | null };

export default function MatchesClient({ initialMatches, initialError }: Props) {
  const [matches,      setMatches]      = useState<Match[]>(initialMatches);
  const [loading,      setLoading]      = useState(false);
  const [fetchError,   setFetchError]   = useState<"quota" | "network" | null>(null);
  const [liveOnly,     setLiveOnly]     = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayIso()); // Initialize with today on client
  const [showCal,      setShowCal]      = useState(false);
  const [search,       setSearch]       = useState("");
  const [filterComp,   setFilterComp]   = useState<string | null>(null);
  const [isFallback,     setIsFallback]     = useState(false);
  const [fallbackReason, setFallbackReason] = useState<MatchesApiResponse["fallbackReason"]>(undefined);
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([]);
  const [loadingUpcoming, setLoadingUpcoming] = useState(false);

  // Ensure today's date is always correct on client-side
  useEffect(() => {
    setSelectedDate(todayIso());
  }, []);

  const MIN_DATE  = offsetToIso(-2);
  const MAX_DATE  = offsetToIso(1);
  const dateStrip = [-2, -1, 0, 1].map(i => ({ iso: offsetToIso(i), label: isoLabel(offsetToIso(i)) }));

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);
    setIsFallback(false);
    setFallbackReason(undefined);
    setMatches([]);

    fetch(`/api/matches?date=${selectedDate}`)
      .then(r => r.json())
      .then((data: MatchesApiResponse | Match[]) => {
        if (cancelled) return;

        // Support both old array shape and new object shape
        const raw      = Array.isArray(data) ? data : (data.matches ?? []);
        const fallback = !Array.isArray(data) && !!data.isFallback;

        // FIX 2: filter out any entries missing a valid league at the source
        // so groupByLeague, allComps, liveCount etc. never see bad data
        const clean = raw.filter((m: Match) => m?.league?.id != null);

        setMatches(clean);
        setIsFallback(fallback);
        setFallbackReason(!Array.isArray(data) ? data.fallbackReason : undefined);
      })
      .catch(() => { if (!cancelled) setFetchError("network"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [selectedDate]);

  // ── Fetch upcoming matches to supplement today if it has few matches ──────────
  useEffect(() => {
    const today = todayIso();
    
    // Fetch if:
    // - Today has less than 5 matches AND
    // - We're viewing today's date AND
    // - We're not in live-only mode AND
    // - We haven't encountered an error
    const hasEnoughMatches = matches.length >= 5;
    if (hasEnoughMatches || selectedDate !== today || liveOnly || fetchError) {
      setUpcomingMatches([]);
      setLoadingUpcoming(false);
      return;
    }

    let cancelled = false;
    setLoadingUpcoming(true);

    console.log("[MatchesClient] Today has", matches.length, "matches. Fetching upcoming to supplement...");

    fetch(`/api/matches/upcoming`)
      .then(r => r.json())
      .then((data: { matches?: any[]; count?: number; error?: string }) => {
        if (cancelled) return;
        
        if (data.error) {
          console.warn("[MatchesClient] Upcoming matches error:", data.error);
          setUpcomingMatches([]);
          setLoadingUpcoming(false);
          return;
        }

        const raw = (data.matches ?? []) as Match[];
        const filtered = raw.filter((m: Match) => m?.league?.id != null);
        // Show enough upcoming matches to reach 5 total in view
        const neededCount = Math.max(0, 5 - matches.length);
        const upcomingToShow = filtered.slice(0, Math.max(neededCount, 10)); // At least 10 upcoming
        
        console.log("[MatchesClient] Fetched", filtered.length, "upcoming. Showing", upcomingToShow.length);
        setUpcomingMatches(upcomingToShow);
        setLoadingUpcoming(false);
      })
      .catch(err => {
        console.error("[MatchesClient] Failed to fetch upcoming matches:", err);
        if (!cancelled) {
          setUpcomingMatches([]);
          setLoadingUpcoming(false);
        }
      });

    return () => { cancelled = true; };
  }, [matches.length, liveOnly, fetchError, selectedDate]);


  // ── Derived values ────────────────────────────────────────────────────────
  let display = matches;
  
  // When viewing today and we have < 5 matches, append upcoming matches
  const today = todayIso();
  if (selectedDate === today && matches.length < 5 && upcomingMatches.length > 0) {
    display = [...matches, ...upcomingMatches];
    console.log("[MatchesClient] Today view: combined", matches.length, "today +", upcomingMatches.length, "upcoming =", display.length, "total");
  }
  
  // Remove live matches from past/future dates — live only appears on today
  if (selectedDate !== today) {
    display = display.filter(m => m.status !== "LIVE" && m.status !== "HT");
  }
  
  if (liveOnly)   display = display.filter(m => m.status === "LIVE" || m.status === "HT");
  if (filterComp) display = display.filter(m => String(m.league.id) === filterComp);

  // Create importance scoring map based on league priorities
  const importancePriority: Record<number, number> = {
    2: 1, 3: 2, 848: 3, 4: 4, 1: 5,
    39: 6, 140: 7, 135: 8, 78: 9, 61: 10,
    88: 11, 94: 12, 144: 13, 12: 14, 20: 15, 6: 16,
    399: 17, 288: 18, 167: 19, 13: 26, 11: 27, 71: 28,
  };
  
  // Sort matches by importance (live first, then upcoming by league tier, then finished)
  display = display.sort((a, b) => {
    const scoreA = getMatchImportance(a, importancePriority);
    const scoreB = getMatchImportance(b, importancePriority);
    
    if (scoreB !== scoreA) return scoreB - scoreA; // Higher score first
    
    // Secondary sort: by match date
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  let groups    = groupByLeague(display);
  const liveCount = matches.filter(m => m.status === "LIVE" || m.status === "HT").length;

  // ── Sort groups by league importance (same priority as matches) ──────────────
  groups = groups.sort((a, b) => {
    const aPri = importancePriority[a.leagueId] ?? 999;
    const bPri = importancePriority[b.leagueId] ?? 999;
    
    if (aPri !== bPri) return aPri - bPri; // Higher priority first
    
    // Secondary sort: by league name
    return a.leagueName.localeCompare(b.leagueName);
  });

  // ── Pagination ────────────────────────────────────────────────────────
  const INITIAL_GROUPS = 6;
  const BATCH_SIZE     = 8;
  const [visibleCount, setVisibleCount] = useState(INITIAL_GROUPS);
  const groupsLenRef = useRef(0);

  useEffect(() => { setVisibleCount(INITIAL_GROUPS); }, [selectedDate]);

  const handleLoadMore = () => {
    setVisibleCount(v => Math.min(v + BATCH_SIZE, groupsLenRef.current));
  };

  groupsLenRef.current = groups.length;
  const visibleGroups = groups.slice(0, visibleCount);
  const hasMoreGroups = visibleCount < groups.length;

  // ── Sidebar competitions ──────────────────────────────────────────────────
  // All available competitions (European + African leagues)
  const ALL_AVAILABLE_COMPETITIONS = [
    // International Tournaments
    { code: "1",   name: "FIFA World Cup",       country: "World",      logo: "https://media.api-sports.io/football/leagues/1.png" },
    { code: "4",   name: "Euro Championship",    country: "Europe",     logo: "https://media.api-sports.io/football/leagues/4.png" },
    // European Club Competitions
    { code: "2",   name: "Champions League",     country: "Europe",     logo: "https://media.api-sports.io/football/leagues/2.png" },
    { code: "3",   name: "Europa League",        country: "Europe",     logo: "https://media.api-sports.io/football/leagues/3.png" },
    // Top 5 European Leagues
    { code: "39",  name: "Premier League",       country: "England",    logo: "https://media.api-sports.io/football/leagues/39.png" },
    { code: "140", name: "La Liga",              country: "Spain",      logo: "https://media.api-sports.io/football/leagues/140.png" },
    { code: "135", name: "Serie A",              country: "Italy",      logo: "https://media.api-sports.io/football/leagues/135.png" },
    { code: "78",  name: "Bundesliga",           country: "Germany",    logo: "https://media.api-sports.io/football/leagues/78.png" },
    { code: "61",  name: "Ligue 1",              country: "France",     logo: "https://media.api-sports.io/football/leagues/61.png" },
    // Secondary Leagues
    { code: "10",  name: "Championship",         country: "England",    logo: "https://media.api-sports.io/football/leagues/10.png" },
    { code: "94",  name: "Primeira Liga",        country: "Portugal",   logo: "https://media.api-sports.io/football/leagues/94.png" },
    { code: "71",  name: "Brasileirão",          country: "Brazil",     logo: "https://media.api-sports.io/football/leagues/71.png" },
    // African Leagues
    { code: "6",   name: "Africa Cup of Nations",country: "Africa",     logo: "https://media.api-sports.io/football/leagues/6.png" },
    { code: "20",  name: "CAF Champions League", country: "Africa",     logo: "https://media.api-sports.io/football/leagues/20.png" },
    { code: "21",  name: "CAF Confederation Cup",country: "Africa",     logo: "https://media.api-sports.io/football/leagues/21.png" },
    { code: "323", name: "NPFL",                 country: "Nigeria",    logo: "https://media.api-sports.io/football/leagues/323.png" },
    { code: "169", name: "Ghana Premier League", country: "Ghana",      logo: "https://media.api-sports.io/football/leagues/169.png" },
    { code: "288", name: "PSL",                  country: "South Africa", logo: "https://media.api-sports.io/football/leagues/288.png" },
    { code: "233", name: "Egyptian Premier League", country: "Egypt",   logo: "https://media.api-sports.io/football/leagues/233.png" },
    { code: "200", name: "Tunisian Ligue 1",     country: "Tunisia",    logo: "https://media.api-sports.io/football/leagues/200.png" },
  ];

  const SIDEBAR_PRIORITY: Record<string, number> = {
    "1": 1,   "4": 2,   "2": 3,   "3": 4,
    "39": 5,  "140": 6, "135": 7, "78": 8,   "61": 9,
    "10": 10, "94": 11, "71": 12,
    "6": 13,  "20": 14, "21": 15,
    "323": 16, "169": 17, "288": 18, "233": 19, "200": 20,
  };

  // Use all available competitions for sidebar (not just today's matches)
  const allComps = ALL_AVAILABLE_COMPETITIONS.sort((a, b) => {
    const aPri = SIDEBAR_PRIORITY[a.code] ?? 999;
    const bPri = SIDEBAR_PRIORITY[b.code] ?? 999;
    if (aPri !== bPri) return aPri - bPri;
    return a.country.localeCompare(b.country) || a.name.localeCompare(b.name);
  });

  const searchLower = search.toLowerCase();
  const sideComps   = searchLower
    ? allComps.filter(c => c.name.toLowerCase().includes(searchLower) || c.country.toLowerCase().includes(searchLower))
    : allComps;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.shell}>

      {/* ══ SIDEBAR ══ */}
      <aside className={styles.sidebar}>
        <div className={styles.sideSearch}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input placeholder="Search teams, leagues…" value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className={styles.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>
        <div className={styles.sideGroup}>
          <div className={styles.sideGroupHead}><span>COMPETITIONS</span></div>
          {sideComps.map(c => (
            <button key={c.code} className={`${styles.sideRow} ${filterComp === c.code ? styles.sideRowActive : ""}`} onClick={() => setFilterComp(filterComp === c.code ? null : c.code)}>
              <Logo src={c.logo} size={20} />
              <div className={styles.sideRowInfo}>
                <span className={styles.sideRowName}>{c.name}</span>
                <span className={styles.sideRowSub}>{c.country}</span>
              </div>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ color: "var(--text-3)", flexShrink: 0 }}><polyline points="9 18 15 12 9 6"/></svg>
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

          <button className={styles.dateArrow} disabled={selectedDate <= MIN_DATE}
            onClick={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() - 1); return nd.toISOString().split("T")[0]; })}
            style={{ opacity: selectedDate <= MIN_DATE ? 0.3 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>

          <div className={styles.dateTabs}>
            {dateStrip.map((d, idx) => (
              <button key={idx} className={`${styles.dateTab} ${selectedDate === d.iso ? styles.dateTabActive : ""}`} onClick={() => setSelectedDate(d.iso)}>
                {d.label}
              </button>
            ))}
          </div>

          <button className={styles.dateArrow} disabled={selectedDate >= MAX_DATE}
            onClick={() => setSelectedDate(d => { const nd = new Date(d); nd.setDate(nd.getDate() + 1); return nd.toISOString().split("T")[0]; })}
            style={{ opacity: selectedDate >= MAX_DATE ? 0.3 : 1 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          <div className={styles.calWrap}>
            <button className={`${styles.calBtn} ${showCal ? styles.calBtnActive : ""}`} onClick={() => setShowCal(v => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            </button>
            {showCal && (
              <CalendarPicker
                selected={selectedDate}
                onSelect={iso => { const clamped = iso < MIN_DATE ? MIN_DATE : iso > MAX_DATE ? MAX_DATE : iso; setSelectedDate(clamped); }}
                onClose={() => setShowCal(false)}
              />
            )}
          </div>
        </div>

        {/* Filter pill */}
        {filterComp && (() => { const c = allComps.find(x => x.code === filterComp); return c ? (
          <div className={styles.filterPill}><Logo src={c.logo} size={14} /><span>{c.name}</span><button onClick={() => setFilterComp(null)}>✕</button></div>
        ) : null; })()}

        {/* Count bar */}
        {!loading && matches.length > 0 && (
          <div className={styles.countBar}>
            <span className={styles.countLabel}>
              {isFallback ? "Upcoming European fixtures" : isoLabel(selectedDate)}
            </span>
            <span className={styles.countNum}>{display.length} match{display.length !== 1 ? "es" : ""}</span>
            {liveCount > 0 && <span className={styles.countLive}><span className={styles.liveDot}/>{liveCount} live</span>}
          </div>
        )}

        {/* Fallback banner — shown above matches when African API has no data */}
        {!loading && isFallback && matches.length > 0 && (
          <FallbackBanner reason={fallbackReason} />
        )}

        {/* Loading skeletons */}
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

        {/* Network error */}
        {!loading && fetchError === "network" && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>⚠️</div>
            <h2 className={styles.emptyTitle}>Connection error</h2>
            <p className={styles.emptyText}>Check your connection and try again.</p>
            <button className={styles.emptyBtn} onClick={() => setSelectedDate(s => s)}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetchError && groups.length === 0 && (
          <>
            {liveOnly && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📺</div>
                <h2 className={styles.emptyTitle}>No live matches right now</h2>
                <p className={styles.emptyText}>No games are currently in play.</p>
                <button className={styles.emptyBtn} onClick={() => setLiveOnly(false)}>Show all matches</button>
              </div>
            )}
            
            {!liveOnly && loadingUpcoming && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>⏳</div>
                <h2 className={styles.emptyTitle}>Loading upcoming matches…</h2>
                <p className={styles.emptyText}>Fetching fixtures for the next 14 days.</p>
              </div>
            )}
            
            {!liveOnly && !loadingUpcoming && upcomingMatches.length > 0 && selectedDate !== today && (
              <UpcomingMatches 
                matches={upcomingMatches}
                totalCount={upcomingMatches.length}
              />
            )}
            
            {!liveOnly && !loadingUpcoming && upcomingMatches.length === 0 && selectedDate === today && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📅</div>
                <h2 className={styles.emptyTitle}>No matches today</h2>
                <p className={styles.emptyText}>No fixtures found for today.</p>
              </div>
            )}

            {!liveOnly && !loadingUpcoming && groups.length === 0 && selectedDate !== today && (
              <div className={styles.empty}>
                <div className={styles.emptyIcon}>📅</div>
                <h2 className={styles.emptyTitle}>No matches on {isoLabel(selectedDate)}</h2>
                <p className={styles.emptyText}>No fixtures found for this date.</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 16 }}>
                  <button className={styles.emptyBtn} onClick={() => setSelectedDate(offsetToIso(-1))}>
                    ← View yesterday
                  </button>
                  <button className={styles.emptyBtn}
                    style={{ background: "var(--bg-card)", color: "var(--text-2)", border: "1px solid var(--border)" }}
                    onClick={() => setSelectedDate(offsetToIso(1))}>
                    Tomorrow →
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* League groups */}
        {!loading && visibleGroups.map(group => (
          <LeagueGroup key={group.leagueId} group={group} today={today} />
        ))}

        {/* Load more button - explicit pagination */}
        {!loading && hasMoreGroups && (
          <div style={{ padding: "20px 0", textAlign: "center" }}>
            <button
              onClick={handleLoadMore}
              style={{
                padding: "10px 20px",
                background: "var(--accent, #FF4B2B)",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: "600",
              }}
            >
              Load more competitions ({visibleCount} of {groups.length})
            </button>
            <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-3)" }}>
              Showing {visibleCount} of {groups.length} competitions
            </div>
          </div>
        )}

      </div>
    </div>
  );
}