"use client";

import { useState, useEffect } from "react";
import { useSession, signIn, signOut } from "next-auth/react";
import Image from "next/image";
import styles from "./settings.module.scss";

interface Prefs { defaultTab: "europe" | "africa"; defaultSeason: number; compactCards: boolean; }
const DEFAULT_PREFS: Prefs = { defaultTab: "europe", defaultSeason: 2025, compactCards: false };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem("pitchintel_prefs") ?? "{}") }; }
  catch { return DEFAULT_PREFS; }
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  function update<K extends keyof Prefs>(key: K, val: Prefs[K]) {
    setPrefs(p => ({ ...p, [key]: val }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem("pitchintel_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    if (!confirm("This will remove all followed teams, saved preferences and AI reports stored in your browser. Continue?")) return;
    ["pitchintel_followed","pitchintel_prefs","pitchintel_summaries"].forEach(k => localStorage.removeItem(k));
    setPrefs(DEFAULT_PREFS);
    setSaved(false);
    alert("Local data cleared.");
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Settings</h1>

        {/* Account */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Account</h2>
          {session ? (
            <div className={styles.accountRow}>
              {session.user?.image && <Image src={session.user.image} alt="" width={44} height={44} className={styles.avatar}/>}
              <div className={styles.accountInfo}>
                <span className={styles.accountName}>{session.user?.name ?? "User"}</span>
                <span className={styles.accountEmail}>{session.user?.email}</span>
              </div>
              <button className={styles.signOutBtn} onClick={() => signOut()}>Sign out</button>
            </div>
          ) : (
            <div className={styles.signInPrompt}>
              <p className={styles.signInText}>Sign in with Google to sync your saved matches across devices.</p>
              <button className={styles.signInBtn} onClick={() => signIn("google")}>Sign in with Google</button>
            </div>
          )}
        </section>

        {/* Preferences */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Preferences</h2>

          <div className={styles.field}>
            <label className={styles.label}>Default league tab</label>
            <p className={styles.hint}>Which tab opens by default on the Matches page</p>
            <div className={styles.radioGroup}>
              {(["europe","africa"] as const).map(v => (
                <label key={v} className={`${styles.radioOption} ${prefs.defaultTab === v ? styles.radioActive : ""}`}>
                  <input type="radio" name="tab" value={v} checked={prefs.defaultTab === v} onChange={() => update("defaultTab", v)}/>
                  {v === "europe" ? "🌍 European Leagues" : "🌍 African Leagues"}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Default season</label>
            <p className={styles.hint}>Used when browsing team pages</p>
            <div className={styles.radioGroup}>
              {[2025, 2024, 2023].map(s => (
                <label key={s} className={`${styles.radioOption} ${prefs.defaultSeason === s ? styles.radioActive : ""}`}>
                  <input type="radio" name="season" value={s} checked={prefs.defaultSeason === s} onChange={() => update("defaultSeason", s)}/>
                  {s}/{String(s+1).slice(2)}
                </label>
              ))}
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Match card style</label>
            <div className={styles.toggleRow}>
              <div>
                <span className={styles.toggleLabel}>Compact cards</span>
                <p className={styles.hint}>Show smaller match cards on the main view</p>
              </div>
              <button
                className={`${styles.toggle} ${prefs.compactCards ? styles.toggleOn : ""}`}
                onClick={() => update("compactCards", !prefs.compactCards)}
                role="switch"
                aria-checked={prefs.compactCards}
              >
                <span className={styles.toggleThumb}/>
              </button>
            </div>
          </div>

          <button className={`${styles.saveBtn} ${saved ? styles.saveBtnSaved : ""}`} onClick={handleSave}>
            {saved ? "✓ Saved" : "Save preferences"}
          </button>
        </section>

        {/* About */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>App</span><span className={styles.aboutValue}>PitchIntel</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>Version</span><span className={styles.aboutValue}>1.0.0</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>AI Model</span><span className={styles.aboutValue}>Llama 3.3 70B (Groq)</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>Football Data</span><span className={styles.aboutValue}>api-sports.io</span></div>
          </div>
        </section>

        {/* Danger zone */}
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Data</h2>
          <p className={styles.hint} style={{marginBottom: 14}}>Followed teams, preferences and AI reports are stored locally in your browser.</p>
          <button className={styles.dangerBtn} onClick={handleClearData}>Clear all local data</button>
        </section>
      </div>
    </div>
  );
}
