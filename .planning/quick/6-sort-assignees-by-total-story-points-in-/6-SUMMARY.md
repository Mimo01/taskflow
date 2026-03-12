---
phase: quick-6
plan: 6
subsystem: WorkloadTab
tags: [sort, story-points, workload, tdd]
dependency_graph:
  requires: []
  provides: [workload-sort-by-points]
  affects: [WorkloadTab]
tech_stack:
  added: []
  patterns: [tdd-red-green, sort-comparator]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/WorkloadTab.tsx
    - taskflow/src/routes/dashboard/WorkloadTab.test.tsx
decisions:
  - Sort uses b.points - a.points with localeCompare tiebreaker for stable ordering
metrics:
  duration: 5min
  completed_date: "2026-03-12"
  tasks: 1
  files: 2
---

# Quick Task 6: Sort Assignees by Total Story Points Summary

**One-liner:** Sort WorkloadTab assignee rows by story points descending (not count) with alphabetical tiebreaker.

## What Was Built

Changed the `useMemo` sort comparator in `WorkloadTab.tsx` from sorting by open task count (`b.count - a.count`) to sorting by total story points (`b.points - a.points || a.name.localeCompare(b.name)`). Also updated the JSDoc comment on line 7 to reflect the new sort criterion.

A new test was added verifying that Bob (8pts) ranks above Carol (5pts) above Alice (3pts) — confirming sort order is points-based.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Add failing sort-by-points test | ba7d7ba | WorkloadTab.test.tsx |
| 1 (GREEN) | Implement sort by points descending | 99dc766 | WorkloadTab.tsx |

## Decisions Made

- **Sort comparator:** `b.points - a.points || a.name.localeCompare(b.name)` — points descending primary, name alphabetical as stable tiebreaker.
- **No refactor phase needed:** The change was a single-line comparator swap plus JSDoc update; no cleanup required.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check

- [x] `taskflow/src/routes/dashboard/WorkloadTab.tsx` — exists, line 135 uses `b.points - a.points`
- [x] `taskflow/src/routes/dashboard/WorkloadTab.test.tsx` — exists, new sort test added
- [x] Commits ba7d7ba and 99dc766 exist
- [x] All 13 tests pass

## Self-Check: PASSED
