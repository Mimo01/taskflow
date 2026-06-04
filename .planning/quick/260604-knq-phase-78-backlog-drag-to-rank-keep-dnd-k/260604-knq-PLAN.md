---
phase: 78-drag-to-rank-on-backlog
plan: 260604-knq
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [RANK-04, RANK-05, CR-01]
must_haves:
  truths:
    - "Dragging a backlog row reorders it within its section while autoScroll stays enabled, with no one-row hit-test drift on drop"
    - "The dragged row stays visible and follows the pointer in place (no DragOverlay clone)"
    - "Post-drop click selects the correct row (justDragged guard + in-place sortable keeps hit-test synced)"
    - "Cross-section drag remains a no-op; right-click move-to-sprint/backlog still works"
  artifacts:
    - path: "taskflow/src/routes/dashboard/BacklogPage.tsx"
      provides: "DndContext with autoScroll ON, no DragOverlay/createPortal, MeasuringStrategy.Always + drag-end reconcile intact"
      contains: "MeasuringStrategy.Always"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "In-place visible-drag sortable row treatment"
      contains: "useSortable"
  key_links:
    - from: "BacklogRow useSortable transform"
      to: "rendered <tr> while isDragging"
      via: "CSS.Transform.toString(transform) on a visible (non-opacity-0) row"
      pattern: "isDragging"
---

<objective>
UAT gap-closure: eliminate the one-row autoscroll-during-drag hit-test desync on the
backlog drag-to-rank flow. Root cause (confirmed in dnd-kit@6.3.1 `core.cjs` ~line 2993):
the DragOverlay path skips `activeNodeScrollDelta` compensation, so with an inner
overflow-auto scroll container + built-in autoScroll the drop target / post-drop click
drifts by ~one row. The non-overlay (in-place sortable) path DOES add
`activeNodeScrollDelta`. Fix: drag the real row in place (no overlay), keeping autoScroll ON.

Purpose: Keep autoscroll-during-drag (user requirement) while removing the desync.
Output: BacklogPage with no DragOverlay/createPortal; BacklogRow drags visibly in place.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/78-drag-to-rank-on-backlog/78-UAT.md
@taskflow/src/routes/dashboard/BacklogPage.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove DragOverlay from BacklogPage and drag the row in place in BacklogRow</name>
  <files>taskflow/src/routes/dashboard/BacklogPage.tsx, taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
Two coordinated edits implementing the in-place sortable drag (per the dnd-kit
non-overlay path that adds activeNodeScrollDelta — eliminates the one-row autoscroll desync).

BacklogPage.tsx:
1. Delete the entire `{createPortal(<DragOverlay dropAnimation={null}>...</DragOverlay>, document.body)}`
   block (currently the last child inside `<DndContext>`, the inline-clone IIFE rendering a
   `<table>`/`<BacklogRow ... isOverlay />`). Also delete its two leading comment blocks
   ("DragOverlay ghost..." and "Portaled to document.body...").
2. Remove `DragOverlay` from the `@dnd-kit/core` named import block (line ~34) — it is no
   longer referenced.
3. Remove the `import { createPortal } from 'react-dom';` line (~49) — no longer referenced.
4. Do NOT add `autoScroll={false}` anywhere. autoScroll stays ON by default.
5. KEEP `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}` and the
   `MeasuringStrategy` import. KEEP the drag-end reconcile re-render
   (`setLocalOrder((prev) => new Map(prev))` in handleDragEnd) and ALL drag plumbing:
   resolveIntraRankFromDrop → rankMutation, CR-01 localOrder clear in onSettled, the
   flicker gate (cancelQueries + isDraggingRef), RANK-04 rollback banner, justDragged
   post-drop click guard, cross-section no-op early return.
6. KEEP `activeId` state and its set/clear in handleDragStart/handleDragEnd — harmless and
   still tracked. (It only fed the now-deleted overlay; leaving the state is fine. Do NOT
   let removing the overlay cascade into deleting activeId unless tsc reports it unused —
   it is referenced by the deleted block only, so after deletion `activeId` read becomes
   unused; if biome/tsc flags `activeId` as unused, KEEP `setActiveId` calls and prefix the
   read with a void or remove the read only — but prefer leaving `setActiveId` calls intact.
   Simplest clean path: keep `const [activeId, setActiveId] = useState`; if biome flags
   `activeId` (the value) as unused, drop the destructured value to `const [, setActiveId]`
   and keep the setter calls. Do this ONLY if the check fails — run the check first.)

BacklogRow.tsx:
1. In `dragStyle`, change `opacity: isDragging && !isOverlay ? 0 : undefined` to keep the
   dragged row VISIBLE: `opacity: isDragging ? 0.85 : undefined`. The row now follows the
   pointer via its existing `CSS.Transform.toString(transform)`; dnd-kit's
   verticalListSortingStrategy still animates sibling rows to open the drop gap.
2. Add a subtle dragging treatment via existing design tokens. In `rowClassName`
   (the `cn(...)` call), add a conditional `isDragging && 'shadow-lg ring-2 ring-primary
   relative z-10'` entry so the dragged row reads as lifted. (z-10/relative ensures the
   shadow/ring render above sibling rows.) The existing `data-dragging={isDragging ? 'true'
   : undefined}` attribute on both <tr> paths already exposes the state — keep it.
3. Remove the now-dead `isOverlay` prop cleanly (verified low-risk: only referenced in
   BacklogRow.tsx + the deleted BacklogPage overlay block; no test references it):
   - Delete the `isOverlay?: boolean;` field + its doc comment from `BacklogRowProps`.
   - Remove `isOverlay` from the destructured props in the forwardRef render fn.
   - Change `useSortable({ id: issue.key, disabled: isOverlay })` to
     `useSortable({ id: issue.key })`.
   - Delete the `overlayClassName` const (`const overlayClassName = isOverlay ? 'bg-background'
     : undefined;`) and its comment, and remove `overlayClassName` from the `rowClassName`
     `cn(...)` arguments.
4. Apply the visible-drag treatment consistently — both the no-context-menu `<tr>` and the
   ContextMenuTrigger-rendered `<tr>` share `rowClassName`/`dragStyle`, so editing those two
   shared consts covers both paths. Do NOT duplicate.

Do NOT reintroduce any per-frame onDragOver live-reorder — order is computed once on drop.
Right-click Move-to-Sprint / Move-to-Backlog context menu must remain untouched.
  </action>
  <verify>
    <automated>cd taskflow && npm run check</automated>
    grep -c "DragOverlay" taskflow/src/routes/dashboard/BacklogPage.tsx → 0
    grep -c "createPortal" taskflow/src/routes/dashboard/BacklogPage.tsx → 0
    grep -c "autoScroll={false}" taskflow/src/routes/dashboard/BacklogPage.tsx → 0
    grep -c "isOverlay" taskflow/src/routes/dashboard/BacklogRow.tsx → 0
    grep -c "MeasuringStrategy.Always" taskflow/src/routes/dashboard/BacklogPage.tsx → 1 (kept)
  </verify>
  <done>
`npm run check` is clean (biome + tsc). BacklogPage.tsx has zero `DragOverlay`,
`createPortal`, and `autoScroll={false}` occurrences; `MeasuringStrategy.Always` and the
drag-end reconcile re-render remain. BacklogRow.tsx has zero `isOverlay` occurrences, the
dragged row stays visible (opacity 0.85) with a shadow-lg/ring-2 treatment, and the
useSortable transform drives in-place movement on both <tr> render paths.
  </done>
</task>

<task type="auto">
  <name>Task 2: Run the dashboard + jira test suites to confirm no regressions</name>
  <files>taskflow/src/routes/dashboard, taskflow/src/services/jira</files>
  <action>
Run the affected test suites to confirm the overlay removal + in-place drag did not regress
the backlog drag-to-rank behavior (intra-section rank mutation, cross-section no-op, rollback
banner, justDragged guard) or any jira service tests. No code changes expected here; if a test
asserts on the removed DragOverlay/isOverlay surface (none found in the grep audit), update the
assertion to reflect the in-place sortable behavior rather than reverting the implementation.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/routes/dashboard src/services/jira</automated>
  </verify>
  <done>
`npx vitest run src/routes/dashboard src/services/jira` passes (~810 passing, 2 skipped) with
no new failures attributable to the overlay removal or in-place drag change.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| user pointer → dnd-kit drag | Drag input drives an optimistic rank mutation; no new untrusted data crosses here (UI-only refactor) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-78-knq-01 | Tampering | rank mutation order on drop | accept | Unchanged from existing P78 flow — resolveIntraRankFromDrop + rankMutation onError rollback (RANK-04) already cover bad-order persistence; this plan does not touch the mutation path |
| T-78-knq-SC | Tampering | npm/pip installs | accept | No package installs in this plan — pure source edits to two existing files |
</threat_model>

<verification>
- `cd taskflow && npm run check` clean (biome + tsc).
- `cd taskflow && npx vitest run src/routes/dashboard src/services/jira` passes (~810 / 2 skipped).
- Grep guards: `DragOverlay`=0, `createPortal`=0, `autoScroll={false}`=0 in BacklogPage.tsx; `isOverlay`=0 in BacklogRow.tsx.
- Manual (UAT, out of scope for automation): drag a backlog row while the inner container autoscrolls; the row stays under the pointer and drops on the correct slot with no one-row drift; post-drop click selects the right row.
</verification>

<success_criteria>
- DragOverlay + createPortal removed from BacklogPage; autoScroll stays ON; MeasuringStrategy.Always and drag-end reconcile retained.
- BacklogRow drags in place (visible, opacity 0.85 + shadow-lg/ring-2), isOverlay prop removed cleanly, treatment applied to both <tr> paths.
- All invariants intact: intra-section rank path, CR-01 localOrder clear, flicker gate, RANK-04 rollback banner, justDragged guard, cross-section no-op, context menu untouched, verticalListSortingStrategy sibling animation (no onDragOver live-reorder).
- `npm run check` clean; dashboard + jira suites pass.
</success_criteria>

<output>
Create `.planning/quick/260604-knq-phase-78-backlog-drag-to-rank-keep-dnd-k/260604-knq-SUMMARY.md` when done
</output>
