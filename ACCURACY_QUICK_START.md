# 🎯 Prediction Accuracy System - Quick Integration Guide

## 5-Minute Setup Overview

This guide shows how to integrate real-time accuracy tracking into your match prediction pipeline.

---

## Step 1: Verify Database Schema

Your Prisma schema should have this `Prediction` model:

```prisma
// prisma/schema.prisma

model Prediction {
  id                String    @id @default(cuid())
  matchId           String    @unique
  homeTeam          String
  awayTeam          String
  
  // Prediction
  predictedOutcome  String    // "HOME", "DRAW", "AWAY"
  predictedScore    String?   // Optional: "2-1" format
  
  // Actual Result (filled after match completes)
  actualOutcome     String?
  actualScore       String?
  
  // Accuracy Tracking
  outcomeCorrect    Boolean?
  scoreCorrect      Boolean?
  
  // Quality Metrics
  confidence        String    // "Low", "Medium", "High"
  dataReliability   String    // "low", "medium", "high"
  
  // Reference Data
  homeWeightedForm  Float?
  awayWeightedForm  Float?
  
  // Timestamps
  predictionDate    DateTime  @default(now())
  resultDate        DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([predictionDate])
  @@index([confidence])
  @@index([dataReliability])
  @@index([outcomeCorrect])
}
```

Run migration if not already done:
```bash
npx prisma migrate dev --name add_prediction_model
```

---

## Step 2: When Saving Predictions

Update your prediction save endpoint to store real data:

```typescript
// app/api/save-match/route.ts or wherever predictions are created

import { prisma } from "@/services/prisma";
import { calculateConfidence, assessDataReliability } from "@/services/accuracyHelpers";

export async function POST(req: NextRequest) {
  try {
    const { match, aiPrediction, matchAnalysis } = await req.json();

    // Calculate confidence and reliability
    const confidence = calculateConfidence({
      h2hMatch: matchAnalysis.h2hPatternMatch || 0.5,
      formTrend: matchAnalysis.homeFormScore || 0.5,
      statisticalModel: aiPrediction.modelConfidence || 0.5,
      recentForm: matchAnalysis.recentFormReliability || 0.5,
    });

    const dataReliability = assessDataReliability({
      h2h: match.h2h || [],
      homeStats: match.homeStats,
      awayStats: match.awayStats,
      recentMatches: match.recentMatches || [],
      injuryReports: match.injuries,
    });

    // Save prediction to database
    const prediction = await prisma.prediction.create({
      data: {
        matchId: match.id,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        predictedOutcome: aiPrediction.outcome, // "HOME"|"DRAW"|"AWAY"
        predictedScore: aiPrediction.score,     // Optional
        confidence,
        dataReliability,
        homeWeightedForm: match.homeWeightedForm,
        awayWeightedForm: match.awayWeightedForm,
        predictionDate: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      prediction,
      confidence,
      dataReliability,
    });
  } catch (err) {
    console.error("Error saving prediction:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Step 3: When Match Results Arrive

Update predictions with actual outcomes:

```typescript
// app/api/match-result/route.ts or results processor

import { prisma } from "@/services/prisma";

export async function POST(req: NextRequest) {
  try {
    const { matchId, actualOutcome, actualScore } = await req.json();

    // Find existing prediction
    const prediction = await prisma.prediction.findUnique({
      where: { matchId },
    });

    if (!prediction) {
      return NextResponse.json({ error: "Prediction not found" }, { status: 404 });
    }

    // Calculate if prediction was correct
    const outcomeCorrect = actualOutcome === prediction.predictedOutcome;
    const scoreCorrect = actualScore === prediction.predictedScore;

    // Update prediction with results
    const updated = await prisma.prediction.update({
      where: { matchId },
      data: {
        actualOutcome,
        actualScore,
        outcomeCorrect,
        scoreCorrect,
        resultDate: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Prediction for ${prediction.homeTeam} vs ${prediction.awayTeam}`);
    console.log(`   Outcome: ${outcomeCorrect ? "✓" : "✗"}`);
    console.log(`   Score: ${scoreCorrect ? "✓" : "✗"}`);

    return NextResponse.json({
      success: true,
      prediction: updated,
      outcome: {
        outcomeCorrect,
        scoreCorrect,
      },
    });
  } catch (err) {
    console.error("Error updating match result:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

---

## Step 4: View the Dashboard

Once predictions and results are stored, view real-time accuracy at:

📊 **`http://localhost:3000/accuracy`**

The dashboard shows:
- Overall accuracy percentage
- Breakdown by confidence level
- Breakdown by data reliability
- Recent predictions table
- Period selector (7 days, 30 days, all-time)

---

## Integration Checklist

```typescript
// ✅ Required in your codebase:

// 1. Import helpers
import { calculateConfidence, assessDataReliability } from "@/services/accuracyHelpers";

// 2. When creating predictions:
const confidence = calculateConfidence(factors);
const dataReliability = assessDataReliability(matchData);

// 3. Store in Prisma:
await prisma.prediction.create({
  data: {
    matchId,
    homeTeam,
    awayTeam,
    predictedOutcome,
    confidence,
    dataReliability,
    // ... other fields
  },
});

// 4. Update when results arrive:
await prisma.prediction.update({
  where: { matchId },
  data: {
    actualOutcome,
    outcomeCorrect: result === prediction.predictedOutcome,
    resultDate: new Date(),
  },
});

// 5. Access API:
// GET /api/prediction-accuracy?period=7d
// POST /api/prediction-accuracy/export?period=30d
```

---

## Files Reference

| Purpose | File | Status |
|---------|------|--------|
| Database API | `app/api/prediction-accuracy/route.ts` | ✅ Ready |
| Dashboard Component | `components/AccuracyMetrics/AccuracyDashboard.tsx` | ✅ Ready |
| Dashboard Styles | `components/AccuracyMetrics/accuracy.module.scss` | ✅ Ready |
| Dashboard Page | `app/accuracy/page.tsx` | ✅ Ready |
| Helper Functions | `services/accuracyHelpers.ts` | ✅ Ready |
| Documentation | `PREDICTION_ACCURACY_SYSTEM.md` | ✅ Ready |

---

## Common Implementation Patterns

### Pattern 1: Async Prediction & Result Update

```typescript
// When match is created
const prediction = await savePrediction(matchData);

// Much later, when result is known
const result = await getMatchResult(matchId);
await updatePredictionResult(matchId, result);

// Dashboard automatically updates
```

### Pattern 2: Batch Processing

```typescript
// Process multiple matches
for (const match of newMatches) {
  const prediction = analyzeAndCreate(match);
  predictions.push(prediction);
}

// Later, batch update results
const results = await fetchResultsBatch(matchIds);
for (const result of results) {
  await updateResult(result.matchId, result.outcome);
}
```

### Pattern 3: Real-Time Updates

```typescript
// If using WebSockets or event listeners
socket.on("matchResult", async (result) => {
  await updatePredictionResult(result.matchId, result.outcome);
  // Dashboard reloads automatically
});
```

---

## Troubleshooting

### ❌ Dashboard shows "No data"

**Check:**
1. Are predictions being saved? 
   ```bash
   npx prisma studio  # Check Prediction table
   ```
2. Call the API directly:
   ```bash
   curl http://localhost:3000/api/prediction-accuracy
   ```
3. Check console for errors

### ❌ Accuracy metrics incorrect

**Check:**
1. Verify `outcomeCorrect` matches actual result
2. Compare `predictedOutcome` with `actualOutcome`
3. Check timestamps are reasonable

### ❌ Dashboard loads slowly

**Fix:**
1. Add database indexes (see schema above)
2. Implement Redis caching:
   ```typescript
   const cached = await redisCache.get(`accuracy:7d`);
   ```

---

## Next Steps

1. ✅ Verify/create `Prediction` model
2. ✅ Update prediction save endpoints  
3. ✅ Update result processing endpoints
4. ✅ Test with sample data
5. ✅ View dashboard at `/accuracy`
6. ✅ Monitor accuracy trends
7. 🚀 Deploy to production

---

## Performance Notes

- Dashboard loads metrics from last 7 days by default
- Use `?period=7d|30d|all-time` to adjust
- Frontend caches data until page reload
- Backend caches metrics for 1 hour (if Redis available)
- Indexes on database ensure fast queries

---

## Need Help?

- Documentation: `PREDICTION_ACCURACY_SYSTEM.md`
- Implementation Tasks: `ACCURACY_IMPLEMENTATION_CHECKLIST.md`
- Helper Functions: `services/accuracyHelpers.ts`

**Ready to track accuracy! 🎉**
