---
phase: quick-260531-3ey
plan: 01
subsystem: sprint-board-filters
tags: [ui, css, overflow, filter-bar]
requires: []
provides:
  - "UnifiedFilterBar primary + expanded rows with locally-scrollable left region and pinned right group"
affects:
  - "Sprint Board and Backlog views (both render UnifiedFilterBar)"
tech-stack:
  added: []
  patterns:
    - "flex-1 min-w-0 + overflow-x-auto no-scrollbar to contain horizontal overflow in a flex child"
key-files:
  created: []
  modified:
    - taskflow/src/components/UnifiedFilterBar.tsx
decisions:
  - "Added shrink-0 to the four FilterDropdown triggers in the expanded row so they keep intrinsic width and scroll rather than squashing inside the flex-nowrap scroll region (Rule 2 — required for the scroll behavior to actually work)."
metrics:
  duration: ~6 min
  completed: 2026-05-31
---

# Quick Task 260531-3ey: Sprint Board filters row drags the page — Summary

Restructured both rows of `UnifiedFilterBar.tsx` so overflowing filter content scrolls horizontally inside a contained `flex-1 min-w-0 ... overflow-x-auto no-scrollbar` region instead of widening the page and forcing the ancestor `overflow-auto` to scroll the whole board.

## What changed

**Task 1 — Primary row** (commit `e5ad4e5d`):
- Wrapped the empty-state hint, quickfilter preset pills, and the active-chip block inside a new `flex-1 min-w-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto no-scrollbar` left region.
- Switched the active-chip container from `flex-wrap` to `flex-nowrap`; added `shrink-0` to each chip span, the hint span, and the divider so they keep intrinsic width inside the nowrap region.
- Deleted the `<div className="flex-1" />` spacer (the left region's `flex-1` now fills the available space).
- Pinned all right-side controls (Save / Save Filter / `savingName` input / Filter toggle) inside a single `shrink-0 flex items-center gap-1.5` group.
- Kept `px-3` on the outer row only.

**Task 2 — Expanded filtersOpen row** (commit `dc9fbbd8`):
- Wrapped the four FilterDropdowns (Epic / Label / Assignee / Status) and the active-chip block inside a matching `flex-1 min-w-0 ... overflow-x-auto no-scrollbar` region.
- Switched the expanded chip container to `flex-nowrap`; added `shrink-0` to each chip span and the divider.
- No right-pinned group needed in this row.

No logic, handlers, state, props, conditional-render guards, or `data-testid` values were changed. Biome reformatted the JSX indentation introduced by the new wrapper divs (auto-applied via `biome check --write`).

## Deviations from Plan

### Auto-fixed / clarified

**1. [Rule 2 - Missing critical functionality] `shrink-0` on expanded-row FilterDropdown triggers**
- **Found during:** Task 2
- **Issue:** Inside a `flex-nowrap` scroll region, flex children shrink by default. Without `shrink-0` the four FilterDropdown trigger buttons would squash instead of overflowing/scrolling, defeating the intended scroll behavior. The plan specified `shrink-0` for chips and divider but not the dropdowns.
- **Fix:** Added `shrink-0` to the four FilterDropdown wrappers (className only; no prop/logic/testid change).
- **Files modified:** taskflow/src/components/UnifiedFilterBar.tsx
- **Commit:** dc9fbbd8

## Verification

- `npm run check` (biome check + tsc) — GREEN. "Checked 447 files. No fixes applied."
- Left scroll regions: 2 (one per row) ✓
- `flex-1` spacer: 0 ✓
- Right action group (`shrink-0 flex items-center gap-1.5`): present ✓
- `flex-nowrap` chip containers: 2; `flex-wrap` chip containers: 0 ✓
- Chip `data-testid` replace patterns: 2 (unchanged) ✓
- `QuickFilterChipRow.tsx`: unmodified ✓

## Known Stubs

None.

## Self-Check: PASSED
- FOUND: taskflow/src/components/UnifiedFilterBar.tsx
- FOUND commit: e5ad4e5d
- FOUND commit: dc9fbbd8
