# Phase 79: Drag-to-Transition on Sprint Board - Research

**Researched:** 2026-06-04
**Domain:** dnd-kit drag-and-drop over a virtualized sprint board + Jira/GreenHopper workflow transitions
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split all multi-status columns at drag start. The instant a drag begins, every column that has ≥2 valid+allowed transitions from the card's current status pre-splits into its labelled drop boxes — all options visible at once.
- **D-02:** A column with exactly **one** reachable+allowed transition shows **no split** — the whole column is a single drop target; dropping fires that transition directly.
- **D-03:** Drop boxes are labelled by transition **NAME** (e.g. "Start Progress", "Reopen"), not destination status name (multiple transitions can target the same status).
- **D-04:** Only subtask/task cards inside swimlanes are drag-to-transition enabled. Story header (swimlane parent) rows are NOT draggable.
- **D-05:** Only transitions **reachable from the card's current status** are offered (use existing `filterTransitionsForStatus`).
- **D-06:** Columns with zero reachable+allowed transitions are **dimmed** during the drag and **reject the drop** — silent snap-back to origin, **no error banner**.
- **D-07:** Transitions with `hasScreen: true` OR `hasValidators: true` are **silently filtered out** of drop targets — no new hint in the drag UI. They remain reachable via right-click StatusPopover (unchanged).
- **D-08 (prerequisite):** `__adaptToJiraTransition` currently DROPS `hasScreen`/`hasValidators`. Add `hasScreen?: boolean` and `hasValidators?: boolean` to `JiraTransition` and propagate through the adapter. Hard prerequisite for D-07.
- **D-09:** Reuse the app's optimistic pattern: `onMutate` snapshot + apply new status to local state → `onError` rollback → `onSettled` invalidate. Mirror `handleTransition` in `SprintBoardTab.tsx`.
- **D-10:** On a failed transition API call, roll the card back and surface an **inline error** (reuse `cardErrors: Map<string,string>`; inline banner not toast).
- **D-11:** On success, refresh the board by invalidating GreenHopper board data (`gh-all-data`) via `invalidateGhAllData`.
- **D-12:** Reuse Phase 78 dnd-kit foundation: `PointerSensor { delay: 150, tolerance: 5 }`, portaled `DragOverlay` ghost with `dropAnimation={null}`, `justDragged` + `isDraggingRef` guards, **`autoScroll={false}`** (dnd-kit#1108).
- **D-13:** `DndContext` scoped to the **board scroll area only** (not AppLayout); `DragOverlay` mounted inside `boardRef` at the same z-level as `stickyOverlayRef`; apply `touch-action: none` on all draggable card elements; add an explicit **Windows/Tauri WebView2 UAT step** (mouseup loss).

### Claude's Discretion
- Drop-box label wording (D-03) — transition name; planner may refine copy.
- Invalid-column dim treatment styling (D-06) — opacity/visual; planner picks (UI-SPEC locks `opacity-40 transition-opacity duration-150`).
- Exact error-surface component (D-10) — per-card `cardErrors` vs shared inline banner; reuse existing primitives.

### Deferred Ideas (OUT OF SCOPE)
- Dragging story header (swimlane parent) rows to transition.
- Intra-column reordering / rank on the sprint board (Phase 78 owns backlog rank).
- Surfacing screen-required transitions in the drag UI (hint/badge).
- Keyboard-accessible drag (dnd-kit `KeyboardSensor`).
- Bulk multi-card drag.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TRAN-01 | User can drag a card between sprint board columns to change its status | Phase 78 `DndContext`/`PointerSensor`/`DragOverlay` foundation (`BacklogPage.tsx`) adapted from sortable-list to droppable-columns; `useDraggable` on `TaskCard`, `useDroppable` on column/zone. Drop fires `postTransition`. |
| TRAN-02 | Multi-status target column splits into per-transition drop zones during drag | Per-card reachable transitions computed at drag start via `peekGhTransitions` + `filterTransitionsForStatus`; grouped by target `statusCategory.key` into the 3 fixed columns; ≥2 in a column → render N `useDroppable` zones (D-01), 1 → single droppable (D-02). |
| TRAN-03 | Screen/validator transitions not offered as silent drop targets | D-08 propagates `hasScreen`/`hasValidators` through `__adaptToJiraTransition`; filter them out of drop targets (D-07). No drop target = no silent snap-back. |
| TRAN-04 | Failed transition rolls back optimistic move + surfaces error | Mirror `handleTransition` optimistic/rollback/`cardErrors` pattern (`SprintBoardTab.tsx:816-870`). |
| TRAN-05 | Successful drag refreshes the board | `invalidateGhAllData(queryClient, boardId)` on success — same call `handleTransition` already makes (`SprintBoardTab.tsx:858`). |
</phase_requirements>

## Summary

Phase 79 layers a pointer-based drag interaction onto an already-built sprint board. Every primitive needed already exists in the codebase and was verified this session: the dnd-kit foundation (Phase 78 `BacklogPage`), the transition cache (`peekGhTransitions` + `filterTransitionsForStatus`), the optimistic transition mutation (`handleTransition`), and the board refresh (`invalidateGhAllData`). The work is **adaptation and wiring**, not new infrastructure or new libraries. No packages are installed.

The single genuine prerequisite is **D-08**: `__adaptToJiraTransition` (`transitions.ts:142-159`) currently drops `hasScreen`/`hasValidators`. I verified this directly — both return branches of the adapter omit those two fields, even though they exist on the raw `GhTransition` (`greenhopper/types.ts:234,236`) and in the real test fixture. `JiraTransition` (`jira/types.ts:76-95`) must gain the two optional fields, and the adapter must copy them through, before drop-target gating (D-07) can read them. There is an existing adapter test (`transitions.test.ts`) and a real fixture to extend.

The hardest design problem is **modelling the split column** (TRAN-02). The board's 3 columns are derived purely from `categoryOf(issue)` against a fixed list — the split is a **drag-time overlay**, not a change to the column model. At drag start, compute the dragged card's reachable+allowed transitions, bucket each by its target `statusCategory.key` into the matching column, and render either N labelled `useDroppable` zones (≥2) or one column-wide droppable (1) or a dimmed reject (0). A `pointerWithin`-first custom collision detection (already written in `BacklogPage`) handles the nested zones cleanly.

**Primary recommendation:** Ship D-08 (adapter + type) as a standalone first task with its own adapter unit test. Then build a `SplitColumn`/`TransitionDropZone` overlay driven by a pure "transitions → per-column drop-zone model" function (the key test seam), reuse `BacklogPage`'s `DndContext` config verbatim (`autoScroll={false}`, portaled overlay, `pointerWithin` collision), and reuse `handleTransition`'s exact optimistic/rollback/`cardErrors` shape for the drop mutation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Drag interaction (sensors, overlay, collision) | Frontend / Client (React + dnd-kit) | — | Pure pointer UI; no server involvement until drop |
| Reachable-transition computation | Frontend / Client (cache read) | API (warmed once) | `peekGhTransitions` reads the already-fetched GH envelope synchronously; no per-drag network call |
| `hasScreen`/`hasValidators` propagation | API adapter layer (`greenhopper/transitions.ts`) | — | Data-shape correctness belongs in the adapter, not the view |
| Transition execution | API (`postTransition` → Jira) | — | Jira DC workflow transition endpoint |
| Optimistic move + rollback | Frontend / Client state (`localIssues`) | — | UI responsiveness; rollback is local state restore |
| Board refresh on success | Frontend cache (`invalidateGhAllData`) → API refetch | — | React Query invalidation triggers a GH board refetch |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@dnd-kit/core` | ^6.3.1 | `DndContext`, `useDraggable`, `useDroppable`, `DragOverlay`, `PointerSensor`, collision detection | Already installed (Phase 78); Pointer-Events based — works inside Tauri/WebView2 (HTML5 DnD rejected, see REQUIREMENTS Out of Scope) |
| `@dnd-kit/utilities` | ^3.2.2 | `CSS.Transform.toString` for draggable transforms | Already used by `BacklogRow` |
| `@tanstack/react-query` | ^5.90.21 | Optimistic mutation + cache invalidation | App-wide standard for Jira writes |
| `@tanstack/react-virtual` | ^3.13.23 | Swimlane row virtualization (cards live inside it) | Already powering the board; drag must coexist |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/sortable` | ^10.0.0 | NOT needed this phase | Phase 78 used it for reordering; Phase 79 is droppable-zones only, no sorting |
| `@dnd-kit/modifiers` | ^9.0.0 | `restrictToVerticalAxis` (Phase 78) | NOT needed — board drag is 2-D (card moves between columns) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@dnd-kit` `useDroppable` columns | `pragmatic-drag-and-drop` | REJECTED in REQUIREMENTS — uses HTML5 DnD API, requires disabling Tauri `dragDropEnabled`, breaks attachment upload |
| Custom collision detection | `closestCenter` default | `closestCenter` biases toward source and fails on nested zones; reuse Phase 78's `pointerWithin`-first detector |

**Installation:** None. All dependencies are already in `package.json`.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero** external packages. All four dnd-kit packages and both TanStack packages are already present in `taskflow/package.json` and were installed/verified in prior phases (78 for dnd-kit, 73-74 for the GH data layer). No registry lookup or slopcheck required.

## Architecture Patterns

### System Architecture Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │  DndContext (scoped to boardRef scroll area)  │
                          │  sensors=[PointerSensor{delay:150,tol:5}]     │
                          │  collisionDetection=pointerWithin-first       │
                          │  autoScroll={false}                           │
                          └───────────────┬───────────────────────────────┘
                                          │
   user pointer-down on card             │ onDragStart(active)
   ──────────────────────────────────────▶
                                          │  1. read dragged card's reachable transitions:
                                          │     peekGhTransitions(qc, projectId, typeId)
                                          │       → filterTransitionsForStatus(all, statusId)   [D-05]
                                          │       → drop hasScreen||hasValidators               [D-07]
                                          │  2. bucket transitions by to.statusCategory.key
                                          │       into the 3 fixed columns
                                          │  3. build dropModel: per column →
                                          │       {kind:'split', zones:[{transitionId,name}...]} [D-01]
                                          │     | {kind:'single', transition}                    [D-02]
                                          │     | {kind:'invalid'}  (dim, reject)                [D-06]
                                          ▼
        ┌──────────────┬──────────────────────┬──────────────┐
        │  To Do col   │  In Progress col      │  Done col    │
        │ (single drop │ (SPLIT: N useDroppable│ (dimmed —    │
        │  useDroppable│  zones, labelled by    │  opacity-40, │
        │  whole col)  │  transition NAME)      │  rejects)    │
        └──────┬───────┴───────────┬───────────┴──────────────┘
               │ drop on zone/col   │ drop on dimmed col → silent snap-back (no error) [D-06]
               ▼
       onDragEnd(active, over)
               │  resolve over.id → transitionId (from dropModel)
               │  own-column / no-transition drop → no-op snap-back
               ▼
       optimistic move (mirror handleTransition):                              [D-09]
         setLocalIssues(apply new status)  ──▶  postTransition(key, transitionId)
              │                                        │
              │ onError                                │ onSuccess
              ▼                                        ▼
         rollback localIssues +                  invalidateGhAllData(qc, boardId)  [D-11/TRAN-05]
         cardErrors.set(key,'Transition failed') [D-10/TRAN-04]
```

### Component Responsibilities
| Element | File (new/edit) | Responsibility |
|---------|-----------------|----------------|
| `JiraTransition` type | EDIT `services/jira/types.ts` (+ mirror in `jira.ts:193-208`) | Add `hasScreen?`, `hasValidators?` (D-08) |
| `__adaptToJiraTransition` | EDIT `services/jira/greenhopper/transitions.ts:125-160` | Copy `hasScreen`/`hasValidators` into both return branches (D-08) |
| `buildDropModel(transitions)` | NEW pure helper (e.g. `sprintBoardDragHelpers.ts`) | Transitions → per-column `{split|single|invalid}` model. **Primary test seam.** |
| `TransitionDropZone` | NEW local component | `div` + `useDroppable({id})`, labelled by transition name |
| `SplitColumn` | NEW local component | Renders whole column / N zones / dimmed reject per dropModel |
| Draggable `TaskCard` | EDIT `TaskCard.tsx` or wrapper | `useDraggable` + `touch-action:none`; only when `isSubtask`/non-story (D-04) |
| Drop mutation | NEW in `SprintBoardTab` (mirror `handleTransition`) | Optimistic + rollback + `cardErrors` + invalidate |
| `DndContext` wrapper | EDIT `SprintBoardTab` render | Wrap the scroll area only; portaled `DragOverlay` (D-13) |

### Pattern 1: Column-as-droppable with pre-split zones (D-01/D-02)
**What:** Each of the 3 fixed columns is, at drag time, EITHER one `useDroppable` (single/invalid) OR a container of N `useDroppable` zones (split). Droppable `id`s encode the action.
**When to use:** Computed once per drag in `onDragStart` from the dropModel.
**Example (droppable id scheme — recommended):**
```typescript
// Single-target column:  id = `col:${categoryKey}` and dropModel says single → transitionId known
// Split zone:            id = `zone:${transitionId}`           (one per reachable transition in that column)
// Invalid column:        rendered with opacity-40, NOT registered as droppable (or registered + rejected in onDragEnd)
// onDragEnd: look up over.id in the dropModel to recover the transitionId; null → snap-back no-op.
```
Source: pattern derived from `backlogDragHelpers.ts` `resolveTargetContainer` (over.id → known container set) — VERIFIED in codebase.

### Pattern 2: Synchronous reachable-transition computation at drag start (D-05/D-07)
**What:** No network call on drag. `peekGhTransitions` reads the GH envelope already warmed by the sentinel `useGhTransitions` on board mount.
**Example:**
```typescript
// Source: SprintBoardTab.tsx:769-782 (getTransitions) — VERIFIED, reuse verbatim then extend with D-07 filter
const projectId = Number(issue.fields.project?.id ?? 0) || sentinelProjectId;
const all = peekGhTransitions(queryClient, projectId, issue.fields.issuetype?.id ?? '');
if (!all) return undefined;                                    // cache not warm → treat as not-draggable yet
const reachable = filterTransitionsForStatus(all, issue.fields.status?.id);   // D-05
const droppable = reachable.filter((t) => !t.hasScreen && !t.hasValidators);  // D-07 (needs D-08)
```

### Pattern 3: Optimistic transition mirror (D-09/D-10/D-11)
**What:** The drop handler is `handleTransition` with the `transitionId` selected by the dropped zone instead of by a popover click.
**Example:** `SprintBoardTab.tsx:816-870` is the exact template — `setLocalIssues` apply, `postTransition`, `invalidateGhAllData` on success, rollback + `cardErrors.set(key,'Transition failed')` on catch. The existing StatusPopover path and the new drag path can share one function.

### Anti-Patterns to Avoid
- **Per-frame `onDragOver` state mutation:** Phase 78-04 explicitly removed `onDragOver` because it caused an oscillation/jump fighting dnd-kit's own transforms (`BacklogPage.tsx:954-962`). Compute the dropModel ONCE in `onDragStart`; do not recompute per pointer move.
- **Enabling `autoScroll`:** dnd-kit#1108 desyncs the overlay or drop target during autoscroll inside a scrolled container. Phase 78 locked `autoScroll={false}` (`BacklogPage.tsx:1302-1313`). Carry it forward (D-12).
- **Mounting `DragOverlay` inside the virtualized/scrolled list:** the overlay must be portaled (Phase 78 portals to `document.body`; D-13 says mount inside `boardRef` at `stickyOverlayRef`'s z-level). Either way, NOT inside the scroll-transformed virtualizer container.
- **Making story header rows draggable:** D-04 — they double as collapse/expand controls; click/drag conflict.

### Anti-Pattern note on the 150ms delay (D-12)
The `PointerSensor` `{ delay: 150, tolerance: 5 }` is the same guard that lets a card's `onClick` (open peek / open detail) coexist with drag. Keep `justDragged`/`isDraggingRef` guards so a drop does not fire a stray click on the underlying card.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Pointer drag tracking | Custom mousedown/mousemove/mouseup | `@dnd-kit` `PointerSensor` | Tauri/WebView2 pointer quirks (mouseup loss) + the 150ms click/drag arbitration already solved |
| Drop-target hit testing across nested zones | Manual rect math | `pointerWithin`-first `CollisionDetection` (copy `BacklogPage.tsx:287-314`) | Nested zones + autoscroll-off edge cases already handled |
| Reachable-transition filtering | Re-derive from workflow | `filterTransitionsForStatus` | Handles global transitions (no `fromStatusId`) and `null` fromStatusId DC quirk (WR-06) |
| Transitions fetch | New per-card REST `/transitions` call | `peekGhTransitions` (synchronous cache read) | Per-card REST on drag start would block the drag; envelope is pre-warmed |
| Optimistic move + rollback | New mutation | Mirror `handleTransition` | Identical shape already battle-tested for StatusPopover |
| Board refresh | Manual refetch | `invalidateGhAllData` | The board's single source of truth (`gh-all-data`) |
| Error surface | New toast/banner system | `cardErrors` map + `TaskCard transitionError` prop | Already rendered below each card (`TaskCard.tsx:335`) |

**Key insight:** Phase 79 has near-zero novel infrastructure. The only new *logic* worth its own module + tests is `buildDropModel` (transitions → per-column drop-zone model). Everything else is reuse.

## Common Pitfalls

### Pitfall 1: D-08 omission silently breaks D-07
**What goes wrong:** If `hasScreen`/`hasValidators` are not propagated, the D-07 filter (`!t.hasScreen && !t.hasValidators`) reads `undefined` for both, treats every transition as droppable, and offers screen-required transitions as drop targets — which then fail or pop a screen the drag UI can't satisfy.
**Why it happens:** `__adaptToJiraTransition` drops the fields today (VERIFIED transitions.ts:142-159).
**How to avoid:** Land D-08 first, with an adapter unit test asserting both fields round-trip. Extend the existing `transitions.test.ts` and the real fixture (`__fixtures__/transitions.real.json` already carries `hasScreen`/`hasValidators`).
**Warning signs:** A "Start Progress" zone appears for a transition the StatusPopover would have routed through a screen.

### Pitfall 2: Drag inside @tanstack/react-virtual — cards unmount on scroll
**What goes wrong:** Virtualized rows outside the overscan window are NOT in the DOM. A draggable card that scrolls out mid-drag loses its node; dnd-kit's measured rects go stale.
**Why it happens:** Virtualizer renders only visible + `overscan: 5` rows (`SprintBoardTab.tsx:137`).
**How to avoid:** This phase keeps `autoScroll={false}` (D-12), so the list does NOT scroll mid-drag — the dragged card and all visible drop zones stay mounted for the whole drag. The `DragOverlay` (portaled) is what the user sees move, not the source node. Document the same tradeoff Phase 78 accepted: to move a card to an off-screen lane, you cannot (board transitions are within-viewport columns, so this is a non-issue — the 3 columns are always horizontally visible; the card stays in its own swimlane row vertically). **Net: virtualization + drag coexist safely precisely because autoScroll is off and columns are horizontal.**
**Warning signs:** Drop zones not registering when a swimlane is near the viewport edge — if seen, confirm `autoScroll={false}` and `MeasuringStrategy.Always` (Phase 78 kept the latter as a robustness measure, `BacklogPage.tsx:1301`).

### Pitfall 3: Click fires after drop (peek/detail opens)
**What goes wrong:** Dropping a card triggers the card's `onClick` (opens peek panel).
**Why it happens:** `TaskCard` outer is a `div[role=button]`/`button` with `onClick` (`TaskCard.tsx:308,322`).
**How to avoid:** `PointerSensor { delay: 150 }` + `justDragged` ref guard (50ms window) exactly as Phase 78 (`BacklogPage.tsx:975-979`). The card's `onClick` must early-return while `justDragged.current`.
**Warning signs:** Peek panel flashes open immediately after a successful drop.

### Pitfall 4: Own-column / no-net-move drop
**What goes wrong:** Dropping a card back on its current category fires a spurious transition or error.
**How to avoid:** In `onDragEnd`, if the resolved `transitionId` is null (dropped on dimmed column, own column with no transition, or outside any zone) → silent no-op snap-back (no API call, no error) per D-06.

### Pitfall 5: Tauri/WebView2 mouseup loss (Windows)
**What goes wrong:** On Windows WebView2, a `pointerup`/`mouseup` can be dropped if the pointer leaves the window, leaving the drag "stuck".
**Why it happens:** Known WebView2 pointer-capture quirk; this is why D-13 mandates an explicit Windows UAT step.
**How to avoid:** `touch-action: none` on draggable elements (D-13); `DndContext` scoped to the board area. Cannot be unit-tested — **manual UAT only** (see Validation Architecture).
**Warning signs:** Ghost card stays attached to the cursor after releasing the mouse on Windows.

## Code Examples

### Verified: current adapter drops the two fields (D-08 target)
```typescript
// Source: services/jira/greenhopper/transitions.ts:154-159 (the success branch) — VERIFIED
return {
  id: String(gh.transitionId),
  name: gh.name,
  to: { id: toId, name: status.name, statusCategory: status.statusCategory },
  fromStatusId,
  // MISSING: hasScreen: gh.hasScreen, hasValidators: gh.hasValidators   ← add for D-08
};
// The fallback branch (lines 143-152) ALSO omits them — add to both.
```

### Verified: raw GhTransition carries the fields
```typescript
// Source: services/jira/greenhopper/types.ts:229-239 — VERIFIED
export interface GhTransition {
  transitionId: number;
  name: string;
  toStatusId: number;
  fromStatusId?: number;
  hasScreen: boolean;       // ← present on raw
  hasConditions: boolean;
  hasValidators: boolean;   // ← present on raw
  isInitial: boolean;
  isGlobal: boolean;
}
```

### Verified: optimistic transition template (D-09/D-10/D-11)
```typescript
// Source: SprintBoardTab.tsx:816-870 (handleTransition) — VERIFIED, mirror for drag drop
setLocalIssues((prev) => prev.map((i) => i.key === issueKey ? { ...i, fields: { ...i.fields,
  status: { id: toStatusId, name: toStatusName,
    statusCategory: { key: toStatusCategoryKey ?? 'new' } } } } : i));
setCardErrors((prev) => { const m = new Map(prev); m.delete(issueKey); return m; });
try {
  await postTransition(jiraBaseUrl ?? '', jiraToken ?? '', issueKey, transitionId);
  invalidateGhAllData(queryClient, boardId ?? undefined);            // TRAN-05
} catch {
  setLocalIssues((prev) => prev.map((i) => i.key === issueKey
    ? { ...i, fields: { ...i.fields, status: originalIssue.fields.status } } : i));   // rollback
  setCardErrors((prev) => new Map(prev).set(issueKey, 'Transition failed'));          // TRAN-04
}
```

### Verified: Phase 78 DndContext config to reuse (D-12)
```tsx
// Source: BacklogPage.tsx:1295-1316 — VERIFIED
<DndContext
  sensors={useSensors(useSensor(PointerSensor, { activationConstraint: { delay: 150, tolerance: 5 } }))}
  collisionDetection={/* pointerWithin-first, BacklogPage.tsx:287-314 */}
  measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
  autoScroll={false}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
```

## Runtime State Inventory

> Not a rename/refactor/migration phase. **SKIPPED** — Phase 79 is a new client-side interaction plus one additive type/adapter change. No stored data, live service config, OS-registered state, secrets, or build artifacts carry phase-specific identifiers. The D-08 type change is purely additive (optional fields) and backward-compatible with all existing `JiraTransition` consumers.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Right-click StatusPopover only | Drag-to-transition + StatusPopover (escape hatch for screen transitions) | This phase | Faster status changes; screen/validator transitions stay popover-only |
| HTML5 DnD (`pragmatic-drag-and-drop`) | `@dnd-kit` Pointer Events | Phase 78 (locked) | Avoids breaking Tauri attachment upload |
| dnd-kit `autoScroll` on | `autoScroll={false}` | Phase 78-04 UAT | Eliminates overlay/drop-target desync (dnd-kit#1108) |

**Deprecated/outdated:** None relevant. dnd-kit `@dnd-kit/sortable` (Phase 78) is NOT used here — Phase 79 is droppable-zones, not sorting.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | All reachable transitions for a dragged card resolve synchronously from `peekGhTransitions` because the sentinel `useGhTransitions` warms the envelope on board mount | Pattern 2 | If a card's issuetype workflow is not in the warmed envelope, `peekGhTransitions` returns `[]`/`undefined` → card not draggable until cache warms. Mitigate: treat undefined as "not draggable yet" (graceful), matching `getTransitions` existing behavior. LOW risk — same cache the popover already relies on. |
| A2 | A single droppable per column id can recover its `transitionId` from the dropModel in `onDragEnd` (no per-zone sortable container needed) | Pattern 1 | If id→transition mapping is ambiguous, drop fires wrong transition. Mitigate: encode `transitionId` directly in the split-zone droppable id (`zone:${transitionId}`). LOW. |
| A3 | `JiraTransition` is re-declared in `jira.ts:193-208` and both copies must gain the new fields | D-08 | Missing the mirror copy → type error or stale shape on legacy import path. Planner must edit BOTH (`types.ts` and `jira.ts`). Flagged in CONTEXT D-08 note already. LOW. |

**No external/compliance/security assumptions** — phase is internal UI + additive type.

## Open Questions

1. **Where exactly to mount the draggable handle on `TaskCard`?**
   - What we know: `TaskCard` outer is `div[role=button]`/`button` with `onClick` (`TaskCard.tsx:302-329`); Phase 78 spread `{...attributes} {...listeners}` onto the row (`BacklogRow.tsx:267-291`).
   - What's unclear: whether to make the whole card the drag handle (with `touch-action:none`) or add a dedicated grip. UI-SPEC implies whole-card drag (no grip element specified).
   - Recommendation: whole-card draggable with `touch-action:none` + the 150ms delay sensor; planner decides if a grip is wanted. D-04 gating: only render `useDraggable` for non-story cards.

2. **Invalid column: register as droppable-that-rejects, or not droppable at all?**
   - What we know: UI-SPEC says `opacity-40`, NO `pointer-events-none`, drop silently rejected (D-06).
   - Recommendation: either works. Simplest: still register the column droppable but resolve `transitionId = null` in `onDragEnd` for invalid columns → silent snap-back. Keeps collision detection uniform.

## Environment Availability

> **SKIPPED** — no new external tools, services, or runtimes. All dependencies (dnd-kit, TanStack, vitest) are already installed and exercised by the existing test suite. The Jira/GreenHopper endpoints (`postTransition`, `transitions.json`, `gh-all-data`) are already in production use by the board.

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json` — this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 + jsdom 29 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run src/services/jira/greenhopper/transitions.test.ts` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRAN-03 (D-08) | `__adaptToJiraTransition` propagates `hasScreen`/`hasValidators` | unit | `npx vitest run src/services/jira/greenhopper/transitions.test.ts` | ✅ extend existing |
| TRAN-02/D-01/D-02 | `buildDropModel` → split (≥2) / single (1) / invalid (0) per column | unit | `npx vitest run src/routes/dashboard/sprintBoardDragHelpers.test.ts` | ❌ Wave 0 |
| TRAN-03/D-05/D-07 | reachable + non-screen + non-validator filter feeding dropModel | unit | same helper test | ❌ Wave 0 |
| TRAN-01 | drop resolves over.id → transitionId; own-column/invalid → null | unit | same helper test (drop resolution) | ❌ Wave 0 |
| TRAN-04 | failed `postTransition` rolls back `localIssues` + sets `cardErrors` | unit (component) | `npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` | ✅ extend existing |
| TRAN-05 | success calls `invalidateGhAllData` | unit (component, mock) | same SprintBoardTab test | ✅ extend existing |
| TRAN-01 (real pointer drag) | end-to-end drag gesture moves card | manual UAT | n/a — jsdom cannot simulate dnd-kit pointer drag | manual |
| D-13 | Windows/Tauri WebView2 mouseup-loss does not strand the drag | manual UAT | n/a — platform-specific | manual |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/services/jira/greenhopper/transitions.test.ts src/routes/dashboard/sprintBoardDragHelpers.test.ts` (helper + adapter; < 5s)
- **Per wave merge:** `cd taskflow && npm test` (full suite) + `npm run check` (biome + tsc)
- **Phase gate:** Full suite green + the two manual UAT steps signed off before `/gsd-verify-work`.

### Test seams (where logic is extracted so jsdom can assert it)
Mirror the Phase 78 precedent: jsdom **cannot** drive a real dnd-kit pointer drag, so all drop logic must live in **pure functions** (like `backlogDragHelpers.ts` → `backlogDragHelpers.test.ts`). Extract into a new `sprintBoardDragHelpers.ts`:
- `buildDropModel(reachableTransitions): Map<categoryKey, {kind:'split'|'single'|'invalid', ...}>` — D-01/D-02/D-06.
- `filterDroppableTransitions(all, currentStatusId)` — wraps `filterTransitionsForStatus` + the D-07 `hasScreen||hasValidators` exclusion.
- `resolveDropTransitionId(overId, dropModel): string | null` — over.id → transitionId, null for invalid/own/no-zone (snap-back).
Optimistic rollback (TRAN-04/05) is tested at the component level by mocking `postTransition` to reject/resolve and asserting `localIssues` status + `cardErrors` + `invalidateGhAllData` call (the existing `SprintBoardTab.test.tsx` already mounts the board and can be extended; `handleTransition` is the same code path).

### Manual UAT (cannot be automated)
- **UAT-1 (D-13):** On Windows + Tauri WebView2, drag a card to another column, release with the pointer near/over the window edge; confirm the drag completes and the ghost detaches (no stranded ghost). Repeat with a fast flick.
- **UAT-2 (TRAN-01 gesture):** Full pointer drag across columns; confirm split zones appear at drag start, hover highlight, drop fires the right transition, dimmed columns reject.

### Wave 0 Gaps
- [ ] `src/routes/dashboard/sprintBoardDragHelpers.ts` + `sprintBoardDragHelpers.test.ts` — covers TRAN-01/02/03 logic (new module, primary seam)
- [ ] Extend `src/services/jira/greenhopper/transitions.test.ts` — assert D-08 field round-trip (fixture already has the fields)
- [ ] Extend `src/routes/dashboard/SprintBoardTab.test.tsx` — optimistic rollback (TRAN-04) + invalidate-on-success (TRAN-05)
- [ ] Framework install: none — vitest + RTL already present

## Security Domain

> `security_enforcement` is not set in `.planning/config.json` (treated as enabled), but this phase has a minimal attack surface — purely client-side UI driving an already-authenticated Jira transition endpoint that the StatusPopover already calls.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Reuses existing Bearer PAT (`readSecret('jira-pat')`); no new auth path |
| V3 Session Management | no | No new sessions |
| V4 Access Control | yes (delegated) | Jira server enforces workflow permissions; client only offers transitions the workflow returns. No client-side privilege decision. |
| V5 Input Validation | yes (minimal) | `transitionId` is selected from the server-provided transition list, not user free-text; no injection surface |
| V6 Cryptography | no | None |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Offering an unauthorized transition | Elevation of Privilege | Transitions come from the server workflow envelope; Jira re-validates on `postTransition` — a failed/forbidden transition rolls back (TRAN-04) |
| Screen/validator bypass via drag | Tampering | D-07 filters screen/validator transitions out of drop targets; they require the full popover/screen flow |

## Sources

### Primary (HIGH confidence) — codebase, VERIFIED this session
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — board composition, `CATEGORY_COLUMNS`, `categoryOf`, `getTransitions`, `handleTransition`, `cardErrors`, reload/invalidation, virtualizer config
- `taskflow/src/services/jira/greenhopper/transitions.ts` — `__adaptToJiraTransition` (drops fields), `filterTransitionsForStatus`, `peekGhTransitions`, `useGhTransitions`
- `taskflow/src/services/jira/greenhopper/types.ts:229-239` — `GhTransition` carries `hasScreen`/`hasValidators`
- `taskflow/src/services/jira/types.ts:76-95` — `JiraTransition` (target of D-08)
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Phase 78 DndContext/sensor/collision/overlay reference + `autoScroll={false}` rationale
- `taskflow/src/routes/dashboard/backlogDragHelpers.ts` + `__tests__/backlogDragHelpers.test.ts` — pure-helper test-seam precedent
- `taskflow/src/routes/dashboard/TaskCard.tsx` — card structure, `onClick`, `transitionError` render
- `taskflow/src/routes/dashboard/StatusPopover.tsx` — `useGhTransitions` + `filterTransitionsForStatus` usage
- `taskflow/src/services/jira/greenhopper/__fixtures__/transitions.real.json` + `transitions.test.ts` — fixture already carries `hasScreen`/`hasValidators`; adapter test exists
- `taskflow/package.json` — dnd-kit ^6.3.1 / sortable ^10 / modifiers ^9 / utilities ^3.2.2, vitest ^4, react-virtual ^3.13.23 (all installed)
- `.planning/config.json` — `nyquist_validation: true`
- `.planning/REQUIREMENTS.md` — TRAN-01..05; Out-of-Scope rationale for dnd-kit over pragmatic-dnd

### Secondary (MEDIUM confidence)
- Phase 78 CONTEXT/patterns referenced via `[[project_dndkit_drag_patterns]]` memory note (no `onDragOver` reorder, reflowing-ghost crash, optimistic override must outlive refetch)

### Tertiary (LOW confidence)
- dnd-kit#1108 (autoScroll desync) — referenced via Phase 78 code comments, not independently re-verified this session (training knowledge + code citation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and exercised; nothing new
- Architecture: HIGH — every pattern maps to verified existing code (Phase 78 + handleTransition)
- D-08 prerequisite: HIGH — directly read the adapter dropping the fields and the raw type/fixture carrying them
- Pitfalls: HIGH — drawn from Phase 78 code comments documenting real UAT-discovered bugs
- Validation: HIGH — test-seam strategy mirrors the existing, passing `backlogDragHelpers.test.ts` precedent

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable — internal codebase, no fast-moving external deps)
