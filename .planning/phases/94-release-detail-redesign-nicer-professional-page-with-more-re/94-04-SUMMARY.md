---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 04
subsystem: release-detail graphs
tags: [recharts, burnup, donut]
requires: [94-01, 94-02]
provides:
  - ReleaseBurnup (testid release-graph-burnup), BurnupTooltip, burnupYScale, NOT_ENOUGH_HISTORY
  - ReleaseMrDonut (testid release-graph-mrs)
key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.test.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.tsx
    - taskflow/src/routes/dashboard/release-detail/graphs/ReleaseMrDonut.test.tsx
requirements-completed: [D-01, D-02, D-04, D-05, D-06]
metrics:
  tasks: 2
  completed: 2026-10-30
---

# Phase 94 Plan 04: Burnup and MR donut graphs Summary

Presentational recharts burnup (scope dashed, done green line over 12% area, TODAY/RELEASE markers, no forecast/legend, 3-row tooltip) and a fixed-size MR donut reusing AioDonut with direct value labels.

## Commits
- 0df1732b: ReleaseBurnup
- 7ac4e0ea: ReleaseMrDonut

## Deviations from Plan
- Worktree base was off; reset to 66f3b333 per the branch check.
- Explicit Y ticks are exposed as `burnupYScale` (at most 4 ticks, step multiple of 5) and unit-tested.
- jsdom cannot lay out recharts, so TODAY/RELEASE marker presence is not asserted in DOM; markers are conditional on `axis.showToday` / `axis.showRelease` and are left to the visual check in plan 08.
- node_modules symlinked into the worktree (not committed).

## Known Stubs
None.

## Self-Check: PASSED
Both commits exist; vitest, tsc and biome clean for the graphs directory.
