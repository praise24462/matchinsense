"use client";

import { useEffect, useState } from "react";
import { requestNotificationPermission, getNotificationPermission } from "@/utils/pushNotifications";
import styles from "./NotificationPrompt.module.scss";

const DISMISSED_KEY = "mi_notif_dismissed";

export function NotificationPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const perm = getNotificationPermission();
    if (perm !== "default") return;
    if (localStorage.getItem(DISMISSED_KEY)) return;
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, []);

  async function handleAllow() {
    setLoading(true);
    await requestNotificationPermission();
    setLoading(false);
    setVisible(false);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className={styles.banner} role="complementary" aria-label="Enable goal notifications">
      <div className={styles.icon}>⚽</div>
      <div className={styles.text}>
        <strong>Get goal alerts</strong>
        <span>Know the moment your team scores — no app needed.</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.allow} onClick={handleAllow} disabled={loading}>
          {loading ? "Enabling…" : "Allow"}
        </button>
        <button className={styles.dismiss} onClick={handleDismiss}>
          Not now
        </button>
      </div>
    </div>
  );
}
