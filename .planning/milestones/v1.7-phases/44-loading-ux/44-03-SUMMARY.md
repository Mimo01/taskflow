---
phase: 44-loading-ux
plan: "03"
subsystem: ui
tags: [react, tanstack-query, skeleton, loading-ux, useDelayedLoading]

# Dependency graph
requires:
  - phase: 44-loading-ux plan 01
    provides: "useDelayedLoading hook, 8 per-view skeleton components"
provides:
  - "MyTasksTab wired with MyTasksSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "WorkloadTab wired with WorkloadSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "SprintProgressTab wired with SprintProgressSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "EpicsPage wired with EpicsSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "ReleasesTab wired with ReleasesSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "MrAttentionTab wired with MrAttentionSkeleton + useDelayedLoading + cache-invalidating refresh"
  - "LOAD-01 complete: all 8 major views have layout-matched skeletons"
  - "LOAD-05 complete: all 8 major views use 200ms flicker prevention"
affects: [44-loading-ux plan 02]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isRefreshing flag + queryClient.invalidateQueries replaces refetch() on refresh buttons"
    - "showSkeleton = useDelayedLoading(isLoading) || isRefreshing for immediate skeleton on manual refresh"
    - "ErrorState and StaleDataBanner onRetry use same invalidateQueries pattern as refresh button"
    - "useEffect(() => { if (!isLoading) setIsRefreshing(false); }, [isLoading]) for cleanup"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx

key-decisions:
  - "MrAttentionTab uses combined loading state: useDelayedLoading(gitlabTokenLoading || isLoading) to preserve existing Stronghold-read skeleton coverage"
  - "EpicsPage has no refresh button; only ErrorState/StaleDataBanner onRetry use invalidateQueries"
  - "Content guards changed from !isLoading to !showSkeleton to prevent content flash while isRefreshing=true"
  - "useListNavigation enabled guard in MyTasksTab updated to !showSkeleton (consistent with content guards)"

patterns-established:
  - "Refresh invalidation pattern: setIsRefreshing(true) + queryClient.invalidateQueries({ queryKey: ['...prefix'] })"

requirements-completed: [LOAD-01, LOAD-05]

# Metrics
duration: 15min
completed: 2026-03-30
---

# Phase 44 Plan 03: Loading UX — Skeleton Wiring (Remaining 6 Views) Summary

**Layout-matched skeletons wired into all 6 remaining views (MyTasks, Workload, SprintProgress, Epics, Releases, MrAttention) with useDelayedLoading + cache-invalidating refresh, completing LOAD-01 and LOAD-05 coverage for all 8 major views**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-30T07:17:00Z
- **Completed:** 2026-03-30T07:20:30Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- All 6 remaining views now use their dedicated skeleton components (no more raw `bg-muted animate-pulse` divs)
- All 6 views have `useDelayedLoading` wired — 200ms flicker prevention prevents skeleton flash on fast loads
- All 6 refresh buttons changed from `refetch()` to `queryClient.invalidateQueries` with `isRefreshing` flag so skeleton shows immediately on manual refresh
- ErrorState and StaleDataBanner `onRetry` props updated with the same cache invalidation pattern
- 73 tests across all 6 test suites pass with zero changes to test files

## Task Commits

1. **Task 1: Wire skeletons into MyTasksTab, WorkloadTab, SprintProgressTab** - `cd03cdb` (feat)
2. **Task 2: Wire skeletons into EpicsPage, ReleasesTab, MrAttentionTab** - `9201421` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - MyTasksSkeleton + useDelayedLoading + invalidateQueries on refresh
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` - WorkloadSkeleton + useDelayedLoading + invalidateQueries on refresh
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` - SprintProgressSkeleton + useDelayedLoading + invalidateQueries on refresh
- `taskflow/src/routes/dashboard/EpicsPage.tsx` - EpicsSkeleton + useDelayedLoading + invalidateQueries on error retry
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - ReleasesSkeleton + useDelayedLoading + invalidateQueries on refresh
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` - MrAttentionSkeleton + useDelayedLoading (combined gitlabTokenLoading || isLoading) + invalidateQueries on refresh

## Decisions Made

- MrAttentionTab preserves its existing `gitlabTokenLoading || isLoading` combined skeleton guard by passing the combined value to `useDelayedLoading`. This keeps the Stronghold-read skeleton coverage that was already in place.
- EpicsPage has no refresh button in its header (only a "Create Epic" button). The skeleton wiring uses invalidateQueries only on ErrorState/StaleDataBanner onRetry callbacks.
- Content visibility guards were changed from `!isLoading` to `!showSkeleton` so content doesn't flash while `isRefreshing=true` after a manual cache invalidation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs

None — all skeleton components are functional. The views render their skeletons in the loading branch and real content in the success branch.

## Next Phase Readiness

- LOAD-01 complete: all 8 major views have layout-matched skeletons
- LOAD-05 complete: all 8 major views use 200ms flicker prevention via useDelayedLoading
- Combined with Plan 02 (SprintBoard + Backlog), the full loading UX phase is complete

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit cd03cdb (Task 1): FOUND
- Commit 9201421 (Task 2): FOUND

---
*Phase: 44-loading-ux*
*Completed: 2026-03-30*
