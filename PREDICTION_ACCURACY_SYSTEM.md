# 📊 Real-Time Prediction Accuracy Tracking System

## Overview

The new accuracy tracking system provides **real-time, database-backed analytics** for AI predictions. Instead of in-memory metrics, all predictions are stored in Prisma, enabling accurate historical tracking and comprehensive accuracy analysis.

## Key Features

✅ **Database-Backed Accuracy**: All predictions stored in Prisma with actual outcomes
✅ **Real-Time Metrics**: Accuracy calculated from completed matches
✅ **Multi-Dimensional Analysis**: Accuracy by confidence level and data reliability
✅ **Historical Trends**: View accuracy across 7-day, 30-day, or all-time periods
✅ **Visual Dashboard**: Beautiful, responsive accuracy metrics interface
✅ **API-Driven**: RESTful API for programmatic access to metrics

## Setup Instructions

### 1. Database Schema Update ✅

The `Prediction` table must include:

```prisma
model Prediction {
  id                  String    @id @default(cuid())
  matchId             String    @unique
  homeTeam            String
  awayTeam            String
  predictedOutcome    String    // "HOME", "DRAW", "AWAY"
  actualOutcome       String?   // Set after match completes
  outcomeCorrect      Boolean?  // Calculated when actualOutcome is set
  scoreCorrect        Boolean?  // Exact score prediction
  confidence          String    // "Low", "Medium", "High"
  dataReliability     String    // "low", "medium", "high"
  homeWeightedForm    Float?
  awayWeightedForm    Float?
  predictionDate      DateTime  @default(now())
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

### 2. Backend Integration

#### Predictions Endpoint

**POST /api/save-match** - When saving match predictions:

```typescript
// Ensure you save prediction data:
const prediction = await prisma.prediction.create({
  data: {
    matchId: match.id,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    predictedOutcome: aiPrediction.outcome,
    confidence: aiPrediction.confidence, // "Low"|"Medium"|"High"
    dataReliability: assessDataReliability(match), // "low"|"medium"|"high"
    homeWeightedForm: match.homeWeightedForm,
    awayWeightedForm: match.awayWeightedForm,
  },
});
```

#### Match Result Update

**POST /api/match-result/** - When results are determined:

```typescript
// Update prediction with actual outcome
const prediction = await prisma.prediction.update({
  where: { matchId },
  data: {
    actualOutcome: result.outcome, // "HOME", "DRAW", "AWAY"
    outcomeCorrect: result.outcome === prediction.predictedOutcome,
    scoreCorrect: result.score === prediction.predictedScore,
    updatedAt: new Date(),
  },
});
```

### 3. Frontend Integration

#### Display the Dashboard

```typescript
// app/accuracy/page.tsx
import AccuracyDashboard from "@/components/AccuracyMetrics/AccuracyDashboard";

export default function AccuracyPage() {
  return <AccuracyDashboard period="7d" />;
}
```

#### Embed in Existing Pages

```typescript
// In any component
import AccuracyDashboard from "@/components/AccuracyMetrics/AccuracyDashboard";

export default function MyPage() {
  return (
    <>
      <AccuracyDashboard period="30d" confidence="High" />
    </>
  );
}
```

## API Reference

### GET /api/prediction-accuracy

Returns accuracy metrics from database.

**Query Parameters:**
- `period` (optional): "7d" (default), "30d", "all-time"
- `confidence` (optional): "Low", "Medium", "High"
- `dataReliability` (optional): "high", "medium", "low"

**Response:**
```json
{
  "period": "7d",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-08T00:00:00Z",
  "totalPredictions": 45,
  "correctOutcomes": 32,
  "correctScores": 8,
  "overallAccuracy": "71.1",
  "byConfidence": {
    "High": {
      "total": 15,
      "correct": 13,
      "accuracy": "86.7"
    },
    "Medium": {
      "total": 20,
      "correct": 14,
      "accuracy": "70.0"
    },
    "Low": {
      "total": 10,
      "correct": 5,
      "accuracy": "50.0"
    }
  },
  "byDataReliability": {
    "high": {
      "total": 25,
      "correct": 20,
      "accuracy": "80.0"
    },
    "medium": {
      "total": 15,
      "correct": 10,
      "accuracy": "66.7"
    },
    "low": {
      "total": 5,
      "correct": 2,
      "accuracy": "40.0"
    }
  },
  "recentPredictions": [...]
}
```

### POST /api/prediction-accuracy/export

Exports all prediction records for analysis.

**Query Parameters:**
- `period` (optional): "7d", "30d", "all-time" (default)

## Data Reliability Assessment

Implement the `assessDataReliability` function to evaluate data quality:

```typescript
function assessDataReliability(match: any): "high" | "medium" | "low" {
  const factors = {
    hasFormData: match.h2h?.length > 10 ? 1 : 0,
    hasTeamStats: match.homeStats && match.awayStats ? 1 : 0,
    recentMatches: match.recentMatches?.length > 5 ? 1 : 0,
  };

  const score = Object.values(factors).reduce((a, b) => a + b, 0);

  return score >= 3 ? "high" : score >= 2 ? "medium" : "low";
}
```

## Confidence Scoring

Ensure predictions include confidence levels:

```typescript
function calculateConfidence(factors: {
  h2hMatch: number;      // 0-1
  formTrend: number;      // 0-1
  statisticalModel: number; // 0-1
  recentForm: number;     // 0-1
}): "Low" | "Medium" | "High" {
  const avgConfidence = 
    (factors.h2hMatch + factors.formTrend + 
     factors.statisticalModel + factors.recentForm) / 4;

  if (avgConfidence >= 0.7) return "High";
  if (avgConfidence >= 0.5) return "Medium";
  return "Low";
}
```

## Dashboard Components

### AccuracyDashboard

Main dashboard component showing all metrics.

```typescript
<AccuracyDashboard period="7d" confidence="High" />
```

**Props:**
- `period?: "7d" | "30d" | "all-time"` - Time period for metrics
- `confidence?: "Low" | "Medium" | "High"` - Filter by confidence level

### Features:
- Period selector (7d, 30d, all-time)
- Overall accuracy with color-coded status
- Score prediction accuracy
- Breakdown tables by confidence and reliability
- Recent predictions table
- Responsive design for mobile/tablet

## Page Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/accuracy` | AccuracyDashboard | Full accuracy metrics dashboard |
| `/api/prediction-accuracy` | GET endpoint | API for metrics data |
| `/api/prediction-accuracy/export` | POST endpoint | Export predictions for analysis |

## Monitoring & Alerts

### Set Accuracy Thresholds

Monitor these KPIs:

```typescript
const KPI_TARGETS = {
  HIGH_CONFIDENCE: 0.75,        // Should be 75%+ accurate
  MEDIUM_CONFIDENCE: 0.60,      // Should be 60%+ accurate
  LOW_CONFIDENCE: 0.50,         // Should be 50%+ accurate
  HIGH_RELIABILITY: 0.80,       // High data should be 80%+
};
```

### Alert When Metrics Drop

```typescript
async function checkAccuracyThresholds() {
  const metrics = await fetch("/api/prediction-accuracy?period=7d");
  const { byConfidence } = await metrics.json();

  if (parseFloat(byConfidence.High.accuracy) < KPI_TARGETS.HIGH_CONFIDENCE) {
    console.warn("⚠️ High confidence accuracy dropped below 75%");
    // Send alert, trigger investigation
  }
}
```

## Migration from In-Memory Metrics

If using old in-memory metrics:

1. Keep old `predictionAccuracy.ts` for backward compatibility
2. Gradually store predictions in database
3. Update endpoints to prioritize database data
4. Phase out in-memory functions after data migration

## Performance Considerations

### Indexing

Create database indexes for faster queries:

```prisma
model Prediction {
  // ... existing fields ...
  
  @@index([predictionDate])
  @@index([confidence])
  @@index([dataReliability])
  @@index([outcomeCorrect])
}
```

### Query Optimization

- Dashboard uses `findMany` with `select` to minimize data transfer
- Only fetches completed matches (where `actualOutcome` is not null)
- Pagination available for large datasets

### Caching

Implement Redis caching for frequently accessed metrics:

```typescript
// Cache accuracy metrics for 1 hour
const CACHE_KEY = `accuracy:${period}:${confidence || 'all'}`;
const cached = await redisCache.get(CACHE_KEY);
if (cached) return JSON.parse(cached);

// Fetch and cache
const metrics = await calculateMetrics();
await redisCache.set(CACHE_KEY, JSON.stringify(metrics), 3600);
return metrics;
```

## Testing

### Test Prediction Creation

```typescript
test("should save prediction with confidence level", async () => {
  const prediction = await prisma.prediction.create({
    data: {
      matchId: "test-123",
      homeTeam: "Team A",
      awayTeam: "Team B",
      predictedOutcome: "HOME",
      confidence: "High",
      dataReliability: "high",
    },
  });

  expect(prediction.confidence).toBe("High");
});
```

### Test Accuracy Calculation

```typescript
test("should calculate correct accuracy metrics", async () => {
  // Create test predictions
  await prisma.prediction.createMany({
    data: [
      { /* 10 correct high-confidence predictions */ },
      { /* 5 incorrect high-confidence predictions */ },
    ],
  });

  const response = await fetch("/api/prediction-accuracy?confidence=High");
  const data = await response.json();

  expect(parseFloat(data.byConfidence.High.accuracy)).toBe(66.7);
});
```

## Troubleshooting

### No Data Showing

1. Verify predictions are stored in database
2. Check that `actualOutcome` is populated after matches complete
3. Verify API endpoint returns data: `/api/prediction-accuracy`

### Inaccurate Accuracy

1. Ensure `outcomeCorrect` is properly set when updating with results
2. Check data reliability assessment logic
3. Verify confidence scoring is consistent

### Performance Issues

1. Add database indexes (see Performance section)
2. Implement Redis caching
3. Use pagination for large date ranges

## Future Enhancements

- [ ] Trend graphs showing accuracy over time
- [ ] League/team-specific accuracy breakdowns
- [ ] Betting value analysis vs accuracy
- [ ] Prediction adjustment recommendations based on accuracy trends
- [ ] Scheduled accuracy reports via email
- [ ] A/B testing different prediction models
- [ ] User-specific accuracy tracking for multiple predictors

## Support

For issues or questions:
1. Check `/api/prediction-accuracy` endpoint returns valid data
2. Review Prisma schema has required fields
3. Verify match results are being recorded
4. Check browser console for frontend errors

---

**Last Updated**: 2024
**Status**: Active & Production-Ready ✅
