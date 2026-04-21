"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./LeagueStandings.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  form: string | null;
  description: string | null;
}

interface Props {
  leagueId: number;
  season: number;
  /** Highlight this team's row (e.g. home team) */
  highlightTeamId?: number;
  /** Show only rows within ±N positions of the highlighted team */
  compact?: boolean;
  compactRadius?: number;
}

// ─── Form dot ─────────────────────────────────────────────────────────────────

function FormDot({ r }: { r: string }) {
  const cls = r === "W" ? styles.fW : r === "L" ? styles.fL : styles.fD;
  const label = r === "W" ? "Win" : r === "L" ? "Loss" : "Draw";
  return <span className={`${styles.fDot} ${cls}`} title={label} />;
}

// ─── Zone bar (left coloured stripe) ─────────────────────────────────────────

function ZoneBar({ desc }: { desc: string | null }) {
  if (!desc) return null;
  const d = desc.toLowerCase();
  let cls = styles.zoneNeutral;
  if (d.includes("champions league")) cls = styles.zoneCL;
  else if (d.includes("europa league")) cls = styles.zoneEL;
  else if (d.includes("conference")) cls = styles.zoneECL;
  else if (d.includes("relegation") || d.includes("relegated")) cls = styles.zoneRel;
  return <span className={`${styles.zoneBar} ${cls}`} title={desc} />;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className={styles.skelWrap}>
      {[...Array(8)].map((_, i) => <div key={i} className={styles.skelRow} />)}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeagueStandings({
  leagueId,
  season,
  highlightTeamId,
  compact = false,
  compactRadius = 4,
}: Props) {
  const [rows, setRows] = useState<StandingRow[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Uses the existing /api/match-standings route already in the project
      const res = await fetch(`/api/match-standings?league=${leagueId}&season=${season}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // The existing route returns the raw standings array from api-sports.io
      // Shape: [{ rank, team:{id,name,logo}, points, all:{played,win,draw,lose,goals}, form, description }]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped: StandingRow[] = (data ?? []).map((entry: any) => ({
        rank: entry.rank,
        team: { id: entry.team.id, name: entry.team.name, logo: entry.team.logo },
        points: entry.points,
        played: entry.all?.played ?? 0,
        wins: entry.all?.win ?? 0,
        draws: entry.all?.draw ?? 0,
        losses: entry.all?.lose ?? 0,
        gf: entry.all?.goals?.for ?? 0,
        ga: entry.all?.goals?.against ?? 0,
        gd: entry.goalsDiff ?? 0,
        form: entry.form ?? null,
        description: entry.description ?? null,
      }));
      setRows(mapped);
      setLeagueName(data?.leagueName ?? "");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load standings");
    } finally {
      setLoading(false);
    }
  }, [leagueId, season]);

  useEffect(() => { load(); }, [load]);

  // Compact mode: only show rows near highlighted team
  const display = (() => {
    if (!compact || !highlightTeamId || rows.length === 0) return rows;
    const idx = rows.findIndex(r => r.team.id === highlightTeamId);
    if (idx === -1) return rows;
    return rows.slice(Math.max(0, idx - compactRadius), idx + compactRadius + 1);
  })();

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div className={styles.errorState}>
        <span>⚠️ Could not load standings</span>
        <button className={styles.retryBtn} onClick={load}>Retry</button>
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className={styles.wrapper}>
      {leagueName && (
        <div className={styles.header}>
          <span className={styles.title}>{leagueName} — Table</span>
          {compact && rows.length > display.length && (
            <span className={styles.compactNote}>Nearby positions</span>
          )}
        </div>
      )}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.rankCol}>#</th>
              <th className={styles.teamCol}>Team</th>
              <th title="Played">P</th>
              <th title="Wins">W</th>
              <th title="Draws">D</th>
              <th title="Losses">L</th>
              <th title="Goals For" className={styles.hideXs}>GF</th>
              <th title="Goals Against" className={styles.hideXs}>GA</th>
              <th title="Goal Difference">GD</th>
              <th className={styles.ptsCol} title="Points">Pts</th>
              <th className={styles.formCol} title="Last 5 results">Form</th>
            </tr>
          </thead>
          <tbody>
            {display.map(row => {
              const hi = row.team.id === highlightTeamId;
              return (
                <tr key={row.team.id} className={hi ? styles.highlighted : undefined}>
                  <td className={styles.rankCell}>
                    <ZoneBar desc={row.description} />
                    <span className={styles.rankNum}>{row.rank}</span>
                  </td>
                  <td className={styles.teamCell}>
                    {row.team.logo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.team.logo} alt={row.team.name} width={16} height={16} className={styles.teamLogo} />
                    )}
                    <span className={styles.teamName}>{row.team.name}</span>
                  </td>
                  <td>{row.played}</td>
                  <td>{row.wins}</td>
                  <td>{row.draws}</td>
                  <td>{row.losses}</td>
                  <td className={styles.hideXs}>{row.gf}</td>
                  <td className={styles.hideXs}>{row.ga}</td>
                  <td className={row.gd > 0 ? styles.gdPos : row.gd < 0 ? styles.gdNeg : undefined}>
                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                  </td>
                  <td className={styles.ptsCell}><strong>{row.points}</strong></td>
                  <td className={styles.formCell}>
                    {row.form
                      ? row.form.split("").slice(-5).map((c, i) => <FormDot key={i} r={c} />)
                      : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
