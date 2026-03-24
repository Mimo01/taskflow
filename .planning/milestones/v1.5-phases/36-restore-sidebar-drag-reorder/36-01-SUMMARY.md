---
phase: 36-restore-sidebar-drag-reorder
plan: 01
subsystem: ui
tags: [dnd-kit, sortable, drag-drop, sidebar, settings, react]

requires:
  - phase: 34-layout-customization
    provides: "reorderSidebarItem store action and sidebarItems state"
provides:
  - "Drag-and-drop sidebar reordering UI in Settings > Appearance"
  - "SortableItem component with GripVertical drag handle"
  - "Integration tests for drag handle rendering and checkbox toggle"
affects: [sidebar, settings]

tech-stack:
  added: []
  patterns: ["useSortable with setActivatorNodeRef for drag-handle-only activation"]

key-files:
  created:
    - "taskflow/src/routes/settings/SidebarItemsList.test.tsx"
  modified:
    - "taskflow/src/routes/settings/SidebarItemsList.tsx"

key-decisions:
  - "Used data-sortable-item attribute on rows for test querying"

patterns-established:
  - "SortableItem pattern: useSortable with setActivatorNodeRef for handle-only drag activation"

requirements-completed: [LAYOUT-02]

duration: 4min
completed: 2026-03-24
---

# Phase 36 Plan 01: Restore Sidebar Drag-Reorder Summary

**dnd-kit sortable integration restored in SidebarItemsList with GripVertical drag handles, cross-section reorder, and DragOverlay feedback**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-24T10:26:51Z
- **Completed:** 2026-03-24T10:30:51Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Restored drag-and-drop reordering of sidebar items in Settings > Appearance using @dnd-kit/sortable
- GripVertical drag handle isolates drag from checkbox click (D-01, D-02)
- Single flat SortableContext allows cross-section reordering (D-03, D-04)
- Store wiring: onDragEnd calls reorderSidebarItem(fromIndex, toIndex) (D-05)
- 4 integration tests covering drag handle rendering, checkbox toggle, section headers, and row layout

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SidebarItemsList integration test (RED)** - `8c51939` (test)
2. **Task 2: Add dnd-kit sortable to SidebarItemsList (GREEN)** - `65d46e1` (feat)

## Files Created/Modified
- `taskflow/src/routes/settings/SidebarItemsList.test.tsx` - Integration tests for drag handle rendering, checkbox toggle, section headers, row layout
- `taskflow/src/routes/settings/SidebarItemsList.tsx` - Rewritten with DndContext, SortableContext, useSortable, GripVertical drag handles, DragOverlay

## Decisions Made
- Added `data-sortable-item` attribute to SortableItem rows to enable test querying of parent containers

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- LAYOUT-02 requirement satisfied: sidebar items are reorderable via drag-and-drop
- Store integration complete: reorderSidebarItem wired to UI
- All new tests pass; existing store tests unaffected
- Pre-existing test failures in ReleasesTab, IssueDetailSheet, BacklogPage, SprintBoardTab, and jira.test.ts are unrelated to this phase

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 36-restore-sidebar-drag-reorder*
*Completed: 2026-03-24*
