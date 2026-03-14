---
phase: 10-sprint-board-redesign
plan: 02
subsystem: ui
tags: [react, kanban, jira, vitest, dnd-kit]

# Dependency graph
requires:
  - phase: 10-sprint-board-redesign
    provides: "10-01: fetchProjectStatuses in jira.ts, @dnd-kit/core installed, Wave 0 RED stubs"

provides:
  - "BoardColumn.tsx: column shell with status header, card count, droppable slot (data-droppable attr)"
  - "StoryHeaderRow.tsx: non-draggable clickable story divider with monospace key + truncated summary"
  - "SprintBoardTab.tsx: rebuilt kanban using workflow-API columns, grouped subtask layout, localIssues drag state"
  - "BOARD-01 tests GREEN: workflow-API-derived columns and story-in-multiple-columns"
  - "BOARD-03 data-droppable attributes present on column card areas (consumed by DndContext in 10-03)"

affects:
  - 10-sprint-board-redesign (plans 10-03 and 10-04 plug drag and quick-create into BoardColumn/SprintBoardTab)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Grouped kanban: subtasks always visible under StoryHeaderRow — no collapse/expand state"
    - "Column derivation: always from workflow-API (fetchProjectStatuses), never from issue status names"
    - "Optimistic drag guard: localIssues + isDragging state isolates UI from server data during drag"
    - "data-droppable attribute on column card area — consumed by dnd-kit in plan 10-03"

key-files:
  created:
    - taskflow/src/routes/dashboard/BoardColumn.tsx
    - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx

key-decisions:
  - "Subtasks always visible under StoryHeaderRow — no collapse/expand toggle; old expandedStories state removed"
  - "makeIssue test helper updated: statusId defaults to status name so column matching by id works correctly"
  - "Old HIER-02 collapse/expand tests replaced: new tests verify always-visible subtask layout"
  - "BoardColumnGroup interface exported from BoardColumn.tsx for SprintBoardTab useMemo typing"

patterns-established:
  - "StoryHeaderRow: non-draggable role=button row with monospace key + truncated summary + onOpenDetail callback"
  - "BoardColumn: data-droppable on card list div (plan 10-03 adds useDroppable to same element)"
  - "Test fixtures: makeStatus() helper pairs with makeIssue() statusId-by-name convention"

requirements-completed: [BOARD-01, BOARD-02, BOARD-05]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 10 Plan 02: Sprint Board Rebuild Summary

**Workflow-API kanban with StoryHeaderRow + BoardColumn: subtasks grouped under story headers in each column, empty columns shown, BOARD-01 tests GREEN**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T11:29:58Z
- **Completed:** 2026-03-14T11:35:08Z
- **Tasks:** 2
- **Files modified:** 2 modified + 2 created

## Accomplishments
- Created `BoardColumn.tsx` — column shell with workflow-API status header, card count (draggable cards only), grouped card list with `data-droppable` attribute for plan 10-03 dnd-kit wiring
- Created `StoryHeaderRow.tsx` — non-draggable clickable divider showing story key (monospace) + truncated summary; opens IssueDetailSheet on click
- Rebuilt `SprintBoardTab.tsx` — columns come from `fetchProjectStatuses` (sorted by category then alphabetically), subtasks always visible under story headers, bare stories render as standalone cards, `localIssues` + `isDragging` state ready for plan 10-03 drag implementation
- BOARD-01 tests (workflow-API columns, story-in-multiple-columns) turn GREEN; drag stubs (BOARD-03) remain RED pending plan 10-03

## Task Commits

Each task was committed atomically:

1. **Task 1: Create StoryHeaderRow and BoardColumn components** - `259debf` (feat)
2. **Task 2: Rebuild SprintBoardTab with workflow-API columns and grouped layout** - `a822e5a` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/src/routes/dashboard/StoryHeaderRow.tsx` - Non-draggable story section divider (key + summary + onOpenDetail)
- `taskflow/src/routes/dashboard/BoardColumn.tsx` - Column shell: status header, card count, grouped rendering, droppable slot
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Full rebuild: fetchProjectStatuses for columns, grouped kanban layout
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` - Updated tests: old collapse/expand tests replaced; BOARD-01 stubs now GREEN

## Decisions Made
- Subtasks are always visible in the new design — old `expandedStories` / `toggleStory` collapse state removed entirely; the plan explicitly replaces it with the always-visible grouped layout
- `makeIssue` test helper updated to use `statusId = statusName` by default — old fixture used hardcoded `id: '3'` for all statuses which broke new column matching logic (column matching uses `status.id === col.id`)
- Old HIER-02 collapse/expand tests (subtask collapsed by default, chevron expand) replaced with tests verifying always-visible subtask cards and story header visibility — these tests described behavior that was intentionally removed
- `BoardColumnGroup` interface exported from `BoardColumn.tsx` for clean typing in `SprintBoardTab` useMemo

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated SprintBoardTab.test.tsx: OLD collapse/expand tests updated for new layout**
- **Found during:** Task 2 (SprintBoardTab rebuild)
- **Issue:** Three OLD HIER-02 tests (column count, collapsed by default, chevron expand) tested collapse/expand behavior that was intentionally removed; they still passed against old impl but would fail/pass incorrectly against new impl. Additionally, several tests lacked `fetchProjectStatuses` mocks, so no columns rendered and tests failed on new column derivation logic.
- **Fix:** Updated `makeIssue` to use status name as id; added `makeStatus` helper; added `fetchProjectStatuses` mocks to all tests needing columns; rewrote 3 old HIER-02 tests to verify new always-visible subtask layout; removed unused `fireEvent` import.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx`
- **Verification:** 11/11 tests pass after update
- **Committed in:** `a822e5a` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - test alignment with new design)
**Impact on plan:** Required for tests to correctly validate the new always-visible layout. The removed tests described behavior that was deliberately replaced — no regression.

## Issues Encountered
- None beyond the test fixture mismatch documented above.

## Next Phase Readiness
- `BoardColumn.tsx` exposes `data-droppable` attribute on card area — plan 10-03 adds `useDroppable` to same element
- `SprintBoardTab.tsx` has `localIssues` + `isDragging` state ready for `DndContext` + `handleDragEnd` in plan 10-03
- `children` slot in `BoardColumn` reserved for `QuickCreateInput` (plan 10-04)
- BOARD-03 drag/rollback tests remain RED — will turn GREEN in plan 10-03

---
*Phase: 10-sprint-board-redesign*
*Completed: 2026-03-14*
