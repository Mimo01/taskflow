---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
plan: "04"
subsystem: ui
tags: [react, taskcard, accessibility, hit-target, lucide]

# Dependency graph
requires:
  - phase: 07-story-subtask-hierarchy-mr-subtask-filter
    provides: subtask toggle button (chevron + badge) rendered in TaskCard
provides:
  - TaskCard subtask toggle row wrapped in single button with p-1 padding for ~32-44px hit target
affects: [dashboard, sprint-board]

# Tech tracking
tech-stack:
  added: []
  patterns: [wrap decorative badge in button with pointer-events-none to avoid nested click confusion]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx

key-decisions:
  - "Single button wrapping Badge+chevron is the idiomatic approach — avoids nested interactive elements and makes the entire row the hit target"

patterns-established:
  - "Badge used as decorative label inside a button: add pointer-events-none to prevent nested click confusion"

requirements-completed: [HIER-02]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 7 Plan 04: Subtask Toggle Hit Target Fix Summary

**Single `<button>` wrapping Badge and chevron replaces div+button pair, giving a ~32-44px hit target on the subtask toggle row in TaskCard**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-13T10:02:48Z
- **Completed:** 2026-03-13T10:05:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Replaced outer `<div className="flex items-center gap-1">` + inner `<button>` with a single `<button>` that wraps both the Badge and chevron icon
- Added `p-1 -mx-1` to the button for a generous click/tap area without displacing card layout
- Added `pointer-events-none` to the Badge so it acts as a decorative label inside the button
- Bumped chevron icon from `size-3` (12px) to `size-4` (16px) for better visual affordance

## Task Commits

Each task was committed atomically:

1. **Task 1: Expand subtask toggle hit target in TaskCard** - `814b320` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/TaskCard.tsx` - Subtask count+chevron row now uses a single button with p-1 padding

## Decisions Made
- Single button wrapping both Badge and chevron is the idiomatic approach — avoids nested interactive elements and extends the hit target naturally to cover the entire row.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing TypeScript errors in `SprintProgressTab.test.tsx` and `SearchOverlay.test.tsx` are unrelated to TaskCard and were out of scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT test 1 (subtask toggle hit target) should now pass — the entire badge+chevron row is a single interactive button with adequate padding
- Gap closure plan 04 is complete; Phase 07 gap closure is nearing completion

---
*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Completed: 2026-03-13*
