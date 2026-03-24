"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { memo, useState } from "react";
import type { Match } from "@/types";
import styles from "./UpcomingMatches.module.scss";

interface GroupedMatches {
  date: string;
  label: string;
  matches: Match[];
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
}

function isoLabel(iso: string, today: string) {
  const todayDate = new Date(today + "T00:00:00Z");
  const tomorrow = new Date(todayDate);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];
  
  if (iso === tomorrowStr) return "Tomorrow";
  if (iso === today) return "Today";
  
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { 
    weekday: "short", 
    day: "numeric", 
    month: "short" 
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
      <Image
        src={src}
        alt=""
        fill
        style={{ objectFit: "contain" }}
        onError={() => setErr(true)}
        sizes={`${size}px`}
      />
    </div>
  );
});

const MatchItem = memo(function MatchItem({ match, teamSrc }: { match: Match; teamSrc: string }) {
  const router = useRouter();
  const matchHref = `/match/${match.id}?source=${match.source}`;
  
  function handleClick() {
    router.push(matchHref);
  }

  return (
    <div className={styles.matchItem} onClick={handleClick}>
      <div className={styles.teamInfo}>
        <Logo src={match.homeTeam.logo} size={20} fallback={match.homeTeam.name[0]} />
        <span className={styles.teamName}>{match.homeTeam.name}</span>
        <span className={styles.vs}>vs</span>
        <span className={styles.teamName}>{match.awayTeam.name}</span>
        <Logo src={match.awayTeam.logo} size={20} fallback={match.awayTeam.name[0]} />
      </div>
      <div className={styles.time}>{fmtTime(match.date)}</div>
    </div>
  );
});

const DateGroup = memo(function DateGroup({ 
  group, 
  today,
  onMatchClick 
}: { 
  group: GroupedMatches; 
  today: string;
  onMatchClick?: (match: Match) => void;
}) {
  const isFdMatch = group.matches[0]?.id < 600000;
  const teamSrc = group.matches[0]?.source === "africa" ? "africa" : isFdMatch ? "fd" : "euro";

  return (
    <div className={styles.dateGroup}>
      <div className={styles.dateHeader}>
        <span className={styles.dateIcon}>📅</span>
        <span className={styles.dateLabel}>{group.label}</span>
        <span className={styles.matchCount}>{group.matches.length}</span>
      </div>
      <div className={styles.matchList}>
        {group.matches.map(match => (
          <MatchItem key={match.id} match={match} teamSrc={teamSrc} />
        ))}
      </div>
    </div>
  );
});

export default function UpcomingMatches({ 
  matches, 
  totalCount,
  onViewSchedule 
}: { 
  matches: Match[];
  totalCount: number;
  onViewSchedule?: () => void;
}) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  
  // Group matches by date
  const grouped = new Map<string, Match[]>();
  for (const match of matches) {
    const date = match.date.split("T")[0];
    if (!grouped.has(date)) grouped.set(date, []);
    grouped.get(date)!.push(match);
  }

  const groups: GroupedMatches[] = Array.from(grouped.entries())
    .map(([date, matchList]) => ({
      date,
      label: isoLabel(date, today),
      matches: matchList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  function handleViewSchedule() {
    console.log("[UpcomingMatches] View Full Schedule clicked");
    if (onViewSchedule) {
      console.log("[UpcomingMatches] Using callback");
      onViewSchedule();
    } else {
      console.log("[UpcomingMatches] Navigating to /schedule");
      router.push(`/schedule`);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.message}>
          <span className={styles.emoji}>👇</span>
          <h2 className={styles.title}>No matches today</h2>
          <p className={styles.subtitle}>Here's what's coming next</p>
        </div>
        {totalCount > 0 && (
          <div className={styles.badge}>
            <span className={styles.badgeEmoji}>🔥</span>
            <span className={styles.badgeText}>{totalCount} matches upcoming</span>
          </div>
        )}
      </div>

      <div className={styles.groupsContainer}>
        {groups.map(group => (
          <DateGroup key={group.date} group={group} today={today} />
        ))}
      </div>

      {/* CTA Button */}
      <div className={styles.footer}>
        <button className={styles.ctaBtn} onClick={handleViewSchedule}>
          <span>View Full Schedule</span>
          <span className={styles.arrow}>→</span>
        </button>
      </div>
    </div>
  );
}
