import { NextResponse } from "next/server";
import type { Match } from "@/types";

const FD_BASE = "https://api.football-data.org/v4";
const FD_CODES = "CL,EL,ECL,WC,EC,PL,PD,SA,BL1,FL1,ELC,PPL,DED,BSA";

const FD_COMPS: Record<string, { leagueId: number; name: string; country: string; logo: string }> = {
  CL:  { leagueId: 2,   name: "Champions League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/2.png"   },
  EL:  { leagueId: 3,   name: "Europa League",      country: "Europe",      logo: "https://media.api-sports.io/football/leagues/3.png"   },
  ECL: { leagueId: 848, name: "Conference League",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/848.png" },
  WC:  { leagueId: 1,   name: "FIFA World Cup",     country: "World",       logo: "https://media.api-sports.io/football/leagues/1.png"   },
  EC:  { leagueId: 4,   name: "Euro Championship",  country: "Europe",      logo: "https://media.api-sports.io/football/leagues/4.png"   },
  PL:  { leagueId: 39,  name: "Premier League",     country: "England",     logo: "https://media.api-sports.io/football/leagues/39.png"  },
  PD:  { leagueId: 140, name: "La Liga",            country: "Spain",       logo: "https://media.api-sports.io/football/leagues/140.png" },
  SA:  { leagueId: 135, name: "Serie A",            country: "Italy",       logo: "https://media.api-sports.io/football/leagues/135.png" },
  BL1: { leagueId: 78,  name: "Bundesliga",         country: "Germany",     logo: "https://media.api-sports.io/football/leagues/78.png"  },
  FL1: { leagueId: 61,  name: "Ligue 1",            country: "France",      logo: "https://media.api-sports.io/football/leagues/61.png"  },
  ELC: { leagueId: 10,  name: "Championship",       country: "England",     logo: "https://media.api-sports.io/football/leagues/10.png"  },
  PPL: { leagueId: 94,  name: "Primeira Liga",      country: "Portugal",    logo: "https://media.api-sports.io/football/leagues/94.png"  },
  DED: { leagueId: 88,  name: "Eredivisie",         country: "Netherlands", logo: "https://media.api-sports.io/football/leagues/88.png"  },
  BSA: { leagueId: 71,  name: "Brasileirão",        country: "Brazil",      logo: "https://media.api-sports.io/football/leagues/71.png"  },
};

const FD_STATUS: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};

function lagosDate(): string { return new Date(Date.now()+3_600_000).toISOString().split("T")[0]; }
function addDays(iso: string, n: number): string {
  const d=new Date(iso+"T12:00:00Z"); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().split("T")[0];
}

export async function GET() {
  const fdKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!fdKey) return NextResponse.json({ matches: [], error: "No API key" });

  const today = lagosDate();
  const dateTo = addDays(today, 14);

  try {
    const res = await fetch(
      `${FD_BASE}/matches?competitions=${FD_CODES}&dateFrom=${today}&dateTo=${dateTo}&status=SCHEDULED,TIMED`,
      { headers: { "X-Auth-Token": fdKey }, next: { revalidate: 7200 } }
    );

    if (!res.ok) return NextResponse.json({ matches: [], error: `FD ${res.status}` });

    const data = await res.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const matches: Match[] = (data.matches ?? []).map((m: any): Match => {
      const meta = FD_COMPS[m.competition?.code ?? ""] ?? {
        leagueId: m.competition?.id ?? 0, name: m.competition?.name ?? "Unknown",
        country: m.area?.name ?? "", logo: m.competition?.emblem ?? "",
      };
      return {
        id: m.id, date: m.utcDate,
        status: (FD_STATUS[m.status] ?? "NS") as Match["status"],
        homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
        awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
        score: { home: null, away: null },
        league: { id: meta.leagueId, name: meta.name, logo: meta.logo, country: meta.country },
        source: "european",
      };
    }).filter((m: Match) => m.league?.id && m.league.id !== 0)
      .sort((a: Match, b: Match) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return NextResponse.json({ matches, count: matches.length });
  } catch (err: unknown) {
    return NextResponse.json({ matches: [], error: String(err) }, { status: 500 });
  }
}
