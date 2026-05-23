---
status: complete
quick_id: 260513-awc
slug: sprint-board-epic-pill
date: 2026-05-13
commit: ff61a86
---

# Quick Task 260513-awc: Sprint Board Epic Pill

## What was built

Added a clickable epic name pill to sprint board story header rows, positioned between the assignee and the status badge.

**`StoryHeaderRow.tsx`**
- Added optional props: `epicKey`, `epicName`, `epicColorResult: EpicColorResult`, `onEpicClick`
- Epic pill renders between assignee block and status badge using `epicColorToTailwind` Jira color styling
- Click uses `e.stopPropagation()` so it doesn't also open story detail
- Layout order preserved: assignee → epic pill → status badge

**`SprintBoardTab.tsx`**
- `epicColorMap` built alongside existing `epicNameMap` from `epicsBasic`
- All three `StoryHeaderRow` call sites (virtualized swimlane, non-virtualized fallback, sticky overlay) pass epic data through

## Commits

- `437a53f` feat: add epic pill props to StoryHeaderRow
- `21978e0` feat: wire epic pill data through SprintBoardTab
- `ff61a86` fix: restore assignee-before-status order, epic pill between them
