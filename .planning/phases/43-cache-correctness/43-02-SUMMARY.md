---
phase: 43-cache-correctness
plan: 02
subsystem: ui
tags: [tanstack-query, react-router, polling, cache, route-aware]

requires:
  - POLL_INTERVAL_MS and STALE_TIME_MS from query-constants.ts (43-01)
  - useIsActiveRoute hook (43-01)
provides:
  - Route-aware polling pause on all 5 view-scoped polling queries (QOPT-04)
  - Background polling suppressed via refetchIntervalInBackground: false (QOPT-05)
  - Magic number elimination — all polling queries use shared constants
affects: [43-03]

tech-stack:
  added: []
  patterns:
    - "useIsActiveRoute wired into all 5 view-scoped tabs: enabled: isActive && ...existing guards"
    - "refetchIntervalInBackground: false on all view-scoped queries (was true or absent)"
    - "Test mocks: useLocation returns correct route pathname so queries remain enabled in tests"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx

key-decisions:
  - "Test mocks return correct route pathname (/sprint-board, /workload, etc.) so isActive=true and queries run in tests"
  - "MrAttentionTab: useLocation was already imported (pre-existing); useIsActiveRoute added alongside"
  - "Only the polling query (with refetchInterval) modified per-file; non-polling queries left untouched"

requirements-completed: [QOPT-04, QOPT-05]

duration: 8min
completed: 2026-03-29
---

> **Historical note (Phase 49):** `MrAttentionTab.tsx` referenced throughout this document was later removed in a subsequent phase. References below reflect the file's name at the time Phase 43 was executed.

# Phase 43 Plan 02: Route-Aware Polling Wiring Summary

**All 5 view-scoped polling queries now pause when their route is inactive and stop polling in background — shared constants replace all magic numbers**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-03-29T23:10:00Z
- **Completed:** 2026-03-29T23:18:00Z
- **Tasks:** 2
- **Files modified:** 10 (5 components + 5 test files)

## Accomplishments

- Wired `useIsActiveRoute` into all 5 view-scoped polling tabs with correct route paths
- Added `enabled: isActive && ...` to all 6 polling queries (MyTasksTab has 2)
- Changed `refetchIntervalInBackground: true` to `false` on SprintBoardTab, MyTasksTab (x2), and MrAttentionTab
- Added `refetchIntervalInBackground: false` explicitly to WorkloadTab and SprintProgressTab (was absent — default is false but now explicit per D-10)
- Replaced all `refetchInterval: 60_000` and `staleTime: 30_000` magic numbers with `POLL_INTERVAL_MS` and `STALE_TIME_MS`
- Updated 5 test files to return correct route pathname in `useLocation` mock so `isActive=true` and queries still execute in tests
- Confirmed `useNotificationPolling.ts` still has `refetchIntervalInBackground: true` (untouched per D-07)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire polling changes into SprintBoardTab, WorkloadTab, SprintProgressTab** - `68f1418` (feat)
2. **Task 2: Wire polling changes into MyTasksTab and MrAttentionTab** - `598ceca` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — useIsActiveRoute('/sprint-board'), POLL_INTERVAL_MS, STALE_TIME_MS, refetchIntervalInBackground: false
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` — useIsActiveRoute('/workload'), POLL_INTERVAL_MS, STALE_TIME_MS, refetchIntervalInBackground: false (added)
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — useIsActiveRoute('/sprint-progress'), POLL_INTERVAL_MS, STALE_TIME_MS, refetchIntervalInBackground: false (added)
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — useIsActiveRoute('/my-tasks'), POLL_INTERVAL_MS, STALE_TIME_MS, refetchIntervalInBackground: false on both queries
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — useIsActiveRoute('/mr-attention'), POLL_INTERVAL_MS, STALE_TIME_MS, refetchIntervalInBackground: false
- All 5 corresponding test files — useLocation mock returns correct route pathname

## Decisions Made

- `useLocation` mock in tests returns the tab's own route path (e.g. `/workload` for WorkloadTab tests) so `isActive=true` and queries remain enabled — tests still exercise the fetch path
- Only the one polling `useQuery` per file was modified; non-polling queries (worklog map, epics, sprint issues for link-engine) were left untouched

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mocks missing useLocation export**
- **Found during:** Task 1 execution (tests failed immediately after adding useIsActiveRoute)
- **Issue:** `vi.mock('react-router-dom')` in 5 test files did not export `useLocation`, causing "No 'useLocation' export is defined on the mock" runtime errors
- **Fix:** Added `useLocation: vi.fn(() => ({ pathname: '<route>' }))` to each test's react-router-dom mock, returning the tab's own pathname so `isActive=true` and queries remain enabled
- **Files modified:** SprintBoardTab.test.tsx, WorkloadTab.test.tsx (new mock block added), SprintProgressTab.test.tsx, MyTasksTab.test.tsx, MrAttentionTab.test.tsx (pathname changed from /dashboard to /mr-attention)
- **Commits:** 68f1418, 598ceca

## Issues Encountered

None beyond the test mock fix above.

## User Setup Required

None.

## Next Phase Readiness

- All 5 view-scoped polls now pause when navigating away and when app is minimized
- Notification polling continues in background (D-07 preserved)
- Phase 43 complete — all cache-correctness requirements (LOAD-02, QOPT-04, QOPT-05) implemented

---
*Phase: 43-cache-correctness*
*Completed: 2026-03-29*

## Self-Check: PASSED
- SprintBoardTab.tsx: contains useIsActiveRoute('/sprint-board'), POLL_INTERVAL_MS, refetchIntervalInBackground: false
- WorkloadTab.tsx: contains useIsActiveRoute('/workload'), POLL_INTERVAL_MS, refetchIntervalInBackground: false
- SprintProgressTab.tsx: contains useIsActiveRoute('/sprint-progress'), POLL_INTERVAL_MS, refetchIntervalInBackground: false
- MyTasksTab.tsx: contains useIsActiveRoute('/my-tasks'), POLL_INTERVAL_MS, refetchIntervalInBackground: false (x2)
- MrAttentionTab.tsx: contains useIsActiveRoute('/mr-attention'), POLL_INTERVAL_MS, refetchIntervalInBackground: false
- Commit 68f1418: FOUND
- Commit 598ceca: FOUND
- All tests: 793 passed, 0 failed
