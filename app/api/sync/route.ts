import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/services/prisma";

const AS_BASE = "https://v3.football.api-sports.io";

const STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon",
  "Cape Verde","Central African Republic","Chad","Comoros","Congo","Djibouti",
  "DR Congo","Egypt","Equatorial Guinea","Eritrea","Eswatini","Ethiopia",
  "Gabon","Gambia","Ghana","Guinea","Guinea-Bissau","Ivory Coast","Kenya",
  "Lesotho","Liberia","Libya","Madagascar","Malawi","Mali","Mauritania",
  "Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria","Rwanda",
  "Sao Tome and Principe","Senegal","Sierra Leone","Somalia","South Africa",
  "South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe",
  "Africa",
]);

function offsetDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

async function fetchAndSyncDate(date: string, apiKey: string): Promise<{ count: number; error?: string }> {
  const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });

  if (!res.ok) {
    return { count: 0, error: `API HTTP error: ${res.status}` };
  }

  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    return { count: 0, error: JSON.stringify(data.errors) };
  }

  const fixtures = data.response ?? [];
  console.log(`[sync] ${date}: fetched ${fixtures.length} fixtures from API`);
  console.log(`[sync] API remaining:`, data.parameters, data.results);

  if (fixtures.length === 0) {
    return { count: 0, error: `API returned 0 fixtures. Quota remaining: ${JSON.stringify(data.errors || 'check dashboard')}` };
  }

  if (fixtures.length === 0) {
    return { count: 0 };
  }

  let count = 0;
  let lastError = "";

  for (const f of fixtures) {
    const statusShort = f.fixture.status?.short ?? "NS";
    const status      = STATUS_MAP[statusShort] ?? "NS";

    try {
      await prisma.match.upsert({
        where:  { id: f.fixture.id },
        create: {
          id:            f.fixture.id,
          date,
          kickoff:       new Date(f.fixture.date),
          status,
          minuteLive:    f.fixture.status?.elapsed ?? null,
          homeTeamId:    f.teams.home.id,
          homeTeamName:  f.teams.home.name,
          homeTeamLogo:  f.teams.home.logo ?? "",
          awayTeamId:    f.teams.away.id,
          awayTeamName:  f.teams.away.name,
          awayTeamLogo:  f.teams.away.logo ?? "",
          scoreHome:     f.goals?.home ?? null,
          scoreAway:     f.goals?.away ?? null,
          htHome:        f.score?.halftime?.home ?? null,
          htAway:        f.score?.halftime?.away ?? null,
          leagueId:      f.league.id,
          leagueName:    f.league.name,
          leagueLogo:    f.league.logo ?? "",
          leagueCountry: f.league.country ?? "",
          season:        f.league.season ?? new Date().getFullYear(),
          source:        AFRICAN_COUNTRIES.has(f.league.country ?? "") ? "africa" : "euro",
        },
        update: {
          status,
          minuteLive: f.fixture.status?.elapsed ?? null,
          scoreHome:  f.goals?.home ?? null,
          scoreAway:  f.goals?.away ?? null,
          htHome:     f.score?.halftime?.home ?? null,
          htAway:     f.score?.halftime?.away ?? null,
          syncedAt:   new Date(),
        },
      });
      count++;
    } catch (e: any) {
      lastError = e?.message ?? String(e);
      console.error(`[sync] upsert failed for match ${f.fixture.id}:`, lastError);
      // Log first error and break to avoid spamming
      break;
    }
  }

  return { count, error: lastError || undefined };
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";

  try {
    // Test DB connection first
    await prisma.$queryRaw`SELECT 1`;
    console.log("[sync] DB connection OK");

    if (mode === "live") {
      const liveCount = await prisma.match.count({
        where: { status: { in: ["LIVE", "HT"] } },
      });
      if (liveCount === 0) {
        return NextResponse.json({ skipped: true, reason: "No live matches in DB" });
      }
      const today  = offsetDate(0);
      const result = await fetchAndSyncDate(today, apiKey);
      return NextResponse.json({ mode: "live", date: today, ...result });

    } else {
      const today    = offsetDate(0);
      const tomorrow = offsetDate(1);
      const [r1, r2] = await Promise.all([
        fetchAndSyncDate(today, apiKey),
        fetchAndSyncDate(tomorrow, apiKey),
      ]);
      return NextResponse.json({
        mode: "daily",
        synced: {
          [today]:    r1.count,
          [tomorrow]: r2.count,
        },
        errors: {
          [today]:    r1.error ?? null,
          [tomorrow]: r2.error ?? null,
        },
        totalApiCalls: 2,
      });
    }
  } catch (err: any) {
    console.error("[sync] fatal error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}