/**
 * services/predictionAnalytics.ts
 * 
 * Analyzes prediction accuracy across dimensions:
 * - Time periods (7d, 30d, all time)
 * - Confidence levels (High, Medium, Low)
 * - Data reliability (high, medium, low)
 * - Betting markets (Over/Under, BTTS, etc)
 * - Competitions (Premier League, Champions League, etc)
 */

import { prisma } from "@/services/prisma";

export interface AccuracyMetrics {
  totalPredictions: number;
  correctPredictions: number;
  accuracyPercent: number;
  confidenceInterval95: [number, number]; // Lower, Upper
}

export interface ConfidenceBreakdown {
  high: AccuracyMetrics;
  medium: AccuracyMetrics;
  low: AccuracyMetrics;
}

export interface DataQualityAnalysis {
  high: AccuracyMetrics;
  medium: AccuracyMetrics;
  low: AccuracyMetrics;
  correlationWithAccuracy: number; // -1 to 1
}

export interface MarketAnalysis {
  bestMarkets: Array<{
    market: string;
    count: number;
    accuracy: number;
  }>;
  worstMarkets: Array<{
    market: string;
    count: number;
    accuracy: number;
  }>;
}

export interface CompetitionAnalysis {
  [competition: string]: {
    predictions: number;
    accuracy: number;
    confidence: string;
  };
}

export interface DashboardStats {
  period: string;
  overall: AccuracyMetrics;
  byConfidence: ConfidenceBreakdown;
  byDataQuality: DataQualityAnalysis;
  markets: MarketAnalysis;
  competitions: CompetitionAnalysis;
  trends: {
    weeklyAccuracy: Array<{
      week: string;
      accuracy: number;
      predictions: number;
    }>;
    accuracyTrend: "improving" | "declining" | "stable";
  };
}

/**
 * Calculate 95% confidence interval for accuracy using Wilson score interval
 */
function calculateConfidenceInterval(
  successes: number,
  total: number,
  confidence: number = 0.95
): [number, number] {
  if (total === 0) return [0, 100];
  
  const z = 1.96; // 95% confidence
  const p = successes / total;
  const denominator = 1 + z * z / total;
  
  const centre = (p + z * z / (2 * total)) / denominator;
  const adjustment = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  
  const lower = Math.max(0, (centre - adjustment) * 100);
  const upper = Math.min(100, (centre + adjustment) * 100);
  
  return [Math.round(lower), Math.round(upper)];
}

/**
 * Get predictions for a time period
 */
function getPredictionQuery(period: "7d" | "30d" | "all-time") {
  const since = new Date();
  
  switch (period) {
    case "7d":
      since.setDate(since.getDate() - 7);
      break;
    case "30d":
      since.setDate(since.getDate() - 30);
      break;
    case "all-time":
      return { matchCompletedAt: { not: null } };
  }
  
  return {
    matchCompletedAt: { gte: since, not: null },
  };
}

/**
 * Calculate accuracy metrics for a set of predictions
 */
function calculateMetrics(predictions: any[]): AccuracyMetrics {
  if (predictions.length === 0) {
    return {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracyPercent: 0,
      confidenceInterval95: [0, 0],
    };
  }

  const correct = predictions.filter(p => p.outcomeCorrect).length;
  const percent = Math.round((correct / predictions.length) * 100);
  const ci = calculateConfidenceInterval(correct, predictions.length);

  return {
    totalPredictions: predictions.length,
    correctPredictions: correct,
    accuracyPercent: percent,
    confidenceInterval95: ci,
  };
}

/**
 * Analyze accuracy by confidence level
 */
async function analyzeByConfidence(
  where: any
): Promise<ConfidenceBreakdown> {
  const confidenceLevels = ["High", "Medium", "Low"] as const;
  const result: any = {};

  for (const level of confidenceLevels) {
    const predictions = await prisma.prediction.findMany({
      where: { ...where, confidence: level },
    });
    result[level.toLowerCase()] = calculateMetrics(predictions);
  }

  return result;
}

/**
 * Analyze accuracy by data quality
 */
async function analyzeByDataQuality(where: any): Promise<DataQualityAnalysis> {
  const reliabilityLevels = ["high", "medium", "low"] as const;
  const result: any = {};

  for (const level of reliabilityLevels) {
    const predictions = await prisma.prediction.findMany({
      where: { ...where, dataReliability: level },
    });
    result[level] = calculateMetrics(predictions);
  }

  // Calculate correlation: does better data = better accuracy?
  const allPredictions = await prisma.prediction.findMany({ where });
  
  const byReliability: Record<string, number[]> = {
    high: [],
    medium: [],
    low: [],
  };

  for (const pred of allPredictions) {
    byReliability[pred.dataReliability as string].push(pred.outcomeCorrect ? 1 : 0);
  }

  const highAccuracy = byReliability.high.length > 0
    ? (byReliability.high.reduce((a, b) => a + b) / byReliability.high.length)
    : 0;
  const lowAccuracy = byReliability.low.length > 0
    ? (byReliability.low.reduce((a, b) => a + b) / byReliability.low.length)
    : 0;

  // Simple correlation: how much does going from low to high improve accuracy?
  const correlation = lowAccuracy > 0
    ? ((highAccuracy - lowAccuracy) / lowAccuracy)
    : 0;

  result.correlationWithAccuracy = Math.min(1, Math.max(-1, correlation));

  return result as DataQualityAnalysis;
}

/**
 * Analyze best/worst betting markets
 */
async function analyzeMarkets(where: any): Promise<MarketAnalysis> {
  const predictions = await prisma.prediction.findMany({
    where,
    select: { bestBet: true, outcomeCorrect: true },
  });

  const marketStats: Record<string, { correct: number; total: number }> = {};

  for (const pred of predictions) {
    const market = pred.bestBet || "Other";
    if (!marketStats[market]) {
      marketStats[market] = { correct: 0, total: 0 };
    }
    marketStats[market].total++;
    if (pred.outcomeCorrect) {
      marketStats[market].correct++;
    }
  }

  const markets = Object.entries(marketStats)
    .filter(([_, stats]) => stats.total >= 3) // Need at least 3 predictions
    .map(([market, stats]) => ({
      market,
      count: stats.total,
      accuracy: Math.round((stats.correct / stats.total) * 100),
    }))
    .sort((a, b) => b.accuracy - a.accuracy);

  return {
    bestMarkets: markets.slice(0, 5),
    worstMarkets: markets.slice(-5).reverse(),
  };
}

/**
 * Analyze accuracy by competition
 */
async function analyzeCompetitions(where: any): Promise<CompetitionAnalysis> {
  const predictions = await prisma.prediction.findMany({
    where,
    select: { competition: true, outcomeCorrect: true, confidence: true },
  });

  const compStats: Record<
    string,
    { correct: number; total: number; highConf: number }
  > = {};

  for (const pred of predictions) {
    const comp = pred.competition || "Other";
    if (!compStats[comp]) {
      compStats[comp] = { correct: 0, total: 0, highConf: 0 };
    }
    compStats[comp].total++;
    if (pred.outcomeCorrect) {
      compStats[comp].correct++;
    }
    if (pred.confidence === "High") {
      compStats[comp].highConf++;
    }
  }

  const result: CompetitionAnalysis = {};
  for (const [comp, stats] of Object.entries(compStats)) {
    result[comp] = {
      predictions: stats.total,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      confidence: stats.highConf > stats.total * 0.5 ? "High" : "Medium",
    };
  }

  return result;
}

/**
 * Calculate weekly accuracy trend
 */
async function calculateWeeklyTrend(where: any) {
  const predictions = await prisma.prediction.findMany({
    where,
    select: { matchCompletedAt: true, outcomeCorrect: true },
    orderBy: { matchCompletedAt: "asc" },
  });

  const weeklyData: Record<
    string,
    { correct: number; total: number }
  > = {};

  for (const pred of predictions) {
    if (!pred.matchCompletedAt) continue;
    
    // Get week starting Monday
    const date = new Date(pred.matchCompletedAt);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const weekKey = monday.toISOString().split("T")[0];

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { correct: 0, total: 0 };
    }
    weeklyData[weekKey].total++;
    if (pred.outcomeCorrect) {
      weeklyData[weekKey].correct++;
    }
  }

  const weeklyAccuracy = Object.entries(weeklyData)
    .map(([week, stats]) => ({
      week,
      accuracy: Math.round((stats.correct / stats.total) * 100),
      predictions: stats.total,
    }))
    .slice(-12); // Last 12 weeks

  // Determine trend
  let trend: "improving" | "declining" | "stable" = "stable";
  if (weeklyAccuracy.length >= 4) {
    const recent = weeklyAccuracy.slice(-4).map(w => w.accuracy).reduce((a, b) => a + b) / 4;
    const older = weeklyAccuracy.slice(-8, -4).map(w => w.accuracy).reduce((a, b) => a + b) / 4;
    
    if (recent > older + 5) trend = "improving";
    else if (recent < older - 5) trend = "declining";
  }

  return { weeklyAccuracy, trend };
}

/**
 * Get comprehensive dashboard stats for a period
 */
export async function getDashboardStats(
  period: "7d" | "30d" | "all-time" = "30d"
): Promise<DashboardStats> {
  try {
    const where = getPredictionQuery(period);

    // Get all predictions
    const allPredictions = await prisma.prediction.findMany({
      where,
    });

    // Calculate all metrics in parallel
    const [
      byConfidence,
      byDataQuality,
      markets,
      competitions,
      { weeklyAccuracy, trend: accuracyTrend },
    ] = await Promise.all([
      analyzeByConfidence(where),
      analyzeByDataQuality(where),
      analyzeMarkets(where),
      analyzeCompetitions(where),
      calculateWeeklyTrend(where),
    ]);

    const overall = calculateMetrics(allPredictions);

    return {
      period,
      overall,
      byConfidence,
      byDataQuality,
      markets,
      competitions,
      trends: {
        weeklyAccuracy,
        accuracyTrend,
      },
    };
  } catch (err) {
    console.error("[Analytics] Failed to get dashboard stats:", err);
    throw err;
  }
}

/**
 * Compare accuracy across two periods
 */
export async function comparePeriods(
  period1: "7d" | "30d" | "all-time",
  period2: "7d" | "30d" | "all-time"
) {
  const stats1 = await getDashboardStats(period1);
  const stats2 = await getDashboardStats(period2);

  return {
    [period1]: stats1,
    [period2]: stats2,
    improvement: stats2.overall.accuracyPercent - stats1.overall.accuracyPercent,
  };
}

/**
 * Get predictions failing to meet accuracy threshold
 */
export async function getProblemPredictions(
  threshold: number = 50,
  limit: number = 20
) {
  try {
    const predictions = await prisma.prediction.findMany({
      where: {
        confidence: "High",
        outcomeCorrect: false,
        matchCompletedAt: { not: null },
      },
      orderBy: { matchCompletedAt: "desc" },
      take: limit,
    });

    // Group by issues
    const issueGroups: Record<string, number> = {};
    for (const pred of predictions) {
      for (const issue of pred.dataIssues) {
        issueGroups[issue] = (issueGroups[issue] || 0) + 1;
      }
    }

    return {
      failedHighConfidence: predictions.length,
      commonIssues: Object.entries(issueGroups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([issue, count]) => ({ issue, count })),
      examples: predictions.slice(0, 5),
    };
  } catch (err) {
    console.error("[Analytics] Failed to get problem predictions:", err);
    return null;
  }
}
