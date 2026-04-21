"use client";

import { useState, useEffect } from "react";
import styles from "./settings.module.scss";

interface Prefs { defaultTab: "europe" | "africa"; defaultSeason: number; compactCards: boolean; }
const DEFAULT_PREFS: Prefs = { defaultTab: "europe", defaultSeason: 2025, compactCards: false };

function loadPrefs(): Prefs {
  try { return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem("matchinsense_prefs") ?? "{}") }; }
  catch { return DEFAULT_PREFS; }
}

export default function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setPrefs(loadPrefs()); }, []);

  function update<K extends keyof Prefs>(key: K, val: Prefs[K]) {
    setPrefs(p => ({ ...p, [key]: val }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem("matchinsense_prefs", JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleClearData() {
    if (!confirm("This will remove all saved preferences and AI reports stored in your browser. Continue?")) return;
    ["matchinsense_followed","matchinsense_prefs","matchinsense_summaries"].forEach(k => localStorage.removeItem(k));
    setPrefs(DEFAULT_PREFS);
    setSaved(false);
    alert("Local data cleared.");
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <h1 className={styles.title}>Settings</h1>

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
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>App</span><span className={styles.aboutValue}>MatchInsense</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>Version</span><span className={styles.aboutValue}>1.0.0</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>AI Model</span><span className={styles.aboutValue}>Llama 3.3 70B (Groq)</span></div>
            <div className={styles.aboutItem}><span className={styles.aboutLabel}>Data Sources</span><span className={styles.aboutValue}>api-football + football-data.org</span></div>
          </div>
        </section>

        {/* Data */}
        <section className={styles.section}>
          <h2 className={`${styles.sectionTitle} ${styles.dangerTitle}`}>Data</h2>
          <p className={styles.hint} style={{marginBottom: 14}}>Preferences and AI reports are stored locally in your browser.</p>
          <button className={styles.dangerBtn} onClick={handleClearData}>Clear all local data</button>
        </section>
      </div>
    </div>
  );
}