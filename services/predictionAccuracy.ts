/**
 * services/predictionAccuracy.ts
 * 
 * Tracks AI prediction accuracy over time to identify improvements
 * and validate which data enrichments work best.
 */

export interface PredictionRecord {
  id: string;
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  predictionDate: string;
  matchDate: string;
  
  // AI Prediction
  predictedHome: number | null;
  predictedAway: number | null;
  predictedOutcome: "home" | "draw" | "away";
  confidence: "Low" | "Medium" | "High";
  
  // Actual Result
  actualHome: number | null;
  actualAway: number | null;
  actualOutcome: "home" | "draw" | "away" | null;
  
  // Scoring
  scorePredictionCorrect: boolean | null;
  outcomeCorrect: boolean | null;
  confidenceLevel: number; // 1-3
  
  // Used Data Features
  usedFormData: boolean;
  usedH2HData: boolean;
  usedHomeAwayData: boolean;
  
  version: number; // Track AI model/prompt version
}

const IN_MEMORY_PREDICTIONS: Map<string, PredictionRecord> = new Map();

/**
 * Record a prediction for later accuracy tracking
 */
export function recordPrediction(record: Omit<PredictionRecord, "id">): string {
  const id = `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const fullRecord: PredictionRecord = { id, ...record };
  IN_MEMORY_PREDICTIONS.set(id, fullRecord);
  return id;
}

/**
 * Update prediction with actual result (typically called after match finishes)
 */
export function updatePredictionResult(
  predictionId: string,
  actualHome: number,
  actualAway: number
) {
  const pred = IN_MEMORY_PREDICTIONS.get(predictionId);
  if (!pred) return false;

  const actualOutcome =
    actualHome > actualAway ? "home" : actualHome < actualAway ? "away" : "draw";
  
  pred.actualHome = actualHome;
  pred.actualAway = actualAway;
  pred.actualOutcome = actualOutcome;
  
  // Score the prediction
  pred.scorePredictionCorrect =
    pred.predictedHome === actualHome && pred.predictedAway === actualAway;
  
  pred.outcomeCorrect = pred.predictedOutcome === actualOutcome;

  IN_MEMORY_PREDICTIONS.set(predictionId, pred);
  return true;
}

/**
 * Get accuracy metrics across all recorded predictions
 */
export function getAccuracyMetrics(
  filters?: {
    confidence?: "Low" | "Medium" | "High";
    usedFormData?: boolean;
    usedH2HData?: boolean;
    version?: number;
  }
) {
  const predictions = Array.from(IN_MEMORY_PREDICTIONS.values())
    .filter(p => {
      if (!p.actualOutcome) return false; // No result yet
      if (filters?.confidence && p.confidence !== filters.confidence) return false;
      if (filters?.usedFormData !== undefined && p.usedFormData !== filters.usedFormData) return false;
      if (filters?.usedH2HData !== undefined && p.usedH2HData !== filters.usedH2HData) return false;
      if (filters?.version !== undefined && p.version !== filters.version) return false;
      return true;
    });

  if (predictions.length === 0) {
    return {
      summary: "No completed predictions yet",
      totalPredictions: 0,
      scoreAccuracy: 0,
      outcomeAccuracy: 0,
      confidenceDistribution: { High: 0, Medium: 0, Low: 0 },
    };
  }

  const scoreCorrect = predictions.filter(p => p.scorePredictionCorrect).length;
  const outcomeCorrect = predictions.filter(p => p.outcomeCorrect).length;

  const confidence = {
    High: predictions.filter(p => p.confidence === "High").length,
    Medium: predictions.filter(p => p.confidence === "Medium").length,
    Low: predictions.filter(p => p.confidence === "Low").length,
  };

  return {
    totalPredictions: predictions.length,
    scoreAccuracy: Number((scoreCorrect / predictions.length * 100).toFixed(1)),
    outcomeAccuracy: Number((outcomeCorrect / predictions.length * 100).toFixed(1)),
    confidenceDistribution: confidence,
    highConfidenceAccuracy: predictions.filter(p => p.confidence === "High" && p.outcomeCorrect).length / (confidence.High || 1),
  };
}

/**
 * Export for storage/logging purposes
 */
export function exportPredictions() {
  return Array.from(IN_MEMORY_PREDICTIONS.values());
}

/**
 * Clear records (for testing)
 */
export function clearPredictions() {
  IN_MEMORY_PREDICTIONS.clear();
}
