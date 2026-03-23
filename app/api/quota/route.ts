import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.FOOTBALL_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "No key" }, { status: 500 });

  const res = await fetch("https://v3.football.api-sports.io/status", {
    headers: { "x-apisports-key": key }, cache: "no-store",
  });
  const data = await res.json();
  const requests = data.response?.requests ?? {};

  return NextResponse.json({
    plan:      data.response?.account?.plan ?? "free",
    used:      requests.current ?? 0,
    limit:     requests.limit_day ?? 100,
    remaining: (requests.limit_day ?? 100) - (requests.current ?? 0),
    resets:    "1:00 AM Lagos time (midnight UTC)",
  });
}