import type { MatchStatistic } from "@/types";
import styles from "./MatchStats.module.scss";

interface Props {
  statistics: MatchStatistic[];
  homeTeam: string;
  awayTeam: string;
}

function toNum(v: string | number | null): number {
  if (v === null || v === undefined) return 0;
  return parseFloat(String(v).replace("%", "")) || 0;
}

function StatRow({ stat }: { stat: MatchStatistic }) {
  const h = toNum(stat.home);
  const a = toNum(stat.away);
  const total = h + a;
  const hw = total > 0 ? (h / total) * 100 : 50;

  return (
    <div className={styles.row}>
      <span className={styles.val}>{stat.home ?? "–"}</span>
      <div className={styles.center}>
        <span className={styles.label}>{stat.label}</span>
        <div className={styles.track}>
          <div className={styles.barHome} style={{ width: `${hw}%` }} />
          <div className={styles.barAway} style={{ width: `${100 - hw}%` }} />
        </div>
      </div>
      <span className={`${styles.val} ${styles.valRight}`}>{stat.away ?? "–"}</span>
    </div>
  );
}

export default function MatchStats({ statistics, homeTeam, awayTeam }: Props) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.teamLabel}>{homeTeam}</span>
        <span className={styles.centerLabel}>Stats</span>
        <span className={`${styles.teamLabel} ${styles.teamLabelRight}`}>{awayTeam}</span>
      </div>
      <div className={styles.list}>
        {statistics.map((s) => <StatRow key={s.label} stat={s} />)}
      </div>
    </div>
  );
}
