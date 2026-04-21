/**
 * Fallback match data generator
 * Used when APIs fail to ensure the app ALWAYS shows content
 */

import type { Match } from "@/types";

const TEAMS = [
  // Premier League
  { id: 1, name: "Arsenal", logo: "https://media.api-sports.io/teams/logos/33.png", league: 39 },
  { id: 2, name: "Manchester City", logo: "https://media.api-sports.io/teams/logos/50.png", league: 39 },
  { id: 3, name: "Liverpool", logo: "https://media.api-sports.io/teams/logos/40.png", league: 39 },
  { id: 4, name: "Norwich City", logo: "https://media.api-sports.io/teams/logos/51.png", league: 39 },
  { id: 5, name: "Tottenham", logo: "https://media.api-sports.io/teams/logos/47.png", league: 39 },
  { id: 6, name: "Chelsea", logo: "https://media.api-sports.io/teams/logos/49.png", league: 39 },
  { id: 7, name: "Manchester United", logo: "https://media.api-sports.io/teams/logos/33.png", league: 39 },
  { id: 8, name: "Brighton", logo: "https://media.api-sports.io/teams/logos/51.png", league: 39 },
  
  // Championship
  { id: 101, name: "Wrexham", logo: "https://media.api-sports.io/teams/logos/111.png", league: 10 },
  { id: 102, name: "Southampton", logo: "https://media.api-sports.io/teams/logos/320.png", league: 10 },
  { id: 103, name: "Rotherham United", logo: "https://media.api-sports.io/teams/logos/1096.png", league: 10 },
  { id: 104, name: "Port Vale", logo: "https://media.api-sports.io/teams/logos/322.png", league: 10 },
  { id: 105, name: "Bromley", logo: "https://media.api-sports.io/teams/logos/2749.png", league: 10 },
  { id: 106, name: "Shrewsbury Town", logo: "https://media.api-sports.io/teams/logos/326.png", league: 10 },
  
  // La Liga
  { id: 201, name: "Real Madrid", logo: "https://media.api-sports.io/teams/logos/541.png", league: 140 },
  { id: 202, name: "Barcelona", logo: "https://media.api-sports.io/teams/logos/529.png", league: 140 },
  { id: 203, name: "Atlético Madrid", logo: "https://media.api-sports.io/teams/logos/530.png", league: 140 },
  
  // Serie A
  { id: 301, name: "Inter Milan", logo: "https://media.api-sports.io/teams/logos/505.png", league: 135 },
  { id: 302, name: "Juventus", logo: "https://media.api-sports.io/teams/logos/496.png", league: 135 },
  { id: 303, name: "AC Milan", logo: "https://media.api-sports.io/teams/logos/489.png", league: 135 },
  
  // Bundesliga
  { id: 401, name: "Bayern Munich", logo: "https://media.api-sports.io/teams/logos/157.png", league: 78 },
  { id: 402, name: "Borussia Dortmund", logo: "https://media.api-sports.io/teams/logos/165.png", league: 78 },
  
  // Ligue 1
  { id: 501, name: "Paris Saint-Germain", logo: "https://media.api-sports.io/teams/logos/85.png", league: 61 },
];

const LEAGUES = [
  { id: 1, name: "FIFA World Cup", country: "World", logo: "https://media.api-sports.io/football/leagues/1.png" },
  { id: 4, name: "Euro Championship", country: "Europe", logo: "https://media.api-sports.io/football/leagues/4.png" },
  { id: 2, name: "Champions League", country: "Europe", logo: "https://media.api-sports.io/football/leagues/2.png" },
  { id: 3, name: "Europa League", country: "Europe", logo: "https://media.api-sports.io/football/leagues/3.png" },
  { id: 39, name: "Premier League", country: "England", logo: "https://media.api-sports.io/football/leagues/39.png" },
  { id: 140, name: "La Liga", country: "Spain", logo: "https://media.api-sports.io/football/leagues/140.png" },
  { id: 135, name: "Serie A", country: "Italy", logo: "https://media.api-sports.io/football/leagues/135.png" },
  { id: 78, name: "Bundesliga", country: "Germany", logo: "https://media.api-sports.io/football/leagues/78.png" },
  { id: 61, name: "Ligue 1", country: "France", logo: "https://media.api-sports.io/football/leagues/61.png" },
  { id: 10, name: "Championship", country: "England", logo: "https://media.api-sports.io/football/leagues/10.png" },
  { id: 11, name: "League One", country: "England", logo: "https://media.api-sports.io/football/leagues/11.png" },
  { id: 12, name: "League Two", country: "England", logo: "https://media.api-sports.io/football/leagues/12.png" },
];

function getTeamsForLeague(leagueId: number): typeof TEAMS {
  return TEAMS.filter((t) => t.league === leagueId);
}

function generateFallbackMatches(date: string, count: number = 8): Match[] {
  const matches: Match[] = [];
  const [year, month, day] = date.split("-").map(Number);
  
  // Select random leagues (skip international tournaments on random falls)
  const availableLeagues = LEAGUES.filter((l) => l.id !== 1 && l.id !== 4 && l.id !== 2 && l.id !== 3);
  
  for (let i = 0; i < count; i++) {
    const league = availableLeagues[Math.floor(Math.random() * availableLeagues.length)];
    const teamsInLeague = getTeamsForLeague(league.id);
    
    if (teamsInLeague.length < 2) continue;
    
    const homeTeam = teamsInLeague[Math.floor(Math.random() * teamsInLeague.length)];
    let awayTeam = teamsInLeague[Math.floor(Math.random() * teamsInLeague.length)];
    
    // Ensure different teams
    while (awayTeam.id === homeTeam.id && teamsInLeague.length > 1) {
      awayTeam = teamsInLeague[Math.floor(Math.random() * teamsInLeague.length)];
    }
    
    // Generate time
    const hour = 12 + Math.floor(Math.random() * 8); // 12:00 - 20:00
    const minute = Math.random() > 0.5 ? 0 : 30;
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    
    const dateTime = `${date}T${timeStr}:00Z`;
    
    matches.push({
      id: 900000 + i,
      date: dateTime,
      status: "NS",
      homeTeam,
      awayTeam,
      score: { home: null, away: null },
      halfTimeScore: { home: null, away: null },
      league: { 
        id: league.id, 
        name: league.name, 
        logo: league.logo, 
        country: league.country 
      },
      source: "fallback",
      statistics: [],
      events: [],
    });
  }
  
  return matches;
}

/**
 * Generate upcoming matches for the next N days
 * Used as fallback when API fails
 */
export function generateFallbackUpcoming(fromDate: string, days: number = 14): Match[] {
  const matches: Match[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = new Date(fromDate + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() + i);
    const dateStr = date.toISOString().split("T")[0];
    
    // 3-5 matches per day
    const matchCount = 3 + Math.floor(Math.random() * 3);
    const dayMatches = generateFallbackMatches(dateStr, matchCount);
    matches.push(...dayMatches);
  }
  
  return matches;
}

/**
 * Generate matches for a specific date as fallback
 */
export function generateFallbackForDate(date: string): Match[] {
  return generateFallbackMatches(date, 6);
}

export { TEAMS, LEAGUES };
