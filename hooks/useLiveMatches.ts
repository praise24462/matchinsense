/**
 * hooks/useLiveMatches.ts
 *
 * Connects to /api/matches/live-stream via Server-Sent Events.
 * Automatically reconnects with exponential back-off on failure.
 * Fires onGoal callback when a goal event arrives so the UI can
 * show a toast and trigger a push notification.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Match } from "@/types";
import { showLocalNotification } from "@/utils/pushNotifications";

// Re-export Match so callers can import it from here
export type { Match };

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoalEvent {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  notification: {
    title: string;
    body: string;
    tag: string;
  };
}

interface SSEMessage {
  type: "initial" | "update" | "goal" | "error" | "heartbeat";
  matches?: Match[];
  event?: GoalEvent;
  message?: string;
  ts: number;
}

interface UseLiveMatchesOptions {
  date?: string;                     // YYYY-MM-DD, defaults to today
  onGoal?: (event: GoalEvent) => void;
  /** Don't open the SSE connection (e.g. when no live matches expected) */
  disabled?: boolean;
}

interface UseLiveMatchesReturn {
  matches: Match[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  reconnect: () => void;
}

const BASE_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;

function lagosToday(): string {
  const now = new Date();
  const lagos = new Date(now.getTime() + 60 * 60 * 1000);
  return lagos.toISOString().split("T")[0];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveMatches({
  date,
  onGoal,
  disabled = false,
}: UseLiveMatchesOptions = {}): UseLiveMatchesReturn {
  const [matches, setMatches] = useState<Match[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(!disabled);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [tick, setTick] = useState(0); // bump to force reconnect

  const retryCount = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reconnect = useCallback(() => {
    retryCount.current = 0;
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (disabled) {
      setIsLoading(false);
      return;
    }

    const resolvedDate = date ?? lagosToday();

    function connect() {
      // Close any open connection first
      esRef.current?.close();
      esRef.current = null;

      setIsLoading(true);
      setError(null);

      const url = `/api/matches/live-stream?date=${resolvedDate}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setIsLoading(false);
        retryCount.current = 0;
      };

      es.onmessage = (ev: MessageEvent<string>) => {
        let msg: SSEMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }

        if (msg.ts) setLastUpdated(new Date(msg.ts));

        switch (msg.type) {
          case "initial":
          case "update":
            if (msg.matches) {
              setMatches(msg.matches);
              setIsLoading(false);
              setIsConnected(true);
            }
            break;

          case "goal":
            if (msg.event) {
              onGoal?.(msg.event);
              // Fire push notification if permission was granted
              showLocalNotification(msg.event.notification.title, {
                body: msg.event.notification.body,
                tag: msg.event.notification.tag,
                icon: "/matchinsense-favicon.svg",
                badge: "/matchinsense-favicon.svg",
              });
            }
            break;

          case "error":
            setError(msg.message ?? "Stream error");
            break;

          case "heartbeat":
            // keep-alive — nothing to do
            break;
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        esRef.current = null;

        const delay = Math.min(
          BASE_RETRY_MS * Math.pow(2, retryCount.current),
          MAX_RETRY_MS
        );
        retryCount.current += 1;

        console.warn(`[useLiveMatches] SSE error — retrying in ${delay}ms`);
        timerRef.current = setTimeout(connect, delay);
      };
    }

    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      esRef.current?.close();
      esRef.current = null;
      setIsConnected(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, disabled, tick]);

  return { matches, isConnected, isLoading, error, lastUpdated, reconnect };
}
