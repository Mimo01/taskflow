---
status: complete
quick_id: 260609-fbi
date: 2026-06-09
---

# Quick Task 260609-fbi Summary

**Task:** On sprint board or backlog view, when dragging an issue and pressing esc, it should cancel the drag action

## What Was Done

Both `SprintBoardTab.tsx` and `BacklogPage.tsx` now handle the dnd-kit `onDragCancel` event that fires when the user presses ESC during a drag.

### Task 1 — SprintBoardTab (commit 0315e393)

- Imported `DragCancelEvent` from `@dnd-kit/core`
- Added `handleDragCancel` that resets `isDraggingRef`, `activeId`, `activeWidth`, and `dropModel`
- Wired `onDragCancel={handleDragCancel}` on the `DndContext`

### Task 2 — BacklogPage (commit 488bd808)

- Imported `DragCancelEvent` from `@dnd-kit/core`
- Added `handleDragCancel` that resets `isDraggingRef`, `activeId`, re-clones `localOrder`, and clears `rankError`
- Wired `onDragCancel={handleDragCancel}` on the `DndContext`

Both handlers deliberately skip `justDragged` (ESC produces no follow-on click event) and skip any mutation call (no transition or rank change occurred). dnd-kit handles the visual snap-back automatically once `onDragCancel` fires.

## Commits

- `0315e393` feat(quick-260609-fbi): add onDragCancel to SprintBoardTab
- `488bd808` feat(quick-260609-fbi): add onDragCancel to BacklogPage
