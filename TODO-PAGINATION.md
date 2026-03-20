# Pagination for Matches Page

Status: [In Progress]

## Breakdown

### 1. [x] Update app/matches/MatchesClient.tsx
   - Add currentPage state + GROUPS_PER_PAGE = 8
   - Replace visibleCount → currentPage * GROUPS_PER_PAGE slicing
   - Remove sentinelRef and IntersectionObserver
   - Add pagination UI: ← Prev | Next → buttons + Page X of Y
   - Reset page=1 on selectedDate/liveOnly/filterComp/search change

### 2. [x] Update app/matches/matches.module.scss  
   - Add .pagination, .pageBtn, .pageInfo styles

### 3. [x] Test
   - `npm run dev`
   - /matches: Verify Load More/Next buttons work, filters reset pagination
   - Responsive on mobile

**Next:** Update after each step.
