import { NextRequest, NextResponse } from "next/server";
import { getMockBettingContext, findValueBets } from "@/services/bettingMarkets";
import { calculateTeamForm } from "@/services/teamAnalytics";
import { fetchEuropeanMatchesForDate } from "@/services/europeanApi";
import { fetchAfricanMatches } from "@/services/africanApi";

/**
 * POST /api/betting-value
 * 
 * Analyze a match prediction against betting markets to find value
 */
export async function POST(req: NextRequest) {
  try {
    const { homeTeam, awayTeam, date, prediction, confidence, source } = await req.json();
    
    if (!homeTeam || !awayTeam || !prediction || !confidence) {
      return NextResponse.json(
        { message: "Missing required fields: homeTeam, awayTeam, prediction, confidence" },
        { status: 400 }
      );
    }

    // Fetch recent matches for form calculation
    let recentMatches: any[] = [];
    try {
      if (source === "african") {
        const result = await fetchAfricanMatches(date);
        if (result.ok) recentMatches = result.matches;
      } else {
        const result = await fetchEuropeanMatchesForDate(date);
        recentMatches = Array.isArray(result) ? result : [];
      }
    } catch (err) {
      console.warn("[betting-value] Could not fetch matches for form calculation");
    }

    // Calculate form for betting odds generation
    let homeFormPercent = 50;
    let awayFormPercent = 50;

    if (recentMatches.length > 0) {
      const homeForm = calculateTeamForm(homeTeam, recentMatches, 10);
      const awayForm = calculateTeamForm(awayTeam, recentMatches, 10);
      homeFormPercent = homeForm.formPercent;
      awayFormPercent = awayForm.formPercent;
    }

    // Get betting markets
    const bettingContext = getMockBettingContext(
      homeTeam,
      awayTeam,
      homeFormPercent,
      awayFormPercent
    );

    // Parse AI prediction
    const predictionMatch = prediction.match(/PREDICTION:\s*(\d+)-(\d+)/i);
    const predictedHome = predictionMatch ? parseInt(predictionMatch[1]) : 1;
    const predictedAway = predictionMatch ? parseInt(predictionMatch[2]) : 1;
    
    const aiPrediction = {
      outcome: 
        predictedHome > predictedAway ? "home" as const :
        predictedHome < predictedAway ? "away" as const :
        "draw" as const,
      confidence: confidence as "Low" | "Medium" | "High",
    };

    // Find value bets
    const valueBets = findValueBets(aiPrediction, bettingContext);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      match: `${homeTeam} vs ${awayTeam}`,
      aiPrediction: {
        scoreline: `${predictedHome}-${predictedAway}`,
        confidence,
        outcome: aiPrediction.outcome,
      },
      bettingMarkets: bettingContext,
      valueBets,
      note: "Value bets are where AI confidence diverges from market odds - potentially profitable opportunities",
    });
  } catch (err: any) {
    console.error("[betting-value]", err);
    return NextResponse.json(
      { message: "Failed to analyze betting value", error: err.message },
      { status: 500 }
    );
  }
}
