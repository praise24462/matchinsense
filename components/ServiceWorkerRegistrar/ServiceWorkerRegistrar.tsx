"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/utils/pushNotifications";

/**
 * Tiny client component that registers the service worker on mount.
 * Kept separate because app/layout.tsx is a Server Component.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return null;
}
