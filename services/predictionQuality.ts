/**
 * services/predictionQuality.ts
 * 
 * Improves prediction accuracy through:
 * - Weighted recency scoring (recent form matters more)
 * - Momentum detection (is team improving/declining?)
 * - Confidence calibration (don't over-promise)
 * - Data quality validation
 */

import type { TeamForm } from "./teamAnalytics";
import type { NormalizedMatch } from "@/types/matches";

export interface FormWeighting {
  current5Games: number;      // Last 5 (weight: 2.0x)
  previous5Games: number;     // Games 6-10 (weight: 1.5x)
  older: number;              // Games 11+ (weight: 1.0x)
}

export interface TeamMomentum {
  trend: "improving" | "declining" | "stable";
  momentumScore: number;      // -1.0 to +1.0
  confidence: number;         // 0-100, how sure we are about the trend
  gameCountInTrend: number;   // How many games show this trend
}

export interface PredictionQuality {
  dataReliability: "high" | "medium" | "low";
  dataIssues: string[];       // Warnings about data quality
  suggestedConfidence?: "Low" | "Medium" | "High"; // Override AI confidence if data is weak
}

/**
 * Calculate form with recency weighting
 * More recent games have higher weight (recent = more predictive)
 */
export function calculateWeightedForm(
  team: string,
  matches: NormalizedMatch[],
  lastN: number = 10
): { baseForm: TeamForm; weightedForm: number; weighting: FormWeighting } {
  const teamMatches = matches
    .filter(m => {
      const isHome = m.homeTeam.name === team;
      const isAway = m.awayTeam.name === team;
      return (isHome || isAway) && m.status === "FINISHED";
    })
    .slice(-lastN);

  if (teamMatches.length === 0) {
    return {
      baseForm: {
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
      },
      weightedForm: 0,
      weighting: { current5Games: 0, previous5Games: 0, older: 0 },
    };
  }

  // Split matches by recency
  const current = teamMatches.slice(-5);    // Most recent 5 (weight 2.0x)
  const previous = teamMatches.slice(-10, -5); // Games 6-10 (weight 1.5x)
  const older = teamMatches.slice(0, -10);   // Games 11+ (weight 1.0x)

  // Calculate points for each group
  function getPoints(group: NormalizedMatch[]): number {
    let wins = 0, draws = 0;
    for (const m of group) {
      const isHome = m.homeTeam.name === team;
      const teamGoals = isHome ? m.score.fullTime.home : m.score.fullTime.away;
      const oppGoals = isHome ? m.score.fullTime.away : m.score.fullTime.home;
      if (teamGoals === oppGoals) draws++;
      else if (teamGoals! > oppGoals!) wins++;
    }
    const points = wins * 3 + draws * 1;
    const maxPoints = group.length * 3;
    return maxPoints > 0 ? (points / maxPoints) * 100 : 0;
  }

  const current5Form = getPoints(current);
  const previous5Form = getPoints(previous);
  const olderForm = getPoints(older.length > 0 ? older : []);

  // Weighted average (recent games matter more)
  const totalWeight = current.length * 2.0 + previous.length * 1.5 + older.length * 1.0;
  const weightedForm =
    totalWeight > 0
      ? (current5Form * current.length * 2.0 + previous5Form * previous.length * 1.5 + olderForm * older.length * 1.0) / totalWeight
      : 0;

  // Calculate base form for reference
  let baseWins = 0, baseDraws = 0;
  for (const m of teamMatches) {
    const isHome = m.homeTeam.name === team;
    const teamGoals = isHome ? m.score.fullTime.home : m.score.fullTime.away;
    const oppGoals = isHome ? m.score.fullTime.away : m.score.fullTime.home;
    if (teamGoals === oppGoals) baseDraws++;
    else if (teamGoals! > oppGoals!) baseWins++;
  }

  return {
    baseForm: {
      team,
      matches: teamMatches.length,
      wins: baseWins,
      draws: baseDraws,
      losses: teamMatches.length - baseWins - baseDraws,
      formPercent: Math.round(((baseWins * 3 + baseDraws * 1) / (teamMatches.length * 3)) * 100),
      goalsFor: teamMatches.reduce((sum, m) => {
        const isHome = m.homeTeam.name === team;
        return sum + (isHome ? (m.score.fullTime.home ?? 0) : (m.score.fullTime.away ?? 0));
      }, 0),
      goalsAgainst: teamMatches.reduce((sum, m) => {
        const isHome = m.homeTeam.name === team;
        return sum + (isHome ? (m.score.fullTime.away ?? 0) : (m.score.fullTime.home ?? 0));
      }, 0),
      goalDiff: 0,
      goalsPerGame: 0,
      concededPerGame: 0,
    },
    weightedForm: Math.round(weightedForm),
    weighting: {
      current5Games: current5Form,
      previous5Games: previous5Form,
      older: olderForm,
    },
  };
}

/**
 * Detect if team is improving or declining
 * Compares recent form to older form
 */
export function detectMomentum(
  team: string,
  matches: NormalizedMatch[],
  lastN: number = 10
): TeamMomentum {
  const teamMatches = matches
    .filter(m => {
      const isHome = m.homeTeam.name === team;
      const isAway = m.awayTeam.name === team;
      return (isHome || isAway) && m.status === "FINISHED";
    })
    .slice(-lastN);

  if (teamMatches.length < 6) {
    return {
      trend: "stable",
      momentumScore: 0,
      confidence: 0,
      gameCountInTrend: 0,
    };
  }

  const recent = teamMatches.slice(-5);
  const older = teamMatches.slice(0, -5);

  function getWinRate(games: NormalizedMatch[]): number {
    if (games.length === 0) return 0;
    let wins = 0;
    for (const m of games) {
      const isHome = m.homeTeam.name === team;
      const teamGoals = isHome ? m.score.fullTime.home : m.score.fullTime.away;
      const oppGoals = isHome ? m.score.fullTime.away : m.score.fullTime.home;
      if (teamGoals! > oppGoals!) wins++;
    }
    return (wins / games.length) * 100;
  }

  const recentWinRate = getWinRate(recent);
  const olderWinRate = getWinRate(older);
  const diff = recentWinRate - olderWinRate;

  // Momentum score: -1.0 (declining) to +1.0 (improving)
  const momentumScore = Math.max(-1, Math.min(1, diff / 100));

  const trend = diff > 10 ? "improving" : diff < -10 ? "declining" : "stable";

  return {
    trend,
    momentumScore,
    confidence: Math.abs(diff), // Confidence is how big the difference is
    gameCountInTrend: recent.length,
  };
}

/**
 * Assess prediction data quality
 * Warn if data is insufficient or unreliable
 */
export function assessPredictionQuality(
  homeTeam: string,
  awayTeam: string,
  homeForm: TeamForm,
  awayForm: TeamForm,
  h2hCount: number,
  hasStatistics: boolean
): PredictionQuality {
  const issues: string[] = [];
  let dataReliability: "high" | "medium" | "low" = "high";

  // Check recent form data
  if (homeForm.matches < 5 || awayForm.matches < 5) {
    issues.push(`Insufficient recent form data (${homeForm.matches} and ${awayForm.matches} games)`);
    dataReliability = "low";
  } else if (homeForm.matches < 8 || awayForm.matches < 8) {
    issues.push(`Limited recent form data (${homeForm.matches} and ${awayForm.matches} games)`);
    dataReliability = dataReliability === "high" ? "medium" : dataReliability;
  }

  // Check H2H data
  if (h2hCount < 2) {
    issues.push("No recent head-to-head history (less than 2 meetings)");
    dataReliability = dataReliability === "high" ? "medium" : "low";
  } else if (h2hCount < 3) {
    issues.push("Limited head-to-head history (only 2 meetings)");
    dataReliability = dataReliability === "high" ? "medium" : dataReliability;
  }

  // Check statistics
  if (!hasStatistics) {
    issues.push("Match statistics not available");
    dataReliability = dataReliability === "high" ? "medium" : dataReliability;
  }

  // Check form gap (very different form levels)
  const formGap = Math.abs(homeForm.formPercent - awayForm.formPercent);
  if (formGap > 50) {
    issues.push("Extreme form difference between teams (likely one-sided match)");
  }

  // Suggest confidence override
  let suggestedConfidence: "Low" | "Medium" | "High" | undefined;
  if (dataReliability === "low") {
    suggestedConfidence = "Low";
  } else if (dataReliability === "medium" && issues.length > 2) {
    suggestedConfidence = "Low";
  } else if (dataReliability === "medium") {
    suggestedConfidence = "Medium";
  }

  return {
    dataReliability,
    dataIssues: issues,
    suggestedConfidence,
  };
}

/**
 * Generate data quality message for UI
 */
export function getQualityMessage(quality: PredictionQuality): string | null {
  if (quality.dataIssues.length === 0) return null;

  if (quality.dataReliability === "low") {
    return `⚠️ Low confidence prediction: ${quality.dataIssues[0]} — Use with caution.`;
  } else if (quality.dataReliability === "medium") {
    return `📊 Medium confidence: ${quality.dataIssues[0]}`;
  }

  return null;
}
