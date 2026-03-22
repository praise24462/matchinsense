import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/services/prisma";

// ── API endpoints ──────────────────────────────────────────────────────────
const AS_BASE  = "https://v3.football.api-sports.io";   // api-football (African/NPFL)
const FD_BASE  = "https://api.football-data.org/v4";    // football-data.org (European)

// ── football-data.org competition IDs → league info ───────────────────────
// These are the leagues covered by the free tier of football-data.org
const FD_COMPETITIONS: Record<string, { name: string; country: string; leagueId: number }> = {
  PL:  { name: "Premier League",     country: "England",     leagueId: 39  },
  PD:  { name: "La Liga",            country: "Spain",       leagueId: 140 },
  SA:  { name: "Serie A",            country: "Italy",       leagueId: 135 },
  BL1: { name: "Bundesliga",         country: "Germany",     leagueId: 78  },
  FL1: { name: "Ligue 1",            country: "France",      leagueId: 61  },
  CL:  { name: "Champions League",   country: "Europe",      leagueId: 2   },
  EL:  { name: "Europa League",      country: "Europe",      leagueId: 3   },
  EC:  { name: "European Championship", country: "Europe",   leagueId: 4   },
  WC:  { name: "FIFA World Cup",     country: "World",       leagueId: 1   },
};

// ── Status maps ────────────────────────────────────────────────────────────
const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

// ── African countries set (use api-football for these) ────────────────────
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

// ── Sync from api-football (African + NPFL matches) ───────────────────────
async function syncFromApiFootball(
  date: string,
  apiKey: string
): Promise<{ count: number; error?: string; quotaExhausted?: boolean }> {
  try {
    console.log(`[sync:AF] Fetching ${date} from api-football...`);
    const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
      headers: { "x-apisports-key": apiKey },
      cache: "no-store",
    });

    const remaining = res.headers.get("x-apisports-requests-remaining");
    console.log(`[sync:AF] Quota remaining: ${remaining}`);

    if (!res.ok) {
      return { count: 0, error: `HTTP ${res.status}` };
    }

    const data = await res.json();

    // Check for quota exhaustion
    if (data.errors?.requests) {
      console.log(`[sync:AF] Quota exhausted:`, data.errors.requests);
      return { count: 0, quotaExhausted: true, error: data.errors.requests };
    }

    const fixtures = data.response ?? [];
    console.log(`[sync:AF] Got ${fixtures.length} fixtures`);
    if (fixtures.length === 0) return { count: 0, error: "0 fixtures returned" };

    let count = 0;
    for (const f of fixtures) {
      const status = AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS";
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
            syncedAt:      new Date(),
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
        console.error(`[sync:AF] Upsert failed for ${f.fixture.id}:`, e?.message);
      }
    }

    console.log(`[sync:AF] Synced ${count} matches for ${date}`);
    return { count };

  } catch (err: any) {
    return { count: 0, error: err?.message ?? String(err) };
  }
}

// ── Sync from football-data.org (European leagues fallback) ───────────────
async function syncFromFootballData(
  date: string,
  apiKey: string
): Promise<{ count: number; error?: string }> {
  try {
    console.log(`[sync:FD] Fetching ${date} from football-data.org...`);
    let totalCount = 0;
    const errors: string[] = [];

    // Fetch each competition separately (free tier requirement)
    for (const [code, info] of Object.entries(FD_COMPETITIONS)) {
      try {
        const res = await fetch(
          `${FD_BASE}/competitions/${code}/matches?dateFrom=${date}&dateTo=${date}`,
          {
            headers: { "X-Auth-Token": apiKey },
            cache: "no-store",
          }
        );

        if (!res.ok) {
          console.log(`[sync:FD] ${code}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        const matches = data.matches ?? [];
        console.log(`[sync:FD] ${code}: ${matches.length} matches`);

        for (const m of matches) {
          const status = FD_STATUS_MAP[m.status] ?? "NS";

          // Generate a stable ID: use fixture ID from FD or create one
          const matchId = m.id ?? parseInt(`${info.leagueId}${m.homeTeam.id}${m.awayTeam.id}`);

          try {
            await prisma.match.upsert({
              where:  { id: matchId },
              create: {
                id:            matchId,
                date,
                kickoff:       new Date(m.utcDate),
                status,
                minuteLive:    m.minute ?? null,
                homeTeamId:    m.homeTeam.id,
                homeTeamName:  m.homeTeam.shortName ?? m.homeTeam.name,
                homeTeamLogo:  m.homeTeam.crest ?? "",
                awayTeamId:    m.awayTeam.id,
                awayTeamName:  m.awayTeam.shortName ?? m.awayTeam.name,
                awayTeamLogo:  m.awayTeam.crest ?? "",
                scoreHome:     m.score?.fullTime?.home ?? null,
                scoreAway:     m.score?.fullTime?.away ?? null,
                htHome:        m.score?.halfTime?.home ?? null,
                htAway:        m.score?.halfTime?.away ?? null,
                leagueId:      info.leagueId,
                leagueName:    info.name,
                leagueLogo:    "",
                leagueCountry: info.country,
                season:        m.season?.startYear ?? new Date().getFullYear(),
                source:        "euro",
                syncedAt:      new Date(),
              },
              update: {
                status,
                minuteLive: m.minute ?? null,
                scoreHome:  m.score?.fullTime?.home ?? null,
                scoreAway:  m.score?.fullTime?.away ?? null,
                htHome:     m.score?.halfTime?.home ?? null,
                htAway:     m.score?.halfTime?.away ?? null,
                syncedAt:   new Date(),
              },
            });
            totalCount++;
          } catch (e: any) {
            console.error(`[sync:FD] Upsert failed for match ${matchId}:`, e?.message);
          }
        }

        // Small delay between competition requests to respect rate limits
        await new Promise(r => setTimeout(r, 200));

      } catch (e: any) {
        errors.push(`${code}: ${e?.message}`);
      }
    }

    console.log(`[sync:FD] Total synced: ${totalCount} matches for ${date}`);
    return { count: totalCount, error: errors.length ? errors.join("; ") : undefined };

  } catch (err: any) {
    return { count: 0, error: err?.message ?? String(err) };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const startTime = Date.now();

  // Auth
  const secret = req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiFootballKey  = process.env.FOOTBALL_API_KEY ?? "";
  const footballDataKey = process.env.FOOTBALL_DATA_API_KEY ?? "";

  if (!apiFootballKey && !footballDataKey) {
    return NextResponse.json({ error: "No API keys configured" }, { status: 500 });
  }

  const mode = req.nextUrl.searchParams.get("mode") ?? "daily";

  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("[sync] DB OK");

    if (mode === "live") {
      const liveCount = await prisma.match.count({
        where: { status: { in: ["LIVE", "HT"] } },
      });
      if (liveCount === 0) {
        return NextResponse.json({ skipped: true, reason: "No live matches" });
      }
      const today = offsetDate(0);
      const result = await syncFromApiFootball(today, apiFootballKey);
      return NextResponse.json({ mode: "live", date: today, ...result });

    } else {
      const today    = offsetDate(0);
      const tomorrow = offsetDate(1);

      console.log(`[sync] Daily sync: ${today} + ${tomorrow}`);

      // Step 1: Try api-football first (has African/NPFL data)
      const [af1, af2] = await Promise.all([
        apiFootballKey ? syncFromApiFootball(today, apiFootballKey)    : Promise.resolve({ count: 0, quotaExhausted: true, error: undefined }),
        apiFootballKey ? syncFromApiFootball(tomorrow, apiFootballKey) : Promise.resolve({ count: 0, quotaExhausted: true, error: undefined }),
      ]);

      const afQuotaExhausted = af1.quotaExhausted || af2.quotaExhausted;
      const afTotalCount = af1.count + af2.count;

      console.log(`[sync] api-football: ${afTotalCount} matches. Quota exhausted: ${afQuotaExhausted}`);

      // Step 2: Always also sync European leagues from football-data.org
      // (runs regardless of api-football quota — covers PL, La Liga, etc.)
      let fd1: { count: number; error?: string } = { count: 0, error: "No football-data key" };
      let fd2: { count: number; error?: string } = { count: 0, error: "No football-data key" };

      if (footballDataKey) {
        console.log(`[sync] Also syncing European leagues from football-data.org...`);
        [fd1, fd2] = await Promise.all([
          syncFromFootballData(today, footballDataKey),
          syncFromFootballData(tomorrow, footballDataKey),
        ]);
      }

      const totalToday    = af1.count + fd1.count;
      const totalTomorrow = af2.count + fd2.count;

      return NextResponse.json({
        mode: "daily",
        synced: {
          [today]:    totalToday,
          [tomorrow]: totalTomorrow,
        },
        breakdown: {
          apiFootball: {
            [today]:    af1.count,
            [tomorrow]: af2.count,
            quotaExhausted: afQuotaExhausted,
          },
          footballData: {
            [today]:    fd1.count,
            [tomorrow]: fd2.count,
          },
        },
        errors: {
          [today]:    [af1.error, fd1.error].filter(Boolean).join(" | ") || null,
          [tomorrow]: [af2.error, fd2.error].filter(Boolean).join(" | ") || null,
        },
        executionTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (err: any) {
    console.error("[sync] Fatal:", err);
    return NextResponse.json({
      error: err?.message ?? String(err),
      executionTime: `${Date.now() - startTime}ms`,
    }, { status: 500 });
  }
}