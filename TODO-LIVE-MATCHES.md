# Fix Live Matches Display Issue
Track progress on resolving "no live matches" bug.

## Steps
- [ ] **Step 1**: Create TODO-LIVE-MATCHES.md ✅ **(done)**
- [ ] **Step 2**: Read services/prisma.ts to confirm DB queries
- [ ] **Step 3**: Edit app/matches/MatchesClient.tsx 
  - Fix date logic (UTC consistent)
  - Loosen isTodayLive
  - Improve polling
- [ ] **Step 4**: Edit app/api/matches/route.ts
  - Add Prisma DB fallback
  - Reduce live TTL
- [ ] **Step 5**: Test locally (`npm run dev`, visit /matches, toggle LIVE)
- [ ] **Step 6**: Optional: Create app/api/live/route.ts for dedicated live endpoint
- [ ] **Step 7**: Verify sync (`curl /api/sync?mode=live`)
- [ ] **Step 8**: Complete task (attempt_completion)

**Current progress: Starting Step 2**

