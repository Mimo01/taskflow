---
phase: 06-workload-sprint-progress-enrichment
plan: "03"
subsystem: ui
tags: [react, vitest, workload, sprint, jira, tdd]

# Dependency graph
requires:
  - phase: 06-01
    provides: WorkloadTab with expand/collapse rows and time tracking columns
  - phase: 06-02
    provides: SprintProgressTab enrichment foundation

provides:
  - Done stories appear as sub-rows in expanded assignee view (WorkloadTab)
  - Summary row count/pts reflect only non-done (open) stories
  - Assignees with only done stories still appear in the table (0 tasks, 0 pts)

affects: [workload-tab, sprint-board, UAT]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "isDone conditional increment: push story unconditionally, only increment count/pts when !isDone"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx

key-decisions:
  - "Phase 06: WorkloadTab done-story fix: replace guard skip with conditional increment — done stories always pushed to assignee map, count/pts only incremented for non-done"

patterns-established:
  - "isDone conditional increment: accumulate all stories into sub-rows unconditionally; gate count/points increment behind !isDone check"

requirements-completed: [WORK-01]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 06 Plan 03: Done-Story Exclusion Fix Summary

**WorkloadTab now shows done stories as expandable sub-rows while excluding them from the open-work count and points summary — fixing the UAT gap where done stories were entirely absent from the Workload table.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-12T21:47:00Z
- **Completed:** 2026-03-12T21:48:29Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2

## Accomplishments

- Replaced `if (cat === 'done') continue` guard with conditional increment logic
- Done stories now always pushed into the assignee map — visible as sub-rows when expanded
- `count` and `points` only incremented for non-done stories (open-work summary unchanged)
- Assignee with only done stories now appears in the table with 0 tasks, 0 pts
- Updated JSDoc comment to reflect new behavior accurately
- 12/12 WorkloadTab tests pass (2 updated, 1 new added)

## Task Commits

1. **Task 1: Fix done-story exclusion logic and update tests** - `e6bc1c4` (feat, TDD RED+GREEN)

## Files Created/Modified

- `taskflow/src/routes/dashboard/WorkloadTab.tsx` - Conditional increment logic replacing guard skip; updated JSDoc
- `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` - Updated 2 existing tests to assert done stories appear as sub-rows; added new test for assignee-with-only-done-stories

## Decisions Made

- isDone conditional increment pattern: `existing.stories.push(...)` is always called regardless of `isDone`; only `existing.count += 1` and `existing.points += pts` are gated behind `!isDone`. This is the minimal change to fix the UAT gap without touching time-tracking or subtask logic.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TDD flow proceeded as expected. Tests went RED with the new assertions (P-2 not found), then GREEN after implementing the conditional increment fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT gap closed: done stories now visible in WorkloadTab expanded sub-rows
- All WorkloadTab tests pass (12/12)
- No regressions introduced in the WorkloadTab suite
- Pre-existing failures in MyTasksTab.test.tsx and ReleasesTab.test.tsx are out of scope (those files had unstaged changes prior to this plan)

---
*Phase: 06-workload-sprint-progress-enrichment*
*Completed: 2026-03-12*
