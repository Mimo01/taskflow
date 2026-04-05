---
phase: 44-loading-ux
plan: 02
subsystem: ui
tags: [react, tanstack-query, skeleton, loading-ux, sprint-board, backlog]

requires:
  - phase: 44-01
    provides: SprintBoardSkeleton, BacklogSkeleton components and useDelayedLoading hook

provides:
  - SprintBoardTab with SprintBoardSkeleton, useDelayedLoading, isRefreshing, cache-invalidating refresh
  - BacklogPage with BacklogSkeleton, useDelayedLoading, isRefreshing, cache-invalidating refresh
  - VirtualizedSwimlanes subtasksLoading prop with Skeleton placeholders in DroppableCells
  - VirtualizedBacklogTable epicsLoading prop with Skeleton h-4 w-16 in epic column header

affects: [44-03, sprint-board, backlog]

tech-stack:
  added: []
  patterns:
    - "showSkeleton = useDelayedLoading(isLoading) || isRefreshing — 200ms flicker prevention plus instant skeleton on manual refresh"
    - "isRefreshing cleared in useEffect when isLoading becomes false"
    - "Refresh buttons use invalidateQueries instead of refetch for cache-busting"
    - "ErrorState and StaleDataBanner onRetry also use invalidateQueries + setIsRefreshing"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx

key-decisions:
  - "subtasksLoading prop added to VirtualizedSwimlanes at false — infrastructure for progressive loading when subtask query is split in future"
  - "epicsLoading shows Skeleton in epic column header of VirtualizedBacklogTable — allEpics query pending state threads through"
  - "showSkeleton guards content visibility (not isLoading) — ensures content stays hidden during manual refresh"

patterns-established:
  - "Progressive skeleton pattern: showSkeleton = useDelayedLoading(isPending) || isRefreshing"
  - "Refresh buttons use invalidateQueries for cache-busting (not refetch which skips staleTime)"

requirements-completed: [LOAD-03, LOAD-04, LOAD-05]

duration: 8min
completed: 2026-03-30
---

# Phase 44 Plan 02: Sprint Board and Backlog Skeleton Wiring Summary

**SprintBoardSkeleton and BacklogSkeleton wired into their views with useDelayedLoading flicker prevention, isRefreshing instant-skeleton on manual refresh, and cache-invalidating invalidateQueries on refresh/retry buttons**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-30T07:15:48Z
- **Completed:** 2026-03-30T07:23:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Sprint board replaces 3 inline bg-muted animate-pulse divs with SprintBoardSkeleton component; refresh button now calls invalidateQueries and shows skeleton immediately via isRefreshing flag
- Backlog replaces 5 inline h-10 animate-pulse divs with BacklogSkeleton component; ErrorState and StaleDataBanner onRetry also use invalidateQueries pattern
- VirtualizedSwimlanes gains subtasksLoading prop with Skeleton h-8 w-full placeholders in DroppableCells; VirtualizedBacklogTable gains epicsLoading prop showing Skeleton h-4 w-16 in epic column header
- All 36 tests across both files pass

## Task Commits

1. **Task 1: Wire SprintBoardTab with skeleton, progressive subtask loading, and refresh** - `ec45a0b` (feat)
2. **Task 2: Wire BacklogPage with skeleton, progressive epic badges, and refresh** - `12f9d5d` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Added SprintBoardSkeleton + useDelayedLoading + isRefreshing + subtasksLoading prop + invalidateQueries refresh
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Added BacklogSkeleton + useDelayedLoading + isRefreshing + epicsLoading/allEpicsPending + invalidateQueries refresh

## Decisions Made

- `subtasksLoading` is always `false` in SprintBoardTab because fetchSprintIssues returns stories and subtasks in the same query response — added as infrastructure for future separate subtask query
- `epicsLoading` reflects `allEpicsPending` from the jira-epics-basic query, which is a separate query from backlogView — shows skeleton in the epic column header while that secondary query loads
- All `!isLoading` guards in the SprintBoardTab render path replaced with `!showSkeleton` so content stays hidden during manual refresh (isRefreshing=true but isLoading=false)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Replaced !isLoading guards with !showSkeleton in SprintBoardTab render path**
- **Found during:** Task 1 (Wire SprintBoardTab)
- **Issue:** Plan specified isRefreshing should immediately show skeleton on manual refresh, but content guards used `!isLoading` — content would appear immediately even when isRefreshing=true since isLoading would be false (cache hit)
- **Fix:** Changed `!isLoading && !isError && data && ...` to `!showSkeleton && !isError && data && ...` for all content guards (sprint goal, quick filters, active filter banner, unified filter bar, empty state, virtualized swimlanes)
- **Files modified:** taskflow/src/routes/dashboard/SprintBoardTab.tsx
- **Verification:** Tests pass; isRefreshing now correctly hides content while invalidateQueries refetches
- **Committed in:** ec45a0b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Essential for the isRefreshing pattern to work correctly. Without this fix, manual refresh would show data immediately without the skeleton flash, defeating the purpose.

## Issues Encountered

None - both tasks executed cleanly.

## Known Stubs

None - all skeleton/progressive patterns are wired to real loading states.

## Next Phase Readiness

- Sprint board and backlog are wired with production-quality skeleton loading
- Plan 44-03 can proceed to wire remaining views (notifications, dashboard widgets, etc.)
- The subtasksLoading=false stub in VirtualizedSwimlanes is documented and ready for future when subtask query is split

---
*Phase: 44-loading-ux*
*Completed: 2026-03-30*

## Self-Check: PASSED

- taskflow/src/routes/dashboard/SprintBoardTab.tsx: FOUND
- taskflow/src/routes/dashboard/BacklogPage.tsx: FOUND
- .planning/phases/44-loading-ux/44-02-SUMMARY.md: FOUND
- Task 1 commit ec45a0b: FOUND
- Task 2 commit 12f9d5d: FOUND
