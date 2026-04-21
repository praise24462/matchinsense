"use client";

import { useEffect, useState, useCallback } from "react";
import type { GoalEvent } from "@/hooks/useLiveMatches";
import styles from "./GoalToast.module.scss";

const DURATION_MS = 7000;

interface Toast {
  id: string;
  event: GoalEvent;
}

interface Props {
  event: GoalEvent | null;
}

export function GoalToast({ event }: Props) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!event) return;
    const id = `${event.matchId}-${event.homeScore}-${event.awayScore}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-2), { id, event }]);
    const t = setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), DURATION_MS);
    return () => clearTimeout(t);
  }, [event]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  if (!toasts.length) return null;

  return (
    <div className={styles.stack} aria-live="polite">
      {toasts.map((t) => (
        <Card key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>
  );
}

function Card({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { event } = toast;
  return (
    <div className={styles.card} role="status">
      <button className={styles.close} onClick={onDismiss} aria-label="Dismiss">×</button>
      <div className={styles.icon}>⚽</div>
      <div className={styles.body}>
        <div className={styles.label}>GOAL!</div>
        <div className={styles.score}>
          <span className={styles.team}>{event.homeTeam}</span>
          <span className={styles.num}>{event.homeScore} – {event.awayScore}</span>
          <span className={styles.team}>{event.awayTeam}</span>
        </div>
      </div>
      <div className={styles.bar} style={{ animationDuration: `${DURATION_MS}ms` }} />
    </div>
  );
}
