---
status: complete
phase: 79-drag-to-transition-on-sprint-board
source: [79-01-SUMMARY.md, 79-02-SUMMARY.md, 79-03-SUMMARY.md]
started: 2026-06-04T17:02:24Z
updated: 2026-06-04T17:04:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cards are draggable
expected: On the sprint board you can pick up and drag a non-story card (subtask/task). Story headers are not draggable — only child cards move.
result: pass

### 2. Drop zones appear in the dragged card's swimlane only
expected: When you start dragging a card, labelled drop zones appear in that card's own story row only. Other story rows do not show drop zones, and the board does not balloon in height.
result: pass

### 3. Multi-status columns split into labelled per-transition zones
expected: A column reachable via 2+ transitions splits into multiple labelled drop boxes (labelled by transition name, e.g. "In Review", "In Dev"). A column with one reachable transition shows a single labelled zone. A column with zero reachable transitions is dimmed/invalid.
result: pass

### 4. Drop zones tinted by status category
expected: Drop zones are color-tinted by status category (To Do = muted, In Progress = blue, Done = green) with a colored dashed border so they're clearly visible during the drag.
result: pass

### 5. Drop fires transition with optimistic move + refresh
expected: Dropping a card on a valid zone fires the correct Jira transition. The card moves to the new column immediately (optimistic), and the board refreshes on settle.
result: pass

### 6. Failed transition rolls back with inline error
expected: If Jira rejects the transition, the card returns to its original column and an inline "Transition failed" error appears on the card.
result: skipped
reason: Hard to force a Jira-rejected transition manually; covered by TRAN-04 component test (SprintBoardTab.test.tsx, 16/16 green).

### 7. Invalid column snaps back silently
expected: Dropping a card on a dimmed (zero-reachable-transition) column snaps the card back to its original position with no error banner.
result: skipped
reason: User skipped; snap-back-on-invalid covered by resolveDropTransitionId null-path unit tests (sprintBoardDragHelpers.test.ts).

### 8. Drag ghost matches card width
expected: While dragging, the floating ghost card matches the width of the real card you picked up (not a fixed narrow width).
result: pass

### 9. Post-drop click does not open peek
expected: After dropping a card, the card's peek/detail panel does not accidentally open from the drop gesture.
result: pass

## Summary

total: 9
passed: 7
issues: 0
pending: 0
skipped: 2
blocked: 0

## Gaps

[none yet]
