---
phase: 43-cache-correctness
plan: 01
subsystem: ui
tags: [tanstack-query, react-router, polling, cache, hooks]

requires: []
provides:
  - POLL_INTERVAL_MS and STALE_TIME_MS shared constants in query-constants.ts
  - useIsActiveRoute hook for route-aware polling pause
  - QueryClient with gcTime: Infinity ensuring cache entries survive entire session
affects: [43-02]

tech-stack:
  added: []
  patterns:
    - "useIsActiveRoute: mock useLocation with vi.mock for hook unit tests"
    - "gcTime: Infinity on QueryClient defaultOptions for session-persistent cache"
    - "Shared constants file (query-constants.ts) enforces staleTime < refetchInterval invariant"

key-files:
  created:
    - taskflow/src/lib/query-constants.ts
    - taskflow/src/hooks/useIsActiveRoute.ts
    - taskflow/src/hooks/useIsActiveRoute.test.ts
  modified:
    - taskflow/src/main.tsx

key-decisions:
  - "POLL_INTERVAL_MS=60_000 and STALE_TIME_MS=30_000 as shared constants so invariant is compile-time verifiable"
  - "gcTime: Infinity globally in QueryClient defaultOptions so all queries survive session without per-query config"
  - "useIsActiveRoute uses pathname.startsWith(routePath + '/') to avoid false matches on shared prefixes"

patterns-established:
  - "Hook tests: vi.mock('react-router-dom') with mockReturnValue for useLocation — no router wrapper needed"
  - "TDD: write failing test, create implementation, confirm green"

requirements-completed: [LOAD-02, QOPT-04]

duration: 5min
completed: 2026-03-29
---

# Phase 43 Plan 01: Cache Infrastructure Summary

**Query-constants shared module, useIsActiveRoute hook, and gcTime: Infinity on QueryClient establish session-persistent cache and route-aware polling pause infrastructure**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-29T23:06:00Z
- **Completed:** 2026-03-29T23:08:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `query-constants.ts` exporting POLL_INTERVAL_MS (60_000) and STALE_TIME_MS (30_000) with enforced invariant comment
- Created `useIsActiveRoute` hook using `useLocation()` for prefix-safe route detection
- Added 7 unit tests covering all routing scenarios plus constant invariant
- Added `gcTime: Infinity` to QueryClient defaultOptions so navigating back always shows cached data instantly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create query-constants.ts and useIsActiveRoute hook with tests** - `0afc58d` (feat)
2. **Task 2: Add gcTime: Infinity to QueryClient defaultOptions** - `6b039cf` (feat)

**Plan metadata:** committed with docs commit after SUMMARY creation

_Note: Task 1 used TDD — tests written first (RED), then implementation created (GREEN)_

## Files Created/Modified
- `taskflow/src/lib/query-constants.ts` - POLL_INTERVAL_MS and STALE_TIME_MS shared constants with invariant documentation
- `taskflow/src/hooks/useIsActiveRoute.ts` - Route-awareness hook using useLocation() for polling pause
- `taskflow/src/hooks/useIsActiveRoute.test.ts` - 7 unit tests (exact match, prefix match, non-match, false-prefix, constant values, invariant)
- `taskflow/src/main.tsx` - Added gcTime: Infinity to QueryClient defaultOptions.queries

## Decisions Made
- Used `pathname.startsWith(routePath + '/')` to prevent false prefix matches (e.g., `/sprint-board-extra` does not match `/sprint-board`)
- Kept gcTime: Infinity at global QueryClient level rather than per-query, matching D-02 from CONTEXT.md
- Existing explicit `gcTime: Infinity` on `pinnedQueries` (line 173 in main.tsx) intentionally preserved per plan instructions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02 can now import `useIsActiveRoute` and `POLL_INTERVAL_MS`/`STALE_TIME_MS` to wire view-scoped polling pause
- gcTime: Infinity is live — all queries now persist cache indefinitely during the session

---
*Phase: 43-cache-correctness*
*Completed: 2026-03-29*

## Self-Check: PASSED
- query-constants.ts: FOUND
- useIsActiveRoute.ts: FOUND
- useIsActiveRoute.test.ts: FOUND
- SUMMARY.md: FOUND
- Commit 0afc58d: FOUND
- Commit 6b039cf: FOUND
