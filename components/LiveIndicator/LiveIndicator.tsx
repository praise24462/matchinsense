"use client";

import styles from "./LiveIndicator.module.scss";

interface Props {
  isConnected: boolean;
  isLoading: boolean;
  lastUpdated: Date | null;
  onReconnect?: () => void;
}

export function LiveIndicator({ isConnected, isLoading, lastUpdated, onReconnect }: Props) {
  const timeStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  if (isLoading) {
    return (
      <span className={`${styles.pill} ${styles.loading}`}>
        <span className={styles.dot} />
        Connecting…
      </span>
    );
  }

  if (isConnected) {
    return (
      <span className={`${styles.pill} ${styles.live}`} title={timeStr ? `Updated ${timeStr}` : undefined}>
        <span className={`${styles.dot} ${styles.pulse}`} />
        LIVE
        {timeStr && <span className={styles.time}>{timeStr}</span>}
      </span>
    );
  }

  return (
    <span className={`${styles.pill} ${styles.offline}`}>
      <span className={styles.dot} />
      Offline
      {onReconnect && (
        <button className={styles.retry} onClick={onReconnect}>Reconnect</button>
      )}
    </span>
  );
}
