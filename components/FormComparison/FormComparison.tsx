"use client";
import React, { useState, useEffect } from "react";
import styles from "./FormComparison.module.scss";

interface TeamForm {
  matches: Array<{
    id: number;
    date: string;
    opponent: string;
    result: "W" | "L" | "D";
    score: string;
    isHome: boolean;
  }>;
  wins: number;
  losses: number;
  draws: number;
  goalsFor: number;
  goalsAgainst: number;
  homeWins: number;
  awayWins: number;
  totalMatches: number;
}

interface FormComparisonData {
  h2h: { wins: number; losses: number; draws: number };
  homeTeam: {
    form: TeamForm;
    winPercentage: number;
    homeWinPercentage: number;
    goalDiffPerMatch: number;
  };
  awayTeam: {
    form: TeamForm;
    winPercentage: number;
    awayWinPercentage: number;
    goalDiffPerMatch: number;
  };
}

function FormBadge({ result }: { result: "W" | "L" | "D" }) {
  return (
    <span
      className={`${styles.formBadge} ${
        result === "W" ? styles.win : result === "L" ? styles.loss : styles.draw
      }`}
      title={result === "W" ? "Win" : result === "L" ? "Loss" : "Draw"}
    >
      {result}
    </span>
  );
}

export default function FormComparison({
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
  const [data, setData] = useState<FormComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    fetch(`/api/form-comparison?homeTeamId=${homeTeamId}&awayTeamId=${awayTeamId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error("Failed to load form comparison");
        return r.json();
      })
      .then(setData)
      .catch((err) => {
        console.error("Form comparison error:", err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [homeTeamId, awayTeamId]);

  if (loading) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 9c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z" />
            <path d="M14 9c0-1 1-2 2-2s2 1 2 2-1 2-2 2-2-1-2-2z" />
            <path d="M4 20h16M7 16h2v4H7zM15 16h2v4h-2z" />
          </svg>
          Form Comparison
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
        <h2 className={styles.sectionTitle}>Form Comparison</h2>
        <div className={styles.error}>{error || "Could not load form data"}</div>
      </section>
    );
  }

  const { h2h, homeTeam, awayTeam } = data;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        Form Comparison
      </h2>

      {/* H2H Record */}
      <div className={styles.h2hCard}>
        <div className={styles.h2hTitle}>Head-to-Head Record</div>
        <div className={styles.h2hStats}>
          <div className={styles.h2hTeam}>
            <div className={styles.h2hTeamName}>{homeTeamName}</div>
            <div className={styles.h2hRecord}>
              <span className={styles.h2hWins}>{h2h.wins}W</span>
              <span className={styles.h2hSep}>•</span>
              <span className={styles.h2hDraws}>{h2h.draws}D</span>
              <span className={styles.h2hSep}>•</span>
              <span className={styles.h2hLosses}>{h2h.losses}L</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form comparison grid */}
      <div className={styles.comparisonGrid}>
        {/* Home Team */}
        <div className={styles.teamSection}>
          <h3 className={styles.teamName}>{homeTeamName}</h3>

          {/* Stats Cards */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Win Rate</div>
              <div className={styles.statValue}>{homeTeam.winPercentage.toFixed(0)}%</div>
              <div className={styles.statSub}>{homeTeam.form.wins} wins in {homeTeam.form.totalMatches} matches</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Home Form</div>
              <div className={styles.statValue}>{homeTeam.homeWinPercentage.toFixed(0)}%</div>
              <div className={styles.statSub}>{homeTeam.form.homeWins} home wins</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Goal Diff</div>
              <div className={`${styles.statValue} ${homeTeam.goalDiffPerMatch > 0 ? styles.positive : homeTeam.goalDiffPerMatch < 0 ? styles.negative : ""}`}>
                {homeTeam.goalDiffPerMatch > 0 ? "+" : ""}{homeTeam.goalDiffPerMatch.toFixed(2)}
              </div>
              <div className={styles.statSub}>per match</div>
            </div>
          </div>

          {/* Recent Form */}
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Recent Form (Last 5)</div>
            <div className={styles.formBadges}>
              {homeTeam.form.matches.slice(0, 5).map((match, i) => (
                <div key={i} className={styles.matchRow}>
                  <FormBadge result={match.result} />
                  <span className={styles.matchScore}>{match.score}</span>
                  <span className={styles.matchOpponent}>
                    {match.isHome ? `vs ${match.opponent}` : `@ ${match.opponent}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Away Team */}
        <div className={styles.teamSection}>
          <h3 className={styles.teamName}>{awayTeamName}</h3>

          {/* Stats Cards */}
          <div className={styles.statsRow}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Win Rate</div>
              <div className={styles.statValue}>{awayTeam.winPercentage.toFixed(0)}%</div>
              <div className={styles.statSub}>{awayTeam.form.wins} wins in {awayTeam.form.totalMatches} matches</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Away Form</div>
              <div className={styles.statValue}>{awayTeam.awayWinPercentage.toFixed(0)}%</div>
              <div className={styles.statSub}>{awayTeam.form.awayWins} away wins</div>
            </div>
            <div className={styles.statBox}>
              <div className={`${styles.statValue} ${awayTeam.goalDiffPerMatch > 0 ? styles.positive : awayTeam.goalDiffPerMatch < 0 ? styles.negative : ""}`}>
                {awayTeam.goalDiffPerMatch > 0 ? "+" : ""}{awayTeam.goalDiffPerMatch.toFixed(2)}
              </div>
              <div className={styles.statLabel}>Goal Diff</div>
              <div className={styles.statSub}>per match</div>
            </div>
          </div>

          {/* Recent Form */}
          <div className={styles.formCard}>
            <div className={styles.formTitle}>Recent Form (Last 5)</div>
            <div className={styles.formBadges}>
              {awayTeam.form.matches.slice(0, 5).map((match, i) => (
                <div key={i} className={styles.matchRow}>
                  <FormBadge result={match.result} />
                  <span className={styles.matchScore}>{match.score}</span>
                  <span className={styles.matchOpponent}>
                    {match.isHome ? `vs ${match.opponent}` : `@ ${match.opponent}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className={styles.insightBox}>
        <div className={styles.insightTitle}>📊 Form Edge</div>
        <div className={styles.insightText}>
          {homeTeam.winPercentage > awayTeam.winPercentage
            ? `${homeTeamName} in better form (${homeTeam.form.wins} wins vs ${awayTeam.form.wins}). Home advantage significant.`
            : awayTeam.winPercentage > homeTeam.winPercentage
              ? `${awayTeamName} showing superior form (${awayTeam.form.wins} wins vs ${homeTeam.form.wins}). Strong away squad.`
              : "Both teams in similar form. Should be competitive."}
        </div>
      </div>
    </section>
  );
}
