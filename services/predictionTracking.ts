/**
 * services/predictionTracking.ts
 * 
 * Saves predictions to database and tracks accuracy over time
 * Enables historical accuracy reporting and trend analysis
 */

import { prisma } from "@/services/prisma";

export interface SavedPrediction {
  matchId: number;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  source: string;
  
  predictedHome: number | null;
  predictedAway: number | null;
  predictedOutcome: "home" | "draw" | "away";
  confidence: "Low" | "Medium" | "High";
  bestBet: string;
  reasoning: string;
  
  dataReliability: "high" | "medium" | "low";
  dataIssues: string[];
  
  homeWeightedForm: number;
  awayWeightedForm: number;
  homeMomentum: "improving" | "declining" | "stable";
  awayMomentum: "improving" | "declining" | "stable";
}

/**
 * Save a prediction to the database
 */
export async function savePrediction(data: SavedPrediction): Promise<string> {
  try {
    const prediction = await prisma.prediction.create({
      data: {
        matchId: data.matchId,
        matchDate: new Date(data.matchDate),
        homeTeam: data.homeTeam,
        awayTeam: data.awayTeam,
        competition: data.competition,
        source: data.source,
        predictedHome: data.predictedHome,
        predictedAway: data.predictedAway,
        predictedOutcome: data.predictedOutcome,
        confidence: data.confidence,
        bestBet: data.bestBet,
        reasoning: data.reasoning,
        dataReliability: data.dataReliability,
        dataIssues: data.dataIssues,
        homeWeightedForm: data.homeWeightedForm,
        awayWeightedForm: data.awayWeightedForm,
        homeMomentum: data.homeMomentum,
        awayMomentum: data.awayMomentum,
      },
    });
    
    console.log(`[Prediction] Saved prediction for ${data.homeTeam} vs ${data.awayTeam}`);
    return prediction.id;
  } catch (err) {
    console.error("[Prediction] Failed to save prediction:", err);
    throw err;
  }
}

/**
 * Update prediction with actual result (call this after match finishes)
 */
export async function updatePredictionResult(
  matchId: number,
  actualHome: number,
  actualAway: number
): Promise<void> {
  try {
    const actualOutcome = 
      actualHome > actualAway ? "home" : 
      actualAway > actualHome ? "away" : 
      "draw";

    const predictions = await prisma.prediction.findMany({
      where: { matchId },
    });

    for (const pred of predictions) {
      const outcomeCorrect = pred.predictedOutcome === actualOutcome;
      const scoreCorrect = 
        pred.predictedHome === actualHome && 
        pred.predictedAway === actualAway;
      
      // "Correct" if outcome is right or very close on score
      const wasCorrect = 
        outcomeCorrect || 
        (pred.predictedHome && pred.predictedAway && 
         Math.abs(pred.predictedHome - actualHome) <= 1 && 
         Math.abs(pred.predictedAway - actualAway) <= 1);

      await prisma.prediction.update({
        where: { id: pred.id },
        data: {
          actualHome,
          actualAway,
          actualOutcome,
          outcomeCorrect,
          scoreCorrect,
          wasCorrect,
          matchCompletedAt: new Date(),
        },
      });
    }

    console.log(`[Prediction] Updated ${predictions.length} predictions for match ${matchId}`);
    
    // Recalculate stats after prediction is updated
    await recalculateStats();
  } catch (err) {
    console.error("[Prediction] Failed to update prediction result:", err);
  }
}

/**
 * Get predictions by confidence level
 */
export async function getPredictionsByConfidence(
  confidence: "Low" | "Medium" | "High",
  limit: number = 50
) {
  try {
    return await prisma.prediction.findMany({
      where: { 
        confidence,
        matchCompletedAt: { not: null }, // Only completed matches
      },
      orderBy: { matchCompletedAt: "desc" },
      take: limit,
    });
  } catch (err) {
    console.error("[Prediction] Failed to fetch predictions by confidence:", err);
    return [];
  }
}

/**
 * Get recent predictions with results
 */
export async function getRecentPredictions(days: number = 30, limit: number = 100) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - days);
    
    return await prisma.prediction.findMany({
      where: {
        predictionDate: { gte: since },
      },
      orderBy: { predictionDate: "desc" },
      take: limit,
    });
  } catch (err) {
    console.error("[Prediction] Failed to fetch recent predictions:", err);
    return [];
  }
}

/**
 * Calculate overall accuracy stats
 */
export async function calculateAccuracyStats(days?: number) {
  try {
    const where = days 
      ? {
          matchCompletedAt: {
            gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
          },
        }
      : {};

    const predictions = await prisma.prediction.findMany({
      where: {
        ...where,
        matchCompletedAt: { not: null },
      },
    });

    if (predictions.length === 0) {
      return {
        totalPredictions: 0,
        correctPredictions: 0,
        accuracyPercent: 0,
        byConfidence: {},
        byDataReliability: {},
      };
    }

    // Overall
    const correct = predictions.filter((p: any) => p.outcomeCorrect).length;
    const accuracyPercent = Math.round((correct / predictions.length) * 100);

    // By confidence
    const byConfidence: Record<string, { total: number; correct: number; percent: number }> = {};
    for (const conf of ["High", "Medium", "Low"]) {
      const confPreds = predictions.filter((p: any) => p.confidence === conf);
      const confCorrect = confPreds.filter((p: any) => p.outcomeCorrect).length;
      byConfidence[conf] = {
        total: confPreds.length,
        correct: confCorrect,
        percent: confPreds.length > 0 ? Math.round((confCorrect / confPreds.length) * 100) : 0,
      };
    }

    // By data reliability
    const byDataReliability: Record<string, { total: number; correct: number; percent: number }> = {};
    for (const rel of ["high", "medium", "low"]) {
      const relPreds = predictions.filter((p: any) => p.dataReliability === rel);
      const relCorrect = relPreds.filter((p: any) => p.outcomeCorrect).length;
      byDataReliability[rel] = {
        total: relPreds.length,
        correct: relCorrect,
        percent: relPreds.length > 0 ? Math.round((relCorrect / relPreds.length) * 100) : 0,
      };
    }

    return {
      totalPredictions: predictions.length,
      correctPredictions: correct,
      accuracyPercent,
      byConfidence,
      byDataReliability,
    };
  } catch (err) {
    console.error("[Prediction] Failed to calculate accuracy stats:", err);
    return {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracyPercent: 0,
      byConfidence: {},
      byDataReliability: {},
    };
  }
}

/**
 * Recalculate and save stats to PredictionStats table
 */
export async function recalculateStats(): Promise<void> {
  try {
    // Calculate for different periods
    const periods = [
      { name: "7d", days: 7 },
      { name: "30d", days: 30 },
      { name: "all-time", days: null },
    ];

    for (const period of periods) {
      const stats = await calculateAccuracyStats(period.days ?? undefined);
      
      const now = new Date();
      const startDate = period.days 
        ? new Date(now.getTime() - period.days * 24 * 60 * 60 * 1000)
        : new Date(2020, 0, 1); // Beginning of time

      await prisma.predictionStats.upsert({
        where: {
          period_startDate: {
            period: period.name,
            startDate,
          },
        },
        create: {
          period: period.name,
          startDate,
          totalPredictions: stats.totalPredictions,
          correctPredictions: stats.correctPredictions,
          accuracyPercent: stats.accuracyPercent,
          highConfidenceTotal: stats.byConfidence["High"]?.total ?? 0,
          highConfidenceCorrect: stats.byConfidence["High"]?.correct ?? 0,
          mediumConfidenceTotal: stats.byConfidence["Medium"]?.total ?? 0,
          mediumConfidenceCorrect: stats.byConfidence["Medium"]?.correct ?? 0,
          lowConfidenceTotal: stats.byConfidence["Low"]?.total ?? 0,
          lowConfidenceCorrect: stats.byConfidence["Low"]?.correct ?? 0,
          highDataReliabilityAccuracy: stats.byDataReliability["high"]?.percent ?? 0,
          mediumDataReliabilityAccuracy: stats.byDataReliability["medium"]?.percent ?? 0,
          lowDataReliabilityAccuracy: stats.byDataReliability["low"]?.percent ?? 0,
        },
        update: {
          totalPredictions: stats.totalPredictions,
          correctPredictions: stats.correctPredictions,
          accuracyPercent: stats.accuracyPercent,
          highConfidenceTotal: stats.byConfidence["High"]?.total ?? 0,
          highConfidenceCorrect: stats.byConfidence["High"]?.correct ?? 0,
          mediumConfidenceTotal: stats.byConfidence["Medium"]?.total ?? 0,
          mediumConfidenceCorrect: stats.byConfidence["Medium"]?.correct ?? 0,
          lowConfidenceTotal: stats.byConfidence["Low"]?.total ?? 0,
          lowConfidenceCorrect: stats.byConfidence["Low"]?.correct ?? 0,
          highDataReliabilityAccuracy: stats.byDataReliability["high"]?.percent ?? 0,
          mediumDataReliabilityAccuracy: stats.byDataReliability["medium"]?.percent ?? 0,
          lowDataReliabilityAccuracy: stats.byDataReliability["low"]?.percent ?? 0,
        },
      });
    }

    console.log("[Stats] Recalculated prediction stats");
  } catch (err) {
    console.error("[Stats] Failed to recalculate stats:", err);
  }
}

/**
 * Get stats for a specific period
 */
export async function getStats(period: "7d" | "30d" | "all-time") {
  try {
    const stats = await prisma.predictionStats.findFirst({
      where: { period },
      orderBy: { updatedAt: "desc" },
    });
    return stats;
  } catch (err) {
    console.error("[Stats] Failed to fetch stats:", err);
    return null;
  }
}
