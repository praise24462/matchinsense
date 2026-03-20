import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Match } from "@/types";
import styles from "./MatchCard.module.scss";

export default function MatchCard({ match }: { match: Match }) {
  const { id, homeTeam, awayTeam, score, status, date, source } = match;

  const isLive      = status === "LIVE";
  const isHT        = status === "HT";
  const isFinished  = status === "FT";
  const isUpcoming  = status === "NS";
  const isPostponed = status === "PST" || status === "CANC";

  const kickoff = new Date(date).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit",
  });

  const homeWin = isFinished && (score.home ?? 0) > (score.away ?? 0);
  const awayWin = isFinished && (score.away ?? 0) > (score.home ?? 0);

  // Favorite logic
const [isFavorite, setIsFavorite] = useState(false);
useEffect(() => {
  const favs: string[] = JSON.parse(localStorage.getItem("favoriteMatches") || "[]");
  setIsFavorite(favs.includes(String(id)));
}, [id]);
const toggleFavorite = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  let favs: string[] = JSON.parse(localStorage.getItem("favoriteMatches") || "[]");
  if (favs.includes(String(id))) {
    favs = favs.filter((fid: string) => fid !== String(id));
  } else {
    favs.push(String(id));
  }
  localStorage.setItem("favoriteMatches", JSON.stringify(favs));
  setIsFavorite(favs.includes(String(id)));
};
  // Pass source so the detail page hits the right API immediately
  const href = `/match/${id}?source=${source ?? "euro"}`;

  return (
    <Link
      href={href}
      className={`${styles.row} ${isLive || isHT ? styles.rowLive : ""}`}
    >
      {/* Status column */}
      <div className={styles.status}>
        {isUpcoming   && <span className={styles.time}>{kickoff}</span>}
        {isHT         && <span className={styles.htBadge}>HT</span>}
        {isLive       && <span className={styles.liveBadge}>LIVE</span>}
        {isFinished   && <span className={styles.ftBadge}>FT</span>}
        {isPostponed  && <span className={styles.pstBadge}>{status}</span>}
      </div>

      {/* Teams column */}
      <div className={styles.teams}>
        <div className={styles.team}>
          <span className={styles.crestBox}>
            {homeTeam.logo
              ? <Image src={homeTeam.logo} alt="" width={16} height={16} className={styles.crest}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <span className={styles.crestLetter}>{homeTeam.name[0]}</span>
            }
          </span>
          <span className={`${styles.name} ${homeWin ? styles.nameWin : ""} ${awayWin ? styles.nameLose : ""}`}>
            {homeTeam.name}
          </span>
        </div>
        <div className={styles.team}>
          <span className={styles.crestBox}>
            {awayTeam.logo
              ? <Image src={awayTeam.logo} alt="" width={16} height={16} className={styles.crest}
                  onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
              : <span className={styles.crestLetter}>{awayTeam.name[0]}</span>
            }
          </span>
          <span className={`${styles.name} ${awayWin ? styles.nameWin : ""} ${homeWin ? styles.nameLose : ""}`}>
            {awayTeam.name}
          </span>
        </div>
      </div>

      {/* Score column */}
      <div className={styles.scores}>
        {isUpcoming ? (
          <>
            <span className={styles.scoreDash}>-</span>
            <span className={styles.scoreDash}>-</span>
          </>
        ) : (
          <>
            <span className={`${styles.scoreNum} ${homeWin ? styles.scoreWin : ""} ${isLive || isHT ? styles.scoreLive : ""}`}>
              {score.home ?? "–"}
            </span>
            <span className={`${styles.scoreNum} ${awayWin ? styles.scoreWin : ""} ${isLive || isHT ? styles.scoreLive : ""}`}>
              {score.away ?? "–"}
            </span>
          </>
        )}
      </div>

      {/* Bookmark icon */}
      <button className={styles.star} onClick={toggleFavorite} aria-label={isFavorite ? "Unfavorite" : "Favorite"} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill={isFavorite ? "#ff4b2b" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>
      </button>
    </Link>
  );
}
