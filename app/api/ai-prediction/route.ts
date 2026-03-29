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
  formatHomeAwayForAI,
  fetchPlayerInjuries,
  getMockInjuryData,
  formatInjuryDataForAI,
  formatVenueForAI,
  formatWeatherForAI,
  getMockWeatherData
} from "@/services/teamAnalytics";
import { 
  calculateWeightedForm,
  detectMomentum,
  assessPredictionQuality,
  getQualityMessage
} from "@/services/predictionQuality";
import { recordPrediction, updatePredictionResult } from "@/services/predictionAccuracy";
import { savePrediction } from "@/services/predictionTracking";
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
    let qualityWarning = "";

    if (recentMatches.length > 20) {
      try {
        const homeForm = calculateTeamForm(homeTeam, recentMatches, 10);
        const awayForm = calculateTeamForm(awayTeam, recentMatches, 10);
        
        if (homeForm.matches > 0 && awayForm.matches > 0) {
          analyticsContext += "\n\n" + formatFormForAI(homeForm, awayForm);
          usedFormData = true;

          // ── Add weighted form (recent form matters more) ───────────────────
          const homeWeighted = calculateWeightedForm(homeTeam, recentMatches, 10);
          const awayWeighted = calculateWeightedForm(awayTeam, recentMatches, 10);
          
          analyticsContext += `\n\nWEIGHTED RECENT FORM (last 5 games weighted 2x):
${homeTeam}: ${homeWeighted.weightedForm}% (recent form prioritized)
${awayTeam}: ${awayWeighted.weightedForm}% (recent form prioritized)`;

          // ── Add momentum detection ───────────────────────────────────────
          const homeMomentum = detectMomentum(homeTeam, recentMatches, 10);
          const awayMomentum = detectMomentum(awayTeam, recentMatches, 10);
          
          if (homeMomentum.trend !== "stable" || awayMomentum.trend !== "stable") {
            analyticsContext += `\n\nMOMENTUM SIGNALS:
${homeTeam}: ${homeMomentum.trend.toUpperCase()} (${homeMomentum.momentumScore > 0 ? "+" : ""}${(homeMomentum.momentumScore * 100).toFixed(0)}%)
${awayTeam}: ${awayMomentum.trend.toUpperCase()} (${awayMomentum.momentumScore > 0 ? "+" : ""}${(awayMomentum.momentumScore * 100).toFixed(0)}%)`;
          }

          // ── Assess prediction quality ────────────────────────────────────
          const h2h = getHeadToHead(homeTeam, awayTeam, recentMatches, 5);
          const hasStats = homeStats && awayStats && (Object.keys(homeStats).length > 0 || Object.keys(awayStats).length > 0);
          const quality = assessPredictionQuality(
            homeTeam,
            awayTeam,
            homeForm,
            awayForm,
            h2h.lastMeetings.length,
            hasStats
          );
          
          if (quality.dataIssues.length > 0) {
            qualityWarning = getQualityMessage(quality) || "";
          }

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

    // ── Phase 2: Add player injury & suspension context ─────────────────
    let injuryContext = "";
    try {
      const afKey = process.env.FOOTBALL_API_KEY ?? "";
      let injuries = null;
      
      // Try to fetch real injury data from API
      if (afKey && source === "africa") {
        // Match ID extraction: African API uses numeric IDs, European uses af-{id}
        const matchIdStr = String(homeTeam + awayTeam).replace(/\s+/g, "");
        const matchId = parseInt(matchIdStr) || 0;
        injuries = await fetchPlayerInjuries(matchId, 0, 0, homeTeam, awayTeam, afKey).catch(() => null);
      }
      
      // Fallback to mock data if real data unavailable
      if (!injuries) {
        injuries = getMockInjuryData(homeTeam, awayTeam);
      }
      
      if (injuries) {
        injuryContext = formatInjuryDataForAI(homeTeam, awayTeam, injuries);
        if (injuryContext.length > 0) {
          analyticsContext += "\n\n" + injuryContext;
        }
      }
    } catch (err) {
      console.warn("[ai-prediction] Injury context failed:", err);
      // Continue without injury data
    }

    // ── Phase 2.2: Add venue & weather context ────────────────────────────
    let venueWeatherContext = "";
    try {
      // Get mock weather data (placeholder for real weather API)
      const weather = getMockWeatherData();
      if (weather) {
        venueWeatherContext = formatWeatherForAI(weather);
        if (venueWeatherContext.length > 0) {
          analyticsContext += "\n\n" + venueWeatherContext;
        }
      }
    } catch (err) {
      console.warn("[ai-prediction] Venue/weather context failed:", err);
      // Continue without weather data
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

    const dataQualityNotice = qualityWarning
      ? `⚠️ DATA QUALITY NOTICE: ${qualityWarning}\nAdjust your confidence accordingly.`
      : "";
      
    // Enhanced context for accuracy calibration — helps AI set realistic confidence
    const confidenceCalibration = qualityWarning
      ? `\n⚠️ CONFIDENCE CALIBRATION: This match has data limitations. If form is thin (<5 recent matches) or H2H history is limited (<2 meetings), mark confidence as LOW even if the trend looks strong. Only use HIGH confidence when you have solid data from BOTH teams AND recent history is clear.`
      : `\n✅ RELIABLE DATA: Good sample of recent form and H2H available. Set confidence to HIGH only if data points clearly to one outcome; otherwise Medium.`;

    // Phase 2: Injury impact guidance for AI
    const injuryGuidance = injuryContext.includes("⚠️ CRITICAL")
      ? `\n⚠️ INJURY IMPACT: This match has critical player absences! Key players missing means reduced team strength. If a team loses their goalkeeper or star forward, expect:
        - Lower scoring (fewer chances created)
        - Defensive vulnerabilities (especially if key defender out)
        - Adjustment needed to confidence even if form suggests dominance
        Reduce confidence by 10-20% if missing goalkeeper or top defender.`
      : injuryContext.includes("⚠️ MODERATE")
      ? `\n⚠️ INJURY IMPACT: Some important players missing. Adjust expectations - team may underperform form trends.`
      : "";

    const prompt = `You're a sharp football betting analyst. A mate just asked "What do you fancy for this match?" Give them your honest take based on the numbers, the form, the head-to-head.

${homeTeam} vs ${awayTeam}
Competition: ${competition}
${resultContext}
${goalContext}
${dataQualityNotice}
${analyticsContext}
${bettingContext}

${isUpcoming
  ? `PRE-MATCH. Just answer like you're texting a friend who wants your best bet. Use these headers (but keep it conversational):

🎯 PREDICTION: [Your final score call e.g. "1-2"]
💪 CONFIDENCE: [Low / Medium / High] — Be honest. If the data's shaky, say Low. If it's clear, go High.${confidenceCalibration}${injuryGuidance}
🔥 BEST BET: [Your strongest single pick e.g. "Away win" or "Both teams to score"]
💬 WHY: [2-3 sentences max. No jargon. Reference specific form %, H2H record, momentum, or injury impact. Sound like you actually analyzed this.]
🎲 ALSO CONSIDER: [Two other angles, one line each]

Keep it real. Name both teams in your reasoning. Sound like you know these teams.`

  : `POST-MATCH. It's over. What just happened? What does it tell us? Use these headers:

✅ WHAT HAPPENED: [Was this the expected result or a shock? Sound surprised or vindicated.]
📊 WHAT IT MEANS: [What does this result tell us about both teams going forward? Any form signals?]
👀 NEXT UP: [One bet to watch for each team's next match. Keep it short.]
`
}

be specific. Name teams. Reference the actual data above (form %, goal averages, H2H records, injury absences). Sound like you genuinely care about getting it right.`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
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

      const bestBetMatch = prediction.match(/BEST BET:\s*([^\n]+)/i);
      const bestBet = bestBetMatch?.[1]?.trim() ?? "Match Result";

      // Calculate data quality metrics
      const homeForm = recentMatches.length > 20 ? calculateTeamForm(homeTeam, recentMatches, 10) : null;
      const awayForm = recentMatches.length > 20 ? calculateTeamForm(awayTeam, recentMatches, 10) : null;
      
      const homeWeightedForm = homeForm ? calculateWeightedForm(homeTeam, recentMatches, 10).weightedForm : 0;
      const awayWeightedForm = awayForm ? calculateWeightedForm(awayTeam, recentMatches, 10).weightedForm : 0;
      
      const homeMomentum = homeForm ? detectMomentum(homeTeam, recentMatches, 10).trend : "stable";
      const awayMomentum = awayForm ? detectMomentum(awayTeam, recentMatches, 10).trend : "stable";

      const quality = homeForm && awayForm
        ? assessPredictionQuality(homeTeam, awayTeam, homeForm, awayForm, 0, usedStatisticsData)
        : { dataReliability: "low", dataIssues: [] };

      // Save to database with full tracking
      try {
        predictionId = await savePrediction({
          matchId: parseInt(date.split("-").join("")),
          matchDate: date,
          homeTeam,
          awayTeam,
          competition,
          source: source || "unknown",
          predictedHome,
          predictedAway,
          predictedOutcome: predictedOutcome as "home" | "draw" | "away",
          confidence,
          bestBet,
          reasoning: prediction
            .match(/REASONING:\s*([^\n]+(?:\n[^\n]+)*)/i)?.[1]
            ?.trim() ?? "Analysis provided in full prediction",
          dataReliability: quality.dataReliability as "high" | "medium" | "low",
          dataIssues: quality.dataIssues,
          homeWeightedForm,
          awayWeightedForm,
          homeMomentum: homeMomentum as "improving" | "declining" | "stable",
          awayMomentum: awayMomentum as "improving" | "declining" | "stable",
        });
      } catch (err) {
        console.warn("[ai-prediction] Failed to save prediction to database:", err);
        // Fall back to old recording method
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
          version: 2,
        });
      }
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
