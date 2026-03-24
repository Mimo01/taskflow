---
phase: 33-board-sprint-filters
plan: 03
subsystem: ui
tags: [react, zustand, bulk-operations, dnd-kit, jira-api, optimistic-updates]

requires:
  - phase: 33-board-sprint-filters/01
    provides: board-selection.store.ts with multi-select state management
  - phase: 33-board-sprint-filters/02
    provides: SprintGoalBanner and QuickFilterChipRow components
provides:
  - BulkActionBar floating toolbar for bulk status/assignee/priority changes
  - BulkProgressIndicator with real-time success/failure tracking
  - Multi-select checkboxes on DraggableCard with Shift+click range selection
  - Optimistic updates with per-issue rollback on API failure
affects: [sprint-board, drag-and-drop, jira-transitions]

tech-stack:
  added: []
  patterns:
    - parallelBatch helper for concurrency-limited API calls
    - Optimistic update callback pattern (parent passes setLocalIssues updater)

key-files:
  created:
    - taskflow/src/routes/dashboard/BulkActionBar.tsx
    - taskflow/src/routes/dashboard/BulkProgressIndicator.tsx
  modified:
    - taskflow/src/routes/dashboard/DraggableCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx

key-decisions:
  - "parallelBatch helper with concurrency=5 for bulk API calls instead of Promise.all"
  - "Checkbox uses native input matching BacklogRow pattern per UI-SPEC"
  - "Selection props threaded through VirtualizedSwimlanes rather than store access in DraggableCard"

patterns-established:
  - "parallelBatch<T> for concurrency-limited parallel execution with per-item callbacks"
  - "Optimistic update via callback prop (onOptimisticUpdate) with per-issue rollback"

requirements-completed: [BOARD-04, BOARD-05, BOARD-06, BOARD-07]

duration: 4min
completed: 2026-03-23
---

# Phase 33 Plan 03: Bulk Operations Summary

**Multi-select checkboxes on sprint board cards with floating bulk action bar for status/assignee/priority changes, parallel API execution with concurrency limit of 5, and per-issue optimistic rollback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T00:10:45Z
- **Completed:** 2026-03-23T00:14:38Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Multi-select checkbox overlay on DraggableCard with hover-only visibility that becomes persistent when any card is selected
- Floating BulkActionBar with Status/Assignee/Priority shadcn Select dropdowns, Apply Changes, and Deselect All
- BulkProgressIndicator with progress bar, success/failure counts, expandable failure details, and 3-second auto-dismiss
- Shift+click range selection using allVisibleKeys computed from data model (not DOM)
- Drag-and-drop disabled on selected cards via useDraggable disabled option
- Escape key clears selection via react-hotkeys-hook

## Task Commits

Each task was committed atomically:

1. **Task 1: Add checkboxes to DraggableCard and create BulkActionBar + BulkProgressIndicator** - `1eafb02` (feat)
2. **Task 2: Wire bulk selection and BulkActionBar into SprintBoardTab** - `f88a251` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/BulkActionBar.tsx` - Floating bulk action toolbar with status/assignee/priority dropdowns and parallelBatch execution
- `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` - Inline progress display with success/failure counts and auto-dismiss
- `taskflow/src/routes/dashboard/DraggableCard.tsx` - Added checkbox overlay, isSelected/hasAnySelection/onToggleSelect props, disabled drag on selected
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Wired useBoardSelectionStore, allVisibleKeys, handleToggleSelect, BulkActionBar rendering

## Decisions Made
- Used parallelBatch helper with concurrency=5 rather than unbounded Promise.all to avoid overwhelming Jira API
- Native `<input type="checkbox">` matching existing BacklogRow pattern per UI-SPEC directive
- Selection props threaded via VirtualizedSwimlanes props rather than accessing store directly in DraggableCard -- keeps card component pure and testable
- Combined operations (status + assignee/priority) execute sequentially: transitions first, then field updates on successful keys

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Bulk operations complete, ready for saved filters (Plan 04+)
- board-selection.store.ts fully integrated with SprintBoardTab

## Self-Check: PASSED

- All 4 files verified on disk
- Commit 1eafb02 (Task 1) verified in git log
- Commit f88a251 (Task 2) verified in git log

---
*Phase: 33-board-sprint-filters*
*Completed: 2026-03-23*
