---
phase: 48-restore-backlog-progressive-loading
plan: 02
subsystem: backlog-tests
tags: [tests, backlog, progressive-loading, mocks]
requirements: [LOAD-01, LOAD-04, LOAD-05, QOPT-02]

dependency_graph:
  requires: [48-01]
  provides: [BacklogPage test coverage for per-section query architecture]
  affects: [taskflow/src/routes/dashboard/BacklogPage.test.tsx]

tech_stack:
  added: []
  patterns:
    - resetMocks helper pattern for vi.resetAllMocks() + re-establishing base implementations
    - Per-section mock pattern (fetchSprintStories + fetchSprintList + fetchBacklogIssues)
    - sprintId field in makeIssue fixture for sprint grouping

key_files:
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx

decisions:
  - Used resetMocks() async helper to re-establish base mock implementations after vi.resetAllMocks() — vi.resetAllMocks() clears mock implementations, so stronghold readSecret and other always-on mocks needed to be reinstated in beforeEach
  - Kept LOAD-04 test inline with BACK-01 describe block — it validates loading state, which fits the list rendering group

metrics:
  duration_minutes: 12
  completed_date: "2026-04-04"
  tasks_completed: 2
  files_modified: 1
---

# Phase 48 Plan 02: Update BacklogPage Tests for Per-Section Query Architecture Summary

Updated BacklogPage.test.tsx mocks from the defunct fetchBacklogView single-query pattern to the new three-query architecture (fetchSprintStories + fetchSprintList + fetchBacklogIssues) and added LOAD-04 test validating per-row epic Skeleton during allEpics loading.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Update test mocks to per-section query architecture | 5e84a6d | BacklogPage.test.tsx |
| 2 | Add LOAD-04 test for per-row epic Skeleton | 5e84a6d | BacklogPage.test.tsx |

## What Was Built

**Mock architecture replacement:**
- Removed `vi.mock('@/services/jira')` entry for `fetchBacklogView` and `fetchActiveSprint`
- Added `vi.mock('@/services/jira/issues')` with `fetchSprintStories`
- Added `vi.mock('@/services/jira/backlog')` with `fetchSprintList` and `fetchBacklogIssues`
- Added `vi.mock('@/hooks/useBoardId')` returning `{ boardId: 1 }`
- Added `vi.mock('@/hooks/useDelayedLoading')` passing `isPending` through directly (no delay in tests)

**Fixture update:**
- `makeIssue` now accepts optional `sprintId` parameter, populating `fields.sprint.id` for proper sprint grouping in `mergedSprints` computation

**Test case updates:**
- All 14 existing tests (BACK-01 through BACK-05) updated to use new per-function mock pattern
- `vi.clearAllMocks()` replaced with `vi.resetAllMocks()` + `resetMocks()` async helper

**New test:**
- LOAD-04: `shows epic skeleton badge while allEpics is loading` — verifies backlog issues render while fetchEpicsBasic is pending, and epic badge cell shows `.animate-pulse` skeleton for issues with epic keys

**Results:** 15/15 tests pass; full 834-test suite green.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] resetMocks helper needed after vi.resetAllMocks()**
- **Found during:** Task 1 — first test run
- **Issue:** `vi.resetAllMocks()` clears mock implementations including `readSecret.mockResolvedValue('test-jira-token')`, causing `Cannot read properties of undefined (reading 'then')` in the `useEffect` that calls `readSecret('jira-pat').then(setJiraToken)`
- **Fix:** Created async `resetMocks()` helper called in `beforeEach` that re-establishes base implementations for `readSecret`, `fetchEpicsBasic`, `fetchProjectStatuses`, `addIssuesToSprint`, `fetchSprintStories`, `fetchSprintList`, `fetchBacklogIssues`, `useBoardId`, `useDelayedLoading`, and `useOutletContext`
- **Files modified:** BacklogPage.test.tsx
- **Commit:** 5e84a6d

## Known Stubs

None — test file only; no UI stubs introduced.

## Self-Check: PASSED

- [x] `/Users/mimo/Desktop/Tasker/taskflow/src/routes/dashboard/BacklogPage.test.tsx` — file exists and modified
- [x] Commit `5e84a6d` exists
- [x] No `fetchBacklogView` references in test file (grep count: 0)
- [x] LOAD-04 test present at line 208
- [x] All 15 BacklogPage tests pass
- [x] Full 834-test suite green
