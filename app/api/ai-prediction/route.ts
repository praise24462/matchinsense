import { NextRequest, NextResponse } from "next/server";
import { 
  calculateTeamForm, 
  getHeadToHead, 
  formatFormForAI, 
  formatH2HForAI, 
  getHomeAwayStats,
  getAdvancedTeamMetrics,
  formatAdvancedAnalyticsForAI,
  formatMatchStatisticsForAI,
  formatHomeAwayForAI
} from "@/services/teamAnalytics";
import { recordPrediction, updatePredictionResult } from "@/services/predictionAccuracy";
import { getMockBettingContext, formatBettingForAI, findValueBets } from "@/services/bettingMarkets";
import { fetchEuropeanMatchesForDate } from "@/services/europeanApi";
import { fetchAfricanMatches } from "@/services/africanApi";

export async function POST(req: NextRequest) {
  try {
    const GROQ_KEY = process.env.GROQ_API_KEY;
    if (!GROQ_KEY) return NextResponse.json({ message: "GROQ_API_KEY not configured — get a free key at console.groq.com" }, { status: 500 });

    const { homeTeam, awayTeam, competition, date, score, events, status, source, homeStats, awayStats } = await req.json();
    if (!homeTeam || !awayTeam) return NextResponse.json({ message: "Missing match data" }, { status: 400 });

    const isFinished = status === "FT";
    const isUpcoming = status === "NS";

    // ── Fetch recent matches for analytics ─────────────────────────────────
    let recentMatches: any[] = [];
    try {
      if (source === "africa") {
        const result = await fetchAfricanMatches(date);
        if (result.ok) recentMatches = result.matches;
      } else {
        const result = await fetchEuropeanMatchesForDate(date);
        recentMatches = Array.isArray(result) ? result : [];
      }
    } catch (err) {
      console.warn("[ai-prediction] Could not fetch recent matches for analytics");
    }

    // ── Calculate team analytics ──────────────────────────────────────────
    let analyticsContext = "";
    let usedFormData = false;
    let usedH2HData = false;

    if (recentMatches.length > 20) {
      try {
        const homeForm = calculateTeamForm(homeTeam, recentMatches, 10);
        const awayForm = calculateTeamForm(awayTeam, recentMatches, 10);
        
        if (homeForm.matches > 0 && awayForm.matches > 0) {
          analyticsContext += "\n\n" + formatFormForAI(homeForm, awayForm);
          usedFormData = true;

          // Add advanced team metrics
          try {
            const homeMetrics = getAdvancedTeamMetrics(homeTeam, recentMatches, 10);
            const awayMetrics = getAdvancedTeamMetrics(awayTeam, recentMatches, 10);
            
            if (homeMetrics.team && awayMetrics.team) {
              analyticsContext += "\n\n" + formatAdvancedAnalyticsForAI(homeMetrics, awayMetrics, homeForm, awayForm);
            }
          } catch (err) {
            console.warn("[ai-prediction] Advanced metrics calculation failed:", err);
          }
        }

        const h2h = getHeadToHead(homeTeam, awayTeam, recentMatches, 5);
        if (h2h.lastMeetings.length > 0) {
          analyticsContext += "\n\n" + formatH2HForAI(homeTeam, awayTeam, h2h);
          usedH2HData = true;
        }

        const homeAwayStats = getHomeAwayStats(homeTeam, recentMatches, 10);
        const awayAwayStats = getHomeAwayStats(awayTeam, recentMatches, 10);
        
        analyticsContext += `\n\nHOME/AWAY SPLITS:
${homeTeam} at home: ${homeAwayStats.home.winPercent}% (${homeAwayStats.home.wins}W-${homeAwayStats.home.draws}D)
${awayTeam} away: ${awayAwayStats.away.winPercent}% (${awayAwayStats.away.wins}W-${awayAwayStats.away.draws}D)`;
      } catch (err) {
        console.warn("[ai-prediction] Analytics calculation failed:", err);
      }
    }

    // ── Add match statistics context ──────────────────────────────────────
    let usedStatisticsData = false;
    if (homeStats && awayStats && (Object.keys(homeStats).length > 0 || Object.keys(awayStats).length > 0)) {
      try {
        const statsContext = formatMatchStatisticsForAI(homeTeam, awayTeam, homeStats, awayStats);
        if (statsContext.length > 0) {
          analyticsContext += "\n\n" + statsContext;
          usedStatisticsData = true;
        }
      } catch (err) {
        console.warn("[ai-prediction] Statistics formatting failed:", err);
      }
    }

    // ── Get betting market context ────────────────────────────────────────
    let bettingContext = "";
    try {
      const homeForm = calculateTeamForm(homeTeam, recentMatches, 10);
      const awayForm = calculateTeamForm(awayTeam, recentMatches, 10);
      
      const betting = getMockBettingContext(
        homeTeam,
        awayTeam,
        homeForm.formPercent,
        awayForm.formPercent
      );
      bettingContext = "\n\n" + formatBettingForAI(betting);
    } catch (err) {
      console.warn("[ai-prediction] Betting context failed");
    }

    // ── Build enhanced prompt ─────────────────────────────────────────────
    const resultContext = isFinished
      ? `Final result: ${homeTeam} ${score?.home ?? 0} – ${score?.away ?? 0} ${awayTeam}`
      : `This match has not yet been played.`;

    const goalContext = isFinished && events?.length > 0
      ? `Goals: ${events.filter((e: any) => ["Goal","Penalty","OwnGoal"].includes(e.type))
          .map((e: any) => `${e.player} ${e.minute}' (${e.team === "home" ? homeTeam : awayTeam})`).join(", ")}`
      : "";

    const prompt = `You are a professional football betting analyst for MatchInsense. Provide a structured betting analysis for:

${homeTeam} vs ${awayTeam}
Competition: ${competition}
${resultContext}
${goalContext}
${analyticsContext}
${bettingContext}

${isUpcoming
  ? `PRE-MATCH betting analysis. Use these exact labels:

PREDICTION: [predicted scoreline e.g. "1-2"]
CONFIDENCE: [Low / Medium / High]
BEST BET: [strongest single market pick e.g. "Both Teams to Score — Yes"]
REASONING: [2-3 sentences — use form data, head-to-head, and home/away records provided above]
ALSO CONSIDER: [Two secondary markets, one per line]

When form data is provided, factor it heavily into your prediction. High form teams should get higher confidence.`

  : `POST-MATCH analysis for future markets. Use these exact labels:

RESULT VERDICT: [e.g. "Expected win" / "Shock result" / "Fair draw"]
FORM SIGNAL: [What this result tells us about both teams going forward]
NEXT MATCH WATCH: [One forward-looking bet for each team's next fixture]`
}

Be specific. Reference teams by name. Use the provided statistics and analytics. No generic statements.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 500, // Increased for more detailed analysis
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `Groq error ${res.status}`);
    }

    const data = await res.json();
    const prediction = data.choices?.[0]?.message?.content?.trim() ?? "";
    if (!prediction) throw new Error("Empty response from AI");

    // ── Record prediction for accuracy tracking ──────────────────────────
    let predictionId = "";
    if (isUpcoming) {
      const confidenceMatch = prediction.match(/CONFIDENCE:\s*(Low|Medium|High)/i);
      const confidence = (confidenceMatch?.[1] ?? "Medium") as "Low" | "Medium" | "High";
      
      const outcomeMatch = prediction.match(/PREDICTION:\s*(\d+)-(\d+)/i);
      const predictedHome = outcomeMatch ? parseInt(outcomeMatch[1]) : null;
      const predictedAway = outcomeMatch ? parseInt(outcomeMatch[2]) : null;
      const predictedOutcome = !predictedHome || !predictedAway ? "draw" :
        predictedHome > predictedAway ? "home" : predictedHome < predictedAway ? "away" : "draw";

      predictionId = recordPrediction({
        matchId: `${homeTeam}-${awayTeam}-${date}`,
        homeTeam,
        awayTeam,
        predictionDate: new Date().toISOString(),
        matchDate: date,
        predictedHome,
        predictedAway,
        predictedOutcome: predictedOutcome as "home" | "draw" | "away",
        confidence,
        actualHome: null,
        actualAway: null,
        actualOutcome: null,
        scorePredictionCorrect: null,
        outcomeCorrect: null,
        confidenceLevel: confidence === "High" ? 3 : confidence === "Medium" ? 2 : 1,
        usedFormData,
        usedH2HData,
        usedHomeAwayData: true,
        version: 2, // Version with enhanced data
      });
    }

    return NextResponse.json({ 
      prediction, 
      generatedAt: new Date().toISOString(),
      predictionId,
      dataEnrichment: {
        usedFormData,
        usedH2HData,
        usedBettingContext: bettingContext.length > 0,
        usedStatisticsData,
      }
    });
  } catch (err: any) {
    console.error("[ai-prediction]", err);
    return NextResponse.json({ message: err?.message ?? "Failed to generate prediction" }, { status: 500 });
  }
}
