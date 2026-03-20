import { NextResponse } from "next/server";
import { prisma } from "@/services/prisma";

export async function GET() {
  const checks: Record<string, any> = {};

  // Check Prisma/Database
  try {
    await prisma.match.findFirst();
    checks.database = { status: "ok" };
  } catch (err: any) {
    checks.database = { status: "error", message: err.message };
  }

  // Check environment variables
  checks.env = {
    hasApiKey: !!process.env.FOOTBALL_API_KEY,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasRedisUrl: !!process.env.REDIS_URL,
  };

  return NextResponse.json(checks);
}
