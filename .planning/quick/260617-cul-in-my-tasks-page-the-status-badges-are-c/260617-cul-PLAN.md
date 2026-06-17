---
phase: quick-260617-cul
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/my-tasks/MyTaskRow.tsx
autonomous: true
requirements: [QUICK-260617-CUL]

must_haves:
  truths:
    - "Clicking a status badge in My Tasks opens the issue preview (PeekPanel), same as clicking the row"
    - "Status badges no longer show a transitions popover"
    - "The status badge still displays the current status name with category coloring"
  artifacts:
    - path: "taskflow/src/routes/my-tasks/MyTaskRow.tsx"
      provides: "Static (non-interactive) status pill in the row right cluster"
      contains: "statusPillClass"
  key_links:
    - from: "taskflow/src/routes/my-tasks/MyTaskRow.tsx"
      to: "onOpenPeek"
      via: "row onClick fires for status badge clicks (no stopPropagation wrapper)"
      pattern: "onOpenPeek"
---

<objective>
In the My Tasks page, the status badge in each row is currently an interactive
`StatusPopover` that opens a transitions dropdown. The user wants the badge to be
non-interactive: clicking it should open the issue preview (PeekPanel) exactly like
clicking anywhere else on the row.

Replace the `StatusPopover` with a static status pill, and remove the
`stopPropagation` wrapper so clicks fall through to the row's `onOpenPeek` handler.

Purpose: Status badges in My Tasks should be read-only and behave like the rest of the row.
Output: Updated `MyTaskRow.tsx` with a static status pill and no transitions UI.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@taskflow/src/routes/my-tasks/MyTaskRow.tsx
@taskflow/src/lib/statusStyles.ts
@taskflow/src/routes/my-tasks/MyTasksPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Replace StatusPopover with a static status pill in MyTaskRow</name>
  <files>taskflow/src/routes/my-tasks/MyTaskRow.tsx</files>
  <action>
In the `rightCluster` JSX (around lines 216-232), replace the interactive status
section with a static, non-interactive status pill:

1. Remove the entire `StatusPopover` block AND its surrounding stopPropagation
   wrapper div (`<div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>`),
   including the two biome-ignore comments above it (the `useKeyWithClickEvents`
   and `noStaticElementInteractions` ignores that exist only to justify the
   stopPropagation wrapper).

2. In its place, render a static status pill. It MUST stay inside a `flex`
   wrapper div — per the project pitfall, the `statusPillClass` min-w/text-center
   geometry collapses on a bare inline element, so it needs a flex parent. Use a
   `<div className="flex shrink-0">` containing a `<span>` whose className is
   `statusPillClass(statusCategoryKey)` and whose text content is
   `issue.fields.status.name`. Do NOT add `cursor-pointer`, `hover:*`, `onClick`,
   or any interactive handlers — the span must be purely presentational so clicks
   bubble up to the row's `onClick={() => onOpenPeek(issue.key)}`.

3. Add the import `statusPillClass` from `@/lib/statusStyles` (top of file, with
   the other `@/lib` imports).

4. Remove the now-unused import `StatusPopover` from `@/routes/dashboard/StatusPopover`
   (line 28).

5. Remove the now-unused `onStatusSelect` prop entirely: delete it from the
   `MyTaskRowProps` interface (the `onStatusSelect?: (...) => void;` block and its
   doc comment, lines ~134-139), delete it from the destructured params (line 165),
   and remove the `onStatusSelect={onStatusSelect}` pass-through in the recursive
   subtask `MyTaskRow` render (line 448). `MyTasksPage` never passed
   `onStatusSelect`, so no caller changes are needed — confirm via grep that
   `onStatusSelect` has zero remaining references after the edit.

Do NOT change any other column in the right cluster (SP slot, time bar, avatar)
or the left region. The pill must visually match the prior badge: same status
text, same category coloring via `statusPillClass(statusCategoryKey)`. The
`statusCategoryKey` variable already exists (line 171).
  </action>
  <verify>
    <automated>cd taskflow && test -z "$(grep -E 'StatusPopover|onStatusSelect' src/routes/my-tasks/MyTaskRow.tsx)" && grep -q "statusPillClass" src/routes/my-tasks/MyTaskRow.tsx && npm run check</automated>
  </verify>
  <done>
- `StatusPopover` and `onStatusSelect` no longer appear anywhere in MyTaskRow.tsx
- A static `statusPillClass(statusCategoryKey)` span renders the status name inside a flex div
- No interactive handlers (onClick/stopPropagation/cursor-pointer/hover) on the status pill
- `npm run check` (biome + tsc) passes clean — no unused-import or unused-prop errors
  </done>
</task>

</tasks>

<verification>
- `npm run check` passes (biome lint + tsc --noEmit, no unused imports/props/vars)
- Manual sanity (optional, done by user): in My Tasks, clicking a status badge
  opens the issue preview panel rather than a transitions dropdown; badge still
  shows the status name with correct category color.
</verification>

<success_criteria>
- Status badges in My Tasks are static and non-interactive
- Clicking a status badge opens the PeekPanel via the row's `onOpenPeek`
- Transitions popover is fully removed from the My Tasks rows
- Status name + category coloring preserved
- `npm run check` is green
</success_criteria>

<output>
Create `.planning/quick/260617-cul-in-my-tasks-page-the-status-badges-are-c/260617-cul-SUMMARY.md` when done
</output>
