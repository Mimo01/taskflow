---
phase: quick-261022-jzt
plan: 01
subsystem: aio-cycle-dashboard
tags: [aio, empty-state, ui]
requires: []
provides: [compact Defect Summary empty state]
affects: [AIO cycle detail page]
tech-stack:
  added: []
  patterns: [inline compact empty state (icon badge + title + subline)]
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx
    - taskflow/src/routes/dashboard/aio-cycle/DefectSummary.test.tsx
decisions:
  - Inline compact empty state instead of the page-sized shared EmptyState component
metrics:
  tasks: 1
  files: 2
  completed: 2026-10-22
---

# Quick 261022-jzt: Defect Summary empty state Summary

Cycles with no linked defects now show a centred green BugOff badge, a "No linked defects" title and the muted subline "No defects raised against this cycle's runs" in the Defect Summary section. The empty grey ring is gone.

## Tasks

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Compact empty state for Defect Summary + test | 04f86c31 | DefectSummary.tsx, DefectSummary.test.tsx |

## Changes

- `CycleDefectDonuts`: the `statusSlices.length === 0` branch now renders a `w-full` flex column (`data-testid="defect-donut-empty"`) holding a `size-10` green round badge with `BugOff`, plus the title and subline. The loading skeleton and the populated donuts are unchanged. `AioDonutSkeleton` is still imported because `DonutBlockSkeleton` uses it. AioDonut.tsx was not touched.
- Updated the doc comment so it no longer claims every state has the same height.
- Test: added `defect donut empty state`. It checks that both text lines are shown, that the status donut is absent and that there is no `.border-muted` ring.

## Verification

- `vitest run src/routes/dashboard/aio-cycle`: 13/13 pass. The full suite passed in the pre-commit hook (3802 passed).
- `biome check` on both files: clean.
- `tsc --noEmit`: clean.

## Deviations from Plan

None. The plan was followed exactly as written.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx (contains BugOff)
- FOUND: commit 04f86c31
