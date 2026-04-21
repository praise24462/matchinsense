/**
 * Curated list of popular football teams shown in the sidebar.
 * source: api-sports.io team IDs + logos
 * Grouped by region for the Europe/Africa tabs.
 */

export interface PopularTeam {
  id: number;
  name: string;
  shortName: string;
  logo: string;
  league: string;
  leagueId: number;
  country: string;
  source: "euro" | "africa";
}

export const POPULAR_EURO_TEAMS: PopularTeam[] = [
  // England
  { id: 33,  name: "Manchester United",  shortName: "Man Utd",    logo: "https://media.api-sports.io/football/teams/33.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  { id: 40,  name: "Liverpool",          shortName: "Liverpool",  logo: "https://media.api-sports.io/football/teams/40.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  { id: 42,  name: "Arsenal",            shortName: "Arsenal",    logo: "https://media.api-sports.io/football/teams/42.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  { id: 49,  name: "Chelsea",            shortName: "Chelsea",    logo: "https://media.api-sports.io/football/teams/49.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  { id: 50,  name: "Manchester City",    shortName: "Man City",   logo: "https://media.api-sports.io/football/teams/50.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  { id: 47,  name: "Tottenham",          shortName: "Spurs",      logo: "https://media.api-sports.io/football/teams/47.png",  league: "Premier League", leagueId: 39,  country: "England",  source: "euro" },
  // Spain
  { id: 541, name: "Real Madrid",        shortName: "Real Madrid",logo: "https://media.api-sports.io/football/teams/541.png", league: "La Liga",        leagueId: 140, country: "Spain",    source: "euro" },
  { id: 529, name: "Barcelona",          shortName: "Barcelona",  logo: "https://media.api-sports.io/football/teams/529.png", league: "La Liga",        leagueId: 140, country: "Spain",    source: "euro" },
  { id: 530, name: "Atletico Madrid",    shortName: "Atletico",   logo: "https://media.api-sports.io/football/teams/530.png", league: "La Liga",        leagueId: 140, country: "Spain",    source: "euro" },
  // Italy
  { id: 489, name: "AC Milan",           shortName: "AC Milan",   logo: "https://media.api-sports.io/football/teams/489.png", league: "Serie A",        leagueId: 135, country: "Italy",    source: "euro" },
  { id: 505, name: "Inter Milan",        shortName: "Inter",      logo: "https://media.api-sports.io/football/teams/505.png", league: "Serie A",        leagueId: 135, country: "Italy",    source: "euro" },
  { id: 496, name: "Juventus",           shortName: "Juventus",   logo: "https://media.api-sports.io/football/teams/496.png", league: "Serie A",        leagueId: 135, country: "Italy",    source: "euro" },
  // Germany
  { id: 157, name: "Bayern Munich",      shortName: "Bayern",     logo: "https://media.api-sports.io/football/teams/157.png", league: "Bundesliga",     leagueId: 78,  country: "Germany",  source: "euro" },
  { id: 165, name: "Borussia Dortmund",  shortName: "Dortmund",   logo: "https://media.api-sports.io/football/teams/165.png", league: "Bundesliga",     leagueId: 78,  country: "Germany",  source: "euro" },
  // France
  { id: 85,  name: "Paris Saint-Germain",shortName: "PSG",        logo: "https://media.api-sports.io/football/teams/85.png",  league: "Ligue 1",        leagueId: 61,  country: "France",   source: "euro" },
  { id: 80,  name: "Lyon",               shortName: "Lyon",       logo: "https://media.api-sports.io/football/teams/80.png",  league: "Ligue 1",        leagueId: 61,  country: "France",   source: "euro" },
  // Portugal
  { id: 212, name: "Benfica",            shortName: "Benfica",    logo: "https://media.api-sports.io/football/teams/212.png", league: "Primeira Liga",  leagueId: 94,  country: "Portugal", source: "euro" },
  { id: 228, name: "Porto",              shortName: "Porto",      logo: "https://media.api-sports.io/football/teams/228.png", league: "Primeira Liga",  leagueId: 94,  country: "Portugal", source: "euro" },
];

export const POPULAR_AFRICA_TEAMS: PopularTeam[] = [
  // Nigeria
  { id: 2532, name: "Enyimba FC",           shortName: "Enyimba",        logo: "https://media.api-sports.io/football/teams/2532.png", league: "NPFL",               leagueId: 334, country: "Nigeria",      source: "africa" },
  { id: 2533, name: "Kano Pillars",          shortName: "Kano Pillars",   logo: "https://media.api-sports.io/football/teams/2533.png", league: "NPFL",               leagueId: 334, country: "Nigeria",      source: "africa" },
  { id: 2531, name: "Rangers Int'l",         shortName: "Rangers",        logo: "https://media.api-sports.io/football/teams/2531.png", league: "NPFL",               leagueId: 334, country: "Nigeria",      source: "africa" },
  // Ghana
  { id: 2535, name: "Asante Kotoko",         shortName: "Kotoko",         logo: "https://media.api-sports.io/football/teams/2535.png", league: "Ghana Premier",      leagueId: 167, country: "Ghana",        source: "africa" },
  { id: 2536, name: "Hearts of Oak",         shortName: "Hearts of Oak",  logo: "https://media.api-sports.io/football/teams/2536.png", league: "Ghana Premier",      leagueId: 167, country: "Ghana",        source: "africa" },
  // Egypt
  { id: 2547, name: "Al Ahly",               shortName: "Al Ahly",        logo: "https://media.api-sports.io/football/teams/2547.png", league: "Egypt Premier",      leagueId: 233, country: "Egypt",        source: "africa" },
  { id: 2548, name: "Zamalek",               shortName: "Zamalek",        logo: "https://media.api-sports.io/football/teams/2548.png", league: "Egypt Premier",      leagueId: 233, country: "Egypt",        source: "africa" },
  // Morocco
  { id: 2558, name: "Raja Casablanca",       shortName: "Raja",           logo: "https://media.api-sports.io/football/teams/2558.png", league: "Botola Pro",         leagueId: 200, country: "Morocco",      source: "africa" },
  { id: 2559, name: "Wydad AC",              shortName: "Wydad",          logo: "https://media.api-sports.io/football/teams/2559.png", league: "Botola Pro",         leagueId: 200, country: "Morocco",      source: "africa" },
  // South Africa
  { id: 2564, name: "Kaizer Chiefs",         shortName: "Kaizer Chiefs",  logo: "https://media.api-sports.io/football/teams/2564.png", league: "PSL",                leagueId: 288, country: "South Africa", source: "africa" },
  { id: 2565, name: "Orlando Pirates",       shortName: "Pirates",        logo: "https://media.api-sports.io/football/teams/2565.png", league: "PSL",                leagueId: 288, country: "South Africa", source: "africa" },
  { id: 2566, name: "Mamelodi Sundowns",     shortName: "Sundowns",       logo: "https://media.api-sports.io/football/teams/2566.png", league: "PSL",                leagueId: 288, country: "South Africa", source: "africa" },
  // Kenya
  { id: 2570, name: "Gor Mahia",             shortName: "Gor Mahia",      logo: "https://media.api-sports.io/football/teams/2570.png", league: "Kenyan Premier",     leagueId: 357, country: "Kenya",        source: "africa" },
  { id: 2571, name: "AFC Leopards",          shortName: "AFC Leopards",   logo: "https://media.api-sports.io/football/teams/2571.png", league: "Kenyan Premier",     leagueId: 357, country: "Kenya",        source: "africa" },
  // Tunisia
  { id: 2580, name: "Espérance Tunis",       shortName: "Espérance",      logo: "https://media.api-sports.io/football/teams/2580.png", league: "Tunisia Ligue 1",    leagueId: 392, country: "Tunisia",      source: "africa" },
  { id: 2581, name: "Club Africain",         shortName: "Club Africain",  logo: "https://media.api-sports.io/football/teams/2581.png", league: "Tunisia Ligue 1",    leagueId: 392, country: "Tunisia",      source: "africa" },
];

export const ALL_POPULAR_TEAMS = [...POPULAR_EURO_TEAMS, ...POPULAR_AFRICA_TEAMS];
