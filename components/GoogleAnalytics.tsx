"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pageview } from "@/services/gtag";

/**
 * GoogleAnalytics Component
 * 
 * Tracks page views automatically on route changes.
 * Place this in your root layout to track SPA navigation.
 * 
 * This component:
 * - Listens for pathname changes using usePathname() hook
 * - Sends pageview events to GA4 whenever the route changes
 * - Works seamlessly with Next.js client-side navigation
 * - Does not double-track (GA script handles initial pageview)
 */
export function GoogleAnalytics() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Construct the full URL path including query params
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : "");

    // Track pageview to Google Analytics
    pageview(url);
  }, [pathname, searchParams]);

  // This component doesn't render anything
  return null;
}
