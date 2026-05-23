---
phase: quick
plan: 260316-ssu
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "Sprint board columns no longer show '+ Add' quick-create buttons"
    - "All other sprint board functionality (drag-drop, swimlanes, filters) unchanged"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintBoardTab.tsx"
      provides: "Sprint board without QuickCreateInput"
  key_links: []
---

<objective>
Remove the "+ Add" (QuickCreateInput) buttons from each Sprint Board column.

Purpose: The quick-create buttons in sprint board columns are not desired UX.
Output: Clean sprint board columns without inline issue creation.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Remove QuickCreateInput from SprintBoardTab</name>
  <files>taskflow/src/routes/dashboard/SprintBoardTab.tsx, taskflow/src/routes/dashboard/SprintBoardTab.test.tsx</files>
  <action>
In SprintBoardTab.tsx:
1. Remove the QuickCreateInput import (line 44)
2. Remove the QuickCreateInput JSX block inside each DroppableCell (lines 471-482) — the block wrapped in `{jiraToken && activeJiraProject && (...)}`
3. If QuickCreateInput import was the only consumer of `createIssue` from jira service, also remove that unused import if present (check — it is not directly imported here, only in QuickCreateInput itself, so likely just the component import to remove)

In SprintBoardTab.test.tsx:
1. Remove the test "renders a + Add button in each category column" (the test that expects 3 "+ Add" buttons at ~line 668-669)
2. Remove the test "passes numeric Jira status ID (not category key) to QuickCreateInput so transition lookup succeeds" (~lines 672-717) — this test exercises QuickCreateInput behavior which is being removed
3. Remove any `createIssue` mock references that were only used by those deleted tests

Do NOT remove QuickCreateInput.tsx or QuickCreateInput.test.tsx files — they may be used by BoardColumn.tsx or other consumers.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx --reporter=verbose 2>&1 | tail -30</automated>
  </verify>
  <done>Sprint board renders without any "+ Add" buttons in columns. All remaining tests pass. Drag-drop, swimlanes, epic filter, error/empty states all unaffected.</done>
</task>

</tasks>

<verification>
- `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/SprintBoardTab.test.tsx` — all remaining tests pass
- `grep -n "QuickCreateInput" taskflow/src/routes/dashboard/SprintBoardTab.tsx` — no matches
- `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` — no type errors
</verification>

<success_criteria>
- No QuickCreateInput rendered in sprint board columns
- All remaining SprintBoardTab tests pass
- No TypeScript errors
</success_criteria>

<output>
After completion, create `.planning/quick/260316-ssu-remove-add-buttons-from-sprint-board-col/260316-ssu-SUMMARY.md`
</output>
