import MatchesClient from "./matches/MatchesClient";
import type { Match } from "@/types";

const AS_BASE = "https://v3.football.api-sports.io";
const FD_BASE = "https://api.football-data.org/v4";

const FD_COMPETITIONS = [
  { code: "CL",  leagueId: 2,   name: "Champions League", country: "Europe",  logo: "https://media.api-sports.io/football/leagues/2.png"   },
  { code: "EL",  leagueId: 3,   name: "Europa League",    country: "Europe",  logo: "https://media.api-sports.io/football/leagues/3.png"   },
  { code: "PL",  leagueId: 39,  name: "Premier League",   country: "England", logo: "https://media.api-sports.io/football/leagues/39.png"  },
  { code: "PD",  leagueId: 140, name: "La Liga",          country: "Spain",   logo: "https://media.api-sports.io/football/leagues/140.png" },
  { code: "SA",  leagueId: 135, name: "Serie A",          country: "Italy",   logo: "https://media.api-sports.io/football/leagues/135.png" },
  { code: "BL1", leagueId: 78,  name: "Bundesliga",       country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png"  },
  { code: "FL1", leagueId: 61,  name: "Ligue 1",          country: "France",  logo: "https://media.api-sports.io/football/leagues/61.png"  },
];

const FD_STATUS_MAP: Record<string, string> = {
  FINISHED:"FT", IN_PLAY:"LIVE", PAUSED:"HT",
  SCHEDULED:"NS", TIMED:"NS", POSTPONED:"PST", CANCELLED:"CANC", SUSPENDED:"PST",
};
const AS_STATUS_MAP: Record<string, string> = {
  FT:"FT", AET:"FT", PEN:"FT", AWD:"FT", WO:"FT",
  "1H":"LIVE","2H":"LIVE",ET:"LIVE",BT:"LIVE",P:"LIVE",LIVE:"LIVE",
  HT:"HT", NS:"NS", TBD:"NS", PST:"PST", SUSP:"PST", CANC:"CANC",
};
const PRIORITY: Record<number, number> = {
  2:1,3:2,848:3,39:4,140:5,135:6,78:7,61:8,
  88:9,94:10,144:11,12:14,20:15,6:16,
  399:17,288:18,167:19,13:26,11:27,71:28,128:29,
};
const AFRICAN_COUNTRIES = new Set([
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cameroon",
  "Cape Verde","Congo","DR Congo","Egypt","Ethiopia","Gabon","Ghana","Guinea",
  "Ivory Coast","Kenya","Libya","Madagascar","Mali","Morocco","Mozambique",
  "Namibia","Niger","Nigeria","Rwanda","Senegal","Sierra Leone","South Africa",
  "Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe","Africa",
]);
const EU_COUNTRIES = new Set(["England","Spain","Italy","Germany","France","Europe"]);

function sortMatches(matches: Match[]): Match[] {
  return [...matches].sort((a, b) => {
    const aLive = a.status==="LIVE"||a.status==="HT";
    const bLive = b.status==="LIVE"||b.status==="HT";
    if (aLive && !bLive) return -1;
    if (!aLive && bLive) return 1;
    const aPri = PRIORITY[a.league.id] ?? 50;
    const bPri = PRIORITY[b.league.id] ?? 50;
    if (aPri !== bPri) return aPri - bPri;
    if (a.status==="FT" && b.status!=="FT") return -1;
    if (a.status!=="FT" && b.status==="FT") return 1;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });
}

function getDate(offset: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().split("T")[0];
}

async function fetchMatches(date: string): Promise<Match[]> {
  const afKey = process.env.FOOTBALL_API_KEY ?? "";
  const fdKey = process.env.FOOTBALL_DATA_API_KEY ?? "";
  const all: Match[] = [];

  // Fetch European matches from football-data.org
  if (fdKey) {
    for (const comp of FD_COMPETITIONS) {
      try {
        const res = await fetch(
          `${FD_BASE}/competitions/${comp.code}/matches?dateFrom=${date}&dateTo=${date}`,
          { headers: { "X-Auth-Token": fdKey }, next: { revalidate: 300 } }
        );
        if (!res.ok) continue;
        const data = await res.json();
        for (const m of data.matches ?? []) {
          all.push({
            id: m.id, date: m.utcDate,
            status: (FD_STATUS_MAP[m.status] ?? "NS") as Match["status"],
            homeTeam: { id: m.homeTeam.id, name: m.homeTeam.shortName ?? m.homeTeam.name, logo: m.homeTeam.crest ?? "" },
            awayTeam: { id: m.awayTeam.id, name: m.awayTeam.shortName ?? m.awayTeam.name, logo: m.awayTeam.crest ?? "" },
            score: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
            league: { id: comp.leagueId, name: comp.name, logo: comp.logo, country: comp.country },
            source: "euro",
          });
        }
        await new Promise(r => setTimeout(r, 200));
      } catch {}
    }
  }

  // Fetch African + other matches from api-football
  if (afKey) {
    try {
      const res = await fetch(`${AS_BASE}/fixtures?date=${date}`, {
        headers: { "x-apisports-key": afKey },
        next: { revalidate: 300 },
      });
      if (res.ok) {
        const data = await res.json();
        if (!data.errors?.requests) {
          for (const f of data.response ?? []) {
            const country = f.league.country ?? "";
            if (EU_COUNTRIES.has(country)) continue; // already have from FD
            all.push({
              id: f.fixture.id, date: f.fixture.date,
              status: (AS_STATUS_MAP[f.fixture.status?.short ?? "NS"] ?? "NS") as Match["status"],
              homeTeam: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo ?? "" },
              awayTeam: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo ?? "" },
              score: { home: f.goals?.home ?? null, away: f.goals?.away ?? null },
              league: { id: f.league.id, name: f.league.name, logo: f.league.logo ?? "", country },
              source: AFRICAN_COUNTRIES.has(country) ? "africa" : "euro",
            });
          }
        }
      }
    } catch {}
  }

  return sortMatches(all);
}

export default async function HomePage() {
  // Try today first, fall back to yesterday if empty
  const today = getDate(0);
  let matches = await fetchMatches(today);

  if (matches.length === 0) {
    const yesterday = getDate(-1);
    matches = await fetchMatches(yesterday);
  }

  return <MatchesClient initialMatches={matches} initialError={null} />;
}

// Revalidate every 5 minutes
export const revalidate = 300;