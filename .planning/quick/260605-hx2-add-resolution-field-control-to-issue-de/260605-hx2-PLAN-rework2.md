---
phase: quick-260605-hx2
plan: rework2
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/transitions.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/BoardResolutionDialog.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/services/jira/transitions.test.ts
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
autonomous: true
requirements: [hx2-REWORK2-board-resolution]
must_haves:
  truths:
    - "Dragging a story into a resolution-capable transition (e.g. Done) opens a resolution-picker dialog instead of moving the card immediately"
    - "Confirming a resolution executes the dragged transition with fields.resolution and the card then moves"
    - "Cancelling the dialog performs no transition and the card stays in place"
    - "Dragging into a non-resolution-capable transition transitions immediately with no fields (exactly as today)"
    - "A required-but-empty resolution (allowedValues length 0) blocks the transition with a message and fires no request"
    - "Existing right-click / context-menu transition callers are unaffected"
  artifacts:
    - path: "taskflow/src/services/jira/transitions.ts"
      provides: "resolveDropResolution pure decision helper encapsulating the three-branch resolution logic (dialog / block / plain)"
      contains: "resolveDropResolution"
    - path: "taskflow/src/routes/dashboard/BoardResolutionDialog.tsx"
      provides: "Board-level resolution-picker dialog mirroring confirm-sprint-move-dialog structure"
      min_lines: 40
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Async resolution-capability probe on drop + dialog wiring + handleTransition resolution forwarding"
      contains: "resolveDropResolution"
  key_links:
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "fetchIssueTransitionsWithFields"
      via: "queryClient.fetchQuery on drop (handleDragEnd)"
      pattern: "transitionsWithFieldsKey"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "resolveDropResolution"
      via: "classify the matched REST transition meta into dialog/block/plain"
      pattern: "resolveDropResolution"
    - from: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      to: "postTransition"
      via: "handleTransition resolution arg → fields.resolution presence-check"
      pattern: "postTransition\\([^)]*resolution|fields"
    - from: "taskflow/src/routes/dashboard/BoardResolutionDialog.tsx"
      to: "Dialog primitives"
      via: "import from @/components/ui/dialog"
      pattern: "DialogContent"
---

<objective>
Drag-to-done on the sprint board does not prompt for a resolution. Add a resolution-picker
dialog to the board drag-to-transition flow, mirroring the StatusPopover resolution step, so
dragging a story into a resolution-capable transition lets the user choose a resolution and
executes the transition with `fields.resolution`.

Purpose: Close the second UAT rework for 260605-hx2 — the sidebar already sets resolution via
transition; the board drag path was never wired to do the same. Per CONTEXT REWORK ADDENDUM,
resolution on the board is set by executing the dragged transition WITH `fields.resolution`.

Output: A new pure `resolveDropResolution` decision helper (next to
`fetchIssueTransitionsWithFields` in `services/jira/transitions.ts`, re-exported from the
`@/services/jira` barrel), a new `BoardResolutionDialog` component, and SprintBoardTab changes
that detect resolution-capable drops, prompt for a resolution, and forward it through
`handleTransition` → `postTransition`. Tests cover the helper's three branches directly plus the
dialog's confirm wiring.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/260605-hx2-add-resolution-field-control-to-issue-de/260605-hx2-CONTEXT.md

# THE PATTERN TO MIRROR — StatusPopover resolution-picker step (handleSelect ~119, WR-05 ~133, handleResolutionPick ~141)
@taskflow/src/routes/dashboard/StatusPopover.tsx

# Drag flow to extend — handleDragEnd ~1089, handleTransition ~1148, getTransitions ~1044, DragOverlay/createPortal mount ~1630, return/fragment close ~1652
@taskflow/src/routes/dashboard/SprintBoardTab.tsx

# Transition infra — fetchIssueTransitionsWithFields ~92, transitionsWithFieldsKey ~22, postTransition optional-fields presence-check ~38; resolveDropResolution helper goes here
@taskflow/src/services/jira/transitions.ts

# Barrel re-export path (dual-file gotcha: @/services/jira resolves to jira.ts, which re-exports from ./jira/transitions ~610-614)
@taskflow/src/services/jira.ts

# Dialog precedent — board-level confirm dialog structure/props/open-state
@taskflow/src/components/ui/confirm-sprint-move-dialog.tsx

# Board test patterns/mocks — @/services/jira mock block ~77, TRAN-04 rollback ~636, TRAN-05 invalidate ~700 (context-menu onTransition path only — no drag-simulation helper exists)
@taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create BoardResolutionDialog component</name>
  <files>taskflow/src/routes/dashboard/BoardResolutionDialog.tsx</files>
  <action>
Create a board-level resolution-picker dialog mirroring the structure of
`confirm-sprint-move-dialog.tsx` (same Dialog/DialogContent/DialogHeader/DialogTitle/
DialogDescription/DialogFooter/DialogClose primitives from `@/components/ui/dialog`, same
`showCloseButton={false}` and controlled `open`/`onOpenChange` props).

Props interface:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `issueKey: string`
- `toStatusName: string` (the transition target, for the description text)
- `allowedValues: Array<{ id: string; name: string }>` (the resolution options from the
  matching transition's `fields.resolution.allowedValues`)
- `onConfirm: (resolution: { id: string } | null) => void`
- `isPending?: boolean`

Body:
- Title "Set Resolution"; description naming the issue key and target status, e.g.
  "Move {issueKey} to {toStatusName}. Choose a resolution:" (mirror confirm-sprint-move-dialog's
  mono/medium styling for the key).
- Render the resolution options as a vertical list of selectable buttons (mirror StatusPopover's
  resolution-list buttons ~168-177: `w-full text-left px-2 py-1.5 hover:bg-accent rounded`).
  Track the locally selected resolution id in `useState`; highlight the selected one.
- Include an explicit "Unresolved" option that maps to a `null` resolution payload, consistent
  with the sidebar/StatusPopover offering a null/clear option.
- Footer: a "Cancel" DialogClose (variant outline) and a "Confirm" Button that is disabled until
  a selection is made (or always allow Unresolved), shows "Setting..." when `isPending`, and on
  click calls `onConfirm` with `{ id }` for a real resolution or `null` for Unresolved.

Do NOT add any new dependencies. Reuse `Button` from `@/components/ui/button`. This component
holds NO data-fetching logic — it is presentational; the parent owns the transition execution.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -i BoardResolutionDialog | grep -v '^#' | wc -l | grep -q '^ *0$' && echo OK</automated>
  </verify>
  <done>BoardResolutionDialog.tsx exists, compiles, exports the component with the props above, renders allowedValues + an Unresolved option, and calls onConfirm with `{id}` or `null`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add resolveDropResolution helper + wire probe/dialog into the board drag flow</name>
  <files>taskflow/src/services/jira/transitions.ts, taskflow/src/services/jira.ts, taskflow/src/routes/dashboard/SprintBoardTab.tsx</files>
  <behavior>
`resolveDropResolution(meta: JiraTransitionWithFields | undefined)` returns a discriminated union:
    - meta has `fields.resolution.allowedValues` with length > 0
      → `{ kind: 'dialog', allowedValues }`
    - meta has `fields.resolution.required === true` AND no allowedValues / length 0
      → `{ kind: 'block' }` (WR-05)
    - otherwise (no meta, no resolution field, or optional-and-empty)
      → `{ kind: 'plain' }`
  </behavior>
  <action>
**Part A — extract the pure decision helper (this is the load-bearing test seam).**
In `services/jira/transitions.ts`, next to `fetchIssueTransitionsWithFields`, add and export a
PURE function `resolveDropResolution(meta: JiraTransitionWithFields | undefined)` that returns the
discriminated union described in `<behavior>`. It encapsulates StatusPopover's three-branch logic
(handleSelect ~119-138): allowedValues>0 → dialog; required && empty → block (WR-05); else → plain.
It must read ONLY from `meta.fields.resolution` and take no other inputs (so it is unit-testable
in isolation, no React, no network). Then re-export `resolveDropResolution` from the
`@/services/jira` barrel by adding it to the existing
`export { fetchIssueTransitionsWithFields, postTransition, transitionsWithFieldsKey } from './jira/transitions'`
block in `src/services/jira.ts` (~610-614) — the dual-file gotcha means consumers import from
`@/services/jira`, which is `jira.ts`, not the modular barrel.

**Part B — wire the drag flow in SprintBoardTab.tsx.** Extend the drag flow so a drop into a
resolution-capable transition opens BoardResolutionDialog instead of transitioning immediately.

1. **State** (add near the existing drag state ~822-827): a single
   `pendingResolution` state object holding everything the dialog needs to confirm later:
   `{ issueKey, transitionId, toStatusName, toStatusId, toStatusCategoryKey,
   allowedValues: Array<{id;name}> } | null`. Initialize null.

2. **Pin async ordering in `handleDragEnd` (~1089).** The existing early-return guards
   (`!over`, `transitionId === null`, missing issue, missing `transition`) MUST remain in the
   SYNCHRONOUS body of `handleDragEnd` and return BEFORE entering any async IIFE — only the REST
   probe + dialog branch is async. The synchronous cleanup
   (`isDraggingRef`/`setActiveId`/`setActiveWidth`/`setDropModel` and the `justDragged` 50ms guard)
   stays at the TOP of the sync body, before the probe, exactly as today. After resolving
   `transition` (~1116), instead of immediately calling `handleTransition`, enter the async probe:
   - Run an async probe (wrap the post-guard tail in `void (async () => { ... })()`; dnd-kit
     ignores the return). Fetch the dragged issue's REST transitions-with-fields via
     `queryClient.fetchQuery({ queryKey: transitionsWithFieldsKey(issueKey, jiraBaseUrl ?? '',
     draggedIssue.fields.status?.id ?? ''), queryFn: () => fetchIssueTransitionsWithFields(
     jiraBaseUrl ?? '', jiraToken ?? '', issueKey), staleTime: Infinity })`. This reuses the same
     cache key the sidebar/StatusPopover populate (keyed on the dragged issue's CURRENT status id,
     NOT the target). NOTE: this is NOT a guaranteed cache hit — if the sidebar/StatusPopover has
     not already populated the entry for this issue+status, `fetchQuery` COLD-FETCHES from REST.
     `staleTime: Infinity` is acceptable here per the interactive-path precedent (StatusPopover
     uses the same key + staleTime).
   - Wrap the fetch in try/catch. On fetch failure, fall back to the plain transition (call
     `handleTransition` with no resolution) so a probe error never blocks an otherwise-valid move.
   - Find the matching REST transition by id (`meta = list.find(t => t.id === transitionId)`) and
     classify it: `const decision = resolveDropResolution(meta)`.
   - **decision.kind === 'dialog'** → set `pendingResolution` with the transition's target fields +
     `decision.allowedValues`; open the dialog. Do NOT optimistically move the card yet.
   - **decision.kind === 'block'** → WR-05: set a card error on this issue (reuse `setCardErrors`
     with a message like "This transition requires a resolution, but none are available") and fire
     NO request.
   - **decision.kind === 'plain'** → call `handleTransition(issueKey, transitionId,
     transition.to.name, transition.to.id, transition.to.statusCategory?.key)` with NO resolution
     arg — identical to today's behavior for non-resolution-capable transitions.

3. **Extend `handleTransition` (~1148)** to accept an optional trailing
   `resolution?: { id: string } | null` parameter. When the parameter is PRESENT (use a presence
   check via an explicit overload or a sentinel — match postTransition's presence semantics, NOT
   truthiness, so `null` clear survives), pass `{ resolution }` as the `fields` arg to
   `postTransition(jiraBaseUrl ?? '', jiraToken ?? '', issueKey, transitionId, { resolution })`.
   When absent, call `postTransition(... , transitionId)` with no fields exactly as today. Keep the
   optimistic update + rollback + invalidateGhAllData logic unchanged. The existing context-menu
   caller passes no resolution arg, so it is unaffected.

4. **Dialog handlers + render.** Add a confirm handler that, given the dialog's chosen
   `{ id } | null`, calls `handleTransition(pendingResolution.issueKey, .transitionId,
   .toStatusName, .toStatusId, .toStatusCategoryKey, resolution)` then clears `pendingResolution`.
   Add a cancel/close handler that just clears `pendingResolution` (no transition; card already
   never moved). Render `<BoardResolutionDialog open={pendingResolution !== null} ... />` inside
   the component's returned JSX — place it alongside the portaled DragOverlay near the
   DndContext close (~1630-1648) or just before the closing fragment (~1652); it must be inside
   the top-level return.

Use the existing imports: add `BoardResolutionDialog` import and add
`fetchIssueTransitionsWithFields`, `transitionsWithFieldsKey`, and `resolveDropResolution` to the
existing `@/services/jira` import block (~45-59). `queryClient`, `jiraToken`, `jiraBaseUrl`,
`boardId` are already in scope.
  </action>
  <verify>
    <automated>cd taskflow && npx tsc --noEmit 2>&1 | grep -iE 'SprintBoardTab|BoardResolutionDialog|transitions\.ts' | grep -v '^#' | wc -l | grep -q '^ *0$' && echo OK</automated>
  </verify>
  <done>`resolveDropResolution` exists in transitions.ts, is re-exported from the `@/services/jira` barrel (jira.ts), and returns dialog/block/plain per `<behavior>`. Drop into a resolution-capable transition opens the dialog (no optimistic move); confirm forwards `{resolution}` through handleTransition→postTransition; non-capable drops transition immediately with no fields; required-but-empty sets a card error and fires nothing; sync guards remain before the async probe; context-menu caller unchanged; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Unit-test resolveDropResolution branches + dialog confirm wiring</name>
  <files>taskflow/src/services/jira/transitions.test.ts, taskflow/src/routes/dashboard/SprintBoardTab.test.tsx</files>
  <behavior>
    - resolveDropResolution unit tests (transitions.test.ts):
      - allowedValues=[{id,name}] (length 1) → `{ kind: 'dialog', allowedValues }`
      - required:true, allowedValues=[] → `{ kind: 'block' }` (WR-05)
      - required:true, allowedValues undefined → `{ kind: 'block' }`
      - no fields.resolution at all → `{ kind: 'plain' }`
      - meta undefined → `{ kind: 'plain' }`
      - required:false, allowedValues=[] → `{ kind: 'plain' }` (optional-and-empty)
    - BoardResolutionDialog render test (SprintBoardTab.test.tsx or a sibling):
      - rendering with allowedValues, selecting an option, clicking Confirm → onConfirm called once with `{ id }`
      - selecting Unresolved + Confirm → onConfirm called with `null`
    - handleTransition forwarding (via the existing context-menu onTransition path):
      - a caller that passes a resolution arg → postTransition receives 5th arg `{ resolution: { id } }`
      - a caller that passes none → postTransition receives exactly 4 args (no fields)
  </behavior>
  <action>
The checker confirmed there is NO dnd-kit drag-simulation utility in the suite and the new drag
logic lives in the `handleDragEnd` closure with no reachable test seam (existing TRAN-04/05 tests
reach `handleTransition` ONLY via the context-menu `onTransition` path). So test the LOAD-BEARING
contract directly through the extracted pure helper and the dialog's confirm wiring — do NOT
attempt to simulate a pointer drag.

**Part A — `resolveDropResolution` unit tests (new file `src/services/jira/transitions.test.ts`,
or append to an existing transitions test if one exists — check first).** Import
`resolveDropResolution` from `'./transitions'`. Assert every branch listed in `<behavior>` Part 1.
These tests are the primary proof that the three-branch decision logic (dialog / block / plain)
is correct, since this helper is exactly the logic the drag handler delegates to.

**Part B — BoardResolutionDialog confirm test (SprintBoardTab.test.tsx, reuse its render
utilities; or a `BoardResolutionDialog.test.tsx` sibling).** Render `BoardResolutionDialog` with
`open`, an `allowedValues` of `[{id:'10000',name:'Done'}]`, and a `vi.fn()` `onConfirm`. Click the
"Done" option, then click Confirm; assert `onConfirm` was called once with `{ id: '10000' }`. Add
a second render: click the "Unresolved" option, click Confirm; assert `onConfirm` called with
`null`. This proves the dialog forwards the chosen `{ resolution }` payload.

**Part C — handleTransition forwarding (SprintBoardTab.test.tsx, existing context-menu path).**
Extend the `@/services/jira` mock block (~77-98) to add `fetchIssueTransitionsWithFields: vi.fn()`,
`transitionsWithFieldsKey: vi.fn((k, b, s) => ['jira-issue-transitions-fields', k, b, s])`, and
`resolveDropResolution: vi.fn()` so the new SprintBoardTab imports resolve (keep `postTransition`
mocked as today). Using the existing context-menu `onTransition` path that already reaches
`handleTransition` (TRAN-04 ~636), drive ONE case where the caller forwards a resolution and assert
`postTransition` receives a 5th arg `{ resolution: { id } }`, and KEEP the existing no-resolution
case asserting a 4-arg `postTransition` call (no fields). This locks `handleTransition`'s
presence-based forwarding to `postTransition`.

Together these three parts verify the complete contract: the decision logic (Part A), the dialog
payload (Part B), and the postTransition forwarding shape (Part C) — without needing a drag
simulator.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/jira/transitions.test.ts src/routes/dashboard/SprintBoardTab.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>resolveDropResolution unit tests cover all six branches and pass; the BoardResolutionDialog confirm test verifies onConfirm receives `{id}` and `null`; the handleTransition forwarding test verifies postTransition gets `{resolution:{id}}` when a resolution is passed and exactly 4 args otherwise; both test files green.</done>
</task>

</tasks>

<verification>
- `cd taskflow && npx tsc --noEmit` clean.
- `cd taskflow && npx vitest run src/services/jira/transitions.test.ts src/routes/dashboard/SprintBoardTab.test.tsx` green.
- `cd taskflow && npm run check` clean (biome + tsc) — per project Biome baseline GREEN memory.
- Manual (out of scope for automated gate, validate against live ESHOP after build): drag a story
  to Done → resolution dialog appears → pick a resolution → card moves and Jira shows the
  resolution set; drag to a non-resolution status → moves immediately; cancel → no change.
</verification>

<success_criteria>
- `resolveDropResolution` is a pure, exported, unit-tested helper returning dialog/block/plain.
- Dragging into a resolution-capable transition opens BoardResolutionDialog and does NOT move the
  card until confirmed.
- Confirm executes the dragged transition with `fields.resolution` (id or null) via postTransition.
- Non-resolution-capable drops behave exactly as today (immediate optimistic transition, no fields).
- Required-but-empty allowedValues blocks with a message and fires no request (WR-05 parity).
- Cancel performs no transition; card stays in place.
- Existing context-menu/right-click transition callers are unaffected (resolution arg optional).
- No new dependencies added; Dialog primitives reused.
</success_criteria>

<output>
Create `.planning/quick/260605-hx2-add-resolution-field-control-to-issue-de/260605-hx2-SUMMARY-rework2.md` when done.
</output>
</content>
</invoke>
