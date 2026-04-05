---
phase: 48-restore-backlog-progressive-loading
plan: 03
subsystem: testing
tags: [vitest, typescript, react-query, backlog, cache-invalidation]

# Dependency graph
requires:
  - phase: 48-restore-backlog-progressive-loading
    provides: "BacklogPage per-section query architecture and updated test mocks (48-02)"
provides:
  - "Type-safe BacklogPage.test.tsx with all 7 TypeScript errors resolved"
  - "Cache-invalidation assertion verifying jira-sprint-stories key is invalidated on move-to-sprint"
affects: [48-restore-backlog-progressive-loading]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "as unknown as EpicEnriched[] cast pattern for partial mock objects in TypeScript strict mode"
    - "QueryClient spy pattern: create isolated client, spy on invalidateQueries, render with that client"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx

key-decisions:
  - "Used as unknown as EpicEnriched[] cast rather than full mock objects to keep test fixtures minimal while satisfying TypeScript"
  - "Cache-invalidation test creates its own QueryClient (not renderBacklogPage helper) to enable spying on invalidateQueries"

patterns-established:
  - "Partial mock objects use as unknown as FullType[] to satisfy TypeScript without over-specifying fixture data"

requirements-completed: [LOAD-01, LOAD-04, LOAD-05, QOPT-02]

# Metrics
duration: 8min
completed: 2026-04-04
---

# Phase 48 Plan 03: Gap Closure — TS Type Errors and Cache Invalidation Test Summary

**BacklogPage.test.tsx gap closure: 7 TypeScript errors fixed and jira-sprint-stories cache-invalidation assertion added to BACK-02**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-04T19:00:00Z
- **Completed:** 2026-04-04T19:08:00Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Resolved all 7 TypeScript type errors: added `isLoading: false` to useBoardId mock and `as unknown as EpicEnriched[]` cast to 3 fetchEpicsBasic mock calls
- Added `import type { EpicEnriched } from '@/services/jira'` required for the cast
- Added new BACK-02 test `moving an issue to a sprint invalidates jira-sprint-stories cache key` with QueryClient spy pattern
- All 16 BacklogPage tests pass (was 15); `npx tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix TypeScript type errors in test mocks** - `98e6ded` (fix)
2. **Task 2: Add cache-invalidation assertion to BACK-02** - `748a283` (test)

## Files Created/Modified
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` - Added EpicEnriched import, isLoading: false to useBoardId mock, three EpicEnriched[] casts, and new cache-invalidation test in BACK-02

## Decisions Made
- Used `as unknown as EpicEnriched[]` cast rather than full mock objects — keeps test fixtures minimal while satisfying TypeScript strict mode
- Cache-invalidation test creates its own QueryClient (bypasses `renderBacklogPage` helper) to enable spying on `invalidateQueries` before the component renders

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All verification gaps from VERIFICATION.md are now closed: 11/11 truths verified
- TypeScript compiles cleanly (`npx tsc --noEmit` exits 0)
- Full BacklogPage test suite green (16 tests)
- Phase 48 gap closure complete

---
*Phase: 48-restore-backlog-progressive-loading*
*Completed: 2026-04-04*
