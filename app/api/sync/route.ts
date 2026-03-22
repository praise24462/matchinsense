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

async function fetchAndSyncDate(date: string, apiKey: string): Promise<{ count: number; error?: string; apiStatus?: number }> {
  try {
    const url = `${AS_BASE}/fixtures?date=${date}`;
    console.log(`[sync] Fetching: ${url}`);

    const res = await fetch(url, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });

    // Log quota info from headers
    const remaining = res.headers.get("x-apisports-requests-remaining");
    const used = res.headers.get("x-apisports-requests-current");
    console.log(`[sync] API quota - Used: ${used}, Remaining: ${remaining}`);

    if (!res.ok) {
      const errorText = await res.text();
      return { 
        count: 0, 
        error: `API HTTP error: ${res.status}. Response: ${errorText.slice(0, 200)}`,
        apiStatus: res.status
      };
    }

    const data = await res.json();

    if (data.errors && Object.keys(data.errors).length > 0) {
      return { 
        count: 0, 
        error: `API returned errors: ${JSON.stringify(data.errors)}`
      };
    }

    const fixtures = data.response ?? [];
    console.log(`[sync] ${date}: fetched ${fixtures.length} fixtures from API`);

    if (fixtures.length === 0) {
      return { count: 0, error: `API returned 0 fixtures for ${date}` };
    }

    let count = 0;
    let lastError = "";

    for (const f of fixtures) {
      const statusShort = f.fixture.status?.short ?? "NS";
      const status = STATUS_MAP[statusShort] ?? "NS";

      try {
        await prisma.match.upsert({
          where: { id: f.fixture.id },
          create: {
            id: f.fixture.id,
            date,
            kickoff: new Date(f.fixture.date),
            status,
            minuteLive: f.fixture.status?.elapsed ?? null,
            homeTeamId: f.teams.home.id,
            homeTeamName: f.teams.home.name,
            homeTeamLogo: f.teams.home.logo ?? "",
            awayTeamId: f.teams.away.id,
            awayTeamName: f.teams.away.name,
            awayTeamLogo: f.teams.away.logo ?? "",
            scoreHome: f.goals?.home ?? null,
            scoreAway: f.goals?.away ?? null,
            htHome: f.score?.halftime?.home ?? null,
            htAway: f.score?.halftime?.away ?? null,
            leagueId: f.league.id,
            leagueName: f.league.name,
            leagueLogo: f.league.logo ?? "",
            leagueCountry: f.league.country ?? "",
            season: f.league.season ?? new Date().getFullYear(),
            source: AFRICAN_COUNTRIES.has(f.league.country ?? "") ? "africa" : "euro",
            syncedAt: new Date(),
          },
          update: {
            status,
            minuteLive: f.fixture.status?.elapsed ?? null,
            scoreHome: f.goals?.home ?? null,
            scoreAway: f.goals?.away ?? null,
            htHome: f.score?.halftime?.home ?? null,
            htAway: f.score?.halftime?.away ?? null,
            syncedAt: new Date(),
          },
        });
        count++;
      } catch (e: any) {
        lastError = e?.message ?? String(e);
        console.error(`[sync] Upsert failed for match ${f.fixture.id}:`, lastError);
        break;
      }
    }

    console.log(`[sync] Successfully synced ${count} matches for ${date}`);
    return { count, error: lastError || undefined };

  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    console.error(`[sync] fetchAndSyncDate failed:`, errorMsg);
    return { count: 0, error: errorMsg };
  }
}

export async function GET(req: NextRequest) {
  const startTime = Date.now();
  console.log(`[sync] Request started at ${new Date().toISOString()}`);

  // Validate secret
  const secret = req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");
  const expectedSecret = process.env.SYNC_SECRET ?? "";
  
  if (!secret) {
    console.error("[sync] No secret provided");
    return NextResponse.json({ error: "No secret provided" }, { status: 401 });
  }

  if (secret !== expectedSecret) {
    console.error(`[sync] Secret mismatch. Expected: ${expectedSecret.slice(0, 5)}***, Got: ${secret.slice(0, 5)}***`);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check API key
  const apiKey = process.env.FOOTBALL_API_KEY ?? "";
  if (!apiKey) {
    console.error("[sync] FOOTBALL_API_KEY not configured");
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";
  console.log(`[sync] Mode: ${mode}`);

  try {
    // Test DB connection
    console.log("[sync] Testing database connection...");
    await prisma.$queryRaw`SELECT 1`;
    console.log("[sync] Database connection OK");

    if (mode === "live") {
      const liveCount = await prisma.match.count({
        where: { status: { in: ["LIVE", "HT"] } },
      });
      console.log(`[sync] Found ${liveCount} live matches`);
      
      if (liveCount === 0) {
        console.log("[sync] No live matches, skipping sync");
        return NextResponse.json({ 
          skipped: true, 
          reason: "No live matches in DB",
          executionTime: `${Date.now() - startTime}ms`
        });
      }

      const today = offsetDate(0);
      const result = await fetchAndSyncDate(today, apiKey);
      console.log(`[sync] Live sync result for ${today}: ${result.count} matches, error: ${result.error ?? "none"}`);
      
      return NextResponse.json({ 
        mode: "live", 
        date: today, 
        ...result,
        executionTime: `${Date.now() - startTime}ms`
      });

    } else {
      const today = offsetDate(0);
      const tomorrow = offsetDate(1);
      
      console.log(`[sync] Daily sync: fetching ${today} and ${tomorrow}`);
      const [r1, r2] = await Promise.all([
        fetchAndSyncDate(today, apiKey),
        fetchAndSyncDate(tomorrow, apiKey),
      ]);
      
      console.log(`[sync] Daily sync complete. ${today}: ${r1.count} matches, ${tomorrow}: ${r2.count} matches`);
      
      return NextResponse.json({
        mode: "daily",
        synced: {
          [today]: r1.count,
          [tomorrow]: r2.count,
        },
        errors: {
          [today]: r1.error ?? null,
          [tomorrow]: r2.error ?? null,
        },
        totalApiCalls: 2,
        executionTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    console.error("[sync] Fatal error:", errorMsg, err);
    
    return NextResponse.json({ 
      error: errorMsg,
      errorType: err?.constructor?.name ?? "Unknown",
      executionTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}