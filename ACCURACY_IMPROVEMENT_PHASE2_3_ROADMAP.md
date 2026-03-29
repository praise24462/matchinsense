# 📋 Accuracy Improvement - Phase 2 & Phase 3 Roadmap

## Phase 2: Data Enrichment (2-3 weeks) — +15-25% accuracy

### 2.1 Player Injury & Suspension Data Integration
**Expected Gain:** +15-20% accuracy  
**Effort:** High  
**Priority:** 🔴 Critical

#### What to Add:
```typescript
// From each match fixture via API-Sports:
interface PlayerStatus {
  team: "home" | "away";
  players: {
    name: string;
    position: "ST" | "MF" | "DF" | "GK";
    status: "injured" | "suspended" | "unavailable";
    injuryType?: "muscle" | "bone" | "other";
    daysOut?: number;
  }[];
}
```

#### Implementation:
1. **Fetch lineup data** (`/api/team/[id]` → add `/api/match/[id]/lineups`)
   ```typescript
   // In ai-prediction route, before calling AI:
   const lineups = await fetchMatchLineups(matchId, source);
   // Returns: homeLineup[], awayLineup[]
   ```

2. **Identify key players** (position importance)
   ```typescript
   const keyInjuries = lineups.filter(p => 
     (p.position === "GK" || p.position === "DF") && p.status === "injured"
   );
   // Goalkeepers & defenders = high impact (-10% team strength per key)
   // Midfielders = medium impact (-5%)
   // Strikers = variable (depends on if star player)
   ```

3. **Add to AI prompt:**
   ```
   INJURY & SUSPENSIONS:
   HOME: GK Alisson out (injured) — backup keeper in
   AWAY: Mane suspended — left winger missing
   
   → AI automatically adjusts confidence down by 15-20%
   ```

#### Files to Modify:
- `/app/api/ai-prediction/route.ts` → add lineups fetching
- `/services/teamAnalytics.ts` → new `fetchPlayerStatus()` function
- Create `/app/api/match/[id]/lineups` endpoint (optional)

---

### 2.2 Venue & Weather Context
**Expected Gain:** +5-8% accuracy  
**Effort:** Medium  
**Priority:** 🟡 Important

#### What to Add:
```typescript
interface VenueContext {
  venueName: string;
  country: string;
  weather: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    conditions: "clear" | "rainy" | "snowy" | "foggy";
  };
  altitude: number;
  capacity: number;
  surfaceType: "grass" | "artificial";
}
```

#### Implementation:
1. **Fetch venue data** (already have from match details)
2. **Query weather API** (Open-Meteo is free)
   ```typescript
   const weather = await fetch(
     `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
   );
   ```

3. **Add to prompt:**
   ```
   VENUE: Old Trafford, Manchester, England
   WEATHER: Cold & rainy (2°C, 80% humidity)
   → Heavy rain favors defensive play, reduces scoring
   → Cold favors physical defenders
   ```

#### Files to Modify:
- `/app/api/ai-prediction/route.ts` → add weather context
- `/services/teamAnalytics.ts` → new `getWeatherContext()` function

---

### 2.3 Prediction Accuracy Dashboard Endpoint
**Expected Gain:** Feedback loop for model improvement  
**Effort:** Low  
**Priority:** 🟢 Nice to Have

#### What to Build:
```typescript
// GET /api/prediction-accuracy?period=7d|30d|all-time
{
  period: "7d",
  stats: {
    totalPredictions: 42,
    correctPredictions: 27,
    overallAccuracy: 0.643,  // 64.3%
    
    byConfidence: {
      "High": { total: 15, correct: 12, accuracy: 0.80 },
      "Medium": { total: 20, correct: 13, accuracy: 0.65 },
      "Low": { total: 7, correct: 2, accuracy: 0.29 }
    },
    
    byDataReliability: {
      "high": { accuracy: 0.72 },
      "medium": { accuracy: 0.61 },
      "low": { accuracy: 0.38 }
    },
    
    bestBets: [
      { market: "Over 2.5 Goals", accuracy: 0.75, predictions: 8 },
      { market: "Both Teams to Score", accuracy: 0.71, predictions: 7 }
    ]
  }
}
```

#### Implementation:
1. Query Prediction table grouped by confidence
2. Calculate win rate for each group
3. Return trend data to frontend dashboard

#### Files to Modify:
- Create `/app/api/prediction-accuracy/route.ts`
- Create `/app/analytics/AccuracyDashboard.tsx` component

---

## Phase 3: Advanced Analytics (3-4 weeks) — +10-15% accuracy

### 3.1 Expected Goals (xG) Calculation
**Expected Gain:** +5-7% accuracy  
**Effort:** High  
**Complexity:** Medium

#### Formula:
```
xG = Sum of (shot_quality × position_factor × defender_proximity)
```

#### Implementation:
```typescript
// From match statistics (available via API-Sports):
interface ShotData {
  team: "home" | "away";
  shotsOnTarget: number;
  totalShots: number;
  xG: number;  // Often provided directly by API
}

// AI gets:
xG Analysis:
Home team expected goals: 1.8 (actual chances created)
Away team expected goals: 0.9 (limited attacking play)
→ Home team underperforming (low conversion rate)
```

#### Data Source:
- **API-Sports** provides `xG` directly in match statistics
- No complex calculation needed, just extraction

---

### 3.2 Player Performance Ratings
**Expected Gain:** +3-5% accuracy  
**Effort:** High  
**Complexity:** High

#### What to Track:
```typescript
interface PlayerMetrics {
  team: "home" | "away";
  player: string;
  position: string;
  rating: number;  // 1-10 from API (usually provided)
  passAccuracy: number;  // %
  shotAccuracy: number;  // %
  tackles: number;
  interceptions: number;
}

// Add to prompt:
PLAYER FORM:
Home: Haaland (9.2 rating) - in excellent form
Away: Saka (7.1 rating) - below average this season
```

#### Data Source:
- **API-Sports** has player ratings per match
- Track across last 5 games to show trends

---

### 3.3 Automated Accuracy Feedback Loop
**Expected Gain:** Continuous model improvement  
**Effort:** Medium  
**Complexity:** Medium

#### Process:
```
1. Make prediction (store in DB with all metadata)
   ↓
2. Match completes (80+ minutes)
   ↓
3. Run daily job to fetch results & update predictions
   ↓
4. Calculate: was prediction correct?
   ↓
5. Analyze: which features (momentum, injuries, xG, etc.) 
           had highest correlation with correct predictions?
   ↓
6. Adjust AI prompt weights accordingly
   ↓
7. Next prediction uses improved prompt
```

#### Implementation:
```typescript
// Daily cron job (can use Vercel Cron)
export async function POST(req: NextRequest) {
  // Find predictions from matches that finished 2+ hours ago
  const predictions = await prisma.prediction.findMany({
    where: {
      actualOutcome: null,
      matchCompletedAt: { isNot: null }
    }
  });
  
  // For each prediction:
  for (const pred of predictions) {
    const match = await fetchMatchResult(pred.matchId);
    
    await prisma.prediction.update({
      where: { id: pred.id },
      data: {
        actualHome: match.score.home,
        actualAway: match.score.away,
        actualOutcome: calculateOutcome(match),
        outcomeCorrect: pred.predictedOutcome === actualOutcome,
        matchCompletedAt: new Date()
      }
    });
  }
  
  // Generate accuracy report
  await generateAccuracyReport();
}
```

---

## Implementation Timeline

### Week 1-2 (Phase 2.1)
- [ ] Integrate player injury/suspension data
- [ ] Update AI prompt to handle injuries
- [ ] Test with 20-30 predictions
- [ ] Measure accuracy improvement

### Week 2-3 (Phase 2.2-2.3)
- [ ] Add venue & weather context
- [ ] Build prediction accuracy dashboard
- [ ] Frontend: Display accuracy by confidence level
- [ ] Deploy to production

### Week 3-4 (Phase 3)
- [ ] Extract xG data from API-Sports
- [ ] Add player ratings to context
- [ ] Build daily cron job for result updates
- [ ] Create heatmap: features vs accuracy correlation

---

## Monitoring & Metrics

### Track These KPIs:
```sql
-- Accuracy trend by phase
SELECT 
  DATE_TRUNC('week', predictionDate) as week,
  COUNT(*) as predictions,
  SUM(CASE WHEN outcomeCorrect THEN 1 ELSE 0 END)::float / COUNT(*) as weekly_accuracy
FROM Prediction
GROUP BY week
ORDER BY week DESC;
```

### Target Accuracy by Phase:
| Phase | Target | Cumulative |
|-------|--------|-----------|
| Baseline | ~58% | 58% |
| Phase 1 (Caching + Calibration) | +5-8% | 63-66% |
| Phase 2 (Injuries + Weather) | +8-15% | 71-81% |
| Phase 3 (xG + Feedback Loop) | +5-10% | 76-91% |

---

## Risk Mitigation

### Risk: Over-reliance on single AI model
**Mitigation:** Track accuracy by league/competition separately

### Risk: Stale injury data
**Mitigation:** Refresh lineups every 6 hours, not just at match start

### Risk: Holiday/off-season disruptions
**Mitigation:** Disable predictions during international breaks

### Risk: API quota exhaustion with new data sources
**Mitigation:** Implement aggressive caching (24h for team data, 6h for player data)

---

## Success Criteria

### Phase 2 Success:
- ✅ Injury context integrated, showing in 50% of predictions
- ✅ Accuracy improves to 70%+ on next 50 predictions
- ✅ Dashboard shows 8%+ improvement vs baseline

### Phase 3 Success:
- ✅ xG data flowing into all predictions
- ✅ Feedback loop running daily with no errors
- ✅ Accuracy trend shows consistent month-over-month improvement
- ✅ "High confidence" predictions hitting 80%+ accuracy

---

## Cost Estimate

| Phase | Complexity | Time | Quota Impact | Dev Cost |
|-------|-----------|------|--------------|----------|
| 1 (Current) | Low | 2hrs | -95% saved | ✅ Done |
| 2 | Medium | 40hrs | 0% (cached) | ~$800 (dev time) |
| 3 | High | 60hrs | 0% (mostly API data) | ~$1200+ |

---

## Questions & Next Steps

1. **Ready to start Phase 2?** See [Phase 2 Implementation Guide]
2. **Want to monitor Phase 1?** Check `/api/prediction-accuracy`
3. **Performance question?** All improvements cached—no latency hit

