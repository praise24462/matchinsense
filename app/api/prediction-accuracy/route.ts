import { NextRequest, NextResponse } from "next/server";
import { getAccuracyMetrics, exportPredictions } from "@/services/predictionAccuracy";

/**
 * GET /api/prediction-accuracy
 * 
 * Returns real-time accuracy metrics for AI predictions
 */
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const confidence = searchParams.get("confidence") as "Low" | "Medium" | "High" | null;
    const formDataOnly = searchParams.get("formData") === "true";
    const h2hDataOnly = searchParams.get("h2hData") === "true";

    const metrics = getAccuracyMetrics({
      confidence: confidence || undefined,
      usedFormData: formDataOnly || undefined,
      usedH2HData: h2hDataOnly || undefined,
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      ...metrics,
      note: "These metrics show how accurate the enhanced AI predictions are",
    });
  } catch (err: any) {
    console.error("[prediction-accuracy]", err);
    return NextResponse.json(
      { message: "Failed to get accuracy metrics", error: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/prediction-accuracy/export
 * 
 * Export all recorded predictions for analysis
 */
export async function POST(req: NextRequest) {
  try {
    const predictions = exportPredictions();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      totalRecords: predictions.length,
      predictions,
    });
  } catch (err: any) {
    console.error("[prediction-accuracy]", err);
    return NextResponse.json(
      { message: "Failed to export predictions", error: err.message },
      { status: 500 }
    );
  }
}
