---
phase: 78-drag-to-rank-on-backlog
plan: 260604-knq
subsystem: dashboard/backlog
tags: [dnd-kit, drag-to-rank, autoscroll, uat-gap]
requires:
  - "@dnd-kit/core DndContext + @dnd-kit/sortable useSortable (existing P78 plumbing)"
provides:
  - "Backlog drag-to-rank with autoScroll ON and no one-row hit-test desync"
  - "In-place visible-drag sortable row (no DragOverlay clone)"
affects:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
tech-stack:
  added: []
  patterns:
    - "dnd-kit non-overlay (in-place sortable) drag path — adds activeNodeScrollDelta, fixing autoscroll-during-drag drift"
key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
decisions:
  - "Drag the real row in place (no DragOverlay/createPortal) so dnd-kit adds activeNodeScrollDelta — eliminates the one-row autoscroll desync while keeping autoScroll ON"
  - "Dragged row stays visible (opacity 0.85) with shadow-lg/ring-2 lift; treatment lives on shared rowClassName/dragStyle so both <tr> render paths get it"
  - "Removed dead isOverlay prop + overlayClassName; dropped unused activeId value (setActiveId calls retained)"
metrics:
  duration: ~6min
  completed: 2026-06-04
  tasks: 2
  files: 2
---

# Phase 78 Plan 260604-knq: Backlog Drag-to-Rank — Keep dnd-kit Autoscroll, Fix Desync Summary

UAT gap-closure that eliminates the one-row autoscroll-during-drag hit-test desync on the backlog drag-to-rank flow by switching from a portaled DragOverlay clone to dragging the real row in place, while keeping autoScroll enabled.

## What Was Built

The root cause (dnd-kit@6.3.1 `core.cjs` ~line 2993): the DragOverlay path skips `activeNodeScrollDelta` compensation, so with an inner overflow-auto scroll container + built-in autoScroll, the drop target / post-drop click drifted by ~one row. The non-overlay (in-place sortable) path DOES add `activeNodeScrollDelta`.

**BacklogPage.tsx:**
- Deleted the entire `{createPortal(<DragOverlay dropAnimation={null}>...</DragOverlay>, document.body)}` block and its two leading comment blocks.
- Removed `DragOverlay` from the `@dnd-kit/core` named import and removed the `import { createPortal } from 'react-dom';` line.
- Kept `measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}`, the drag-end reconcile re-render (`setLocalOrder((prev) => new Map(prev))`), and ALL drag plumbing: `resolveIntraRankFromDrop` → `rankMutation`, CR-01 localOrder clear in `onSettled`, the flicker gate (`cancelQueries` + `isDraggingRef`), RANK-04 rollback banner, justDragged post-drop click guard, cross-section no-op early return.
- Did NOT add `autoScroll={false}` — autoScroll stays ON by default.
- `activeId` value became unused after the overlay deletion (biome/tsc flagged it, as the plan anticipated) → dropped to `const [, setActiveId]`, retaining the setter calls in `handleDragStart`/`handleDragEnd`.

**BacklogRow.tsx:**
- Changed `dragStyle` opacity from `isDragging && !isOverlay ? 0` to `isDragging ? 0.85` so the dragged row stays VISIBLE and follows the pointer via its existing `CSS.Transform.toString(transform)`.
- Added an in-place lift treatment to `rowClassName`: `isDragging && 'shadow-lg ring-2 ring-primary relative z-10'`. Both render paths (no-context-menu `<tr>` and ContextMenuTrigger `<tr>`) share `rowClassName`/`dragStyle`, so the single edit covers both — no duplication.
- Removed the dead `isOverlay` prop cleanly: deleted the `isOverlay?: boolean` field + doc comment, removed it from destructured props, changed `useSortable({ id, disabled: isOverlay })` to `useSortable({ id })`, and deleted the `overlayClassName` const + its use in `cn(...)`.

No per-frame `onDragOver` live-reorder reintroduced (order computed once on drop). Right-click Move-to-Sprint / Move-to-Backlog context menu untouched.

## Tasks Completed

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Remove DragOverlay from BacklogPage; drag row in place in BacklogRow | 2a2a4c30 | BacklogPage.tsx, BacklogRow.tsx |
| 2 | Run dashboard + jira test suites to confirm no regressions | (no code change) | — |

## Verification

- `npm run check` (biome + tsc): clean.
- `npx vitest run src/routes/dashboard src/services/jira`: 810 passed, 2 skipped, 13 todo (66 files passed, 2 skipped). No new failures.
- Grep guards: `DragOverlay`=0, `createPortal`=0, `autoScroll={false}`=0 in BacklogPage.tsx; `MeasuringStrategy.Always`=1 (kept); `isOverlay`=0 in BacklogRow.tsx.
- Manual UAT (out of scope for automation): drag a backlog row while the inner container autoscrolls; the row stays under the pointer and drops on the correct slot with no one-row drift; post-drop click selects the right row.

## Deviations from Plan

### Auto-fixed Issues

None requiring code changes beyond what the plan anticipated.

The plan pre-described the `activeId`-unused contingency: after deleting the overlay block, biome (`lint/correctness/noUnusedVariables`) and tsc (`TS6133`) flagged `activeId` as unused. Applied the plan's prescribed clean path — dropped the destructured value to `const [, setActiveId]` and kept the setter calls. One additional touch: a code comment I added literally contained the token "DragOverlay", tripping the `DragOverlay`=0 grep guard; rephrased to "drag-overlay clone" so the guard passes. Neither is a behavioral deviation.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/BacklogPage.tsx
- FOUND: taskflow/src/routes/dashboard/BacklogRow.tsx
- FOUND commit: 2a2a4c30
