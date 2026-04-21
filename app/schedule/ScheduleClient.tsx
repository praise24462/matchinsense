"use client";

import { useEffect, useState, useRef, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Match } from "@/types";
import styles from "./schedule.module.scss";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

function isoLabel(iso: string) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { 
    weekday: "short", 
    day: "numeric", 
    month: "short",
    year: "numeric"
  });
}

// ── Logo component ────────────────────────────────────────────────────────────
const Logo = memo(function Logo({ src, size = 24, fallback }: { src?: string; size?: number; fallback?: string }) {
  const [err, setErr] = useState(false);
  
  if (!src || err) {
    return (
      <div 
        style={{ 
          width: size, 
          height: size, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          background: "rgba(255,255,255,0.08)", 
          borderRadius: 4, 
          fontSize: size * 0.5, 
          color: "var(--text-3)", 
          flexShrink: 0,
          fontWeight: 600
        }}
      >
        {fallback ?? "?"}
      </div>
    );
  }

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ objectFit: "contain", width: size, height: size }}
        onError={() => setErr(true)}
      />
    </div>
  );
});

// ── MatchRow ──────────────────────────────────────────────────────────────────
const MatchRow = memo(function MatchRow({ match }: { match: Match }) {
  const router = useRouter();
  const matchHref = `/match/${match.id}?source=${match.source}`;
  
  function handleClick() {
    router.push(matchHref);
  }

  const homeTeamName = match.homeTeam?.name || 'Home';
  const awayTeamName = match.awayTeam?.name || 'Away';

  return (
    <div className={styles.matchRow} onClick={handleClick}>
      <div className={styles.matchDate}>
        {isoLabel(match.date.split("T")[0])}
      </div>
      <div className={styles.matchTime}>
        {fmtTime(match.date)}
      </div>
      <div className={styles.matchTeams}>
        <Logo src={match.homeTeam?.logo} size={20} fallback={homeTeamName[0]} />
        <span className={styles.teamName}>{homeTeamName}</span>
        <span className={styles.vs}>vs</span>
        <span className={styles.teamName}>{awayTeamName}</span>
        <Logo src={match.awayTeam?.logo} size={20} fallback={awayTeamName[0]} />
      </div>
    </div>
  );
});

// ── CompetitionGroup ─────────────────────────────────────────────────────────
type CompetitionData = {
  leagueId: number;
  leagueName: string;
  leagueLogo: string;
  leagueCountry: string;
  source: string;
  matches: Match[];
};

const CompetitionGroup = memo(function CompetitionGroup({ group }: { group: CompetitionData }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className={styles.competitionGroup}>
      <button 
        className={styles.competitionHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <div className={styles.competitionInfo}>
          <Logo src={group.leagueLogo} size={28} fallback={group.leagueName[0]} />
          <div className={styles.competitionDetails}>
            <span className={styles.competitionName}>{group.leagueName}</span>
            <span className={styles.competitionCountry}>{group.leagueCountry}</span>
          </div>
        </div>
        <div className={styles.competitionMeta}>
          <span className={styles.matchCount}>{group.matches.length} matches</span>
          <span className={styles.expandIcon}>{expanded ? "▼" : "▶"}</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.matchesList}>
          {group.matches.map(match => (
            <MatchRow key={match.id} match={match} />
          ))}
        </div>
      )}
    </div>
  );
});

// ── Main component ────────────────────────────────────────────────────────────
export default function ScheduleClient() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log("[ScheduleClient] Fetching full season schedule...");

    fetch(`/api/matches/upcoming`)
      .then(r => r.json())
      .then((data: { matches?: any[]; count?: number; error?: string }) => {
        if (cancelled) return;

        if (data.error) {
          console.error("[ScheduleClient] API error:", data.error);
          setError(data.error);
          setMatches([]);
          return;
        }

        const raw = (data.matches ?? []) as Match[];
        const filtered = raw.filter((m: Match) => 
          m?.league?.id != null && 
          m?.homeTeam?.name && 
          m?.awayTeam?.name
        );
        
        console.log("[ScheduleClient] Schedule loaded:", filtered.length, "matches");
        setMatches(filtered);
        setError(null);
      })
      .catch(err => {
        console.error("[ScheduleClient] Fetch error:", err);
        if (!cancelled) {
          setError("Failed to load schedule");
          setMatches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Group by competition
  const grouped = new Map<number, CompetitionData>();
  for (const match of matches) {
    if (!grouped.has(match.league.id)) {
      grouped.set(match.league.id, {
        leagueId: match.league.id,
        leagueName: match.league.name,
        leagueLogo: match.league.logo,
        leagueCountry: match.league.country,
        source: match.source,
        matches: [],
      });
    }
    grouped.get(match.league.id)!.matches.push(match);
  }

  const groups = Array.from(grouped.values())
    .sort((a, b) => {
      const priority: Record<string, number> = {
        "Champions League": 1,
        "Europa League": 2,
        "Premier League": 3,
        "La Liga": 4,
        "Serie A": 5,
        "Bundesliga": 6,
        "Ligue 1": 7,
      };
      const aPri = priority[a.leagueName] ?? 999;
      const bPri = priority[b.leagueName] ?? 999;
      return aPri - bPri;
    });

  const searchLower = search.toLowerCase();
  const filteredGroups = groups.filter(g =>
    g.leagueName.toLowerCase().includes(searchLower) ||
    g.leagueCountry.toLowerCase().includes(searchLower)
  );

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()}>
          <span>←</span>
          <span>Back</span>
        </button>
        <div className={styles.headerTitle}>
          <h1>Full Season Schedule</h1>
          <p className={styles.subtitle}>2025/26 Upcoming Fixtures</p>
        </div>
      </div>

      {/* Stats */}
      {!loading && matches.length > 0 && (
        <div className={styles.stats}>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{matches.length}</span>
            <span className={styles.statLabel}>Total Matches</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statValue}>{groups.length}</span>
            <span className={styles.statLabel}>Competitions</span>
          </div>
        </div>
      )}

      {/* Search */}
      {!loading && groups.length > 1 && (
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search competitions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingState}>
          <div className={styles.spinner} />
          <p>Loading full season schedule...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className={styles.errorState}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className={styles.retryBtn}>
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && matches.length === 0 && !error && (
        <div className={styles.emptyState}>
          <span>📅</span>
          <p>No scheduled matches found</p>
        </div>
      )}

      {/* Competitions List */}
      {!loading && filteredGroups.length > 0 && (
        <div className={styles.competitionsList}>
          {filteredGroups.map(group => (
            <CompetitionGroup key={group.leagueId} group={group} />
          ))}
        </div>
      )}

      {/* No results from search */}
      {!loading && search && filteredGroups.length === 0 && (
        <div className={styles.noResults}>
          <p>No competitions match "{search}"</p>
        </div>
      )}
    </div>
  );
}
