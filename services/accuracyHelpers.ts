/**
 * Prediction Accuracy Helper Functions
 * 
 * These functions support the accuracy tracking system by:
 * - Calculating prediction confidence levels
 * - Assessing data quality/reliability
 * - Scoring prediction factors
 */

/**
 * Calculates confidence level based on multiple predictive factors
 * 
 * @param factors - Object containing prediction confidence factors (0-1 scale)
 *   - h2hMatch: Head-to-head historical accuracy
 *   - formTrend: Recent form trend alignment
 *   - statisticalModel: Model prediction confidence
 *   - recentForm: Recent team form reliability
 *   - homeAdvantage: Home/away advantage factor (optional)
 *   
 * @returns Confidence level: "High" (>=0.7), "Medium" (0.5-0.7), "Low" (<0.5)
 */
export function calculateConfidence(factors: {
  h2hMatch?: number;
  formTrend?: number;
  statisticalModel?: number;
  recentForm?: number;
  homeAdvantage?: number;
  [key: string]: number | undefined;
}): "Low" | "Medium" | "High" {
  // Filter out undefined values
  const values = Object.values(factors).filter((v) => v !== undefined) as number[];

  if (values.length === 0) return "Low";

  // Average all factors (each should be 0-1)
  const avgConfidence = values.reduce((a, b) => a + b, 0) / values.length;

  // Classify based on average
  if (avgConfidence >= 0.7) return "High";
  if (avgConfidence >= 0.5) return "Medium";
  return "Low";
}

/**
 * Assesses data reliability based on available information about a match
 * 
 * @param matchData - Match information object
 *   - h2h: Array of head-to-head records
 *   - homeStats: Home team statistics
 *   - awayStats: Away team statistics
 *   - recentMatches: Recent match records
 *   - injuryReports: Any injury information
 *   - marketMovement: Betting market data (optional)
 *   
 * @returns Reliability level based on data availability
 *   - "high": Strong data foundation (3+ factors)
 *   - "medium": Moderate data (2 factors)
 *   - "low": Limited data (<2 factors)
 */
export function assessDataReliability(matchData: {
  h2h?: any[];
  homeStats?: any;
  awayStats?: any;
  recentMatches?: any[];
  injuryReports?: any;
  marketMovement?: any;
  [key: string]: any;
}): "high" | "medium" | "low" {
  let dataScore = 0;

  // H2H data - valuable if >10 matches
  if (matchData.h2h && matchData.h2h.length > 10) {
    dataScore += 2; // Weight H2H heavily
  } else if (matchData.h2h && matchData.h2h.length > 0) {
    dataScore += 1;
  }

  // Team statistics available
  if (matchData.homeStats && matchData.awayStats) {
    dataScore += 1;
  }

  // Recent form data
  if (matchData.recentMatches && matchData.recentMatches.length > 5) {
    dataScore += 1;
  }

  // Injury reports (impacts reliability)
  if (matchData.injuryReports) {
    dataScore += 1;
  }

  // Market movement data (indicates professional betting activity)
  if (matchData.marketMovement) {
    dataScore += 1;
  }

  // Score to reliability mapping
  if (dataScore >= 3) return "high";
  if (dataScore >= 2) return "medium";
  return "low";
}

/**
 * Calculates multiple confidence factors for a prediction
 * Used to feed into calculateConfidence()
 */
export function generateConfidenceFactors(matchAnalysis: any) {
  return {
    h2hMatch: matchAnalysis.h2hPatternMatch || 0.5,
    formTrend: matchAnalysis.homeFormScore || 0.5,
    statisticalModel: matchAnalysis.modelConfidence || 0.5,
    recentForm: matchAnalysis.recentFormReliability || 0.5,
    homeAdvantage: matchAnalysis.homeAdvantage || 0.3,
  };
}

/**
 * Comprehensive match data assessment
 * Returns both confidence and reliability scores
 */
export function assessPredictionQuality(matchData: {
  h2h?: any[];
  homeStats?: any;
  awayStats?: any;
  recentMatches?: any[];
  injuryReports?: any;
  marketMovement?: any;
  h2hPatternMatch?: number;
  homeFormScore?: number;
  modelConfidence?: number;
  recentFormReliability?: number;
  homeAdvantage?: number;
}): {
  confidence: "Low" | "Medium" | "High";
  dataReliability: "low" | "medium" | "high";
  qualityScore: number; // 0-100
} {
  const factors = generateConfidenceFactors(matchData);
  const confidence = calculateConfidence(factors);
  const dataReliability = assessDataReliability(matchData);

  // Calculate overall quality score (0-100)
  const confidenceScore =
    {
      High: 0.8,
      Medium: 0.6,
      Low: 0.4,
    }[confidence] || 0.5;

  const reliabilityScore =
    {
      high: 0.9,
      medium: 0.6,
      low: 0.3,
    }[dataReliability] || 0.5;

  const qualityScore = Math.round((confidenceScore + reliabilityScore) / 2 * 100);

  return {
    confidence,
    dataReliability,
    qualityScore,
  };
}

/**
 * Validates if a prediction meets minimum quality thresholds
 */
export function isPredictionValid(
  matchData: any,
  minQualityScore: number = 50
): { valid: boolean; score: number; reason?: string } {
  const { qualityScore, confidence, dataReliability } = assessPredictionQuality(matchData);

  // Check minimum quality threshold
  if (qualityScore < minQualityScore) {
    return {
      valid: false,
      score: qualityScore,
      reason: `Quality score ${qualityScore} below minimum ${minQualityScore}`,
    };
  }

  // Can add additional validation rules here
  if (dataReliability === "low" && confidence === "Low") {
    return {
      valid: false,
      score: qualityScore,
      reason: "Both data reliability and confidence are low",
    };
  }

  return {
    valid: true,
    score: qualityScore,
  };
}

/**
 * Example usage in prediction creation:
 * 
 * ```typescript
 * const matchAnalysis = analyzeMatch(match);
 * const quality = assessPredictionQuality(matchAnalysis);
 * 
 * // Check if prediction meets quality threshold
 * if (!isPredictionValid(matchAnalysis, 60)) {
 *   console.log("Prediction quality too low, skipping");
 *   return;
 * }
 * 
 * // Save prediction with quality data
 * await prisma.prediction.create({
 *   data: {
 *     // ... prediction data
 *     confidence: quality.confidence,
 *     dataReliability: quality.dataReliability,
 *   },
 * });
 * ```
 */

/**
 * KPI Thresholds for monitoring accuracy
 * Adjust these based on your model's expected performance
 */
export const ACCURACY_KPI_TARGETS = {
  HIGH_CONFIDENCE: 0.75,        // High confidence should be 75%+ accurate
  MEDIUM_CONFIDENCE: 0.60,      // Medium confidence should be 60%+ accurate
  LOW_CONFIDENCE: 0.50,         // Low confidence should be 50%+ accurate
  HIGH_RELIABILITY: 0.80,       // High reliability data should be 80%+ accurate
  MEDIUM_RELIABILITY: 0.65,     // Medium reliability should be 65%+ accurate
  OVERALL: 0.65,                // Overall accuracy target
};

/**
 * Evaluates if accuracy metrics meet targets
 */
export function evaluateAccuracyMetrics(metrics: {
  overallAccuracy: number;
  byConfidence: {
    High?: { accuracy: string | number };
    Medium?: { accuracy: string | number };
    Low?: { accuracy: string | number };
  };
  byDataReliability?: {
    high?: { accuracy: string | number };
    medium?: { accuracy: string | number };
    low?: { accuracy: string | number };
  };
}): {
  meetsTargets: boolean;
  warnings: string[];
  details: {
    [key: string]: {
      value: number;
      target: number;
      status: "✅" | "⚠️" | "❌";
    };
  };
} {
  const warnings: string[] = [];
  const details: any = {};

  // Check overall accuracy
  const overall = metrics.overallAccuracy;
  details.overall = {
    value: overall,
    target: ACCURACY_KPI_TARGETS.OVERALL,
    status: overall >= ACCURACY_KPI_TARGETS.OVERALL ? "✅" : "⚠️",
  };
  if (overall < ACCURACY_KPI_TARGETS.OVERALL) {
    warnings.push(
      `⚠️ Overall accuracy ${overall.toFixed(1)}% below target ${(ACCURACY_KPI_TARGETS.OVERALL * 100).toFixed(0)}%`
    );
  }

  // Check by confidence
  if (metrics.byConfidence.High) {
    const value = parseFloat(metrics.byConfidence.High.accuracy as any);
    details.highConfidence = {
      value,
      target: ACCURACY_KPI_TARGETS.HIGH_CONFIDENCE,
      status: value >= ACCURACY_KPI_TARGETS.HIGH_CONFIDENCE ? "✅" : "❌",
    };
    if (value < ACCURACY_KPI_TARGETS.HIGH_CONFIDENCE) {
      warnings.push(
        `❌ High confidence accuracy ${value.toFixed(1)}% below target ${(ACCURACY_KPI_TARGETS.HIGH_CONFIDENCE * 100).toFixed(0)}%`
      );
    }
  }

  const meetsTargets = warnings.length === 0;

  return {
    meetsTargets,
    warnings,
    details,
  };
}
