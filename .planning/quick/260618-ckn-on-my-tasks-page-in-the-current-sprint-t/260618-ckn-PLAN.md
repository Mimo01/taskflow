---
phase: quick-260618-ckn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/my-tasks/MyTasksPage.tsx
  - taskflow/src/routes/my-tasks/MyTasksPage.test.tsx
autonomous: true
requirements: [QUICK-260618-ckn]
must_haves:
  truths:
    - "On My Tasks → Current Sprint tab, a story whose status is in the DONE status category renders WITHOUT any subtask rows beneath it (parent row only)."
    - "Stories in TODO (statusCategory 'new') and IN PROGRESS (statusCategory 'indeterminate') still render their subtask rows exactly as before."
    - "Other scopes (All Assigned / All Reported) are unaffected (they already render parent-only)."
  artifacts:
    - path: "taskflow/src/routes/my-tasks/MyTasksPage.tsx"
      provides: "Subtask gating in renderMyDayList based on parent done status category"
      contains: "statusCategory"
  key_links:
    - from: "renderMyDayList (MyTasksPage.tsx)"
      to: "renderFlatRows"
      via: "subtasks argument suppressed when parent statusCategory key === 'done'"
      pattern: "statusCategory\\?\\.key === 'done'"
---

<objective>
On the My Tasks page → "Current Sprint" tab, stories whose status is in the Jira DONE
status category must render WITHOUT their subtasks — only the parent story row. Stories
in TODO and IN PROGRESS keep their current behavior (subtasks shown).

Purpose: Reduce clutter for finished work — a completed story doesn't need its subtask
breakdown in the daily sprint view.
Output: A one-line gate in `renderMyDayList` plus a regression test.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/my-tasks/MyTasksPage.tsx
@taskflow/src/routes/my-tasks/MyTaskRow.tsx
@taskflow/src/routes/my-tasks/MyTasksPage.test.tsx

Investigation findings (already confirmed — do NOT re-investigate):
- The Current Sprint tab is rendered exclusively by `renderMyDayList()` (MyTasksPage.tsx
  line ~706: `scope === 'current-sprint' ? renderMyDayList() : renderBySprintList()`).
  `renderBySprintList()` serves the All Assigned / All Reported scopes and already renders
  parents only — out of scope, do not touch it.
- Inside `renderMyDayList()`, each parent is rendered via
  `renderFlatRows(parent, subtasksByKey.get(parent.key) ?? [])` (line ~585-586).
  `renderFlatRows(parent, subtasks)` forwards `subtasks` to `<MyTaskRow subtasks={...}>`,
  and `MyTaskRow` (line ~414) maps over `subtasks` to emit the nested subtask rows. So
  passing an empty array to `renderFlatRows` suppresses subtask rendering for that parent.
- "DONE status category" is detected consistently across this file as
  `issue.fields.status.statusCategory?.key === 'done'` (see lines ~387, ~421). TODO is
  `'new'`, IN PROGRESS is `'indeterminate'`. Use the `'done'` category check — NOT a single
  status name — so all done-category statuses are covered.
- `renderFlatRows` also calls `accumulateTime(parent, subtasks)` for the parent's time bar.
  Passing `[]` for a done parent means its time bar shows the parent's own time only. This
  is acceptable for done stories (their work is complete); do not add special-casing.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Gate subtask rendering for DONE-category parents in the Current Sprint tab</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.tsx</files>
  <action>
In `renderMyDayList()`, at the parent map (currently
`sortedParents.map((parent) => renderFlatRows(parent, subtasksByKey.get(parent.key) ?? []))`),
suppress subtasks when the parent's own status is in the DONE category. Compute
`const isParentDone = parent.fields.status.statusCategory?.key === 'done';` and pass
`isParentDone ? [] : (subtasksByKey.get(parent.key) ?? [])` as the subtasks argument to
`renderFlatRows`. Do NOT change `renderBySprintList`, `groupByMyDay`, the band/sort logic,
or `MyTaskRow`. Only this single call site changes. Keep the existing TODO/IN PROGRESS
behavior identical (their subtasks still flow through unchanged).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i "MyTasksPage" || echo "no MyTasksPage type errors"</automated>
  </verify>
  <done>A done-category parent in the current-sprint view passes an empty subtasks array to renderFlatRows; TODO/in-progress parents still pass their real subtasks. Type-check clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add regression test for done-parent subtask suppression</name>
  <files>taskflow/src/routes/my-tasks/MyTasksPage.test.tsx</files>
  <behavior>
    - In the Current Sprint scope, a parent story with statusCategory.key === 'done' that
      has subtasks renders the parent row but NONE of its subtask rows
      (e.g. `queryByTestId('my-task-row-<SUBTASK-KEY>')` is null while the parent
      `my-task-row-<PARENT-KEY>` is present).
    - A parent with statusCategory.key === 'indeterminate' (or 'new') that has subtasks
      DOES render its subtask rows (the existing behavior is preserved).
  </behavior>
  <action>
Read the existing `MyTasksPage.test.tsx` to reuse its render harness, mock setup
(fetchMyTasksHierarchy / stores / outlet context), and fixture-building conventions —
match the existing patterns rather than introducing new ones. Add fixtures: one DONE-category
parent with at least one subtask, and one IN-PROGRESS-category parent with at least one
subtask, all belonging to the current user (so they pass the `myIssueKeys` eligibility
filter in `groupByMyDay`). Assert via `data-testid="my-task-row-<key>"` that the done
parent's subtask row is absent and the in-progress parent's subtask row is present. Default
scope is 'current-sprint' so no scope toggle is needed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/my-tasks/MyTasksPage.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>New test fails before Task 1's change and passes after; the full MyTasksPage test file is green.</done>
</task>

</tasks>

<verification>
- `npx vitest run src/routes/my-tasks/MyTasksPage.test.tsx` passes.
- `npm run check` (biome + tsc) clean for the touched files.
- Manual sanity (optional): My Tasks → Current Sprint, a Done story shows only its parent
  row; a To Do / In Progress story still lists its subtasks.
</verification>

<success_criteria>
- DONE-category stories in the Current Sprint tab render parent-only (no subtask rows).
- TODO and IN PROGRESS stories render subtasks unchanged.
- No changes to All Assigned / All Reported scopes or to the sort/band logic.
</success_criteria>

<output>
Create `.planning/quick/260618-ckn-on-my-tasks-page-in-the-current-sprint-t/260618-ckn-SUMMARY.md` when done.
</output>
