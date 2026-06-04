# Phase 79: Drag-to-Transition on Sprint Board - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Users can drag sprint board cards between columns to change their workflow
status. The board has **3 fixed category columns** (To Do / In Progress / Done)
and `categoryOf()` buckets every Jira status into one of them — so a single
column genuinely maps to multiple statuses. When a target column has ≥2 valid
transitions from the dragged card's current status, the column splits into
labelled per-transition drop zones during the drag. Transitions requiring a
screen or validators (`hasScreen` / `hasValidators`) are filtered out of drop
targets (still reachable via the existing right-click StatusPopover). A failed
transition rolls back the optimistic move and surfaces an inline error; a
successful drag refreshes the board.

**In scope:** drag-to-transition for subtask/task cards inside swimlanes;
multi-status column split into per-transition drop zones; filtering of
screen/validator transitions; valid-transition gating (only transitions
reachable from the card's current status are offered); optimistic move +
rollback + inline error; board refresh on settle; propagating
`hasScreen`/`hasValidators` through `__adaptToJiraTransition` into
`JiraTransition`.

**Out of scope:** dragging story header (swimlane parent) rows; intra-column
reordering / rank on the sprint board (that's Phase 78 backlog territory);
keyboard-accessible drag sensor; bulk multi-card drag; surfacing
screen-required transitions in the drag UI (they stay in right-click only).

</domain>

<decisions>
## Implementation Decisions

### Split-Column UX (TRAN-02)
- **D-01:** **Split all multi-status columns at drag start.** The instant a drag
  begins, every column that has ≥2 valid+allowed transitions from the card's
  current status pre-splits into its labelled drop boxes — all options visible
  at once before the user moves the card. (Chosen over hover-only split and
  always-on dividers.)
- **D-02:** A column with exactly **one** reachable+allowed transition shows
  **no split** — the whole column is a single drop target; dropping fires that
  transition directly.
- **D-03:** **Drop boxes are labelled by transition NAME** (e.g. "Start
  Progress", "Reopen"), not by destination status name — because multiple
  transitions can lead to the same status, so the transition name is the
  unambiguous label. (Claude's discretion, derived from D-01.)

### Draggable Scope
- **D-04:** **Only subtask/task cards inside swimlanes are drag-to-transition
  enabled.** Story header (swimlane parent) rows are NOT draggable — they double
  as swimlane controls (collapse/expand) and would raise click/drag conflict
  risk. Matches the goal's "drag sprint board cards" wording.

### Valid-Target Gating & Invalid Columns (TRAN-01, TRAN-03)
- **D-05:** Only transitions **reachable from the card's current status** are
  offered as drop targets (use the existing per-status transition filtering,
  `filterTransitionsForStatus`).
- **D-06:** **Columns with zero reachable+allowed transitions are dimmed during
  the drag and reject the drop.** Releasing a card over an invalid column =
  silent snap-back to origin, **no error banner** (an error is reserved for a
  *failed API call*, not an invalid drop). (Claude's discretion — chosen over
  neutral no-op and dim+tooltip for the clearest "not here" affordance without
  noise.)

### Screen / Validator Transitions (TRAN-03)
- **D-07 (REVERSED during 79-03 UAT, 2026-06-04):** Originally, transitions with
  `hasScreen: true` **or** `hasValidators: true` were filtered out of drop targets
  (reachable only via right-click). UAT showed this hid legitimate targets like
  **Done**, and investigation found the app has **no transition-screen flow
  anywhere** — the right-click StatusPopover path also just calls `postTransition`
  with no screen. So the exclusion protected nothing while removing valid targets.
  **Decision (user-confirmed): all reachable transitions are now valid drop
  targets**, regardless of `hasScreen`/`hasValidators`. A move Jira rejects rolls
  back with the inline "Transition failed" message (TRAN-04) — the same outcome
  the right-click path would produce. `filterDroppableTransitions` no longer
  applies the screen/validator filter.
- **TRAN-03 reinterpretation:** "not offered as *silent* drop targets" is now
  satisfied by the rollback+inline-error path (a rejected drop is never silent),
  rather than by pre-excluding the transitions.
- **D-08 note:** the `hasScreen`/`hasValidators` fields added in Plan 01 are still
  propagated through the adapter (harmless, may be reused for a future
  badge/affordance) but no longer gate drop targets.

### hasScreen / hasValidators Propagation (prerequisite)
- **D-08:** `__adaptToJiraTransition`
  (`taskflow/src/services/jira/greenhopper/transitions.ts`) currently **DROPS**
  `hasScreen` and `hasValidators` (they exist on the raw `GhTransition` but not
  on the adapted `JiraTransition`). **Add `hasScreen?: boolean` and
  `hasValidators?: boolean` to the `JiraTransition` type** and propagate them
  through the adapter. This is a hard prerequisite for D-07. (Locked by ROADMAP
  notes — "Confirm `hasScreen` propagation through `__adaptToJiraTransition`
  before writing plans.")

### Optimistic Move, Rollback & Error Surface (TRAN-04, TRAN-05)
- **D-09:** Reuse the app's standard optimistic pattern: `onMutate` snapshot +
  apply the new status to local state → `onError` rollback → `onSettled`
  invalidate. The board already does this for `StatusPopover` transitions
  (`handleTransition` in `SprintBoardTab.tsx`) — mirror it for drag.
- **D-10:** On a **failed transition API call**, roll the card back to its
  original column and surface an **inline error** (reuse the board's existing
  `cardErrors: Map<string,string>` per-card surface and/or the
  `stale-data-banner.tsx` idiom — planner picks; carry forward Phase 78's
  inline-banner-not-toast convention `[[project_dndkit_drag_patterns]]`).
- **D-11:** On **success**, refresh the board by invalidating GreenHopper board
  data (`gh-all-data`) — reuse the existing `invalidateGhAllData` /
  reload-board invalidation set (TRAN-05).

### Carried Forward from Phase 78 (locked — do not re-decide)
- **D-12:** Reuse the dnd-kit foundation installed in Phase 78: `PointerSensor`
  `{ delay: 150, tolerance: 5 }`, portaled `DragOverlay` ghost with
  `dropAnimation={null}`, `justDragged` + `isDraggingRef` guards, and
  **`autoScroll={false}`** (the P78 UAT desync fix, dnd-kit#1108).
- **D-13:** Locked by ROADMAP notes: `DndContext` scoped to the **board scroll
  area only** (not AppLayout); `DragOverlay` mounted inside `boardRef` at the
  same z-level as `stickyOverlayRef`; apply `touch-action: none` on all
  draggable card elements; add an explicit **Windows / Tauri WebView2 UAT step**
  (`mouseup` loss).

### Claude's Discretion
- Drop-box label wording (D-03) — transition name; planner may refine copy.
- Invalid-column dim treatment styling (D-06) — opacity/visual; planner picks.
- Exact error-surface component (D-10) — per-card `cardErrors` vs shared inline
  banner; reuse existing primitives.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` § "Phase 79: Drag-to-Transition on Sprint Board" —
  goal, success criteria, and locked technical notes (DndContext scoping,
  DragOverlay mount, `hasScreen` propagation, touch-action, Windows UAT).
- `.planning/REQUIREMENTS.md` § TRAN-01..TRAN-05 — the five transition
  requirements.
- `.planning/phases/78-drag-to-rank-on-backlog/78-CONTEXT.md` — prior phase
  decisions; the dnd-kit patterns reused here originate there.

### Sprint board rendering & transition logic
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — board composition;
  `CATEGORY_COLUMNS` (3 fixed columns, ~L57-61), `categoryOf()` status→column
  bucketing (~L65-67), `VirtualizedSwimlanes` (~L77-526), existing
  `handleTransition` optimistic transition (~L816-870), `cardErrors` map
  (~L393), board reload/invalidation set (~L796-814).
- `taskflow/src/routes/dashboard/StatusPopover.tsx` — right-click transition
  menu; `useGhTransitions` + `filterTransitionsForStatus` (the
  reachable-from-current-status filter to reuse for D-05). Stays the escape
  hatch for screen-required transitions (D-07).

### Transition types & adapter (D-08 prerequisite)
- `taskflow/src/services/jira/types.ts` § `JiraTransition` (~L76-95) — add
  `hasScreen?` / `hasValidators?` here.
- `taskflow/src/services/jira/greenhopper/types.ts` § `GhTransition` (~L229-239)
  — raw shape that already carries `hasScreen` + `hasValidators`.
- `taskflow/src/services/jira/greenhopper/transitions.ts` §
  `__adaptToJiraTransition` (~L125-160) — the adapter that currently drops the
  two fields; must propagate them.

### Board data & refresh
- `taskflow/src/services/jira/greenhopper/useGhAllData.ts` — board query hook
  (`useGhAllData`, poll while `/sprint-board` active) + `invalidateGhAllData`
  for the success refresh (D-11).
- `taskflow/src/services/jira/greenhopper/types.ts` § `GhAllDataResponse` /
  `GhBoardIssue` / `GhStatusEntity` (~L63-180) — card/column/status shapes.

### Reusable dnd-kit foundation (Phase 78)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — reference implementation:
  `DndContext` setup w/ `autoScroll={false}` (~L1295-1374), `PointerSensor`
  config (~L329-333), custom collision detection (~L287-314), portaled
  `DragOverlay` (~L1347-1373), optimistic mutation pattern (~L877-935).
- `taskflow/src/routes/dashboard/backlogDragHelpers.ts` — container-resolution
  and drop-resolution helpers (adapt the column/drop-zone resolution analog).

### Error / banner primitives
- `taskflow/src/components/ui/stale-data-banner.tsx` and
  `taskflow/src/components/ui/alert.tsx` — inline-banner convention for D-10.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useGhAllData(boardId)` + `invalidateGhAllData(queryClient, boardId)` — the
  board query and the success-refresh hook (D-11).
- `useGhTransitions(projectId, issueTypeId)` + `peekGhTransitions(...)` +
  `filterTransitionsForStatus(all, currentStatusId)` — the warmed transition
  cache and the reachable-from-current-status filter to reuse for D-05/D-01.
- `SprintBoardTab.handleTransition` — existing optimistic transition + rollback
  + `cardErrors` surface; the drag mutation should mirror it (D-09/D-10).
- Phase 78's `BacklogPage` DndContext/DragOverlay/collision/sensor setup — copy
  the foundation, adapt from "sortable list within sections" to "droppable
  columns + per-transition drop zones."

### Established Patterns
- Optimistic-update + rollback (`onMutate` snapshot → `onError` rollback →
  `onSettled` invalidate) is the app's standard for Jira writes — mirror it.
- Board columns are derived purely from `categoryOf(issue)` against a fixed
  3-column list; the split (D-01) is a *drag-time overlay* on the In-Progress/
  multi-status columns, NOT a change to the underlying column model.
- Inline banner (not toast) is the rollback-error convention
  `[[project_dndkit_drag_patterns]]`.

### Integration Points
- New drag transition mutation calls the existing transition endpoint
  (`postTransition(... issueKey, transitionId)`) — same call the StatusPopover
  already uses; drag just selects the `transitionId` from the dropped zone.
- `JiraTransition` type + `__adaptToJiraTransition` must be extended (D-08)
  before drop-zone filtering (D-07) can read `hasScreen`/`hasValidators`.
- `DndContext` wraps only the board scroll area; the virtualized swimlanes
  (`@tanstack/react-virtual`) host the draggable subtask cards (D-04) — confirm
  drag works with virtualization (measure/overscan) during planning.

</code_context>

<specifics>
## Specific Ideas

- Drop-box labels read as the **transition name** (e.g. "Start Progress",
  "In Review", "Reopen", "Done").
- Multi-status split appears at **drag start** for all columns with ≥2 valid
  targets; single-target columns stay whole.
- Invalid columns **dim** during drag; dropping there snaps back silently
  (no error).

</specifics>

<deferred>
## Deferred Ideas

- Dragging story header (swimlane parent) rows to transition — deliberately out
  of scope (D-04); revisit only if users ask to transition whole stories by drag.
- Intra-column reordering / rank on the sprint board — Phase 78 owns drag-rank
  on the backlog; not in scope here.
- Surfacing screen-required transitions in the drag UI (hint/badge) — rejected
  for now (D-07); revisit if UAT shows users can't find them via right-click.
- Keyboard-accessible drag (dnd-kit `KeyboardSensor`) — not requested this phase.

None outside these belong to other phases — discussion stayed within scope.

</deferred>

---

*Phase: 79-drag-to-transition-on-sprint-board*
*Context gathered: 2026-06-04*
