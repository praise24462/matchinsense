/**
 * ACCURACY_DASHBOARD_INTEGRATION.md
 * 
 * Integration guide for the newly built Accuracy Dashboard system
 */

# Accuracy Dashboard Integration Guide

## Overview

The accuracy dashboard system is now fully built and ready to use. It consists of:

1. **Database Layer**: `Prediction` and `PredictionStats` models in Prisma
2. **Services**:
   - `predictionTracking.ts` - Save predictions and manage DB
   - `predictionAnalytics.ts` - Calculate accuracy metrics and trends
3. **API**: `GET /api/prediction-stats?period=30d`
4. **Components**: `AccuracyStats` component (full & compact variants)
5. **Pages**: `/stats` - full accuracy dashboard page

## Quick Start - Add to Your Pages

### 1. Full Dashboard Page
The dashboard is already available at `/stats`. Just visit:
```
https://yoursite.com/stats
```

### 2. Add Compact Widget to Matches Page
Edit `app/matches/MatchesClient.tsx`:

```typescript
import AccuracyStats from "@/components/AccuracyStats/AccuracyStats";

export default function MatchesClient() {
  return (
    <div>
      {/* Your existing matches content */}
      
      {/* Add this before the matches list */}
      <AccuracyStats period="7d" compact={true} showTrends={false} />
      
      {/* Matches list continues... */}
    </div>
  );
}
```

### 3. Add Stats Widget to Match Detail Page
Edit `app/match/[id]/page.tsx`:

```typescript
import AccuracyStats from "@/components/AccuracyStats/AccuracyStats";

export default function MatchDetailPage() {
  return (
    <div>
      {/* Your existing match detail content */}
      
      {/* Add confidence stats section */}
      <section>
        <h2>How Accurate Are Our Predictions?</h2>
        <AccuracyStats period="30d" compact={true} showTrends={false} />
      </section>
      
      {/* Rest of page */}
    </div>
  );
}
```

### 4. Add Link in Navigation
Update your navbar/menu to link to `/stats`:

```typescript
<nav>
  {/* Other links */}
  <a href="/stats">Accuracy Stats</a>
</nav>
```

## How Predictions Get Saved

When an AI prediction is generated via `/api/ai-prediction/`, it:

1. **Generates the prediction** using Groq LLaMA AI
2. **Extracts structured data** (confidence, outcome, quality metrics)
3. **Calls `savePrediction()`** which stores to DB with:
   - Predicted outcome and score
   - Confidence level
   - Data quality assessment
   - Weighted form and momentum
   - Best betting market
4. **Returns prediction ID** for tracking

This happens automatically - no additional setup needed.

## How Predictions Get Updated

After a match completes, you need to call `/api/match-result/` to:

1. Fetch final match score
2. Call `updatePredictionResult(matchId, homeGoals, awayGoals)`
3. Automatically compares predicted vs actual
4. Marks prediction as correct/incorrect
5. Recalculates `PredictionStats`

**Currently**: This needs manual triggering. Consider:
- Cron job to check completed matches daily
- Webhook from football-data.org when matches finish
- Manual API call from admin panel

### Example Cron Job (Next.js)

Create `app/api/cron/update-predictions/route.ts`:

```typescript
import { prisma } from "@/services/prisma";
import { updatePredictionResult } from "@/services/predictionTracking";
import { getVercelRequestContext } from "@vercel/functions/next";

export async function GET(req: NextRequest) {
  // Only allow from Vercel cron
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find predictions without results
    const pendingPredictions = await prisma.prediction.findMany({
      where: {
        matchCompletedAt: null,
        matchDate: {
          lt: new Date(), // Date has passed
        },
      },
      distinct: ["matchId"],
    });

    let updated = 0;
    for (const pred of pendingPredictions) {
      // Fetch result from API
      const result = await fetch(
        `/api/match/${pred.matchId}`
      ).then(r => r.json());
      
      if (result.status === "FT") {
        await updatePredictionResult(
          pred.matchId,
          result.score.fullTime.home,
          result.score.fullTime.away
        );
        updated++;
      }
    }

    return Response.json({
      updated,
      message: `Updated ${updated} predictions`,
    });
  } catch (err) {
    console.error("[Cron] Error updating predictions:", err);
    return Response.json({ error: "Failed", details: String(err) }, { status: 500 });
  }
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/update-predictions",
    "schedule": "0 3 * * *"
  }]
}
```

## Data Structure

### Prediction Model
```prisma
model Prediction {
  id                String    @id @default(cuid())
  matchId           Int
  matchDate         DateTime
  homeTeam          String
  awayTeam          String
  competition       String
  source            String
  
  // Prediction
  predictedHome     Int?
  predictedAway     Int?
  predictedOutcome  String    // "home" | "draw" | "away"
  confidence        String    // "Low" | "Medium" | "High"
  bestBet           String    // Market prediction: "Over 2.5", "BTTS", etc
  reasoning         String    // Why this prediction
  
  // Data Quality
  dataReliability   String    // "high" | "medium" | "low"
  dataIssues        String[]
  homeWeightedForm  Float
  awayWeightedForm  Float
  homeMomentum      String    // "improving" | "declining" | "stable"
  awayMomentum      String
  
  // Results (filled after match)
  actualHome        Int?
  actualAway        Int?
  actualOutcome     String?
  outcomeCorrect    Boolean?
  scoreCorrect      Boolean?
  wasCorrect        Boolean?
  matchCompletedAt  DateTime?
  
  predictionDate    DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}
```

### PredictionStats Model
```prisma
model PredictionStats {
  id                      String    @id @default(cuid())
  period                  String    // "7d" | "30d" | "all-time"
  startDate               DateTime
  
  totalPredictions        Int
  correctPredictions      Int
  accuracyPercent         Int
  
  highConfidenceTotal     Int
  highConfidenceCorrect   Int
  mediumConfidenceTotal   Int
  mediumConfidenceCorrect Int
  lowConfidenceTotal      Int
  lowConfidenceCorrect    Int
  
  highDataReliabilityAccuracy     Int
  mediumDataReliabilityAccuracy   Int
  lowDataReliabilityAccuracy      Int
  
  bestMarket              String?
  bestMarketAccuracy      Int?
  
  createdAt               DateTime  @default(now())
  updatedAt               DateTime  @updatedAt
  
  @@unique([period, startDate])
}
```

## API Reference

### GET `/api/prediction-stats`

**Query Parameters:**
- `period` (optional): "7d" | "30d" | "all-time" (default: "30d")
- `compare` (optional): Compare two periods
- `problems` (optional): "true" to include problem predictions

**Response:**
```json
{
  "period": "30d",
  "overall": {
    "totalPredictions": 45,
    "correctPredictions": 25,
    "accuracyPercent": 56,
    "confidenceInterval95": [41, 70]
  },
  "byConfidence": {
    "high": { "total": 15, "correct": 10, "percent": 67 },
    "medium": { ... },
    "low": { ... }
  },
  "byDataQuality": { ... },
  "markets": {
    "bestMarkets": [
      { "market": "Match Result", "count": 30, "accuracy": 62 },
      ...
    ],
    "worstMarkets": [ ... ]
  },
  "competitions": { ... },
  "trends": {
    "weeklyAccuracy": [ ... ],
    "accuracyTrend": "improving"
  }
}
```

## Performance Considerations

1. **Database Indexes** - Already created on:
   - `Prediction(matchId, matchCompletedAt)`
   - `PredictionStats(period, startDate)`

2. **Caching** - API response cached for 1 hour (stale-while-revalidate for 24h)

3. **Stats Calculation** - Only done when:
   - Prediction is marked as complete
   - Cron job triggers recalculation
   - Manual request to `/api/prediction-stats`

## Future Enhancements

1. **Email Reports** - Weekly accuracy summaries
2. **Trend Alerts** - Notify if accuracy drops below threshold
3. **A/B Testing** - Test different AI models and compare
4. **User Predictions** - Let users log their own bets and compare to AI
5. **Market Value** - Show if predictions beat market odds
6. **Bankroll Stats** - ROI if betting with fixed units

## Troubleshooting

**Q: No predictions showing in dashboard?**
- Predictions only appear after `/api/ai-prediction/` is called
- Ensure `savePrediction()` isn't failing (check logs)
- Verify Prisma migrations ran: `npx prisma migrate deploy`

**Q: Accuracy very low?**
- With few predictions (<30), variance is high
- Check `byConfidence` - are high-confidence predictions actually worse?
- Check `byDataQuality` - do we have good data?
- Look at `byCompetition` - accuracy varies by league?

**Q: Predictions not updating with results?**
- Set up cron job or manually call `updatePredictionResult()`
- Check API can fetch match results
- Verify match status is "FT" (Full Time)

## Support

For issues or questions:
1. Check the Prisma logs for database errors
2. Review `/api/prediction-stats` response for data
3. Test `/api/ai-prediction/` to ensure predictions are saving
4. Check browser console for component rendering issues
