export interface Team {
  id: number;
  name: string;
  logo: string;
}

export interface Score {
  home: number | null;
  away: number | null;
}

export type MatchStatus = "FT" | "LIVE" | "NS" | "HT" | "PST" | "CANC";

export interface League {
  id: number;
  name: string;
  logo: string;
  country: string;
}

export interface Match {
  id: number;
  date: string;
  status: MatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  score: Score;
  league: League;
  source: "european" | "african"; // which API this match came from
}

export interface MatchStatistic {
  label: string;
  home: string | number | null;
  away: string | number | null;
}

export interface MatchEvent {
  minute: number;
  type: "Goal" | "Card" | "Substitution" | "OwnGoal" | "Penalty";
  team: "home" | "away";
  player: string;
  detail?: string;
}

export interface MatchDetails extends Match {
  statistics: MatchStatistic[];
  events: MatchEvent[];
  halfTimeScore: Score;
  venue?: string;
  referee?: string;
}

export interface SummaryRequest {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  score: Score;
  halfTimeScore?: Score;
  statistics: MatchStatistic[];
  events?: MatchEvent[];
}

export interface SummaryResponse {
  summary: string;
  generatedAt: string;
}
