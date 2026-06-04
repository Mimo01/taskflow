---
phase: 78-drag-to-rank-on-backlog
plan: "04"
subsystem: routes/dashboard
tags: [dnd-kit, drag-drop, backlog, rank, optimistic-mutation, flicker-gate]
dependency_graph:
  requires:
    - plan: 78-01
      provides: "@dnd-kit packages, cancelLabel prop, BacklogPage.rank.test.ts scaffold"
    - plan: 78-02
      provides: "rank.ts CR-01/CR-02 fixed"
    - plan: 78-03
      provides: "rankIssueApi service function"
  provides:
    - "BacklogRow: dnd-kit sortable item with justDragged-guarded click"
    - "BacklogPage: DndContext + per-section SortableContext + rank mutation + flicker gate + error banner + cross-section confirm"
  affects:
    - "Phase 79 (drag-to-transition) — same @dnd-kit package, same DndContext pattern"
tech_stack:
  added: []
  patterns:
    - "per-section SortableContext with stable string id (sprint-<id> / backlog)"
    - "localOrder Map<sectionId,string[]> as isDraggingRef-gated rendered source of truth"
    - "useMutation onMutate/onError/onSettled optimistic pattern (mirrors useFieldMutation.ts)"
    - "DragOverlay ghost clone with isOverlay prop disabling useSortable hook"
    - "justDragged ref guard: 50ms window suppresses click-to-peek after drop"
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts
decisions:
  - "SortableContext placed inside renderSection body (wrapping VirtualizedBacklogTable) so each section has its own sortable namespace; items= uses localOrder override when set"
  - "handleDragEnd reads sourceContainer from active.data.current?.sortable?.containerId — stable because SortableContext id is explicit"
  - "DragOverlay BacklogRow uses isOverlay=true to disable useSortable and avoid double-registration"
  - "10105 in BacklogPage is only in a pre-existing doc comment; mutation always reads backlog?.rankCustomFieldId (integer from cache)"
  - "Cross-section confirm handler (confirmDragMove) fires sprint-membership then rank in sequence; rollback restores both sections"
metrics:
  duration: "~35 min (continuation after prior executor crash)"
  completed: "2026-06-03"
  tasks: 2
  files_changed: 3
---

# Phase 78 Plan 04: BacklogPage Drag-to-Rank Wiring Summary

**Full drag-to-rank wiring: BacklogRow as dnd-kit sortable item; BacklogPage with DndContext + per-section SortableContext, optimistic rank mutation, flicker gate, rollback banner, DragOverlay ghost, and cross-section ConfirmSprintMoveDialog with "Keep Position"**

## Performance

- **Duration:** ~35 min (resumed from prior executor crash after Task 1 commit)
- **Completed:** 2026-06-03
- **Tasks:** 2 autonomous (Task 3 is human-verify checkpoint)
- **Files modified:** 3

## Accomplishments

### Task 1 (prior executor — commit a131e397)
- Made `BacklogRow` a `useSortable({ id: issue.key, disabled: isOverlay })` item
- Applied `setNodeRef`, `dragStyle` (CSS.Transform + opacity 0 while dragging), `data-dragging`, `{...attributes}`, `{...listeners}` to BOTH `<tr>` render paths (context-menu path and no-context-menu path)
- Added `justDragged?.current` guard on both click handlers
- Added `isOverlay` and `justDragged` props to `BacklogRowProps`

### Task 2 (this executor — commit a8ee538c)
- Added drag state: `isDraggingRef`, `justDragged`, `activeId`, `localOrder` (Map), `rankError`, `pendingDragMove`
- Added `sensors` with `PointerSensor { delay: 150, tolerance: 5 }` (D-06)
- Added `rankMutation` (`useMutation`) following `useFieldMutation.ts` pattern:
  - `onMutate`: `cancelQueries(['gh-backlog', boardId])` + snapshot + `setLocalOrder` (D-08/RANK-05)
  - `onError`: restore snapshot + restore localOrder + set `rankError` (RANK-04)
  - `onSettled`: clear `isDraggingRef` + `invalidateGhBacklogData` (RANK-05)
- Added `handleDragStart` / `handleDragEnd` with intra-section `arrayMove` + `rankMutation.mutate` path
- Cross-section: `pendingDragMove` state drives `ConfirmSprintMoveDialog` with `cancelLabel="Keep Position"` (D-03/D-04)
- `confirmDragMove` fires sprint-membership (`addIssuesToSprint` / `moveIssuesToBacklog`) then `rankIssueApi` sequentially; rolls back both sections on error
- Wrapped sprint+backlog sections in `DndContext` (closestCenter + restrictToVerticalAxis)
- Each `renderSection` call wraps `VirtualizedBacklogTable` in `SortableContext` with stable id + `localOrder`-driven items (RANK-01)
- DragOverlay renders BacklogRow clone with `isOverlay` + `opacity: 0.6` (D-07)
- Inline `rankError` banner above sections: "Couldn't save new order — reverted" / "Couldn't move issue — reverted" (D-09)
- `BacklogPage.rank.test.ts` GREEN (3/3: RANK-03/04/05); `BacklogPage.network.test.tsx` GREEN; full suite 151 passed

## Task Commits

1. **Task 1: Make BacklogRow a dnd-kit sortable item** — `a131e397` (feat, prior executor)
2. **Task 2: Wire DndContext + per-section SortableContext + rank mutation** — `a8ee538c` (feat)

## Files Modified

- `taskflow/src/routes/dashboard/BacklogRow.tsx` — `useSortable` hook, `dragStyle`, `isOverlay`/`justDragged` props, guard on both `<tr>` click paths
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — full drag-to-rank wiring (see Accomplishments Task 2)
- `taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` — Wave-0 RED scaffold (Plan 01) now GREEN

## Verification Results

```
npm test -- --run BacklogPage.rank.test.ts → 3 passed (RANK-03/04/05) GREEN
npm test -- --run BacklogPage.network.test.tsx → 1 passed (RANK-01) GREEN
npm test -- --run (full suite) → 151 passed | 2 skipped | 0 failed GREEN
npx tsc --noEmit → clean (no errors)
```

Acceptance criteria checks:
- `grep -c "DndContext" BacklogPage.tsx` → 4 ✓ (≥1)
- `grep -c "SortableContext" BacklogPage.tsx` → 4 ✓ (≥1)
- `grep -c "cancelQueries" BacklogPage.tsx` → 1 ✓ (≥1)
- `grep -c "isDraggingRef" BacklogPage.tsx` → 6 ✓ (≥2)
- `grep -c "rankIssueApi" BacklogPage.tsx` → 3 ✓ (≥1)
- `grep -c "backlog?.rankCustomFieldId" BacklogPage.tsx` → 4 ✓ (≥1)
- `grep -c "10105" BacklogPage.tsx` → 1 (pre-existing doc comment only — not in mutation body) ✓
- `grep -c "Couldn't save new order — reverted" BacklogPage.tsx` → 1 ✓
- `grep -c 'cancelLabel="Keep Position"' BacklogPage.tsx` → 1 ✓
- `grep -c "delay: 150" BacklogPage.tsx` → 1 ✓

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] getSectionKeys helper**
- **Found during:** Task 2 handleDragEnd implementation
- **Issue:** handleDragEnd needs to look up current server-derived issue keys for a section by id; plan sketch showed a comment placeholder `/* current section keys */[]`
- **Fix:** Added `getSectionKeys(sectionId: string)` helper that dispatches on `'backlog'` vs `'sprint-<id>'` prefix
- **Files modified:** `BacklogPage.tsx`

**2. [Rule 1 - Bug] DragOverlay BacklogRow — removed non-existent `flaggedFieldKey` prop**
- **Found during:** TypeScript check after Task 2 implementation
- **Issue:** `BacklogRowProps` does not have a `flaggedFieldKey` prop (flag status is derived from `isIssueFlagged` inside the parent, not passed to the row)
- **Fix:** Removed `flaggedFieldKey` from the DragOverlay `BacklogRow` instantiation
- **Files modified:** `BacklogPage.tsx`
- **Commit:** `a8ee538c` (fixed before commit)

## Known Stubs

None. All drag behaviors use real mutation paths consuming `rankIssueApi` and cached `rankCustomFieldId`.

## Threat Surface Scan

No new threat surface beyond the plan's threat model:
- T-78-04A mitigated: `backlog?.rankCustomFieldId` (integer from cache) used in all mutation calls; no `10105` literal in mutation body
- T-78-04B mitigated: all writes use `readSecret('jira-pat')` + `rankIssueApi`/`addIssuesToSprint`/`moveIssuesToBacklog` via established `apiFetch` path
- T-78-04C mitigated: `cancelQueries` in `onMutate` + `isDraggingRef`-gated `localOrder` hold optimistic order during drag window

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/BacklogPage.tsx` — FOUND ✓
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — FOUND ✓
- `taskflow/src/routes/dashboard/__tests__/BacklogPage.rank.test.ts` — FOUND ✓
- Commit `a131e397` — FOUND ✓
- Commit `a8ee538c` — FOUND ✓
- `npm test -- --run BacklogPage.rank.test.ts` → 3 passed ✓
- `npm test -- --run BacklogPage.network.test.tsx` → 1 passed ✓
- `npm test -- --run` (full suite) → 151 passed ✓
- `npx tsc --noEmit` → clean ✓

## Next Steps

Task 3 is a human-verify checkpoint. The reviewer exercises the five manual behaviors (drag/ghost/insertion line, click-vs-drag, no-flicker-during-refetch, cross-section confirm, failure rollback) in the running app.

## Gap-Closure (post-UAT, 2026-06-04)

Human UAT at the Task 3 checkpoint found two defects; both fixed on `main` with code committed before this note.

**Defect 1 — Drop indicator too weak (D-07).** The only feedback was the dragged row going `opacity:0` plus a faint `opacity:0.6` ghost; no insertion line. Fix:
- Added a strong 2px `bg-primary` insertion line rendered INSIDE the row's first `<td>` (absolutely positioned, `position: relative` on the row) so it stays correct under the virtualized/transformed `<tr>`. The edge (top/bottom) is chosen from drag direction in `onDragOver`. New `dropEdge` prop on `BacklogRow`, threaded via `dropTargetKey`/`dropEdge` on `VirtualizedBacklogTable`.
- Strengthened the `DragOverlay` ghost: `BacklogRow isOverlay` now applies `ring-2 ring-primary shadow-xl`, and the overlay table is near-opaque (`0.95`) with `ring-2 ring-primary shadow-2xl`.
- Commit `c5dbf106` (`fix(78-04): strengthen drop indicator / insertion line`).

**Defect 2 — Cross-section drag did not work (D-03/D-04/D-05).** `handleDragEnd` only read `over.data.current.sortable.containerId`, undefined when dropping on a section header/gap/empty section; `closestCenter` biased to the source container; empty sprint sections (a `<p>`) could not receive a drop. Fix:
- Each section body (incl. the empty-section branch) is now wrapped in a `useDroppable({ id: sectionId })` (`DroppableSection`) so `over.id` resolves to the section even with no row under the cursor; empty sections insert at index 0.
- Replaced `closestCenter` with a custom `collisionDetection` (`pointerWithin` → `rectIntersection` → `closestCenter`).
- Added `onDragOver` tracking the over-target; drives both the cross-section highlight ring (`bg-accent/10 ring-1 ring-primary/60`, source section suppressed) and the Defect-1 insertion-line edge.
- `handleDragEnd` resolves `targetContainer` from a row's `sortable.containerId` OR a section droppable id; intra-section reorder, optimistic mutation, flicker gate (D-08), rollback banner (D-09), and confirm/Keep-Position flow unchanged.
- Container resolution extracted to pure `backlogDragHelpers.ts` (`resolveCrossSectionDrop` et al.) and unit-tested (`backlogDragHelpers.test.ts`, 18 cases: row drop, header/gap drop, empty-section drop, same-section null, no-target null) — the seam that decides whether `ConfirmSprintMoveDialog` opens. jsdom cannot simulate a real pointer drag, so the cross-section interaction still needs human re-verification.
- Commit `1f648bd8` (`fix(78-04): enable cross-section drag via droppable sections + collision detection`).

Verification after fixes: `BacklogPage.rank.test.ts`, `rank.test.ts`, `rank-api.test.ts`, `BacklogPage.network.test.tsx`, `backlogDragHelpers.test.ts` all GREEN; `npx tsc --noEmit` clean; biome clean.

Second gap-closure pass (commits `9c0ee850`, `bdc048c8`): smoothed drag by gating `handleDragOver` re-renders through `overStateEquals` (zero re-renders on steady-state pointer movement) and lightened visuals to one clean insertion line + a single soft `shadow-lg` overlay; made the cross-section move optimistic by moving the issue between the cached `gh-backlog` `sprints[].issuesIds[]` (`moveIssueAcrossSections`) before the awaits so it renders in the target section immediately (no post-success jump), with snapshot rollback on failure.
