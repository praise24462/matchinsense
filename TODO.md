# Live Badge Only for Today's Matches - Implementation Plan

Status: [In Progress]

## Breakdown of Approved Plan

### 1. [x] Update components/MatchCard/MatchCard.tsx
   - Add today check to isLive definition
   - Update all uses: rowLive class, scoreLive class, liveBadge render

### 2. [x] Update app/matches/MatchesClient.tsx
   - Add helper function for isTodayLive(match)
   - Update MatchRow isLive, liveTag render
   - Update liveOnly filter, liveCount to use date check

### 3. [x] Update app/saved/page.tsx
   - Add date check to status === "LIVE" condition for statusLive class

### 4. [x] Update app/favorites/page.tsx  
   - Add date check to isLive computation

### 5. [x] Update app/match/[id]/page.tsx
   - Add date check to isLive computation

### 6. [ ] Test changes
   - Run `npm run dev`
   - Navigate to matches, select Yesterday - verify no LIVE badges/tags/counts
   - Select Today - verify LIVE shows only if status="LIVE"
   - Test liveOnly filter behavior

## Commands to Run After All Edits
```
npm run dev
```
Open http://localhost:3000/matches and test yesterday vs today views.

**Next Step:** Will update TODO.md after each step completion.
