/**
 * utils/pushNotifications.ts
 *
 * Service worker registration + local notification helpers.
 * Used by useLiveMatches to fire goal/card alerts.
 */

let _swReg: ServiceWorkerRegistration | null = null;

// ─── SW Registration ──────────────────────────────────────────────────────────

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    _swReg = reg;
    window.addEventListener("focus", () => reg.update(), { passive: true });
    return reg;
  } catch (err) {
    console.error("[SW] Registration failed:", err);
    return null;
  }
}

async function getSW(): Promise<ServiceWorkerRegistration | null> {
  if (_swReg) return _swReg;
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    _swReg = await navigator.serviceWorker.ready;
    return _swReg;
  } catch {
    return null;
  }
}

// ─── Permission ───────────────────────────────────────────────────────────────

export function getNotificationPermission(): "granted" | "denied" | "default" | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as "granted" | "denied" | "default";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  try {
    const result = await Notification.requestPermission();
    return result === "granted";
  } catch {
    return false;
  }
}

// ─── Show notification ────────────────────────────────────────────────────────

export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  if (getNotificationPermission() !== "granted") return;

  const opts: NotificationOptions = {
    icon: "/matchinsense-favicon.svg",
    badge: "/matchinsense-favicon.svg",
    vibrate: [200, 100, 200],
    requireInteraction: false,
    ...options,
  };

  try {
    const sw = await getSW();
    if (sw) {
      await sw.showNotification(title, opts);
    } else if ("Notification" in window) {
      new Notification(title, opts);
    }
  } catch (err) {
    console.warn("[Notifications] show failed:", err);
  }
}

// ─── Legacy exports (kept for backward compatibility) ────────────────────────

export async function askNotificationPermission(): Promise<boolean> {
  return requestNotificationPermission();
}

export async function subscribeUserToPush() {
  // Placeholder — wire up VAPID server push here in Phase 2
  return null;
}
