---
phase: quick-261103-eu3
plan: 01
subsystem: release-detail
tags: [release-detail, drift, mr, not-covered]
requires: []
provides:
  - "isTaskEvaluated(mr) TASK gate (opened + merged)"
  - "merged MRs carry a real taskReason in driftRows"
  - "uncovered closed MRs excluded from secondaryRows"
affects:
  - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
tech-stack:
  added: []
  patterns: ["separate BR/MS gate (classifyMrState) from TASK gate (isTaskEvaluated)"]
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/driftDetection.ts
    - taskflow/src/routes/dashboard/release-detail/driftDetection.test.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
decisions:
  - "Merged MRs get the TASK predicate (not-in-fix-version / no-linked-task) but keep evaluated:false and br/ms 'na'"
  - "Uncovered closed MRs are dropped from 'Not covered by tasks' only; they stay in driftRows for donut/labels/counts"
  - "classifyMrState unchanged (BR/MS gate); new exported isTaskEvaluated is the TASK gate"
metrics:
  duration: "~5 min"
  completed: 2026-11-03
---

# Quick 261103-eu3: Evaluate merged MRs in "Not covered by tasks" Summary

Merged MRs in the release detail "Not covered by tasks above" list now get the real "Not in version" / "No task" pill, orange key and Apply / Link task fix actions via a new `isTaskEvaluated` TASK gate in `buildDriftRows`. Uncovered closed MRs are removed from that list. Locked MRs stay muted as "Not evaluated", and BR/MS evaluation is still open-only.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Data layer: TASK-evaluate merged MRs, drop closed from secondaryRows | 6230a198 |
| 2 | UI comments, merged-row fix-action tests, fixture cleanup | 6230a198 |

Both tasks went into one commit, as the plan asked: the pre-commit hook runs the full suite.

## Changes

- `driftDetection.ts`: added `isTaskEvaluated` (opened || merged). `buildDriftRows` now has a merged branch: `evaluated:false`, `br/ms:'na'`, `taskReason = evaluateTaskDrift(...)`, `flagged = task==='flag'`. The `secondaryRows` filter adds `row.mr.state !== 'closed'`. Updated the header D-10 bullet and the docstrings for `classifyMrState`, `buildDriftRows`, `buildTaskMrAttachment` (contract now: disjoint, total except uncovered closed) and `DriftRow.evaluated`.
- `UnifiedTaskTable.tsx`: comment-only changes to `secondaryReason`, `selectDisplayMr` and the else-branch of the secondary key cell. No behavioural change.
- Tests: added driftDetection cases for `isTaskEvaluated`, merged with both reasons and when covered, closed/locked all-na, unchanged BR/MS counts, flagged-partition sort, merged in secondaryRows, and closed exclusion with covered-closed attachment. In UnifiedTaskTable, the unevaluated secondary fixtures moved from merged/closed to locked (titles now read "MR is locked"), and two merged-row tests were added: Apply plus em-dash BR/MS, and Link task retitling a merged MR.

## Verification

- release-detail folder + ReleaseDetailPage: 35 files, 726 tests passed
- `tsc --noEmit` clean; biome on the 4 touched files: no diagnostics
- Pre-commit full suite: 4298 passed

## Deviations from Plan

None. The plan executed as written. No production code was changed to fit test mocks.

## Known Stubs

None.

## Self-Check: PASSED
- All 4 modified files exist; commit 6230a198 present in git log.
