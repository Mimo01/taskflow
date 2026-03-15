---
phase: 10-sprint-board-redesign
plan: 03
subsystem: ui
tags: [react, kanban, jira, dnd-kit, drag-and-drop, vitest]

# Dependency graph
requires:
  - phase: 10-sprint-board-redesign
    provides: "10-02: BoardColumn.tsx with data-droppable slot, SprintBoardTab.tsx with localIssues/isDragging state, BOARD-01 tests GREEN"

provides:
  - "DraggableCard.tsx: useDraggable wrapper around TaskCard with opacity during drag, click preserved"
  - "QuickCreateInput.tsx: inline + Add toggle with createIssue + fetchTransitions + postTransition sequence"
  - "SprintBoardTab.tsx: DndContext with PointerSensor, optimistic update, rollback, transitions pre-fetch, DragOverlay"
  - "BoardColumn.tsx: useDroppable hooked up, invalid-target striped overlay, DraggableCard rendering, cardErrors display"
  - "BOARD-03 drag/rollback stubs GREEN; BOARD-04 QuickCreate stubs GREEN"

affects:
  - 10-sprint-board-redesign (plan 10-04 if applicable — all drag and quick-create features now complete)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Drag-and-drop: DndContext in SprintBoardTab, useDroppable in BoardColumn, useDraggable in DraggableCard"
    - "Optimistic drag update: setLocalIssues immediately, postTransition async, rollback on error"
    - "Transitions pre-fetch: Promise.allSettled over all draggable issues after board loads, 5min staleTime"
    - "Invalid column overlay: striped CSS gradient + opacity-40 + pointer-events-none on disabled droppable"
    - "QuickCreate: + Add button toggle → text input → createIssue → fetchTransitions → postTransition sequence"

key-files:
  created:
    - taskflow/src/routes/dashboard/DraggableCard.tsx
    - taskflow/src/routes/dashboard/QuickCreateInput.tsx
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BoardColumn.tsx
    - taskflow/src/routes/dashboard/QuickCreateInput.test.tsx

key-decisions:
  - "DraggableCard does not put onClick on the wrapper div — passes it to TaskCard's onClick prop to avoid conflict with dnd-kit listeners"
  - "QuickCreateInput hides input after promise resolves (not synchronously on keydown) — test updated to use waitFor for this assertion"
  - "QuickCreateInput test stubs had only statusName prop — updated to pass full required interface (statusId, projectKey, jiraBaseUrl, jiraToken, onCreated)"
  - "QuickCreateInput button renders '+ Add' as text (not lucide Plus icon) — accessible name /+ Add/i required by pre-written test"
  - "Transitions pre-fetch: bare stories identified by checking if story.key appears in subtaskParentKeys set — avoids needing subtasksByParent outside useMemo"

patterns-established:
  - "DraggableCard: thin useDraggable wrapper — all presentation in TaskCard, drag logic in wrapper"
  - "BoardColumn: cardErrors Map<string, string> displayed inline below each card as p.text-destructive"
  - "SprintBoardTab: IssueDetailSheet placed outside DndContext (as React fragment sibling) — DndContext stays mounted while sheet is open"

requirements-completed: [BOARD-03, BOARD-04]

# Metrics
duration: 5min
completed: 2026-03-14
---

# Phase 10 Plan 03: Sprint Board Drag-and-Drop + QuickCreate Summary

**@dnd-kit/core drag-and-drop with optimistic rollback wired into SprintBoardTab, plus per-column inline issue creation via QuickCreateInput**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T11:37:20Z
- **Completed:** 2026-03-14T11:42:30Z
- **Tasks:** 2
- **Files modified:** 3 modified + 2 created

## Accomplishments
- Created `DraggableCard.tsx` — `useDraggable` wrapper around `TaskCard`; opacity 0.4 while dragging; click forwarded to `TaskCard.onClick` (not on the wrapper) to avoid pointer-event conflict with dnd-kit listeners
- Created `QuickCreateInput.tsx` — "+ Add" toggle button expands to text input; Enter calls `createIssue` + `fetchTransitions` + `postTransition`; Escape cancels without creating; inline error display
- Updated `SprintBoardTab.tsx` — `DndContext` with `PointerSensor` (5px threshold), `handleDragStart/End/Cancel`, optimistic `setLocalIssues` update, `postTransition` call, full rollback on rejection, transitions pre-fetch for all draggable issues, `DragOverlay` ghost card
- Updated `BoardColumn.tsx` — `useDroppable` with `disabled` prop for invalid targets, ring highlight on hover (`isOver`), striped overlay for invalid-drop columns, `DraggableCard` replacing `TaskCard`, `cardErrors` inline display
- All 14 targeted tests GREEN (11 SprintBoardTab + 3 QuickCreateInput)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create DraggableCard and QuickCreateInput components** - `b399749` (feat)
2. **Task 2: Wire DndContext into SprintBoardTab and useDroppable into BoardColumn** - `5bcded9` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/src/routes/dashboard/DraggableCard.tsx` — useDraggable wrapper; opacity during drag; click to TaskCard.onClick
- `taskflow/src/routes/dashboard/QuickCreateInput.tsx` — + Add toggle, createIssue + transition sequence, error display
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — DndContext, sensors, handleDragEnd with optimistic update + rollback, transitions pre-fetch, DragOverlay
- `taskflow/src/routes/dashboard/BoardColumn.tsx` — useDroppable, disabled overlay, DraggableCard rendering, cardErrors display
- `taskflow/src/routes/dashboard/QuickCreateInput.test.tsx` — props updated to match real interface; waitFor added for async hide assertion

## Decisions Made
- DraggableCard passes `onClick` to `TaskCard` directly (not to the wrapper `div`) — dnd-kit's listeners on the wrapper intercept all pointer events; clicking without moving fires `onPointerUp` which reaches `TaskCard.onClick` via the 5px threshold not being crossed
- QuickCreateInput button text is `+ Add` (not a lucide Plus icon) — the pre-written test uses `getByRole('button', { name: /\+ Add/i })` which requires the text `+` to be in the accessible name; SVG icons don't contribute to accessible name without aria-label
- Pre-written test expected synchronous input hide after Enter — component hides after async resolve; test updated with `waitFor` to correctly test async behavior
- Transitions pre-fetch identifies "bare stories" by computing `subtaskParentKeys` Set inline in the `useEffect` — `subtasksByParent` is only available inside `boardGroups` useMemo and cannot be referenced in the effect

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] QuickCreateInput test props mismatch**
- **Found during:** Task 1 (verify step)
- **Issue:** Pre-written stubs passed only `statusName` prop but the real component requires `statusId`, `projectKey`, `jiraBaseUrl`, `jiraToken`, `onCreated` — TypeScript reported 3 type errors
- **Fix:** Updated `DEFAULT_PROPS` helper in test file with all required props; added `fetchTransitions` and `postTransition` to the jira mock (needed by the component)
- **Files modified:** `taskflow/src/routes/dashboard/QuickCreateInput.test.tsx`
- **Verification:** TypeScript clean on QuickCreateInput; 3 tests pass after prop fix
- **Committed in:** `b399749` (Task 1 commit)

**2. [Rule 1 - Bug] QuickCreateInput button uses lucide Plus icon — test requires `+ Add` text**
- **Found during:** Task 2 (QuickCreateInput test run)
- **Issue:** Button rendered `<Plus icon /> Add` — accessible name was "Add" not "+ Add"; test uses `getByRole('button', { name: /\+ Add/i })`
- **Fix:** Replaced `<Plus className="size-3" /> Add` with `+ Add` plain text in the button
- **Files modified:** `taskflow/src/routes/dashboard/QuickCreateInput.tsx`
- **Verification:** All 3 QuickCreateInput tests pass
- **Committed in:** `5bcded9` (Task 2 commit)

**3. [Rule 1 - Bug] QuickCreateInput test expected synchronous input hide after Enter**
- **Found during:** Task 2 (QuickCreateInput test run)
- **Issue:** Test asserted `queryByRole('textbox') === null` synchronously after `fireEvent.keyDown(Enter)`, but `handleSubmit` is async — input only hides after promises resolve
- **Fix:** Added `waitFor` import and wrapped the "input should be hidden" assertion in `waitFor()`
- **Files modified:** `taskflow/src/routes/dashboard/QuickCreateInput.test.tsx`
- **Verification:** All 3 QuickCreateInput tests pass with `waitFor`
- **Committed in:** `5bcded9` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 — test stub alignment with real component interface)
**Impact on plan:** All fixes corrected pre-written RED stubs to match the implemented interface. No scope creep.

## Issues Encountered
- Pre-existing TypeScript errors in unrelated files (IssueDetailSheet.test.tsx, IssueDetailSidebar.tsx, SprintProgressTab.test.tsx, WorkloadTab.test.tsx) — out of scope per deviation rules; logged but not fixed
- Pre-existing test failures in SubtasksPanel.test.tsx, MyTasksTab.test.tsx, ReleasesTab.test.tsx — verified pre-existing via git stash; not caused by plan 10-03 changes

## Next Phase Readiness
- `DraggableCard.tsx` ready for use in any future column-based view
- `QuickCreateInput.tsx` accepts all required props via parent — reusable for future board variants
- `SprintBoardTab.tsx` drag-and-drop fully functional: transitions pre-fetched, optimistic update, rollback
- BOARD-03 and BOARD-04 requirements fulfilled

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/DraggableCard.tsx
- FOUND: taskflow/src/routes/dashboard/QuickCreateInput.tsx
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.tsx (DndContext wired)
- FOUND: taskflow/src/routes/dashboard/BoardColumn.tsx (useDroppable wired)
- FOUND commit: b399749 (Task 1)
- FOUND commit: 5bcded9 (Task 2)

---
*Phase: 10-sprint-board-redesign*
*Completed: 2026-03-14*
