---
phase: quick-7
plan: "01"
subsystem: SprintProgressTab
tags: [sort, story-points, sprint-progress, tdd]
dependency_graph:
  requires: []
  provides: [assignee-sort-by-points-sprint-progress]
  affects: [SprintProgressTab]
tech_stack:
  added: []
  patterns: [b.points - a.points || a.name.localeCompare(b.name)]
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
decisions:
  - Sort comparator mirrors WorkloadTab pattern exactly for consistency
metrics:
  duration: ~3 min
  completed: "2026-03-12T22:28:45Z"
  tasks_completed: 1
  files_modified: 2
---

# Quick Task 7: Sort Assignees by Total Story Points in SprintProgressTab Summary

**One-liner:** Sort SprintProgressTab assignee breakdown rows by total story points descending with alphabetical tiebreaker, mirroring WorkloadTab.

## What Was Done

Replaced the alphabetical-only sort comparator in `SprintProgressTab.tsx` with a composite sort: descending total points first, then alphabetical name as tiebreaker. This makes the highest-load assignees appear first in the per-assignee breakdown table, consistent with WorkloadTab.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED  | Add failing sort test | c1ddc57 | SprintProgressTab.test.tsx |
| GREEN | Implement sort comparator | 1bcafe5 | SprintProgressTab.tsx |

## Verification

All 11 SprintProgressTab tests pass, including the new SPPG-03 sort test confirming order: Charlie (8 pts) → Alice (5 pts) → Zara (5 pts, alpha after Alice) → Bob (3 pts).

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- taskflow/src/routes/dashboard/SprintProgressTab.tsx — modified (line 122-126 contains `b.points - a.points || a.name.localeCompare(b.name)`)
- taskflow/src/routes/dashboard/SprintProgressTab.test.tsx — modified (new SPPG-03 sort test added)
- Commits c1ddc57 and 1bcafe5 exist in git log
