"use client";

import { useEffect, useState } from "react";
import { useSession, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import styles from "./saved.module.scss";

interface SavedMatch { id: string; matchId: number; createdAt: string; }
interface MatchInfo {
  id: number; date: string; status: string; source: string;
  homeTeam: { name: string; logo: string };
  awayTeam: { name: string; logo: string };
  score: { home: number | null; away: number | null };
  league: { name: string; logo: string };
}

const STATUS_LABEL: Record<string, string> = { FT: "Full Time", NS: "Upcoming", LIVE: "Live", HT: "Half Time", PST: "Postponed", CANC: "Cancelled" };

export default function SavedMatchesPage() {
  const { data: session, status } = useSession();
  const [saved,    setSaved]    = useState<SavedMatch[]>([]);
  const [details,  setDetails]  = useState<Record<number, MatchInfo>>({});
  const [loading,  setLoading]  = useState(true);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) { setLoading(false); return; }
    fetch("/api/saved-matches")
      .then(r => r.json())
      .then(async (data: SavedMatch[]) => {
        if (!Array.isArray(data)) return;
        setSaved(data);
        // Fetch match details in parallel
        const results = await Promise.allSettled(
          data.map(s => fetch(`/api/match/${s.matchId}?source=euro`).then(r => r.json()))
        );
        const map: Record<number, MatchInfo> = {};
        results.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value?.id) map[data[i].matchId] = r.value;
        });
        setDetails(map);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session, status]);

  async function handleRemove(matchId: number) {
    setRemoving(matchId);
    try {
      await fetch("/api/save-match", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId }) });
      setSaved(prev => prev.filter(s => s.matchId !== matchId));
    } catch {}
    setRemoving(null);
  }

  if (status !== "loading" && !session) return (
    <div className={styles.page}>
      <div className={styles.guestWrap}>
        <span className={styles.guestIcon}>🔖</span>
        <h1 className={styles.guestTitle}>Sign in to view saved matches</h1>
        <p className={styles.guestText}>Save any fixture from the match detail page and it'll appear here.</p>
        <button className={styles.signInBtn} onClick={() => signIn("google", { callbackUrl: "/saved" })}>Continue with Google</button>
      </div>
    </div>
  );

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Saved Matches</h1>
            <p className={styles.pageSubtitle}>Your bookmarked fixtures</p>
          </div>
          {saved.length > 0 && <span className={styles.countBadge}>{saved.length}</span>}
        </div>

        {loading && <div className={styles.state}><div className={styles.spinner}/><p>Loading…</p></div>}

        {!loading && saved.length === 0 && (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🔖</div>
            <h2 className={styles.emptyTitle}>No saved matches yet</h2>
            <p className={styles.emptyText}>Open any match and tap <strong>Save match</strong> to bookmark it here.</p>
            <Link href="/matches" className={styles.browseBtn}>Browse matches →</Link>
          </div>
        )}

        {!loading && saved.length > 0 && (
          <div className={styles.list}>
            {saved.map(s => {
              const m = details[s.matchId];
              return (
                <div key={s.id} className={styles.card}>
                  {m ? (
                    <Link href={`/match/${s.matchId}?source=${m.source}`} className={styles.matchPreview}>
                      {/* League */}
                      <div className={styles.matchLeague}>
                        {m.league.logo && <Image src={m.league.logo} alt="" width={14} height={14} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>}
                        <span>{m.league.name}</span>
                        <span className={`${styles.statusPill} ${m.status === "FT" ? styles.statusFT : (m.status === "LIVE" && new Date(m.date).toDateString() === new Date().toDateString()) ? styles.statusLive : styles.statusNS}`}>
                          {STATUS_LABEL[m.status] ?? m.status}
                        </span>
                      </div>
                      {/* Teams + Score */}
                      <div className={styles.matchBody}>
                        <div className={styles.teamRow}>
                          {m.homeTeam.logo && <Image src={m.homeTeam.logo} alt="" width={22} height={22} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>}
                          <span className={styles.teamName}>{m.homeTeam.name}</span>
                        </div>
                        <div className={styles.scoreBox}>
                          {m.status !== "NS"
                            ? <><span className={styles.scoreDigit}>{m.score.home ?? "–"}</span><span className={styles.scoreSep}>–</span><span className={styles.scoreDigit}>{m.score.away ?? "–"}</span></>
                            : <span className={styles.scoreVs}>vs</span>
                          }
                        </div>
                        <div className={`${styles.teamRow} ${styles.teamRowAway}`}>
                          <span className={styles.teamName}>{m.awayTeam.name}</span>
                          {m.awayTeam.logo && <Image src={m.awayTeam.logo} alt="" width={22} height={22} onError={e=>{(e.target as HTMLImageElement).style.display="none"}}/>}
                        </div>
                      </div>
                      <div className={styles.matchDate}>
                        {new Date(m.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </Link>
                  ) : (
                    <Link href={`/match/${s.matchId}`} className={styles.matchPreview}>
                      <div className={styles.matchBody}>
                        <span className={styles.teamName} style={{color:"var(--text-3)"}}>Match #{s.matchId}</span>
                      </div>
                    </Link>
                  )}
                  <button className={styles.removeBtn} onClick={() => handleRemove(s.matchId)} disabled={removing === s.matchId}>
                    {removing === s.matchId ? "…" : "✕"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
