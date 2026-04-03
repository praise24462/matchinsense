/**
 * services/confidenceCalibration.ts
 * 
 * Advanced confidence level determination based on:
 * - Data quality and availability
 * - Recent form strength
 * - Head-to-head history
 * - Home/away advantage
 * - Momentum indicators
 * - External factors (injuries, weather)
 */

export interface ConfidenceScore {
  level: "Low" | "Medium" | "High";
  score: number; // 0-100
  factors: ConfidenceFactor[];
  reasoning: string;
}

export interface ConfidenceFactor {
  name: string;
  impact: number; // -30 to +30
  reason: string;
}

/**
 * Calculate overall confidence score
 * Based on data availability, form strength, and pattern clarity
 */
export function calculateConfidence(
  dataPoints: {
    recentFormGames?: number;      // How many recent matches available (max 10 for full impact)
    homeTeamFormPercent?: number;  // Win percentage (0-100)
    awayTeamFormPercent?: number;  // Win percentage (0-100)
    h2hMeetings?: number;          // Number of head-to-head matches (max 5)
    h2hHomeWins?: number;          // Home team wins in H2H
    h2hAwayWins?: number;          // Away team wins in H2H
    homeAwayStrength?: number;     // -100 to +100, positive = home has advantage
    homeWeightedForm?: number;     // 0-100, recent form
    awayWeightedForm?: number;     // 0-100, recent form
    homeMomentum?: "declining" | "stable" | "improving";
    awayMomentum?: "declining" | "stable" | "improving";
    hasStatistics?: boolean;       // Real match statistics available?
    homeInjuryCount?: number;      // Critical player absences
    awayInjuryCount?: number;      // Critical player absences
    weatherSevere?: boolean;       // Will weather be a major factor?
  } = {}
): ConfidenceScore {
  const factors: ConfidenceFactor[] = [];
  let confidenceScore = 50; // Start at 50%

  // ── FACTOR 1: Form Data Quality ────────────────────────────────────────
  const recentFormGames = dataPoints.recentFormGames ?? 0;
  if (recentFormGames >= 10) {
    factors.push({
      name: "Form Data Quality",
      impact: +20,
      reason: "Strong available form data (10+ recent matches)"
    });
    confidenceScore += 20;
  } else if (recentFormGames >= 5) {
    factors.push({
      name: "Form Data Quality",
      impact: +10,
      reason: `Moderate form data (${recentFormGames} recent matches)`
    });
    confidenceScore += 10;
  } else {
    factors.push({
      name: "Form Data Quality",
      impact: -15,
      reason: `Weak form data (${recentFormGames} recent matches, need 5+)`
    });
    confidenceScore -= 15;
  }

  // ── FACTOR 2: Form Strength (how dominant is the form?) ─────────────────
  const homeForm = dataPoints.homeTeamFormPercent ?? 0;
  const awayForm = dataPoints.awayTeamFormPercent ?? 0;

  if (homeForm > 70 || awayForm > 70) {
    factors.push({
      name: "Form Dominance",
      impact: +15,
      reason: `One team has strong form (${Math.max(homeForm, awayForm)}%)`
    });
    confidenceScore += 15;
  } else if (homeForm > 50 && awayForm > 50) {
    factors.push({
      name: "Form Parity",
      impact: -10,
      reason: `Both teams performing similarly (${homeForm}% vs ${awayForm}%) - unpredictable`
    });
    confidenceScore -= 10;
  } else if ((homeForm > 60 && awayForm < 40) || (awayForm > 60 && homeForm < 40)) {
    factors.push({
      name: "Form Disparity",
      impact: +20,
      reason: `Clear form advantage: ${homeForm > awayForm ? "Home" : "Away"} team leading`
    });
    confidenceScore += 20;
  }

  // ── FACTOR 3: Head-to-Head History ────────────────────────────────────
  const h2hMeetings = dataPoints.h2hMeetings ?? 0;
  const h2hHomeWins = dataPoints.h2hHomeWins ?? 0;
  const h2hAwayWins = dataPoints.h2hAwayWins ?? 0;

  if (h2hMeetings >= 5) {
    // Check if there's a clear pattern
    const homeWinRate = h2hHomeWins / h2hMeetings;
    const awayWinRate = h2hAwayWins / h2hMeetings;

    if (homeWinRate > 0.6 || awayWinRate > 0.6) {
      factors.push({
        name: "H2H Pattern",
        impact: +18,
        reason: `Clear H2H trend (${homeWinRate > awayWinRate ? "Home" : "Away"} team dominates recent meetings)`
      });
      confidenceScore += 18;
    } else {
      factors.push({
        name: "H2H Data",
        impact: +8,
        reason: `Good H2H history (${h2hMeetings} meetings) but no clear pattern`
      });
      confidenceScore += 8;
    }
  } else if (h2hMeetings >= 2) {
    factors.push({
      name: "H2H History",
      impact: +5,
      reason: `Limited H2H history (${h2hMeetings} meetings, ideal is 5+)`
    });
    confidenceScore += 5;
  } else {
    factors.push({
      name: "H2H Data",
      impact: -8,
      reason: `No significant H2H history - teams unfamiliar with each other`
    });
    confidenceScore -= 8;
  }

  // ── FACTOR 4: Home/Away Advantage ──────────────────────────────────────
  const homeAwayDiff = dataPoints.homeAwayStrength ?? 0;

  if (Math.abs(homeAwayDiff) > 20) {
    factors.push({
      name: "Home/Away Factor",
      impact: +12,
      reason: `Strong home/away split favors ${homeAwayDiff > 0 ? "home" : "away"} team`
    });
    confidenceScore += 12;
  } else if (Math.abs(homeAwayDiff) > 10) {
    factors.push({
      name: "Home/Away Factor",
      impact: +6,
      reason: `Moderate home/away advantage`
    });
    confidenceScore += 6;
  }

  // ── FACTOR 5: Recent Weighted Form (momentum) ──────────────────────────
  const homeWeighted = dataPoints.homeWeightedForm ?? 0;
  const awayWeighted = dataPoints.awayWeightedForm ?? 0;

  if (Math.abs(homeWeighted - awayWeighted) > 20) {
    factors.push({
      name: "Recent Momentum",
      impact: +12,
      reason: `Clear recent form divergence - recent games show clear trend`
    });
    confidenceScore += 12;
  }

  // ── FACTOR 6: Momentum Trends ──────────────────────────────────────────
  const homeMomentum = dataPoints.homeMomentum ?? "stable";
  const awayMomentum = dataPoints.awayMomentum ?? "stable";

  if (
    (homeMomentum === "improving" && awayMomentum === "declining") ||
    (homeMomentum === "declining" && awayMomentum === "improving")
  ) {
    factors.push({
      name: "Momentum Divergence",
      impact: +10,
      reason: `Teams moving in opposite directions - ${homeMomentum === "improving" ? "Home" : "Away"} gaining form`
    });
    confidenceScore += 10;
  } else if (homeMomentum === "stable" && awayMomentum === "stable") {
    factors.push({
      name: "Form Consistency",
      impact: +5,
      reason: `Both teams showing consistent form patterns`
    });
    confidenceScore += 5;
  }

  // ── FACTOR 7: Match Statistics ────────────────────────────────────────
  if (dataPoints.hasStatistics) {
    factors.push({
      name: "Match Data",
      impact: +8,
      reason: `Live match statistics available for analysis`
    });
    confidenceScore += 8;
  }

  // ── FACTOR 8: Injuries (negative impact on confidence) ─────────────────
  const homeInjuries = dataPoints.homeInjuryCount ?? 0;
  const awayInjuries = dataPoints.awayInjuryCount ?? 0;

  if (homeInjuries > 2 || awayInjuries > 2) {
    factors.push({
      name: "Key Player Absences",
      impact: -25,
      reason: `Multiple key players out - unpredictable squad disruption`
    });
    confidenceScore -= 25;
  } else if (homeInjuries > 0 || awayInjuries > 0) {
    factors.push({
      name: "Player Absences",
      impact: -15,
      reason: `One or more important players unavailable`
    });
    confidenceScore -= 15;
  }

  // ── FACTOR 9: Weather Impact ───────────────────────────────────────────
  if (dataPoints.weatherSevere) {
    factors.push({
      name: "Weather Conditions",
      impact: -12,
      reason: `Severe weather will affect match unpredictably`
    });
    confidenceScore -= 12;
  }

  // ── Clamp confidence between 20-95 (never 0% or 100%) ──────────────────
  confidenceScore = Math.max(20, Math.min(95, confidenceScore));

  // Determine level based on score
  let level: "Low" | "Medium" | "High";
  if (confidenceScore >= 70) {
    level = "High";
  } else if (confidenceScore >= 45) {
    level = "Medium";
  } else {
    level = "Low";
  }

  // Build reasoning summary
  let reasoning = `\n📊 CONFIDENCE CALCULATION (${confidenceScore}/100): ${level}`;
  reasoning += "\n\nFACTORS:";
  for (const factor of factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))) {
    const sign = factor.impact > 0 ? "+" : "";
    reasoning += `\n  ${sign}${factor.impact} — ${factor.name}: ${factor.reason}`;
  }

  reasoning += `\n\nBased on these factors, this prediction has ${level} confidence.`;
  if (level === "Low") {
    reasoning += " Consider this prediction cautiously - too much uncertainty.";
  } else if (level === "Medium") {
    reasoning += " This is a reasonable bet but keep expectations realistic.";
  } else {
    reasoning += " Data strongly supports this prediction.";
  }

  return {
    level,
    score: confidenceScore,
    factors,
    reasoning
  };
}

/**
 * Format confidence explanation for AI output
 */
export function formatConfidenceExplanation(confidence: ConfidenceScore): string {
  return confidence.reasoning;
}

/**
 * Adjust confidence based on market odds if comparing
 */
export function adjustConfidenceByOdds(
  confidence: ConfidenceScore,
  impliedProbability: number // From betting odds (0-100%)
): ConfidenceScore {
  // If our confidence aligns with market odds, increase it slightly
  // If it diverges significantly, this might be a value bet
  
  const divergence = Math.abs(confidence.score - impliedProbability);
  
  if (confidence.score > impliedProbability + 10) {
    // We're more confident than the market - value bet
    return {
      ...confidence,
      factors: [
        ...confidence.factors,
        {
          name: "Market Divergence",
          impact: +5,
          reason: `Our analysis (+${confidence.score}) exceeds market odds (${impliedProbability}%) - potential value`
        }
      ]
    };
  } else if (impliedProbability > confidence.score + 10) {
    // Market is more confident than us - respect the market
    return {
      ...confidence,
      factors: [
        ...confidence.factors,
        {
          name: "Market Caution",
          impact: -5,
          reason: `Market odds (${impliedProbability}%) exceed our analysis (+${confidence.score}%) - be cautious`
        }
      ]
    };
  }

  return confidence;
}
