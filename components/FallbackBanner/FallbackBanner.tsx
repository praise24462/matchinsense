// ─────────────────────────────────────────────────────────────────────────────
// components/FallbackBanner/FallbackBanner.tsx
//
// Shown when the African API quota is exceeded or returns no matches for today.
// Informs the user clearly without disrupting the rest of the page.
// ─────────────────────────────────────────────────────────────────────────────

import React from "react";
import styles from "./FallbackBanner.module.scss";
import type { FallbackReason } from "@/types/matches";

interface FallbackBannerProps {
  reason?: FallbackReason;
}

const MESSAGES: Record<FallbackReason, { title: string; body: string }> = {
  african_quota_exceeded: {
    title: "No African matches today",
    body: "We've hit our daily limit for African fixture data. Here are upcoming European fixtures instead.",
  },
  african_empty: {
    title: "No African matches today",
    body: "There are no African fixtures scheduled for today. Here are upcoming European fixtures instead.",
  },
  african_error: {
    title: "African data temporarily unavailable",
    body: "We couldn't retrieve African fixtures right now. Here are upcoming European fixtures instead.",
  },
};

const DEFAULT_MESSAGE = MESSAGES.african_empty;

export default function FallbackBanner({ reason }: FallbackBannerProps) {
  const { title, body } = reason ? MESSAGES[reason] : DEFAULT_MESSAGE;

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      {/* Globe / info icon — pure CSS, no extra deps */}
      <span className={styles.icon} aria-hidden="true">
        🌍
      </span>
      <div className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        <p className={styles.body}>{body}</p>
      </div>
    </div>
  );
}