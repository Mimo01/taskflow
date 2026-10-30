---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 05
subsystem: release-detail graphs
tags: [assignee-rows, waffle, tooltips]
requires: [94-01, 94-02]
provides:
  - ReleaseAssigneeRows (testid release-graph-assignees, rows assignee-row-{id})
  - ReleaseTypeWaffle (testid release-graph-types, rows type-row-{typeName}, cells waffle-cell[data-cat])
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseAssigneeRows.test.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTypeWaffle.test.tsx
  modified:
    - taskflow/src/components/ui/cached-avatar.tsx
requirements-completed: [D-01, D-02, D-05, D-06]
metrics:
  tasks: 2
  completed: 2026-10-30
---

# Phase 94 Plan 05: Assignee rows and type waffle Summary

Two non-recharts release graphs: By assignee (22px avatar, name, slim SegmentedBar, done/total) and By type (muted icon, one 12px status-coloured square per issue), both with GraphSlot states and tooltips of at most 4 rows (story points only as the fourth row).

## Commits
- e6c61558: ReleaseAssigneeRows
- 2471a236: ReleaseTypeWaffle

## Deviations from Plan
- [Rule 3 - Blocking] `CachedAvatar` only allowed sizes 16/18/20/24/32/40, so `size={22}` did not type-check. Added a 22 entry (`size-[22px]`, icon 13) to its size maps; explicit px sizing is preserved.
- Worktree base was reset to 66f3b333 per the branch check.
- Pre-commit full-suite runs failed several times on unrelated load flakes (FindBar, EpicDetailSheet, IssueDetailSheet; load average about 44); those pass in isolation and the commits succeeded on retry.
- Assignee ordering (Unassigned last) is left to the derivation, as planned.

## Known Stubs
None.

## Self-Check: PASSED
Both commits exist; graph tests (16 incl. GraphSlot) and tsc pass.
