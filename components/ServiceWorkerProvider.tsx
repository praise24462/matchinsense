"use client";

import { useEffect } from "react";
import { registerServiceWorker } from "@/utils/pushNotifications";

export default function ServiceWorkerProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return <>{children}</>;
}
