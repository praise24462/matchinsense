/**
 * services/teamAnalytics.ts
 * 
 * Calculates team form, head-to-head records, and betting context
 * to enrich AI predictions with real data.
 */

import type { NormalizedMatch } from "@/types/matches";

export interface TeamForm {
  team: string;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  formPercent: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  goalsPerGame: number;
  concededPerGame: number;
}

export interface HeadToHead {
  lastMeetings: Array<{
    date: string;
    home: string;
    away: string;
    homeScore: number;
    awayScore: number;
  }>;
  homeWins: number;
  awayWins: number;
  draws: number;
  homeGoalsAvg: number;
  awayGoalsAvg: number;
}

/**
 * Calculate team form from recent matches (last 10 games)
 * Formula: (Wins*3 + Draws*1) / (Matches*3) * 100
 */
export function calculateTeamForm(
  team: string,
  matches: NormalizedMatch[],
  lastN: number = 10
): TeamForm {
  // Filter matches for this team (last N games regardless of date)
  const teamMatches = matches
    .filter(m => {
      const isHome = m.homeTeam.name === team;
      const isAway = m.awayTeam.name === team;
      return (isHome || isAway) && m.status === "FINISHED";
    })
    .slice(-lastN);

  if (teamMatches.length === 0) {
    return {
      team,
      matches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      formPercent: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDiff: 0,
      goalsPerGame: 0,
      concededPerGame: 0,
    };
  }

  let wins = 0,
    draws = 0,
    losses = 0;
  let goalsFor = 0,
    goalsAgainst = 0;

  for (const match of teamMatches) {
    const isHome = match.homeTeam.name === team;
    const teamGoals = isHome ? match.score.fullTime.home : match.score.fullTime.away;
    const oppGoals = isHome ? match.score.fullTime.away : match.score.fullTime.home;

    goalsFor += teamGoals ?? 0;
    goalsAgainst += oppGoals ?? 0;

    if (teamGoals === oppGoals) draws++;
    else if (teamGoals! > oppGoals!) wins++;
    else losses++;
  }

  const points = wins * 3 + draws * 1;
  const maxPoints = teamMatches.length * 3;
  const formPercent = Math.round((points / maxPoints) * 100);

  return {
    team,
    matches: teamMatches.length,
    wins,
    draws,
    losses,
    formPercent,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    goalsPerGame: Number((goalsFor / teamMatches.length).toFixed(2)),
    concededPerGame: Number((goalsAgainst / teamMatches.length).toFixed(2)),
  };
}

/**
 * Get head-to-head record between two teams
 */
export function getHeadToHead(
  team1: string,
  team2: string,
  matches: NormalizedMatch[],
  lastN: number = 5
): HeadToHead {
  const h2hMatches = matches
    .filter(m => {
      const isMeeting = 
        (m.homeTeam.name === team1 && m.awayTeam.name === team2) ||
        (m.homeTeam.name === team2 && m.awayTeam.name === team1);
      return isMeeting && m.status === "FINISHED";
    })
    .slice(-lastN);

  let homeWins = 0,
    awayWins = 0,
    draws = 0;
  let team1GoalsTotal = 0,
    team2GoalsTotal = 0;

  for (const match of h2hMatches) {
    const isTeam1Home = match.homeTeam.name === team1;
    const team1Goals = isTeam1Home ? match.score.fullTime.home : match.score.fullTime.away;
    const team2Goals = isTeam1Home ? match.score.fullTime.away : match.score.fullTime.home;

    team1GoalsTotal += team1Goals ?? 0;
    team2GoalsTotal += team2Goals ?? 0;

    if (team1Goals === team2Goals) {
      draws++;
    } else if (team1Goals! > team2Goals!) {
      if (isTeam1Home) homeWins++;
      else awayWins++;
    } else {
      if (isTeam1Home) awayWins++;
      else homeWins++;
    }
  }

  return {
    lastMeetings: h2hMatches.map(m => ({
      date: m.utcDate,
      home: m.homeTeam.name,
      away: m.awayTeam.name,
      homeScore: m.score.fullTime.home ?? 0,
      awayScore: m.score.fullTime.away ?? 0,
    })),
    homeWins,
    awayWins,
    draws,
    homeGoalsAvg: Number(
      (team1GoalsTotal / (h2hMatches.length || 1)).toFixed(1)
    ),
    awayGoalsAvg: Number(
      (team2GoalsTotal / (h2hMatches.length || 1)).toFixed(1)
    ),
  };
}

/**
 * Calculate home vs away performance split for a team
 */
export function getHomeAwayStats(
  team: string,
  matches: NormalizedMatch[],
  lastN: number = 10
) {
  const homeMatches = matches
    .filter(
      m =>
        m.homeTeam.name === team && m.status === "FINISHED"
    )
    .slice(-lastN);

  const awayMatches = matches
    .filter(
      m =>
        m.awayTeam.name === team && m.status === "FINISHED"
    )
    .slice(-lastN);

  const calcStats = (games: NormalizedMatch[], isHome: boolean) => {
    let wins = 0,
      draws = 0;
    let goalsFor = 0,
      goalsAgainst = 0;

    for (const m of games) {
      const teamGoals = isHome ? m.score.fullTime.home : m.score.fullTime.away;
      const oppGoals = isHome ? m.score.fullTime.away : m.score.fullTime.home;
      goalsFor += teamGoals ?? 0;
      goalsAgainst += oppGoals ?? 0;

      if (teamGoals === oppGoals) draws++;
      else if (teamGoals! > oppGoals!) wins++;
    }

    const points = wins * 3 + draws * 1;
    const maxPoints = games.length * 3;
    const winPercent = games.length > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return { wins, draws, winPercent, goalsFor, goalsAgainst };
  };

  const home = calcStats(homeMatches, true);
  const away = calcStats(awayMatches, false);

  return {
    home: { ...home, matches: homeMatches.length },
    away: { ...away, matches: awayMatches.length },
  };
}

/**
 * Calculate advanced team metrics for accurate predictions
 */
export function getAdvancedTeamMetrics(
  team: string,
  matches: NormalizedMatch[],
  lastN: number = 10
) {
  const teamMatches = matches
    .filter(m => {
      const isHome = m.homeTeam.name === team;
      const isAway = m.awayTeam.name === team;
      return (isHome || isAway) && m.status === "FINISHED";
    })
    .slice(-lastN);

  if (teamMatches.length === 0) {
    return {
      team,
      cleanSheets: 0,
      cleanSheetPercent: 0,
      recentMomentum: "neutral",
      totalGoalsScored: 0,
      totalGoalsConceded: 0,
      overUnderGoalsAvg: 0,
      winRate: 0,
      drawRate: 0,
      lossRate: 0,
      avgShotsOnTarget: 0,
      consistency: "low",
    };
  }

  // Recent form (last 3 matches)
  const recentMatches = teamMatches.slice(-3);
  let recentWins = 0;
  for (const match of recentMatches) {
    const isHome = match.homeTeam.name === team;
    const teamGoals = isHome ? match.score.fullTime.home : match.score.fullTime.away;
    const oppGoals = isHome ? match.score.fullTime.away : match.score.fullTime.home;
    if (teamGoals! > oppGoals!) recentWins++;
  }

  // Clean sheets (matches where team conceded 0)
  let cleanSheets = 0;
  let totalGoalsScored = 0;
  let totalGoalsConceded = 0;
  
  for (const match of teamMatches) {
    const isHome = match.homeTeam.name === team;
    const teamGoals = isHome ? match.score.fullTime.home : match.score.fullTime.away;
    const oppGoals = isHome ? match.score.fullTime.away : match.score.fullTime.home;
    
    totalGoalsScored += teamGoals ?? 0;
    totalGoalsConceded += oppGoals ?? 0;
    
    if ((oppGoals ?? 0) === 0) cleanSheets++;
  }

  // Calculate win/draw/loss rates
  const form = calculateTeamForm(team, matches, lastN);
  const winRate = teamMatches.length > 0 ? Math.round((form.wins / teamMatches.length) * 100) : 0;
  const drawRate = teamMatches.length > 0 ? Math.round((form.draws / teamMatches.length) * 100) : 0;
  const lossRate = teamMatches.length > 0 ? Math.round((form.losses / teamMatches.length) * 100) : 0;

  // Total goals in matches (for Over/Under prediction)
  const totalGoalsInMatches = totalGoalsScored + totalGoalsConceded;
  const overUnderGoalsAvg = totalGoalsInMatches / teamMatches.length;

  // Consistency: low variance = high consistency
  const goalsArray = teamMatches.map(m => {
    const isHome = m.homeTeam.name === team;
    const tg = isHome ? m.score.fullTime.home : m.score.fullTime.away;
    return tg ?? 0;
  });
  const avgGoals = goalsArray.reduce((a, b) => a + b, 0) / goalsArray.length;
  const variance = goalsArray.reduce((sum, g) => sum + Math.pow(g - avgGoals, 2), 0) / goalsArray.length;
  const stdDev = Math.sqrt(variance);
  const consistency = stdDev < 1 ? "high" : stdDev < 1.5 ? "medium" : "low";

  // Momentum
  const recentMomentum =
    recentWins === 3 ? "excellent" :
    recentWins === 2 ? "good" :
    recentWins === 1 ? "neutral" :
    "poor";

  return {
    team,
    cleanSheets,
    cleanSheetPercent: Math.round((cleanSheets / teamMatches.length) * 100),
    recentMomentum,
    totalGoalsScored,
    totalGoalsConceded,
    overUnderGoalsAvg: Number(overUnderGoalsAvg.toFixed(2)),
    winRate,
    drawRate,
    lossRate,
    consistency,
  };
}

/**
 * Format advanced metrics for AI consumption
 */
export function formatAdvancedAnalyticsForAI(
  homeMetrics: ReturnType<typeof getAdvancedTeamMetrics>,
  awayMetrics: ReturnType<typeof getAdvancedTeamMetrics>,
  homeForm: TeamForm,
  awayForm: TeamForm
): string {
  return `
COMPREHENSIVE TEAM ANALYSIS:

${homeMetrics.team}:
  • Form: ${homeForm.formPercent}% (${homeForm.wins}W-${homeForm.draws}D-${homeForm.losses}L)
  • Attacking: ${homeForm.goalsPerGame} goals/game, ${homeMetrics.totalGoalsScored} total goals in last 10
  • Defense: ${homeForm.concededPerGame} conceded/game, ${homeMetrics.cleanSheets} clean sheets (${homeMetrics.cleanSheetPercent}%)
  • Momentum: ${homeMetrics.recentMomentum} (last 3 matches trend)
  • Win/Draw/Loss: ${homeMetrics.winRate}%/${homeMetrics.drawRate}%/${homeMetrics.lossRate}%
  • Consistency: ${homeMetrics.consistency} (${homeMetrics.totalGoalsScored} goals in ${homeForm.matches} matches)

${awayMetrics.team}:
  • Form: ${awayForm.formPercent}% (${awayForm.wins}W-${awayForm.draws}D-${awayForm.losses}L)
  • Attacking: ${awayForm.goalsPerGame} goals/game, ${awayMetrics.totalGoalsScored} total goals in last 10
  • Defense: ${awayForm.concededPerGame} conceded/game, ${awayMetrics.cleanSheets} clean sheets (${awayMetrics.cleanSheetPercent}%)
  • Momentum: ${awayMetrics.recentMomentum} (last 3 matches trend)
  • Win/Draw/Loss: ${awayMetrics.winRate}%/${awayMetrics.drawRate}%/${awayMetrics.lossRate}%
  • Consistency: ${awayMetrics.consistency} (${awayMetrics.totalGoalsScored} goals in ${awayForm.matches} matches)

GOAL PREDICTION INSIGHT:
  • ${homeMetrics.team} matches avg ${homeMetrics.overUnderGoalsAvg} total goals
  • ${awayMetrics.team} matches avg ${awayMetrics.overUnderGoalsAvg} total goals
  • Combined expected goals: ${(homeMetrics.overUnderGoalsAvg + awayMetrics.overUnderGoalsAvg).toFixed(1)}
`.trim();
}

/**
 * Format team form for AI consumption
 */
export function formatFormForAI(homeForm: TeamForm, awayForm: TeamForm): string {
  return `
TEAM FORM (Last ${homeForm.matches} matches):
Home: ${homeForm.team} — ${homeForm.wins}W-${homeForm.draws}D-${homeForm.losses}L (${homeForm.formPercent}%) | ${homeForm.goalsPerGame} goals/game | ${homeForm.concededPerGame} conceded/game
Away: ${awayForm.team} — ${awayForm.wins}W-${awayForm.draws}D-${awayForm.losses}L (${awayForm.formPercent}%) | ${awayForm.goalsPerGame} goals/game | ${awayForm.concededPerGame} conceded/game
`.trim();
}

/**
 * Format H2H for AI consumption
 */
export function formatH2HForAI(home: string, away: string, h2h: HeadToHead): string {
  const lastGames = h2h.lastMeetings
    .map(m => `${m.date.split("T")[0]}: ${m.home} ${m.homeScore}-${m.awayScore} ${m.away}`)
    .join(" | ");

  return `
HEAD-TO-HEAD (Last ${h2h.lastMeetings.length} meetings):
${home} record: ${h2h.homeWins} wins, ${h2h.draws} draws, ${h2h.awayWins} losses playing at home
${away} record: ${h2h.awayWins} wins, ${h2h.draws} draws, ${h2h.homeWins} losses playing away
Recent matches: ${lastGames}
Average goals: ${h2h.homeGoalsAvg} (home) vs ${h2h.awayGoalsAvg} (away)
`.trim();
}

/**
 * Extract and format match statistics for AI consumption
 * Combines stats from both teams for tactical insight
 */
export function formatMatchStatisticsForAI(
  homeTeam: string,
  awayTeam: string,
  homeStats: Record<string, any> = {},
  awayStats: Record<string, any> = {}
): string {
  // Helper to safely get stat value
  const getStat = (stats: Record<string, any>, key: string): number => {
    if (typeof stats[key] === "number") return stats[key];
    if (typeof stats[key] === "string") return parseFloat(stats[key]);
    return 0;
  };

  const homeShots = getStat(homeStats, "shotsOnGoal") || getStat(homeStats, "shots");
  const awayShots = getStat(awayStats, "shotsOnGoal") || getStat(awayStats, "shots");
  const homePossession = getStat(homeStats, "possession");
  const awayPossession = getStat(awayStats, "possession");
  const homeCorners = getStat(homeStats, "corners");
  const awayCorners = getStat(awayStats, "corners");
  const homeFouls = getStat(homeStats, "fouls");
  const awayFouls = getStat(awayStats, "fouls");
  const homeCards = getStat(homeStats, "yellow") + getStat(homeStats, "red");
  const awayCards = getStat(awayStats, "yellow") + getStat(awayStats, "red");
  const homePass = getStat(homeStats, "passAccuracy");
  const awayPass = getStat(awayStats, "passAccuracy");
  const homeXG = getStat(homeStats, "expectedGoals");
  const awayXG = getStat(awayStats, "expectedGoals");

  return `
MATCH STATISTICS ANALYSIS:

Possession & Ball Control:
  ${homeTeam}: ${homePossession}% | ${awayTeam}: ${awayPossession}%
  ${homePossession > awayPossession ? "→ " + homeTeam + " likely to dictate play" : "→ " + awayTeam + " likely to dictate play"}

Shooting & Finishing:
  ${homeTeam}: ${homeShots} shots on target | ${awayTeam}: ${awayShots} shots on target
  ${homeXG > 0 || awayXG > 0 ? `Expected Goals: ${homeXG} (${homeTeam}) vs ${awayXG} (${awayTeam})` : ""}

Creativity & Chances:
  Corners: ${homeTeam} ${homeCorners} vs ${awayTeam} ${awayCorners}
  ${homeCorners > awayCorners ? "→ " + homeTeam + " more crosses/set pieces" : "→ " + awayTeam + " more crosses/set pieces"}

Discipline:
  Cards: ${homeTeam} ${homeCards} vs ${awayTeam} ${awayCards}
  Fouls: ${homeTeam} ${homeFouls} vs ${awayTeam} ${awayFouls}
  ${homeCards > awayCards ? `⚠️ ${homeTeam} more aggressive (discipline risk)` : awayCards > homeCards ? `⚠️ ${awayTeam} more aggressive (discipline risk)` : "→ Balanced play expected"}

Passing Quality:
  ${homeTeam}: ${homePass}% accuracy | ${awayTeam}: ${awayPass}% accuracy
  ${Math.abs(homePass - awayPass) > 5 ? `→ ${homePass > awayPass ? homeTeam : awayTeam} has cleaner passing` : "→ Similar passing standards"}
`.trim();
}

/**
 * Format home/away advantage for AI
 */
export function formatHomeAwayForAI(
  homeTeam: string,
  awayTeam: string,
  homeAwayStats: { homeTeam: { winPercent: number; goalsPerGame: number }; awayTeam: { winPercent: number; goalsPerGame: number } }
): string {
  return `
HOME/AWAY FACTORS:
${homeTeam} (Home): ${homeAwayStats.homeTeam.winPercent}% win rate at home, ${homeAwayStats.homeTeam.goalsPerGame} goals/game
${awayTeam} (Away): ${homeAwayStats.awayTeam.winPercent}% win rate in away matches, ${homeAwayStats.awayTeam.goalsPerGame} goals/game
→ Home advantage expected: ${homeAwayStats.homeTeam.winPercent > 50 ? "significant boost" : "marginal boost"}
`.trim();
}
