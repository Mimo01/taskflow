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

Third (final-polish) pass (commits `7c122eae`, `164fff83`): the second pass read TOO light and the cross-section line/section-highlight treatments didn't match. Set the insertion line to a 3px rounded `bg-primary` bar at full row width with a small filled primary dot end-cap (`size-1.5`) at each end, rendered identically for intra- AND cross-section drags (`overRowKey`/`dropEdge` drive both). Softened the section highlight ring `ring-primary/60 → ring-primary/30` so the tint is a subtle secondary cue, not a competing style. Smoothed the residual drop jank with an explicit `backlogDropAnimation` (180ms `cubic-bezier(0.2,0,0,1)`, `defaultDropAnimationSideEffects` active opacity forced to `1`) so the overlay no longer fades to the source row's mid-drag opacity 0 while the real row snaps back to 1 — eliminating the double-image flicker. Overlay ghost confirmed solid (opacity 1) + `shadow-lg` + 1px `border border-border`, no ring/2xl. `overStateEquals` re-render gating and the optimistic `moveIssueAcrossSections` cache move left intact. Suite (5 files / 43 tests) GREEN; `npm run check` (biome + tsc) clean.

Fourth (drop-model) pass (commit `f4cbca05`): human re-test wanted a different drop MODEL. (1) The insertion line + end-cap dots are REMOVED entirely (the primary-color bar read as a dark/black bar on this theme) along with all `dropEdge`/`dropTargetKey`/`overRowKey` plumbing; `OverState` simplified to `overSectionId` only. (2) Adopted the standard dnd-kit live-sortable pattern: `onDragOver` live-reorders the dragged key to follow the pointer (`computeLiveReorder` arrayMove intra-section; cross-section moves the key out of the source `localOrder` and into the target at the over-index), all `setState` GATED by `overStateEquals`/`keyOrderEquals` (zero per-frame re-renders). The dragged row, now living in its drop slot, renders as a translucent GHOST PLACEHOLDER (`opacity-50 border border-dashed border-primary/50 bg-muted/40`) instead of `opacity:0` — identical intra- AND cross-section. (3) `DragOverlay dropAnimation={null}` removes the float-back-to-source animation: the solid clone just disappears, leaving the live-reordered list. A pre-drag `localOrder` snapshot (`preDragOrderRef`) is captured on drag start and restored on aborted drag / cross-section Keep-Position cancel. `handleDragEnd` derives the final order from `localOrder` (no extra arrayMove) and resolves the true source from the pre-drag snapshot (since live-reorder mutates the active container). Optimistic cross-section cache move + rollback preserved. New helper tests (`computeLiveReorder`, `keyOrderEquals`) added; `overStateEquals` tests updated. Suite (5 files / 49 tests) GREEN; `npm run check` clean.

Fifth (drag-scope) pass: cross-section DRAG disabled entirely — drag now ONLY reorders rows WITHIN their own section (intra-section rank). A drop that ends in a different section is a no-op: `handleDragEnd`'s `source !== target` branch just calls `restorePreDragOrder()` (no dialog, no membership change, no rank PUT). `handleDragOver` no longer advertises any non-source section as a drop target (clears overState off-source; only the source section live-reorders). Removed the now-dead cross-section DRAG machinery: `pendingDragMove` state, `dragMovePending`/`dragMoveInFlightRef` (WR-05 guard), `confirmDragMove`/`cancelDragMove`, the drag `ConfirmSprintMoveDialog` ("Keep Position"), and the now-unused `resolveCrossSectionDrop`/`moveIssueAcrossSections` imports in BacklogPage. Pure helpers + their unit tests remain in `backlogDragHelpers.ts`. The right-click context-menu Move-to-Sprint / Move-to-Backlog dialogs (`pendingSprintMove`/`pendingBacklogMove`/`confirmMoveToSprint`/`confirmMoveToBacklog`) are untouched. Intra-section drag fully preserved (ghost placeholder, optimistic `rankMutation`, CR-01 localOrder clear, flicker gate, RANK-04 rollback banner, `resolveIntraSectionRank` server fallback, `dropAnimation={null}`). `npx vitest run src/routes/dashboard src/services/jira` GREEN (66 files / 806 tests); `npm run check` (biome + tsc) clean.

Sixth (jump-fix) pass (commit `86309184`): converted intra-section drag to the canonical dnd-kit single-container sortable pattern to eliminate the drag "jump"/oscillation. Root cause was `handleDragOver` live-reordering `localOrder` every frame (reshuffling DOM rows → changing the row under the pointer → another reorder, fighting dnd-kit's own sortable animation). Fix: removed the live-reorder and dropped the `onDragOver` handler from `<DndContext>` entirely — `verticalListSortingStrategy` + `SortableContext` now animate the sibling rows to open the drop gap via transforms (jump-free, dnd-kit owns the index math). The new order is computed ONCE on drop in `handleDragEnd` via the new pure helper `resolveIntraRankFromDrop(currentKeys, activeKey, overKey)` (arrayMove semantics; `previousOrder = currentKeys`; returns null on no-movement / missing key), then fired through the existing `rankMutation`. `BacklogRow` now hides the in-list source row (`opacity:0`) under the solid `DragOverlay` clone (dashed in-slot ghost removed). Removed dead live-reorder plumbing: `handleDragOver`, `overState`/`OverState`, `preDragOrderRef`, `restorePreDragOrder`, `activeSourceSectionId`, and `computeLiveReorder`/`keyOrderEquals`/`overStateEquals`/`resolveIntraSectionRank` BacklogPage imports (helpers + their tests retained in `backlogDragHelpers.ts`). Verified: NO order-mutating setState remains in onDragOver — `setLocalOrder` is now called only in the rank mutation lifecycle (onMutate/onError/onSuccess), i.e. on drop. Preserved: rank mutation, CR-01 localOrder clear, flicker gate (`cancelQueries` + `isDraggingRef`), RANK-04 rollback banner, persistence (previousOrder = current keys), `dropAnimation={null}`, `PointerSensor {delay:150, tolerance:5}`, `justDragged` guard; cross-section drag stays a no-op; right-click context menu untouched. New `resolveIntraRankFromDrop` tests added (move down→rankAfterIssue, move up→top→rankBeforeIssue, no-op same index, missing key→null). `npx vitest run src/routes/dashboard src/services/jira` GREEN (66 files / 810 tests); `npm run check` (biome + tsc) clean. VISUAL CHANGE for human re-verify: native dnd-kit row-shift gap (siblings slide to open the slot) replaces the in-slot dashed ghost placeholder.
