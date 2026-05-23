---
phase: quick-260405-tci
plan: 01
subsystem: ui
tags: [react, jira, sprints, issue-detail, backlog, confirmation-dialog]

requires: []
provides:
  - Editable sprint picker in issue detail sidebar (stories only)
  - Shared ConfirmSprintMoveDialog component for all sprint move operations
  - Confirmation flow wired into backlog context menu sprint moves
affects: [issue-detail, BacklogPage, sprint-management]

tech-stack:
  added: []
  patterns:
    - "Confirmation dialog pattern: request* function sets pending state, confirm* function executes action"
    - "Sprint picker uses Popover + useBoardId + fetchSprintsForBoard, gated on sprintPickerOpen"
    - "Token read via useQuery with staleTime: Infinity (same pattern as fix versions)"

key-files:
  created:
    - taskflow/src/components/ui/confirm-sprint-move-dialog.tsx
  modified:
    - taskflow/src/routes/dashboard/issue-detail/utils.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx

key-decisions:
  - "Confirmation state uses pending* pattern: request handler sets pending, confirm handler executes"
  - "extractSprintId added to utils.ts alongside existing extractSprintName"
  - "ConfirmSprintMoveDialog placed in components/ui/ for reuse across issue-detail and backlog"
  - "Backlog option only shown when currentSprintId is non-null (issue is in a sprint)"

patterns-established:
  - "request/confirm split: use requestMove* to stage, confirmMove* to execute with optimistic updates"

requirements-completed: [QUICK-TCI]

duration: 20min
completed: 2026-04-05
---

# Quick Task 260405-tci: Sprint Change from Issue Detail Summary

**Editable sprint picker in issue detail sidebar with ConfirmSprintMoveDialog shared component wiring all sprint moves through confirmation before execution**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-05T00:00:00Z
- **Completed:** 2026-04-05T00:20:00Z
- **Tasks:** 2 (+ checkpoint:human-verify pending)
- **Files modified:** 4

## Accomplishments
- Created `ConfirmSprintMoveDialog` reusable component used by both issue detail and backlog
- Sprint field in issue detail sidebar is now an interactive Popover picker (was read-only)
- Added `extractSprintId` helper to utils.ts for getting sprint ID from raw Jira sprint field
- All sprint moves in backlog view now go through confirmation before executing

## Task Commits

1. **Task 1: Sprint picker + ConfirmSprintMoveDialog** - `e7ab0fe` (feat)
2. **Task 2: Backlog confirmation wiring** - `635e22e` (feat)

## Files Created/Modified
- `taskflow/src/components/ui/confirm-sprint-move-dialog.tsx` - Reusable confirmation dialog with issueKey, from/to sprint names, cancel/confirm buttons
- `taskflow/src/routes/dashboard/issue-detail/utils.ts` - Added `extractSprintId` helper
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Sprint row replaced with interactive Popover picker + ConfirmSprintMoveDialog + sprintMoveMutation
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Added pending state, request/confirm handler split, two ConfirmSprintMoveDialog instances

## Decisions Made
- Used `request*/confirm*` split pattern: `requestMoveToSprint` sets pending state, `confirmMoveToSprint` has the optimistic update logic. Clean separation between intent and execution.
- ConfirmSprintMoveDialog placed in `components/ui/` (not routes/) for cross-context reuse.
- Backlog "Move to Backlog" option is gated behind `currentSprintId !== null` — only shown when issue is actually in a sprint.
- Token in FieldsSection fetched via useQuery with `staleTime: Infinity` (same existing pattern as fix versions loading).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in `Sidebar.tsx` (line 133: `number` vs `number[]`) — out of scope, not caused by this task's changes. Documented here only.

## Next Phase Readiness
- Sprint picker functional; awaiting human verification (checkpoint:human-verify)
- ConfirmSprintMoveDialog ready for any future sprint move UI additions

---
*Phase: quick-260405-tci*
*Completed: 2026-04-05*
