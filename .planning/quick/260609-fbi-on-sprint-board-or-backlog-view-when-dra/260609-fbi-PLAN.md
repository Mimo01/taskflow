---
phase: quick-260609-fbi
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/BacklogPage.tsx
autonomous: true
requirements:
  - FBI-01
must_haves:
  truths:
    - "Pressing ESC during a drag on the Sprint Board cancels the drag and snaps the card back to its original column"
    - "Pressing ESC during a drag on the Backlog cancels the drag and snaps the row back to its original position"
    - "After ESC, no transition mutation is fired and no rank mutation is fired"
    - "All drag state (activeId, activeWidth, dropModel, isDraggingRef) is fully reset after ESC"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "handleDragCancel + onDragCancel wired to DndContext"
      contains: "handleDragCancel"
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "handleDragCancel + onDragCancel wired to DndContext"
      contains: "handleDragCancel"
  key_links:
    - from: "DndContext (SprintBoardTab)"
      to: "handleDragCancel"
      via: "onDragCancel prop"
      pattern: "onDragCancel=\\{handleDragCancel\\}"
    - from: "DndContext (BacklogPage)"
      to: "handleDragCancel"
      via: "onDragCancel prop"
      pattern: "onDragCancel=\\{handleDragCancel\\}"
---

<objective>
Wire ESC-to-cancel drag in the Sprint Board (phase-79 drag-to-transition) and the Backlog (phase-78 drag-to-rank). dnd-kit fires `onDragCancel` when the user presses ESC during a drag — currently neither DndContext has this handler, so the drag state (`activeId`, `activeWidth`, `dropModel`, `isDraggingRef`) is never cleared and no snap-back occurs.

Purpose: Pressing ESC must cancel the drag cleanly — no mutation fires, all state resets, the card/row returns to its original position (dnd-kit handles the visual snap-back automatically when `onDragCancel` fires; we only need to reset our own state).

Output: Two handlers added (one per file), `DragCancelEvent` type imported where needed, `onDragCancel` prop added to each `DndContext`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/PROJECT.md
@/Users/mimo/Documents/Projects/taskflow/.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add onDragCancel to SprintBoardTab (phase-79 drag-to-transition)</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <action>
    1. Add `type DragCancelEvent` to the `@dnd-kit/core` import block (alongside the existing `DragEndEvent` and `DragStartEvent` type imports on lines 18/20).

    2. After `handleDragEnd` (around line 1125), add:

       ```
       function handleDragCancel(_event: DragCancelEvent) {
         isDraggingRef.current = false;
         setActiveId(null);
         setActiveWidth(null);
         setDropModel(null);
         // No justDragged guard needed — ESC does not fire a click event.
       }
       ```

    3. On the `DndContext` JSX (around line 1726), add `onDragCancel={handleDragCancel}` after `onDragEnd={handleDragEnd}`.

    Do NOT reset `dragTokenRef` — the token bump in `handleDragStart` is sufficient to invalidate any in-flight async probes; an explicit bump here would create an off-by-one on the next drag start.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>SprintBoardTab compiles clean; `onDragCancel={handleDragCancel}` is present on the DndContext; pressing ESC during a board drag resets activeId/activeWidth/dropModel to null and isDraggingRef to false.</done>
</task>

<task type="auto">
  <name>Task 2: Add onDragCancel to BacklogPage (phase-78 drag-to-rank)</name>
  <files>taskflow/src/routes/dashboard/BacklogPage.tsx</files>
  <action>
    1. Add `DragCancelEvent` to the existing `@dnd-kit/core` type import on line 30:
       `import type { CollisionDetection, DragCancelEvent, DragEndEvent, DragStartEvent } from '@dnd-kit/core';`

    2. After `handleDragEnd` (around line 943), add:

       ```
       function handleDragCancel(_event: DragCancelEvent) {
         isDraggingRef.current = false;
         setActiveId(null);
         // Re-clone localOrder so sortable rows reset their transforms against
         // the current scroll position (same reason as the no-op path in handleDragEnd).
         setLocalOrder((prev) => new Map(prev));
         setRankError(null);
         // No justDragged guard needed — ESC does not fire a click event.
       }
       ```

    3. On the `DndContext` JSX (around line 1294), add `onDragCancel={handleDragCancel}` after `onDragEnd={handleDragEnd}`.

    Do NOT call `rankMutation` — no rank change occurred. Do NOT set `justDragged` — ESC produces no follow-on click.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && npm run check 2>&1 | tail -5</automated>
  </verify>
  <done>BacklogPage compiles clean; `onDragCancel={handleDragCancel}` is present on the DndContext; pressing ESC during a backlog drag resets activeId/localOrder and isDraggingRef without firing a rank mutation.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user input → drag lifecycle | ESC key event handled by dnd-kit internally; our handler only clears local React state |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-fbi-01 | Tampering | handleDragCancel state reset | accept | ESC fires browser-native keyboard event; dnd-kit's KeyboardSensor validates it before invoking onDragCancel — no external input surface |
</threat_model>

<verification>
1. `npm run check` passes (biome + tsc) with no new errors.
2. `grep -n "onDragCancel" taskflow/src/routes/dashboard/SprintBoardTab.tsx` — shows the prop on the DndContext.
3. `grep -n "onDragCancel" taskflow/src/routes/dashboard/BacklogPage.tsx` — shows the prop on the DndContext.
4. Manual: drag a Sprint Board card, press ESC — card snaps back, no transition fires.
5. Manual: drag a Backlog row, press ESC — row snaps back, no rank mutation fires.
</verification>

<success_criteria>
- Pressing ESC during a Sprint Board drag cancels the drag; no transition mutation fires; card returns to original column.
- Pressing ESC during a Backlog drag cancels the drag; no rank mutation fires; row returns to original position.
- `npm run check` GREEN after both changes.
</success_criteria>

<output>
Create `.planning/quick/260609-fbi-on-sprint-board-or-backlog-view-when-dra/260609-fbi-SUMMARY.md` when done.
</output>
