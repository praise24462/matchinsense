/**
 * /api/debug-date
 * 
 * Debug endpoint to check:
 * 1. What date the system thinks is "today"
 * 2. Timezone calculations
 * 
 * NOTE: To check actual /api/matches response, open browser DevTools Network tab
 */

import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const utcNow = new Date();
  const lagosOffset = 1 * 60 * 60 * 1000; // 1 hour
  const lagosNow = new Date(utcNow.getTime() + lagosOffset);

  // Replicate the localDate() function from matches route
  function localDate(): string {
    const now = new Date();
    const lagosTime = new Date(now.getTime() + 60 * 60 * 1000);
    const year = lagosTime.getUTCFullYear();
    const month = String(lagosTime.getUTCMonth() + 1).padStart(2, "0");
    const day = String(lagosTime.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const systemToday = localDate();

  const formatDate = (d: Date) => ({
    iso: d.toISOString(),
    dateOnly: d.toISOString().split("T")[0],
    time: d.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" }),
  });

  return NextResponse.json({
    system: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: process.platform,
      nodeVersion: process.version,
    },
    dateCalculations: {
      utcNow: formatDate(now),
      lagosNow: formatDate(lagosNow),
      lagosDateOnly: lagosNow.toISOString().split("T")[0],
      systemToday,
    },
    apiEndpointToTest: `/api/matches?date=${systemToday}`,
    instructions: {
      step1: "Open browser DevTools (F12) → Network tab",
      step2: `Go to page /matches or directly visit /api/matches?date=${systemToday}`,
      step3: "Look at Network panel for the /api/matches request",
      step4: "Check Response tab to see what's returned",
      expectations: {
        success: 'Response should be JSON: { "matches": [...], "isFallback": false }',
        ifHtml: "If you see HTML instead of JSON, the API route is throwing an error",
        ifEmpty: 'If you see { "matches": [], "isFallback": false }, there are genuinely no matches today',
      }
    },
    troubleshooting: {
      htmlResponse: "Check server console logs for error messages related to [matches]",
      noMatches: "March 30 might not have major league games. App only includes: PL, La Liga, Serie A, Bundesliga, Ligue 1, CL, EL, World Cup, Euro, Qualifiers, African leagues",
      importantNote: "The app uses lazy loading for African matches - they're only fetched if API key is configured",
    },
  });
}
