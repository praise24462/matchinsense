import { NextRequest, NextResponse } from "next/server";
import { updatePredictionResult, recordPrediction } from "@/services/predictionAccuracy";

/**
 * PUT /api/match-result
 * 
 * Update a prediction record with the actual match result.
 * Called when a match finishes to track prediction accuracy.
 */
export async function PUT(req: NextRequest) {
  try {
    const { predictionId, homeTeamScore, awayTeamScore } = await req.json();
    
    if (!predictionId || homeTeamScore === undefined || awayTeamScore === undefined) {
      return NextResponse.json(
        { message: "Missing required fields: predictionId, homeTeamScore, awayTeamScore" },
        { status: 400 }
      );
    }

    const updated = updatePredictionResult(predictionId, homeTeamScore, awayTeamScore);
    
    if (!updated) {
      return NextResponse.json(
        { message: "Prediction not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: "Prediction updated with match result",
      predictionId,
      finalScore: { home: homeTeamScore, away: awayTeamScore },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[match-result]", err);
    return NextResponse.json(
      { message: err?.message ?? "Failed to update match result" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/match-result
 * 
 * Record a new prediction for a match.
 */
export async function POST(req: NextRequest) {
  try {
    const {
      matchId,
      homeTeam,
      awayTeam,
      predictedHome,
      predictedAway,
      confidence,
      usedFormData,
      usedH2HData,
      matchDate,
    } = await req.json();

    if (!matchId || !homeTeam || !awayTeam) {
      return NextResponse.json(
        { message: "Missing required fields: matchId, homeTeam, awayTeam" },
        { status: 400 }
      );
    }

    // Determine predicted outcome from score
    let predictedOutcome: "home" | "draw" | "away" = "draw";
    if (predictedHome !== null && predictedAway !== null) {
      predictedOutcome =
        predictedHome > predictedAway ? "home" : predictedHome < predictedAway ? "away" : "draw";
    }

    const predictionId = recordPrediction({
      matchId,
      homeTeam,
      awayTeam,
      predictionDate: new Date().toISOString(),
      matchDate: matchDate || new Date().toISOString(),
      predictedHome,
      predictedAway,
      predictedOutcome: predictedOutcome as "home" | "draw" | "away",
      confidence: (confidence || "Medium") as "Low" | "Medium" | "High",
      actualHome: null,
      actualAway: null,
      actualOutcome: null,
      scorePredictionCorrect: null,
      outcomeCorrect: null,
      confidenceLevel: confidence === "High" ? 3 : confidence === "Medium" ? 2 : 1,
      usedFormData: usedFormData || false,
      usedH2HData: usedH2HData || false,
      usedHomeAwayData: true,
      version: 2,
    });

    return NextResponse.json({
      message: "Prediction recorded",
      predictionId,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[match-result POST]", err);
    return NextResponse.json(
      { message: err?.message ?? "Failed to record prediction" },
      { status: 500 }
    );
  }
}
