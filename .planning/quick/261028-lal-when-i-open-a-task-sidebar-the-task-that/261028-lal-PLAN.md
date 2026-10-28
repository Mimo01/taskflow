---
phase: quick-261028-lal
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/peek.store.ts
  - taskflow/src/stores/peek.store.test.ts
  - taskflow/src/lib/peek-highlight.ts
  - taskflow/src/main.tsx
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
  - taskflow/src/routes/my-tasks/MyTaskRow.test.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/TaskCard.test.tsx
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [QUICK-261028-lal]

must_haves:
  truths:
    - "Opening a task in the peek sidebar highlights the matching row/card on My Tasks, Sprint Board (cards + story headers), Backlog and Release detail pages"
    - "Closing the peek, swapping to another issue, or changing route moves/clears the highlight"
    - "List rows show a subtle primary tint + 2px inset leading-edge bar; TaskCard shows tint + ring (its 3px type stripe keeps the leading edge)"
    - "Highlight causes no layout shift (box-shadow/bg only, no border/padding changes)"
    - "DragOverlay clones (TaskCard/BacklogRow isOverlay) are never highlighted"
  artifacts:
    - path: "taskflow/src/stores/peek.store.ts"
      provides: "usePeekStore (peekIssueKey, setPeekIssueKey) + useIsPeeked(key)"
      exports: ["usePeekStore", "useIsPeeked"]
    - path: "taskflow/src/lib/peek-highlight.ts"
      provides: "Single source of peek highlight classes"
      exports: ["PEEKED_ROW_CLASS", "PEEKED_CARD_CLASS"]
    - path: "taskflow/src/stores/peek.store.test.ts"
      provides: "Store + useIsPeeked tests"
  key_links:
    - from: "taskflow/src/main.tsx"
      to: "usePeekStore"
      via: "peekIssueKey/setPeekIssueKey selectors replace useState"
      pattern: "usePeekStore\\("
    - from: "row components (MyTaskRow, TaskCard, StoryHeaderRow, BacklogRow, UnifiedTaskTable TaskRow)"
      to: "useIsPeeked"
      via: "hook call in render + data-peeked attribute + shared class"
      pattern: "useIsPeeked\\("
---

<objective>
Highlight the task currently open in the PeekPanel sidebar on the main page, via ONE shared mechanism (per CONTEXT Scope decision): lift `peekIssueKey` from `useState` in main.tsx into a small zustand store, expose `useIsPeeked(key)`, and decorate the 5 peek-opening row/card roots with a shared class + `data-peeked` attribute.

Purpose: user can see which task the sidebar refers to.
Output: peek.store.ts, peek-highlight.ts, wired rows, tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261028-lal-when-i-open-a-task-sidebar-the-task-that/261028-lal-CONTEXT.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261028-lal-when-i-open-a-task-sidebar-the-task-that/261028-lal-RESEARCH.md

Repo layout: `.planning` and git live at the outer `/Users/mimo/Documents/Projects/taskflow/`; src, npm, vitest and biome run in the inner `/Users/mimo/Documents/Projects/taskflow/taskflow/`. All commands below run from the inner dir.

Store convention: `create<State>()((set) => ({...}))`, session-only (no persist) — see `src/stores/board-selection.store.ts`. Store tests reset with `useXStore.setState({...})` in `beforeEach` (see `src/stores/aio-cycles-selection.store.test.ts`).

Interfaces to create (Task 1) and consume (Tasks 2-3):
- `src/stores/peek.store.ts`: `usePeekStore` (state `peekIssueKey: string | null`, action `setPeekIssueKey(key: string | null)`); `useIsPeeked(key: string): boolean` = `usePeekStore((s) => s.peekIssueKey === key)` (boolean selector so a row re-renders only when its own state flips).
- `src/lib/peek-highlight.ts`: `PEEKED_ROW_CLASS = 'bg-primary/5 shadow-[inset_2px_0_0_var(--color-primary)]'` (list rows) and `PEEKED_CARD_CLASS = 'bg-primary/5 ring-2 ring-primary/40'` (TaskCard). Each with a short doc comment explaining no-layout-shift rationale.

Project gotchas that apply:
- React Compiler: call the hook in render; NEVER `usePeekStore.getState()` in render (goes stale only in the app).
- No layout shift: never `border-l-*` / `pl-*` for the highlight. BacklogRow's existing `isFocused && 'bg-muted border-l-2 border-primary'` is keyboard focus — leave it untouched, do not imitate.
- Biome: run `npx biome check <changed files>` only. Do NOT run `biome --write` on all of src.
- Pre-commit hook runs the full vitest suite: commit tests and implementation together per task.
- Line numbers in RESEARCH.md have drifted a few lines; locate anchors by content (`outerClassName`, `rowClassName`, `if (isSubtask)`, `data-testid="task-row"`).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Peek store, shared highlight classes, main.tsx wiring</name>
  <files>taskflow/src/stores/peek.store.ts, taskflow/src/stores/peek.store.test.ts, taskflow/src/lib/peek-highlight.ts, taskflow/src/main.tsx</files>
  <behavior>
    - setPeekIssueKey('ABC-1') sets peekIssueKey; setPeekIssueKey(null) clears it
    - renderHook(() => useIsPeeked('ABC-1')) is false initially, true after store set to 'ABC-1', false for 'ABC-2' when store is 'ABC-1', false again after clearing (wrap store updates in act)
  </behavior>
  <action>Create `src/stores/peek.store.ts` exactly per the interface in context (zustand `create`, no persist; per Claude's Discretion "store/hook useIsPeeked(key)"). Create `src/lib/peek-highlight.ts` exporting `PEEKED_ROW_CLASS` and `PEEKED_CARD_CLASS` as specified (per CONTEXT Style decision: subtle primary tint + 2px leading-edge bar via inset box-shadow, no layout shift; per orchestrator decision on research A2: TaskCard uses tint + ring because its leading edge is owned by the 3px type stripe). Write `src/stores/peek.store.test.ts` covering the behavior list, resetting `usePeekStore.setState({ peekIssueKey: null })` in beforeEach. In `src/main.tsx`, replace the `useState<string | null>(null)` line for peekIssueKey with two selectors: `const peekIssueKey = usePeekStore((s) => s.peekIssueKey);` and `const setPeekIssueKey = usePeekStore((s) => s.setPeekIssueKey);` — all existing call sites (handleOpenPeek, route-change close effect, the keyboard effect deps, PeekPanel onClose/swap/navigate-full) stay unchanged. Keep the `useState` import (used elsewhere in main.tsx). Check no call site uses a functional updater `setPeekIssueKey((prev) => ...)`; if one does, rewrite it to read `peekIssueKey` directly.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/stores/peek.store.test.ts && npx tsc --noEmit -p . && npx biome check src/stores/peek.store.ts src/stores/peek.store.test.ts src/lib/peek-highlight.ts src/main.tsx && grep -c "usePeekStore(" src/main.tsx</automated>
  </verify>
  <done>Store tests pass; tsc clean; biome clean on the 4 files; main.tsx no longer holds peekIssueKey in useState and grep count is 2.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Highlight list rows — MyTaskRow (parent + subtask) and Release detail TaskRow</name>
  <files>taskflow/src/routes/my-tasks/MyTaskRow.tsx, taskflow/src/routes/my-tasks/MyTaskRow.test.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx, taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</files>
  <behavior>
    - MyTaskRow: with store key = row key, `my-task-row-KEY` has data-peeked="true" (both parent row and subtask row variants); a sibling row with a different key has no data-peeked attribute
    - UnifiedTaskTable: the `task-row` for the peeked key has data-peeked="true"; other task-rows do not
  </behavior>
  <action>Per CONTEXT Scope decision (My Tasks + Release detail surfaces). In MyTaskRow, call `const isPeeked = useIsPeeked(issue.key);` near the other hooks, BEFORE the `if (isSubtask)` early return (rules of hooks). On the subtask `div[role=button]` convert its plain-string className to `cn(...)` and append `isPeeked && PEEKED_ROW_CLASS`; on the parent row add `isPeeked && PEEKED_ROW_CLASS` in its existing `cn(...)` BEFORE the flagged-yellow classes (so tailwind-merge lets the flag bg win while the shadow bar survives). Add `data-peeked={isPeeked ? 'true' : undefined}` on both roots. Recursive subtask rendering means a peeked subtask highlights only itself — correct. In UnifiedTaskTable's `TaskRow`, call `useIsPeeked` with the row's issue key and add `PEEKED_ROW_CLASS` + `data-peeked` on the `div[data-testid="task-row"]` (the absolute inset-0 overlay button is transparent so the tint/bar shows through; do not touch the overlay button). Extend both test files with the behavior cases, resetting `usePeekStore.setState({ peekIssueKey: null })` in beforeEach. Use `data-peeked` for assertions, not class strings.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/my-tasks/MyTaskRow.test.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/my-tasks/MyTaskRow.tsx src/routes/my-tasks/MyTaskRow.test.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.tsx src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx</automated>
  </verify>
  <done>New peek assertions pass alongside existing tests; tsc + biome clean on touched files; no getState() call in render in either component.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Highlight Sprint Board cards/story headers and Backlog rows</name>
  <files>taskflow/src/routes/dashboard/TaskCard.tsx, taskflow/src/routes/dashboard/TaskCard.test.tsx, taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <behavior>
    - TaskCard: with store key = card key, card root has data-peeked="true" (test whichever root path the existing tests render; both div[role=button] and button paths share outerClassName)
    - TaskCard rendered with isOverlay and the same peeked key has no data-peeked attribute
    - TaskCard for a different key has no data-peeked attribute
  </behavior>
  <action>Per CONTEXT Scope decision (Sprint Board + Backlog surfaces) and orchestrator decision on research A2. TaskCard: call `useIsPeeked(issue.key)` and derive `const showPeek = isPeeked && !isOverlay;` (DragOverlay clones are never highlighted); add `showPeek && PEEKED_CARD_CLASS` into `outerClassName` (tint + ring, NO inset bar — the 3px `border-l-[3px]` type stripe keeps the leading edge; do not change the stripe), and `data-peeked={showPeek ? 'true' : undefined}` on both root branches (div[role=button] and button). StoryHeaderRow: call `useIsPeeked(storyKey)`, add `isPeeked && PEEKED_ROW_CLASS` to `rowClassName` and `data-peeked` to both root branches that use rowClassName. BacklogRow: call `useIsPeeked(issue.key)`, `showPeek = isPeeked && !isOverlay`, add `showPeek && PEEKED_ROW_CLASS` to `rowClassName` and `data-peeked` on both root branches; leave the existing `isFocused` border classes exactly as they are and do not add pseudo-elements (rows are virtualized position:absolute — inset shadow + bg only). Extend TaskCard.test.tsx with the behavior cases (reset store in beforeEach). BacklogRow and StoryHeaderRow have no existing test files and need dnd/sortable context to render; rely on the store/helper tests plus the grep check in verify rather than creating new heavy harnesses.</action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/TaskCard.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/TaskCard.tsx src/routes/dashboard/TaskCard.test.tsx src/routes/dashboard/StoryHeaderRow.tsx src/routes/dashboard/BacklogRow.tsx && for f in src/routes/dashboard/StoryHeaderRow.tsx src/routes/dashboard/BacklogRow.tsx src/routes/dashboard/TaskCard.tsx; do grep -q "useIsPeeked(" $f && grep -q "data-peeked" $f || { echo "MISSING in $f"; exit 1; }; done && npm test</automated>
  </verify>
  <done>TaskCard peek + isOverlay tests pass; all three components call useIsPeeked and set data-peeked; full suite passes; tsc + biome clean on touched files.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| none new | Purely client-side UI state; issue keys already rendered from existing Jira data |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-lal-01 | Information disclosure | peek.store.ts | accept | Session-only in-memory key, no persist, no new data exposure |
| T-lal-02 | Tampering | data-peeked attribute | accept | Attribute is a constant 'true', never interpolates user data |
</threat_model>

<verification>
- `npm test` (full suite) passes from the inner dir
- `npx tsc --noEmit -p .` clean
- biome check clean on every touched file (no repo-wide --write)
- `grep -rn "usePeekStore.getState" src --include=*.tsx` returns nothing in component render bodies
</verification>

<success_criteria>
- Opening a task in the peek sidebar visibly highlights its row/card on My Tasks, Sprint Board (cards + story headers), Backlog, and Release detail; closing/swapping/route change updates it
- Rows: tint + 2px inset bar; TaskCard: tint + ring; no layout shift; drag ghosts never highlighted
- Single store + single class helper drive all surfaces
</success_criteria>

<output>
Create `/Users/mimo/Documents/Projects/taskflow/.planning/quick/261028-lal-when-i-open-a-task-sidebar-the-task-that/261028-lal-SUMMARY.md` when done
</output>
