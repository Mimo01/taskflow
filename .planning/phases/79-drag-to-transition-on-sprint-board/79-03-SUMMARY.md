---
phase: 79-drag-to-transition-on-sprint-board
plan: 03
subsystem: ui
tags: [dnd-kit, react, jira, sprint-board, drag-and-drop, transitions]

requires:
  - phase: 79-drag-to-transition-on-sprint-board (Plan 01)
    provides: JiraTransition.hasScreen?/hasValidators? fields + adapter propagation
  - phase: 79-drag-to-transition-on-sprint-board (Plan 02)
    provides: sprintBoardDragHelpers (filterDroppableTransitions, buildDropModel, resolveDropTransitionId)
provides:
  - Draggable non-story cards on the sprint board (useDraggable, D-04)
  - Board-scoped DndContext with split/single/invalid drop-zone UI per column
  - Drop drives the existing handleTransition optimistic/rollback/invalidate path
  - Portaled DragOverlay ghost matching the dragged card's width
  - Drop zones tinted by status category (To Do/In Progress/Done)
affects: [sprint-board, jira-transitions, drag-and-drop]

tech-stack:
  added: []
  patterns:
    - "Drag-time per-swimlane drop overlay: zones render only in the dragged card's story row"
    - "Status-category-tinted drop zones via DROP_ZONE_TONE map mirroring statusStyles.ts"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/sprintBoardDragHelpers.ts
    - taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts
    - .planning/phases/79-drag-to-transition-on-sprint-board/79-CONTEXT.md

key-decisions:
  - "D-07 REVERSED during UAT: screen/validator transitions are now valid drop targets (app has no screen flow; right-click also just posts). All reachable transitions are droppable; rejected drops roll back with inline error."
  - "Drop zones render only in the dragged card's own swimlane (activeSwimlaneKey) — fixes scroll-height inflation and wrong-row zones."
  - "Single-transition columns render one labelled zone (same visual as split) instead of keeping cards visible."
  - "DragOverlay ghost width captured from active.rect at drag start so it matches the real card."
  - "Drop zones tinted by status category color + 2px colored dashed border for visibility."

patterns-established:
  - "Per-swimlane drag overlay: gate split/single/invalid rendering on story.key === activeSwimlaneKey"
  - "Category-tone map (DROP_ZONE_TONE) keyed by CategoryKey for status-colored drop affordances"

requirements-completed: [TRAN-01, TRAN-02, TRAN-04, TRAN-05]

duration: ~50min
completed: 2026-06-04
---

# Phase 79 Plan 03: Drag-to-transition live board wiring

**Sprint-board cards drag between status columns to fire Jira transitions, with per-swimlane split drop zones tinted by status category, optimistic rollback, and a board refresh on success.**

## Performance

- **Duration:** ~50 min (incl. human-verify checkpoint iteration)
- **Completed:** 2026-06-04
- **Tasks:** 3 (2 automated + 1 human-verify checkpoint)
- **Files modified:** 6

## Accomplishments
- Non-story (subtask/task) cards are draggable via `useDraggable`; story headers are not (D-04). `justDragged` ref suppresses the post-drop peek click (D-12); `touch-action:none` for WebView2 (D-13).
- Board-scoped `DndContext` (`autoScroll={false}`, portaled `DragOverlay`, pointerWithin-first collision) drives a drag-time drop model computed once at drag start.
- Each column renders split (≥2 transitions) / single (1) / invalid (0) zones; drop resolves via `resolveDropTransitionId` and reuses the existing `handleTransition` optimistic/rollback/`cardErrors`/`invalidateGhAllData` path (D-09/D-10/D-11, TRAN-04/TRAN-05).
- Component tests cover failed-transition rollback (TRAN-04) and invalidate-on-success (TRAN-05).

## Task Commits

1. **Task 1: TaskCard draggable** — `e1a0d795` (feat)
2. **Task 2: DndContext + split-column UI + drop wiring** — `650f845d` (test, RED), `5990c513` (feat, GREEN)

**Checkpoint (Task 3) human-verify fixes:**
3. Scope drop zones to dragged card's swimlane — `e30119f7` (fix)
4. Ghost keeps card width; single-transition columns show labelled zone — `a316f2b8` (fix)
5. Reverse D-07 — screen/validator transitions now valid drop targets — `4ab7152b` (fix)
6. Idle drop zones slightly more visible — `02a392b3` (style)
7. Color drop zones by status category + bolder borders — `d9b58c58` (style)

## Files Created/Modified
- `taskflow/src/routes/dashboard/TaskCard.tsx` — `useDraggable` (gated by `isDraggable`/`isOverlay`), `justDragged` onClick guard, `touch-action:none`, overlay `aria-hidden`.
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — `DndContext`, drag state, `handleDragStart`/`handleDragEnd`, per-swimlane split/single/invalid zone rendering, `DROP_ZONE_TONE` category coloring, portaled `DragOverlay` ghost with captured width.
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — TRAN-04 rollback + TRAN-05 invalidate tests.
- `taskflow/src/routes/dashboard/sprintBoardDragHelpers.ts` — `filterDroppableTransitions` no longer applies the screen/validator filter (D-07 reversed).
- `taskflow/src/routes/dashboard/sprintBoardDragHelpers.test.ts` — screen/validator transitions now asserted kept.
- `.planning/phases/79-drag-to-transition-on-sprint-board/79-CONTEXT.md` — recorded D-07 reversal.

## Decisions Made
See `key-decisions` frontmatter. Headline: **D-07 reversed** — the original plan excluded screen/validator transitions from drag targets, but UAT showed this hid legitimate targets (Done) and the app has no transition-screen flow at all (right-click also just `postTransition`s), so the exclusion protected nothing. All reachable transitions are now droppable; TRAN-03's "no silent snap-back" is satisfied by the rollback + inline-error path.

## Deviations from Plan

All deviations were surfaced and approved during the Task 3 human-verify checkpoint:

1. **Drop zones scoped to the dragged card's swimlane** — plan rendered zones whenever any drag was active, which showed zones in every story row and ballooned the board scroll height. Now gated on `activeSwimlaneKey`.
2. **Single-transition columns render a labelled zone** — plan kept cards visible in a whole-column droppable; users expected the same labelled affordance as multi-transition columns. Now renders one `TransitionDropZone` (keeps the `col:` id so resolution is unchanged).
3. **Ghost matches card width** — plan/overlay used a fixed `w-48`; now captures `active.rect` width at drag start.
4. **D-07 reversed** — screen/validator transitions are now valid drop targets (see Decisions).
5. **Drop-zone visual polish** — zones tinted by status category and given bolder colored borders for visibility.

**Impact:** Deviations 1–3 are correctness/UX fixes; 4 is a user-confirmed decision reversal recorded in CONTEXT; 5 is styling. No scope creep beyond the phase's drag-to-transition goal.

## Issues Encountered
None beyond the checkpoint-driven refinements above. UAT-1 (Windows/WebView2 mouseup) deferred — requires a Windows environment; the WebView2 mitigations (`autoScroll={false}`, `touch-action:none`, portaled overlay) are in place per D-13.

## User Setup Required
None.

## Next Phase Readiness
Phase 79 (drag-to-transition) is feature-complete. TRAN-01/02/04/05 delivered; TRAN-03 satisfied via the rollback path after the D-07 reversal. Manual macOS UAT signed off by the user; Windows mouseup case left for verification on a Windows host.

---
*Phase: 79-drag-to-transition-on-sprint-board*
*Completed: 2026-06-04*
