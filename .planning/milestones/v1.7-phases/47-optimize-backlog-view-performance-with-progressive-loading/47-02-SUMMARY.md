---
phase: 47-optimize-backlog-view-performance-with-progressive-loading
plan: 02
subsystem: ui
tags: [react, tanstack-query, backlog, progressive-loading, virtualization, vitest]

requires:
  - phase: 47-01
    provides: "fetchSprintList in backlog.ts, div-based BacklogRow with epicsLoading prop, always-on VirtualizedBacklogTable"

provides:
  - "BacklogPage wired to per-section queries (jira-sprint-stories shared cache, jira-sprint-list, jira-future-sprint-issues, jira-backlog-issues)"
  - "Progressive rendering: sprint and backlog sections load independently with useDelayedLoading"
  - "fetchFutureSprintIssues function in backlog.ts for Agile board future sprint issues"
  - "handleMoveToSprint optimistically updates both jira-backlog-issues and jira-sprint-stories caches"
  - "Updated BacklogPage tests (19 passing) with virtualizer mock and test isolation via resetMocks()"
  - "New fetchSprintList and fetchFutureSprintIssues service tests (13 passing in backlog.test.ts)"
  - "LOAD-04 test cases: per-row epic Skeleton and div-based row rendering"

affects: [backlog, sprint-board, progressive-loading]

tech-stack:
  added: []
  patterns:
    - "Per-section progressive rendering: each data section has its own query and useDelayedLoading skeleton"
    - "Shared cache across tabs: jira-sprint-stories used by both SprintBoardTab and BacklogPage active sprint section"
    - "vi.resetAllMocks() in beforeEach for backlog.test.ts to clear mockResolvedValueOnce queues between tests"
    - "resetMocks() async helper in BacklogPage.test.tsx for clean service mock isolation"
    - "@tanstack/react-virtual mock in BacklogPage tests to render all items in jsdom"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
    - taskflow/src/services/jira/backlog.ts
    - taskflow/src/services/jira/backlog.test.ts

key-decisions:
  - "fetchFutureSprintIssues added to backlog.ts alongside fetchSprintList — future sprint issues need a separate Agile API query since jira-sprint-stories only fetches openSprints()"
  - "handleMoveToSprint optimistically updates both jira-backlog-issues AND jira-sprint-stories caches — sprint section issues must also disappear immediately on move"
  - "vi.clearAllMocks() does NOT clear mockResolvedValueOnce queues — use vi.resetAllMocks() in beforeEach for backlog.test.ts to prevent test pollution"
  - "@tanstack/react-virtual mock in BacklogPage.test.tsx renders all items without jsdom scroll dimensions — fixes pre-existing test failures"
  - "resetMocks() async helper centralizes test setup with explicit defaults after clear — prevents mock bleed between describe blocks"

requirements-completed: [LOAD-04]

duration: 27min
completed: 2026-04-01
---

# Phase 47 Plan 02: BacklogPage Per-Section Progressive Loading Summary

**BacklogPage rewired to four independent TanStack Query sections (shared sprint stories, sprint list, future sprint issues, backlog issues) with per-section useDelayedLoading skeletons and optimistic cache updates for both backlog and sprint caches**

## Performance

- **Duration:** 27 min
- **Started:** 2026-04-01T00:04:34Z
- **Completed:** 2026-04-01T00:31:30Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Replaced monolithic `fetchBacklogView`/`jira-backlog-view` query with four independent per-section queries enabling progressive rendering
- Added `fetchFutureSprintIssues` to backlog.ts for Agile board future sprint issues endpoint
- Wired `orderedSprintSections` memo derived from sprintList + sprintStories + futureSprintIssues with sprint ID attribution
- Updated `handleMoveToSprint` to optimistically update both `jira-backlog-issues` and `jira-sprint-stories` caches with rollback on failure
- Fixed pre-existing BacklogPage test failures by mocking `@tanstack/react-virtual` for jsdom compatibility
- Added LOAD-04 test cases (per-row epic Skeleton, div-based row assertion) and service tests for fetchSprintList and fetchFutureSprintIssues
- Full suite: 838 tests pass, 0 TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace monolithic fetchBacklogView query with per-section queries** - `7fbde7d` (feat)
2. **Task 2: Update BacklogPage tests and add LOAD-04 test cases** - `3f29789` (test)

## Files Created/Modified

- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Rewired to 4 per-section queries, progressive rendering, updated handleMoveToSprint
- `taskflow/src/services/jira/backlog.ts` - Added fetchFutureSprintIssues (Agile board future sprint endpoint)
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` - Updated mocks, resetMocks() helper, virtualizer mock, LOAD-04 tests
- `taskflow/src/services/jira/backlog.test.ts` - Added fetchSprintList and fetchFutureSprintIssues tests, vi.resetAllMocks() in beforeEach

## Decisions Made

- `fetchFutureSprintIssues` added to backlog.ts: future sprint issues need a separate Agile API query since `jira-sprint-stories` only fetches `openSprints()`. Without this, future sprint sections show empty.
- `handleMoveToSprint` updates `jira-sprint-stories` cache optimistically in addition to `jira-backlog-issues`: the test verified that sprint section items must visually disappear on optimistic removal, not just backlog items.
- `vi.resetAllMocks()` used in backlog.test.ts beforeEach: discovered that `vi.clearAllMocks()` does not clear `mockResolvedValueOnce` queues — using `resetAllMocks()` prevents stale mock values bleeding across tests.
- `@tanstack/react-virtual` mocked in BacklogPage.test.tsx: virtualizer returns 0 items when scrollElement is null in jsdom. Mock renders all items directly, fixing pre-existing test failures.
- `resetMocks()` async helper centralizes test defaults: after vi.clearAllMocks(), all service mocks need explicit defaults to prevent BACK-01's fetchSprintList setup from bleeding into BACK-02 tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] handleMoveToSprint also optimistically updates jira-sprint-stories cache**
- **Found during:** Task 2 (test for "clicking Move to sprint removes selected sprint issues optimistically")
- **Issue:** Sprint section issues come from `orderedSprintSections` derived from `sprintStories` cache. The original plan only updated `jira-backlog-issues`. Sprint issues persisted in the DOM after optimistic move.
- **Fix:** Added optimistic `setQueryData` on `jira-sprint-stories` key before calling `addIssuesToSprint`, with rollback included in catch block.
- **Files modified:** `taskflow/src/routes/dashboard/BacklogPage.tsx`
- **Verification:** BACK-02 sprint issues test now passes
- **Committed in:** `7fbde7d` (Task 1 commit, part of handleMoveToSprint update)

**2. [Rule 1 - Bug] Pre-existing BacklogPage test failures due to jsdom virtualizer returning 0 items**
- **Found during:** Task 2 (running tests)
- **Issue:** `@tanstack/react-virtual` useVirtualizer returns 0 virtual items when `scrollElement` is null in jsdom — rows were never rendered in tests
- **Fix:** Added `vi.mock('@tanstack/react-virtual', ...)` to render all items without scroll dimension dependency
- **Files modified:** `taskflow/src/routes/dashboard/BacklogPage.test.tsx`
- **Verification:** All 19 BacklogPage tests pass
- **Committed in:** `3f29789` (Task 2 commit)

**3. [Rule 1 - Bug] Mock bleed between BacklogPage tests due to vi.clearAllMocks() not resetting implementations**
- **Found during:** Task 2 (BACK-02 tests failing with "Found multiple elements")
- **Issue:** `vi.clearAllMocks()` does not reset `mockResolvedValue` implementations — BACK-01's `fetchSprintList` setup leaked into BACK-02
- **Fix:** Added `resetMocks()` async helper that calls `vi.clearAllMocks()` then re-establishes safe defaults for all service mocks
- **Files modified:** `taskflow/src/routes/dashboard/BacklogPage.test.tsx`
- **Verification:** Test isolation confirmed — all 19 tests pass independently
- **Committed in:** `3f29789` (Task 2 commit)

**4. [Rule 1 - Bug] backlog.test.ts mock queue pollution via clearAllMocks vs resetAllMocks**
- **Found during:** Task 2 (fetchSprintList tests failing with wrong data from previous test)
- **Issue:** `vi.clearAllMocks()` does not clear `mockResolvedValueOnce` queues — fetchBacklogView tests' apiFetch queue was consumed by fetchSprintList tests
- **Fix:** Changed `beforeEach(() => vi.clearAllMocks())` to `vi.resetAllMocks()` in backlog.test.ts
- **Files modified:** `taskflow/src/services/jira/backlog.test.ts`
- **Verification:** All 13 backlog service tests pass
- **Committed in:** `3f29789` (Task 2 commit)

---

**Total deviations:** 4 auto-fixed (all Rule 1 bugs)
**Impact on plan:** All fixes necessary for correctness. The handleMoveToSprint cache update was a behavioral gap. The test fixes resolved pre-existing failures and test isolation issues uncovered during the rewrite.

## Issues Encountered

- The virtualizer mock approach (`count` and `estimateSize` destructuring) required checking the exact interface of `useVirtualizer` to ensure the mock returned valid virtual items with `index`, `start`, and `size` properties.
- The `resetMocks()` helper needed to be `async` because `import('@/services/jira/backlog')` returns a Promise — required `await` in beforeEach.

## Known Stubs

None — all queries are wired to real service functions. Progressive sections render independently from live data.

## Next Phase Readiness

- Phase 47-02 completes the progressive loading architecture for BacklogPage
- Sprint sections benefit from shared `jira-sprint-stories` cache with SprintBoardTab
- Backlog section loads independently without waiting for sprint data
- All 838 tests pass with the new architecture

## Self-Check: PASSED

---
*Phase: 47-optimize-backlog-view-performance-with-progressive-loading*
*Completed: 2026-04-01*
