/**
 * /api/debug-date
 * 
 * Debug endpoint to check date/timezone calculations
 * Used to diagnose "no matches today" issues
 */

import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const utcNow = new Date();
  const lagosOffset = 1 * 60 * 60 * 1000; // 1 hour
  const lagosNow = new Date(utcNow.getTime() + lagosOffset);

  const formatDate = (d: Date) => ({
    iso: d.toISOString(),
    dateOnly: d.toISOString().split("T")[0],
    time: d.toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" }),
  });

  return NextResponse.json({
    system: {
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: process.platform,
    },
    calculations: {
      utcNow: formatDate(now),
      lagosNow: formatDate(lagosNow),
      lagosDateOnly: lagosNow.toISOString().split("T")[0],
    },
    expectedMatchesDate: lagosNow.toISOString().split("T")[0],
    debug: {
      message: "Frontend should request API with date: " + lagosNow.toISOString().split("T")[0],
      note: "Check your browser Network tab to see which date is being sent",
    },
  });
}
