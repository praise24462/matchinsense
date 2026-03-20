"use client";

import { useState } from "react";
import Image from "next/image";
import { POPULAR_EURO_TEAMS, POPULAR_AFRICA_TEAMS } from "@/data/popularTeams";
import styles from "./feed.module.scss";

function Logo({ src, size, fallback }: { src: string; size: number; fallback?: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card-hi)", borderRadius: 3, fontSize: size * 0.5, color: "var(--text-3)", flexShrink: 0 }}>
      {fallback ?? "?"}
    </div>
  );
  return <Image src={src} alt="" width={size} height={size} style={{ objectFit: "contain", flexShrink: 0 }} onError={() => setErr(true)} />;
}

export default function FeedClient() {
  const [region, setRegion] = useState<"euro" | "africa">("euro");
  const [search, setSearch] = useState("");

  const teams = region === "euro" ? POPULAR_EURO_TEAMS : POPULAR_AFRICA_TEAMS;
  const filtered = search
    ? teams.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.country.toLowerCase().includes(search.toLowerCase()) ||
        t.league.toLowerCase().includes(search.toLowerCase())
      )
    : teams;

  // Group by country
  const grouped = filtered.reduce<Record<string, typeof teams>>((acc, t) => {
    if (!acc[t.country]) acc[t.country] = [];
    acc[t.country].push(t);
    return acc;
  }, {});

  return (
    <div className={styles.page}>

      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderInner}>
          <div>
            <h1 className={styles.pageTitle}>Clubs</h1>
            <p className={styles.pageSubtitle}>Browse clubs from Europe and Africa</p>
          </div>

          {/* Region toggle */}
          <div className={styles.regionToggle}>
            <button
              className={`${styles.regionBtn} ${region === "euro" ? styles.regionBtnActive : ""}`}
              onClick={() => setRegion("euro")}
            >
              🌍 Europe
            </button>
            <button
              className={`${styles.regionBtn} ${region === "africa" ? styles.regionBtnActive : ""}`}
              onClick={() => setRegion("africa")}
            >
              🌍 Africa
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <div className={styles.searchBar}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className={styles.searchInput}
          placeholder={`Search ${region === "euro" ? "European" : "African"} clubs…`}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button className={styles.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>
      </div>

      {/* Club grid grouped by country */}
      <div className={styles.clubsContent}>
        {Object.entries(grouped).map(([country, countryTeams]) => (
          <div key={country} className={styles.countryGroup}>
            <div className={styles.countryHead}>
              <span className={styles.countryName}>{country}</span>
              <span className={styles.countryCount}>{countryTeams.length} clubs</span>
            </div>
            <div className={styles.clubGrid}>
              {countryTeams.map(t => (
                <div key={t.id} className={styles.clubCard}>
                  <div className={styles.clubLogoWrap}>
                    <Logo src={t.logo} size={40} fallback={t.shortName[0]} />
                  </div>
                  <span className={styles.clubName}>{t.shortName}</span>
                  <span className={styles.clubLeague}>{t.league}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🔍</div>
            <p className={styles.emptyTitle}>No clubs found</p>
            <p className={styles.emptyText}>Try a different search term</p>
          </div>
        )}
      </div>
    </div>
  );
}