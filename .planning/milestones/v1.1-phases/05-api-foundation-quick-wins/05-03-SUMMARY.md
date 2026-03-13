---
phase: 05-api-foundation-quick-wins
plan: 03
subsystem: api
tags: [jira, fetch, tdd, vitest, typescript, sprint, subtasks]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins plan 02
    provides: JiraIssue type extended with parent/subtasks/timetracking fields and discoverStoryPointsField
provides:
  - fetchSprintIssues with two-query subtask strategy (parent issues + subtasks merged)
  - SUBTASK_CHUNK_SIZE=50 constant for safe Jira DC URL limits
  - APIF-02 test suite: merge, throw fallback, non-OK fallback, chunking
affects:
  - phase 06 (hierarchy UI — depends on subtasks being present in JiraIssue[] array)
  - phase 07 (workload — needs subtask timetracking data)
  - MyTasksTab, SprintBoardTab, WorkloadTab, SprintProgressTab (transparent — return type unchanged)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-query subtask strategy for Jira DC (sprint in openSprints() excludes subtasks by design)
    - Promise.all chunking at 50 keys per chunk to stay within Jira DC URL length limits
    - Silent fallback on subtask query failure — callers never observe subtask errors

key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts

key-decisions:
  - "Two-query strategy: parent query first, then issuetype in subtaskIssueTypes() AND parent in (...) for subtasks"
  - "SUBTASK_CHUNK_SIZE=50 as module-level constant — safe for Jira DC URL limits"
  - "Subtask fields exclude description (on-demand only) — bandwidth saving"
  - "Silent fallback on subtask query failure — throw only on parent query failures"
  - "Switch beforeEach from vi.clearAllMocks() to vi.resetAllMocks() — clearAllMocks does not clear unconsumed Once queues"

patterns-established:
  - "Two-query pattern: fetch parent collection, then related entities in chunked parallel queries"
  - "Silent fallback wrapping: try/catch around enhancement queries, return base data on failure"

requirements-completed: [APIF-02]

# Metrics
duration: 8min
completed: 2026-03-12
---

# Phase 5 Plan 03: fetchSprintIssues Two-Query Subtask Strategy Summary

**fetchSprintIssues now merges sprint parent issues with a second chunked subtask query (50 keys/chunk), silently falling back to parent-only on any subtask query failure**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-12T14:32:00Z
- **Completed:** 2026-03-12T14:39:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Implemented two-query subtask strategy in fetchSprintIssues — resolves the Jira DC limitation where `sprint in openSprints()` intentionally excludes subtasks
- Chunking at 50 parent keys per subtask query keeps within Jira DC URL length limits for large sprints (55 parents = 2 subtask fetch calls)
- Silent fallback: any subtask query throw or non-OK response returns parent issues only — all four callers remain unchanged
- APIF-02 test suite: 4 new tests cover merge, throw fallback, non-OK fallback, and chunk boundary (55 parents)
- Fixed pre-existing test isolation issue: switched `vi.clearAllMocks()` to `vi.resetAllMocks()` to prevent unconsumed `mockResolvedValueOnce` queues from contaminating subsequent tests

## Task Commits

Each task was committed atomically:

1. **RED: APIF-02 failing tests** - `097e230` (test)
2. **GREEN: two-query implementation** - `9bd1b30` (feat)

## Files Created/Modified

- `taskflow/src/services/jira.ts` - Added SUBTASK_CHUNK_SIZE constant, updated fetchSprintIssues with two-query strategy and silent fallback
- `taskflow/src/services/jira.test.ts` - Added APIF-02 describe block (4 tests), fixed DEV-01 test for two-call pattern, switched to vi.resetAllMocks()

## Decisions Made

- Used `issuetype in subtaskIssueTypes()` (not name comparison) per research — admins can rename subtask issue types
- Subtask query fields: `summary,status,assignee,issuetype,parent,timetracking` — description deliberately excluded (on-demand only)
- `Promise.all` for parallel chunk requests — chunks are independent
- Module-level constant `SUBTASK_CHUNK_SIZE = 50` (not inside function) per plan spec

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed vi.clearAllMocks() → vi.resetAllMocks() for test isolation**
- **Found during:** Task 1 (TDD RED phase — writing APIF-02 tests)
- **Issue:** `vi.clearAllMocks()` clears call history but NOT unconsumed `mockResolvedValueOnce`/`mockRejectedValueOnce` queues. The `chunks` test's persistent `mockResolvedValue` and the `throws` test's unconsumed `mockRejectedValueOnce` both leaked into the `fetchFixVersions` tests, causing 3 previously-passing PM-03 tests to fail.
- **Fix:** Changed `beforeEach(() => { vi.clearAllMocks() })` to `vi.resetAllMocks()` which resets both call history AND implementation queues. Also changed `chunks` test to use only `mockResolvedValueOnce` variants.
- **Files modified:** `taskflow/src/services/jira.test.ts`
- **Verification:** All 29 tests pass; PM-03 fetchFixVersions tests restored to passing
- **Committed in:** `097e230` (RED phase commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Required for correct test isolation. Pre-existing fragile test setup exposed by inserting new describe block before fetchFixVersions tests.

## Issues Encountered

- Pre-existing TypeScript errors in `SearchOverlay.test.tsx`, `GitLabStep.tsx`, `JiraStep.tsx` — confirmed out-of-scope (documented in STATE.md from Phase 05 research)
- Pre-existing `MyTasksTab.test.tsx` failure — confirmed pre-existing, unrelated to this plan's changes

## Next Phase Readiness

- fetchSprintIssues now returns `JiraIssue[]` containing both parent issues and subtasks — phases 6-8 can use `issuetype.subtask` flag to distinguish hierarchy
- All four existing callers (MyTasksTab, SprintBoardTab, WorkloadTab, SprintProgressTab) receive the same `JiraIssue[]` type — no caller changes required
- Subtask `parent` field is included — hierarchy UI can build parent-child relationships
- Must validate two-query JQL on real Orange Jira DC v10.3.15 before Phase 6 hierarchy UI

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*
