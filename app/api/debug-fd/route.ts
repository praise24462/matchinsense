/**
 * GET /api/debug-fd?date=YYYY-MM-DD
 * Shows exactly what football-data.org returns for a given date.
 * Remove this file before going to production.
 */
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const date  = new URL(req.url).searchParams.get("date") ?? new Date().toISOString().split("T")[0];
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  const CODES = "CL,EL,ECL,WC,EC,PL,PD,SA,BL1,FL1,ELC,PPL,DED,BSA";

  try {
    const url = `https://api.football-data.org/v4/matches?date=${date}&competitions=${CODES}`;
    const res = await fetch(url, {
      headers: { "X-Auth-Token": fdKey },
      cache: "no-store",
    });

    const body = await res.text();
    let parsed: unknown = null;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    return NextResponse.json({
      httpStatus: res.status,
      url,
      hasKey: !!fdKey,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matchCount: (parsed as any)?.matches?.length ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      competitions: [...new Set(((parsed as any)?.matches ?? []).map((m: any) => m.competition?.name))],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error: (parsed as any)?.message ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sample: ((parsed as any)?.matches ?? []).slice(0, 3).map((m: any) => ({
        competition: m.competition?.name,
        home: m.homeTeam?.shortName,
        away: m.awayTeam?.shortName,
        status: m.status,
        date: m.utcDate,
      })),
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err), hasKey: !!fdKey });
  }
}
