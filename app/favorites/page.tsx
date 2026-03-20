"use client";
import React from "react";
import Link from "next/link";
import Image from "next/image";
import { askNotificationPermission, subscribeUserToPush } from "@/utils/pushNotifications";
import type { Match } from "@/types";
import styles from "./saved.module.scss";

const FavoritesPage = () => {
  const [savedMatches, setSavedMatches] = React.useState<Match[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [notifEnabled, setNotifEnabled] = React.useState(false);

  React.useEffect(() => {
    // Load saved match IDs first
    setLoading(true);
    
    Promise.all([
      fetch("/api/saved-matches-test").then(r => r.json()),
      fetch("/api/matches?date=" + new Date().toISOString().split("T")[0]).then(r => r.json()),
    ])
      .then(([savedData, matchesData]) => {
        // Get saved IDs
        const savedIds = new Set((savedData || []).map((s: any) => s.matchId));
        
        // Filter matches to only saved ones
        if (Array.isArray(matchesData)) {
          const filtered = matchesData.filter(m => savedIds.has(m.id));
          setSavedMatches(filtered);
        }
      })
      .catch(err => {
        console.error("Failed to load saved matches:", err);
        setSavedMatches([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const enableNotifications = async () => {
    const granted = await askNotificationPermission();
    if (granted) {
      await subscribeUserToPush();
      setNotifEnabled(true);
      alert("Push notifications enabled! You'll get alerts for your favorite matches.");
    } else {
      alert("Notification permission denied.");
    }
  };

  const Logo = ({ src, size = 24 }: { src?: string; size?: number }) => {
    const [err, setErr] = React.useState(false);
    if (!src || err) return (
      <div style={{ width: size, height: size, background: "var(--bg-card-hi)", borderRadius: 3, fontSize: size ? size * 0.4 : 10, color: "var(--text-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        ?
      </div>
    );
    return <Image src={src} alt="" width={size} height={size} style={{ objectFit: "contain", flexShrink: 0 }} onError={() => setErr(true)} />;
  };

  const fmtTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });
  };

  return (
    <div style={{ padding: "3rem 2rem" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>Favorite Matches</h1>
      
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-2)" }}>
          <p>Loading your saved matches...</p>
        </div>
      ) : savedMatches.length === 0 ? (
        <div>
          <p style={{ marginBottom: "3rem", fontSize: "1.1rem", color: "var(--text-2)" }}>
            No favorite matches yet. Star a match on the matches page to save it!
          </p>
        </div>
      ) : (
        <div style={{ marginBottom: "3rem" }}>
          <p style={{ marginBottom: "1.5rem", color: "var(--text-2)" }}>
            {savedMatches.length} saved match{savedMatches.length !== 1 ? "es" : ""}
          </p>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {savedMatches.map(match => {
              // Safety checks for incomplete matches
              if (!match || !match.league || !match.homeTeam || !match.awayTeam) {
                return null;
              }

              const isLive = match.status === "LIVE" || match.status === "HT";
              const isFT = match.status === "FT";
              const isNS = match.status === "NS";
              const homeWin = isFT && (match.score.home ?? 0) > (match.score.away ?? 0);
              const awayWin = isFT && (match.score.away ?? 0) > (match.score.home ?? 0);

              return (
                <Link
                  key={match.id}
                  href={`/match/${match.id}?source=${match.source}`}
                  style={{
                    padding: "1.25rem",
                    background: "var(--bg-card)",
                    border: "1px solid var(--bg-card-hi)",
                    borderRadius: "8px",
                    textDecoration: "none",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.875rem",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card-hi)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-card)";
                    (e.currentTarget as HTMLElement).style.borderColor = "var(--bg-card-hi)";
                  }}
                >
                  {/* Header: League + Time */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "var(--text-2)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0, flex: 1 }}>
                      <Logo src={match.league?.logo} size={16} />
                      <span style={{ fontSize: "0.9rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{match.league?.name || "Unknown League"}</span>
                    </div>
                    <div style={{ flexShrink: 0, marginLeft: "0.5rem" }}>
                      {isLive ? <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: "0.9rem" }}>🔴 LIVE</span>
                        : isFT ? <span style={{ color: "var(--text-3)", fontSize: "0.85rem" }}>FT</span>
                        : isNS ? <span style={{ fontSize: "0.85rem" }}>{fmtTime(match.date)}</span>
                        : <span style={{ fontSize: "0.85rem" }}>{match.status}</span>}
                    </div>
                  </div>

                  {/* Teams */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}>
                    {/* Home Team */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: 0 }}>
                      <Logo src={match.homeTeam?.logo} size={28} />
                      <span style={{ fontWeight: 500, color: homeWin ? "var(--accent)" : "inherit", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {match.homeTeam?.name || "Home Team"}
                      </span>
                    </div>

                    {/* Score - Centered */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "1.1rem", fontWeight: 700, minWidth: "70px", justifyContent: "center", flexShrink: 0 }}>
                      {isNS ? (
                        <span style={{ color: "var(--text-3)" }}>-</span>
                      ) : (
                        <>
                          <span style={{ color: homeWin ? "var(--accent)" : "inherit", minWidth: "24px", textAlign: "center" }}>
                            {match.score.home ?? "–"}
                          </span>
                          <span style={{ color: "var(--text-3)", fontSize: "0.9rem" }}>-</span>
                          <span style={{ color: awayWin ? "var(--accent)" : "inherit", minWidth: "24px", textAlign: "center" }}>
                            {match.score.away ?? "–"}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Away Team */}
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, justifyContent: "flex-end", minWidth: 0 }}>
                      <span style={{ fontWeight: 500, color: awayWin ? "var(--accent)" : "inherit", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                        {match.awayTeam?.name || "Away Team"}
                      </span>
                      <Logo src={match.awayTeam?.logo} size={28} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <button 
        onClick={enableNotifications} 
        disabled={notifEnabled} 
        style={{ 
          marginTop: "2rem", 
          padding: "0.5rem 1.5rem", 
          fontSize: 18, 
          fontWeight: 600, 
          borderRadius: 6, 
          background: "var(--accent)", 
          color: "#fff", 
          border: "none", 
          cursor: notifEnabled ? "not-allowed" : "pointer",
          opacity: notifEnabled ? 0.6 : 1,
        }}
      >
        {notifEnabled ? "Notifications Enabled" : "Enable Match Alerts"}
      </button>
      <p style={{ marginTop: "1.5rem", color: "var(--text-2)", lineHeight: "1.6" }}>
        Alerts will notify you when a favorite match is about to start or when a team scores.
      </p>
    </div>
  );
};

export default FavoritesPage;
