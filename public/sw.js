// public/sw.js — MatchInsense Service Worker
// Handles: push events, notification clicks, offline page caching

const CACHE = "matchinsense-v2";

const PRECACHE = [
  "/",
  "/matchinsense-logo.svg",
  "/matchinsense-favicon.svg",
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch (network-first, cache images) ──────────────────────────────────────
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.destination === "image") {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      })
      .catch(() => caches.match(request))
  );
});

// ── Push notification (from server, Phase 2) ──────────────────────────────────
self.addEventListener("push", (e) => {
  if (!e.data) return;
  let data;
  try { data = e.data.json(); } catch { data = { title: "MatchInsense", body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || "MatchInsense", {
      body: data.body || "",
      icon: data.icon || "/matchinsense-favicon.svg",
      badge: data.badge || "/matchinsense-favicon.svg",
      tag: data.tag || "mi-update",
      data: { url: data.url || "/" },
      vibrate: [200, 100, 200],
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  if (e.action === "dismiss") return;
  const url = e.notification.data?.url || "/";

  e.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if (c.url.includes(self.location.origin) && "focus" in c) {
            c.focus();
            c.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});

// ── Message (skip waiting trigger) ───────────────────────────────────────────
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
