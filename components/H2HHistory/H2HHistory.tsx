"use client";
import React, { useState, useEffect } from "react";
import styles from "./H2HHistory.module.scss";

interface H2HMatch {
  id: number;
  date: string;
  homeTeam: { id: number; name: string; logo: string };
  awayTeam: { id: number; name: string; logo: string };
  score: { home: number | null; away: number | null };
  league: { name: string; logo: string };
}

interface H2HData {
  homeTeam: { id: number; name: string };
  awayTeam: { id: number; name: string };
  lastMeetings: H2HMatch[];
  summary: { homeWins: number; draws: number; awayWins: number };
  avgGoalsHome: number;
  avgGoalsAway: number;
}

export default function H2HHistory({
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
}: {
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
}) {
  const [data, setData] = useState<H2HData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/match-h2h?h2h=${homeTeamId}-${awayTeamId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load H2H history");
        return r.json();
      })
      .then((response) => {
        // Handle both array and object responses
        const fixtures = Array.isArray(response) ? response : (response.fixtures || response.response || response.data || []);
        
        if (!Array.isArray(fixtures) || fixtures.length === 0) {
          setData({
            homeTeam: { id: homeTeamId, name: homeTeamName },
            awayTeam: { id: awayTeamId, name: awayTeamName },
            lastMeetings: [],
            summary: { homeWins: 0, draws: 0, awayWins: 0 },
            avgGoalsHome: 0,
            avgGoalsAway: 0,
          });
          return;
        }

        // Transform the response to our expected format
        const homeWins = fixtures.filter((f: H2HMatch) => 
          f.homeTeam.name === homeTeamName && f.score.home! > f.score.away!
        ).length;
        const awayWins = fixtures.filter((f: H2HMatch) => 
          f.homeTeam.name === homeTeamName && f.score.home! < f.score.away!
        ).length;
        const draws = fixtures.filter((f: H2HMatch) => 
          f.score.home === f.score.away
        ).length;

        const homeGoals = fixtures.reduce((sum: number, f: H2HMatch) => {
          const isHome = f.homeTeam.name === homeTeamName;
          return sum + (isHome ? (f.score.home ?? 0) : (f.score.away ?? 0));
        }, 0);
        const awayGoals = fixtures.reduce((sum: number, f: H2HMatch) => {
          const isHome = f.homeTeam.name === homeTeamName;
          return sum + (isHome ? (f.score.away ?? 0) : (f.score.home ?? 0));
        }, 0);

        setData({
          homeTeam: { id: homeTeamId, name: homeTeamName },
          awayTeam: { id: awayTeamId, name: awayTeamName },
          lastMeetings: fixtures,
          summary: { homeWins, draws, awayWins },
          avgGoalsHome: Number((homeGoals / (fixtures.length || 1)).toFixed(1)),
          avgGoalsAway: Number((awayGoals / (fixtures.length || 1)).toFixed(1)),
        });
      })
      .catch((err) => {
        console.error("H2H history error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [homeTeamId, awayTeamId, homeTeamName, awayTeamName]);

  if (loading) {
    return (
      <section className={styles.section}>
        <h2>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          Head-to-Head History
        </h2>
        <div className={styles.loading}>
          <div className={styles.spinner} />
        </div>
      </section>
    );
  }

  if (error || !data) {
    return (
      <section className={styles.section}>
        <h2>Head-to-Head History</h2>
        <div className={styles.error}>{error || "Could not load H2H data"}</div>
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="1" />
          <path d="M12 1v6m0 6v4" />
          <path d="M4.22 4.22l4.24 4.24m1.08 1.08l4.24 4.24" />
          <path d="M1 12h6m6 0h4" />
          <path d="M4.22 19.78l4.24-4.24m1.08-1.08l4.24-4.24" />
          <path d="M12 17v6" />
          <path d="M19.78 19.78l-4.24-4.24m-1.08-1.08l-4.24-4.24" />
          <path d="M23 12h-6" />
          <path d="M19.78 4.22l-4.24 4.24m-1.08 1.08l-4.24 4.24" />
        </svg>
        Head-to-Head History
      </h2>

      {/* Summary Stats */}
      <div className={styles.h2hGrid}>
        <div className={styles.recordCard}>
          <div className={styles.recordValue}>{data.summary.homeWins}</div>
          <div className={styles.recordLabel}>{homeTeamName} Wins</div>
        </div>
        <div className={styles.recordCard}>
          <div className={styles.recordValue}>{data.summary.draws}</div>
          <div className={styles.recordLabel}>Draws</div>
        </div>
        <div className={styles.recordCard}>
          <div className={styles.recordValue}>{data.summary.awayWins}</div>
          <div className={styles.recordLabel}>{awayTeamName} Wins</div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{data.avgGoalsHome.toFixed(1)}</div>
          <div className={styles.statName}>{homeTeamName} Avg Goals</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{data.avgGoalsAway.toFixed(1)}</div>
          <div className={styles.statName}>{awayTeamName} Avg Goals</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>{data.lastMeetings.length}</div>
          <div className={styles.statName}>Total Meetings</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statNumber}>
            {(data.avgGoalsHome + data.avgGoalsAway).toFixed(1)}
          </div>
          <div className={styles.statName}>Avg Total Goals</div>
        </div>
      </div>

      {/* Recent Matches */}
      <h3>Recent Meetings</h3>
      {data.lastMeetings.length > 0 ? (
        <div className={styles.h2hMatches}>
          <div className={styles.matchesTitle}>Last 10 Meetings</div>
          <div className={styles.matchesList}>
            {data.lastMeetings.map((match, idx) => (
              <div key={idx} className={styles.matchRow}>
                <span className={styles.matchDate}>
                  {new Date(match.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit",
                  })}
                </span>
                <span className={styles.matchTeams}>
                  {match.homeTeam.name} vs {match.awayTeam.name}
                </span>
                <span className={styles.matchScore}>
                  {match.score.home ?? "–"} – {match.score.away ?? "–"}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.noMatches}>No previous meetings found</div>
      )}
    </section>
  );
}
