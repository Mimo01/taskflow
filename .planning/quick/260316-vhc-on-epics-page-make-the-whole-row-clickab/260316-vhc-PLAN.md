---
phase: quick
plan: 260316-vhc
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/EpicsPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [clickable-rows]

must_haves:
  truths:
    - "Clicking anywhere on an epic row navigates to the epic detail"
    - "Clicking anywhere on a backlog row (except checkbox and epic badge) navigates to story detail"
    - "Checkbox click in backlog still toggles selection without navigating"
    - "Epic badge click in backlog still navigates to the epic, not the story"
  artifacts:
    - path: "taskflow/src/routes/dashboard/EpicsPage.tsx"
      provides: "Whole-row clickable epic rows"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Whole-row clickable backlog rows (except checkbox + epic badge)"
  key_links:
    - from: "EpicsPage.tsx EpicRow tr"
      to: "onEpicClick"
      via: "onClick on tr element"
    - from: "BacklogRow.tsx tr"
      to: "onIssueClick"
      via: "onClick on tr element with stopPropagation on checkbox and epic badge"
---

<objective>
Make rows clickable for navigation: on the Epics page, clicking anywhere on a row opens epic detail; on the Backlog page, clicking anywhere on a row (except the checkbox and epic badge) opens story detail.

Purpose: Improve click target size for faster navigation — users should not need to find the small text link.
Output: Updated EpicRow and BacklogRow components with row-level click handlers.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/EpicsPage.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/BacklogPage.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make EpicRow whole-row clickable</name>
  <files>taskflow/src/routes/dashboard/EpicsPage.tsx</files>
  <action>
In the EpicRow component, add an onClick handler to the `<tr>` element that calls `onEpicClick?.(epic.key)`. Add `cursor-pointer` to the tr className.

The existing `<button>` around the epic name badge (line 56-63) is now redundant as a navigation target — convert it from a `<button>` to a `<span>` (keeping same visual classes minus hover:opacity-80) since the whole row is clickable now. This avoids a nested interactive element inside a clickable row.

Specific changes:
1. On the `<tr>` (line 45): add `onClick={() => onEpicClick?.(epic.key)}` and add `cursor-pointer` to className
2. Change the epic name `<button>` (line 56) to a `<span>`, remove the onClick handler from it, remove `hover:opacity-80 transition-opacity` classes since the row hover handles visual feedback
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Clicking anywhere on an epic row fires onEpicClick. No nested button inside the row. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Make BacklogRow whole-row clickable (except checkbox and epic badge)</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
Add an onClick handler to the `<tr>` element that calls `onIssueClick(issue.key)`. Add `cursor-pointer` to the tr className.

To preserve existing behavior where checkbox and epic badge have their own distinct click targets:

1. On the `<tr>` (line 63): add `onClick={() => onIssueClick(issue.key)}` and add `cursor-pointer` to the className string in the `cn()` call
2. On the checkbox `<input>` onChange handler (line 76-79): it already calls `e.stopPropagation()` — good, no change needed
3. On the epic badge `<button>` (line 92-105): add `onClick={(e) => { e.stopPropagation(); onIssueClick(epicKey); }}` — replace the current onClick to add stopPropagation so the row click doesn't also fire. The epic badge already navigates to the epic (not the story), so keep that behavior.
4. On the summary `<button>` (line 110-117): convert from `<button>` to a `<span>` since the whole row is now clickable. Remove the onClick handler. Keep `text-sm text-left` classes but remove `hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded` since row handles interaction. Keep `truncate w-full`.

This ensures: row click -> story detail, checkbox click -> toggle selection (no navigation), epic badge click -> epic detail (no story navigation).
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Clicking a backlog row navigates to story detail. Checkbox still toggles without navigation. Epic badge still navigates to the epic. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
- TypeScript compiles with no errors
- Epic rows: clicking any cell navigates to epic detail
- Backlog rows: clicking row navigates to story detail, checkbox toggles selection, epic badge navigates to epic
</verification>

<success_criteria>
Both EpicRow and BacklogRow have row-level click handlers. Checkbox and epic badge in BacklogRow retain their independent behavior via stopPropagation. No nested interactive elements (buttons inside clickable rows).
</success_criteria>

<output>
After completion, create `.planning/quick/260316-vhc-on-epics-page-make-the-whole-row-clickab/260316-vhc-SUMMARY.md`
</output>
