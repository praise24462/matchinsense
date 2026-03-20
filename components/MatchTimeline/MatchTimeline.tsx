"use client";
import React from "react";
import styles from "./MatchTimeline.module.scss";

interface MatchEvent {
  team: "home" | "away";
  type: string;
  minute: number;
  added_time?: number;
  player: string;
  assist?: string;
}

function EventIcon({ type, team }: { type: string; team: "home" | "away" }) {
  const iconProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const };

  if (type === "Goal" || type === "OwnGoal" || type === "Penalty")
    return (
      <svg {...iconProps} className={styles.goalIcon}>
        <path d="M21 12c0 2-2 5-9 5s-9-3-9-5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        <path d="M3 9h18M3 21h18" />
      </svg>
    );

  if (type === "Red Card")
    return <div className={`${styles.card} ${styles.redCard}`} />;

  if (type === "Yellow Card")
    return <div className={`${styles.card} ${styles.yellowCard}`} />;

  if (type === "Substitution")
    return (
      <svg {...iconProps} className={styles.subIcon}>
        <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2" />
      </svg>
    );

  return null;
}

export default function MatchTimeline({
  events,
  homeTeamName,
  awayTeamName,
  status,
}: {
  events: MatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  status: string;
}) {
  if (!events || events.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 11-18 0m18 0a9 9 0 11-18 0" />
            <polyline points="12 7v5l4 2" />
          </svg>
          Match Timeline
        </h2>
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {status === "NS" ? "Match hasn't started yet" : "No events recorded"}
          </p>
        </div>
      </section>
    );
  }

  // Sort events by minute + added time
  const sortedEvents = [...events].sort((a, b) => {
    const minA = (a.minute ?? 0) + (a.added_time ?? 0);
    const minB = (b.minute ?? 0) + (b.added_time ?? 0);
    return minA - minB;
  });

  // Group events by minute for display
  const eventsByMinute: Map<string, MatchEvent[]> = new Map();
  sortedEvents.forEach((event) => {
    const min = event.minute ?? 0;
    const added = event.added_time ? `+${event.added_time}` : "";
    const key = added ? `${min}'${added}` : `${min}'`;
    if (!eventsByMinute.has(key)) eventsByMinute.set(key, []);
    eventsByMinute.get(key)!.push(event);
  });

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        Match Timeline
      </h2>

      <div className={styles.timeline}>
        {Array.from(eventsByMinute.entries()).map(([minute, eventGroup]) => (
          <div key={minute} className={styles.timelineGroup}>
            <div className={styles.minuteBadge}>{minute}</div>

            <div className={styles.eventsContainer}>
              {eventGroup.map((event, idx) => {
                const isHome = event.team === "home";
                const opponent = isHome ? awayTeamName : homeTeamName;

                return (
                  <div
                    key={idx}
                    className={`${styles.event} ${isHome ? styles.eventHome : styles.eventAway}`}
                  >
                    <div className={styles.eventIcon}>
                      <EventIcon type={event.type} team={event.team} />
                    </div>

                    <div className={styles.eventContent}>
                      <div className={styles.eventTeam}>
                        {isHome ? homeTeamName : awayTeamName}
                      </div>

                      <div className={styles.eventText}>
                        {event.type === "Goal" && (
                          <>
                            <strong>{event.player}</strong>
                            {event.assist && <span className={styles.assist}>assist: {event.assist}</span>}
                          </>
                        )}

                        {event.type === "Penalty" && (
                          <>
                            <strong>{event.player}</strong>
                            <span className={styles.badge}>(Penalty)</span>
                          </>
                        )}

                        {event.type === "OwnGoal" && (
                          <>
                            <strong>{event.player}</strong>
                            <span className={styles.badgeOwn}>(Own Goal)</span>
                          </>
                        )}

                        {event.type === "Red Card" && (
                          <>
                            <strong>{event.player}</strong>
                            <span className={styles.badgeRed}>RED CARD</span>
                          </>
                        )}

                        {event.type === "Yellow Card" && (
                          <>
                            <strong>{event.player}</strong>
                            <span className={styles.badgeYellow}>YELLOW CARD</span>
                          </>
                        )}

                        {event.type === "Substitution" && (
                          <div className={styles.subDetail}>
                            <div className={styles.subOut}>
                              <span className={styles.subLabel}>Off:</span>
                              <strong>{event.player}</strong>
                            </div>
                            <svg className={styles.subArrow} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="5 12 19 12" />
                              <polyline points="12 5 19 12 12 19" />
                            </svg>
                            <div className={styles.subIn}>
                              <span className={styles.subLabel}>On:</span>
                              <strong>{event.assist}</strong>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
