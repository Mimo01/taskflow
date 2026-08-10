---
phase: 82-my-tasks-page
plan: "01"
subsystem: lib
tags: [pure-functions, sort, tdd, my-tasks]
dependency_graph:
  requires: []
  provides: [my-tasks-sort.ts, classifyBand, subtreeBand, groupByMyDay, deriveCounts, MY_DAY_BANDS]
  affects: [wave-1-ui-plans]
tech_stack:
  added: []
  patterns: [pure-function-module, tdd-red-green, as-const-enum]
key_files:
  created:
    - taskflow/src/lib/my-tasks-sort.ts
    - taskflow/src/lib/my-tasks-sort.test.ts
  modified: []
decisions:
  - "flagged check precedes done check in classifyBand: plan must_haves truth requires flagged parent always in band 0 regardless of status (including done)"
metrics:
  duration: ~12 minutes
  completed: "2026-06-14"
  tasks_completed: 1
  tasks_total: 1
requirements: [MYTASK-04, MYTASK-02]
---

# Phase 82 Plan 01: Pure My Day Sort Logic Summary

**One-liner:** Pure `classifyBand/subtreeBand/groupByMyDay/deriveCounts` functions with `MY_DAY_BANDS` enum implementing D-04 subtree-float smart-sort and MYTASK-02 count derivation; 29 tests green.

## What Was Built

`taskflow/src/lib/my-tasks-sort.ts` — a zero-I/O, zero-React pure module providing:

| Export | Purpose |
|--------|---------|
| `MY_DAY_BANDS` | `as const` array of 6 band labels in urgency order |
| `MyDayBand` | Derived union type |
| `classifyBand(issue, flaggedFieldKey, myOpenMRIssueKeys, today)` | Returns band index 0–5 for a single issue |
| `subtreeBand(parent, subtasks, ...)` | Returns `Math.min(parent band, ...subtask bands)` — D-04 float |
| `groupByMyDay(issues, myIssueKeys, ...)` | Groups eligible parents into sorted band entries with attached subtasks |
| `deriveCounts(issues, mrAwaitingMeKeys, today)` | Returns `{ toDo, inProgress, inReview, doneSprint, overdue, mrAwaiting }` |
| `MyTaskCounts` | Interface for deriveCounts return shape |

All functions accept `today: Date = new Date()` as final param for deterministic testing.

## TDD Gate Compliance

- RED commit: `53086d64` — `test(82-01): add failing tests for my-tasks-sort band classification and subtree-band D-04`
- GREEN commit: `acac366b` — `feat(82-01): implement pure my-tasks-sort band classification, subtree-band, grouping, and deriveCounts`

RED gate: tests failed with "Failed to resolve import ./my-tasks-sort" (file did not exist). GREEN gate: all 29 tests pass.

## Test Coverage

29 tests across 5 describe blocks:
- `MY_DAY_BANDS` — 1 test (enum shape)
- `classifyBand` — 9 tests (done, flagged, blocked-status, overdue, future-due, in-review-my-mr, in-review-no-mr, in-progress, to-do, flagged-wins-over-done)
- `subtreeBand` — 5 tests (overdue subtask floats parent, done parent+in-progress subtask, flagged parent wins, no subtasks, all subtasks done)
- `groupByMyDay` — 6 tests (single to-do, sort order, D-04 float via subtask, excludes non-mine, includes parent via my subtask, merges same-band)
- `deriveCounts` — 7 tests (toDo, inProgress, inReview, done, overdue excluding done, mrAwaiting, empty array)

## Acceptance Criteria

- [x] `npm run test -- --run src/lib/my-tasks-sort.test.ts` passes (29/29 green)
- [x] `export const MY_DAY_BANDS` present in source
- [x] `isIssueFlagged` imported from `@/services/jira` (not re-implemented)
- [x] No `import ... from 'react'` in source
- [x] No store imports in source (word "store" only in JSDoc comment)
- [x] `subtreeBand` test for "parent To Do + overdue subtask → 1" present and green
- [x] No package.json changes (zero new packages)
- [x] Source file 221 lines (> 80 line minimum)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test contradiction: flagged-vs-done priority order**

- **Found during:** GREEN phase — one of 29 tests failed after implementation
- **Issue:** The initial test suite contained one test asserting "done takes priority over flagged (done wins)" with a done+flagged issue expecting band 5. This contradicted the plan's `must_haves` truth: "A flagged parent sorts into band 0 regardless of subtask bands." The RESEARCH.md algorithm put `done` first, but the plan's must_haves are the authoritative constraint.
- **Fix:** (1) Moved the `flagged/blocked` check before the `done` check in `classifyBand`. (2) Updated the contradicting test to assert band 0 for a done+flagged issue, with a comment referencing the must_haves rule.
- **Files modified:** `my-tasks-sort.ts` (check order), `my-tasks-sort.test.ts` (test expectation + description)
- **Commits:** covered in GREEN commit `acac366b`

## Known Stubs

None. This plan produces pure functions with no UI rendering, no hardcoded empty values, and no placeholder text.

## Threat Flags

None. This plan introduces no new trust boundary — all inputs are already-fetched `JiraIssue` objects from the existing authenticated Jira service. Pure in-memory transforms only.

## Self-Check: PASSED

- [x] `taskflow/src/lib/my-tasks-sort.ts` — FOUND
- [x] `taskflow/src/lib/my-tasks-sort.test.ts` — FOUND
- [x] Commit `53086d64` (RED) — FOUND
- [x] Commit `acac366b` (GREEN) — FOUND
