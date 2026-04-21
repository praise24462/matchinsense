/**
 * /api/test-data
 * Simple endpoint to verify API routing works
 */

import { NextResponse } from "next/server";

export async function GET() {
  const now = new Date();
  const lagosTime = new Date(now.getTime() + 60 * 60 * 1000);
  const systemToday = lagosTime.toISOString().split("T")[0];

  return NextResponse.json({
    status: "ok",
    timestamp: now.toISOString(),
    lagosTime: lagosTime.toISOString(),
    systemToday,
    message: "If you see this JSON, API routing is working",
  });
}
