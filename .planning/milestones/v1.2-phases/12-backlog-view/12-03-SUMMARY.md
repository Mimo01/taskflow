---
phase: 12-backlog-view
plan: 03
subsystem: ui
tags: [react, tanstack-query, optimistic-updates, backlog, jira]

# Dependency graph
requires:
  - phase: 12-02
    provides: BacklogPage, BacklogRow, BacklogFilterBar UI components; BACK-01 and BACK-04 tests GREEN
  - phase: 12-01
    provides: fetchBacklogIssues, fetchActiveSprint, addIssuesToSprint in jira.ts
provides:
  - handleMoveToSprint with optimistic cache update and rollback via queryClient
  - openCreateStory in AppLayout Outlet context opening CreateEditIssueModal with type=Story
  - jira-backlog cache invalidated on story create close via wasStoryCreate ref
  - All BACK-01..05 tests GREEN (13/13)
affects: [12-04, main-layout, backlog-view]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Optimistic update via queryClient.setQueryData with getQueryData snapshot for rollback
    - wasStoryCreate ref pattern for conditional cache invalidation on modal close
    - AppLayout Outlet context extension for child route actions

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx

key-decisions:
  - "Button text 'Move to sprint' (not 'Move N issues to active sprint') — required to match test regex /move to sprint/i"
  - "useOutletContext mock changed from plain fn to vi.fn() — enables BACK-03 and BACK-05 tests to call mockReturnValue"
  - "wasStoryCreate ref tracks modal open source for conditional jira-backlog invalidation on close"
  - "bulkError inline in action bar (not top-of-page) — plan spec; err.message used to match test expectation /failed to add issues to sprint/i"
  - "queryClient.setQueryData optimistic removal replaces movedKeys local state — more React Query idiomatic"

patterns-established:
  - "Optimistic update: snapshot previousData before setQueryData, restore on catch, invalidate on success"
  - "Outlet context extension: add new callback alongside existing ones without breaking consumers"

requirements-completed: [BACK-02, BACK-03]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 12 Plan 03: Move-to-Sprint and Create Story Wiring Summary

**Optimistic move-to-sprint via queryClient cache manipulation + openCreateStory in Outlet context; all 13 BACK-01..05 tests GREEN**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T17:05:59Z
- **Completed:** 2026-03-14T17:10:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Added `handleOpenCreateStory` to AppLayout with `wasStoryCreate` ref pattern for conditional `['jira-backlog']` invalidation on modal close
- Extended Outlet context with `openCreateStory` callback and wired `handleCreateModalClose` for clean cache invalidation
- Replaced `movedKeys` local state with `queryClient.setQueryData` optimistic approach in `handleMoveToSprint`; invalidates `['jira-issues', 'sprint-board']` and `['jira-backlog']` on success
- Fixed `useOutletContext` mock to `vi.fn()` making BACK-03 and BACK-05 tests work

## Task Commits

Each task was committed atomically:

1. **Task 1: Add openCreateStory to AppLayout Outlet context in main.tsx** - `abc0fac` (feat)
2. **Task 2: Wire bulk action bar and Create Story in BacklogPage.tsx** - `1f70953` (feat)

## Files Created/Modified
- `taskflow/src/main.tsx` - Added handleOpenCreateStory, wasStoryCreate ref, handleCreateModalClose, extended Outlet context
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - queryClient optimistic moves, bulkError state, button text fix, required openCreateStory type
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` - Fixed useOutletContext mock to vi.fn() for BACK-03/BACK-05

## Decisions Made
- **Button text "Move to sprint"**: The pre-written test regex `/move to sprint/i` requires this exact substring. The plan's template "Move {n} issues to active sprint" would not match.
- **`vi.fn()` mock fix**: BACK-03 and BACK-05 call `vi.mocked(useOutletContext).mockReturnValue(...)` which requires `useOutletContext` to be a `vi.fn()`. The previous plain function mock broke these tests.
- **`err.message` for bulkError**: Tests expect `/failed to add issues to sprint/i` matching the thrown error message, not a hardcoded string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Changed useOutletContext mock from plain function to vi.fn()**
- **Found during:** Task 2 (BacklogPage test run)
- **Issue:** BACK-03 and BACK-05 tests call `vi.mocked(useOutletContext).mockReturnValue(...)` but the mock was defined as a plain arrow function. `vi.mocked` can't call `.mockReturnValue` on a non-mock function, causing `TypeError: mockReturnValue is not a function`.
- **Fix:** Changed `useOutletContext: () => (...)` to `useOutletContext: vi.fn(() => (...))`
- **Files modified:** taskflow/src/routes/dashboard/BacklogPage.test.tsx
- **Verification:** BACK-03 and BACK-05 now pass; all 13 tests GREEN
- **Committed in:** 1f70953 (Task 2 commit)

**2. [Rule 1 - Bug] Changed button text from "Move N issues to active sprint" to "Move to sprint"**
- **Found during:** Task 2 (test run analysis)
- **Issue:** Plan template used "Move {n} issue{s} to active sprint" which doesn't contain "move to sprint" as a contiguous substring, causing `/move to sprint/i` regex test to fail
- **Fix:** Simplified button text to "Move to sprint" — the count is already shown in the "N issues selected" span
- **Files modified:** taskflow/src/routes/dashboard/BacklogPage.tsx
- **Verification:** All BACK-02 tests find the button; 13/13 tests GREEN
- **Committed in:** 1f70953 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required to make the pre-written tests GREEN. No scope creep.

## Issues Encountered
- Pre-existing `useOutletContext` mock design issue (documented in STATE.md [12-02] note) required targeted fix to enable BACK-03 and BACK-05 tests.

## Next Phase Readiness
- All 5 BACK requirements implemented and tested (BACK-01..05 GREEN)
- BacklogPage fully interactive: filter, select, move to sprint, create story
- Ready for Phase 12 Plan 04 (final integration/E2E verification)

---
*Phase: 12-backlog-view*
*Completed: 2026-03-14*
