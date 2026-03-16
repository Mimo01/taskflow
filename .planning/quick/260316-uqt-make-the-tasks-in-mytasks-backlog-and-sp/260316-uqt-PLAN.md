---
phase: quick
plan: 260316-uqt
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "MyTasks shows stories in Jira board rank order, not updated-date order"
    - "SprintBoard swimlanes appear in Jira board rank order, not updated-date order"
    - "Backlog already uses rank order (no change needed — verify only)"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "JQL queries with ORDER BY rank ASC"
      contains: "ORDER BY rank ASC"
  key_links:
    - from: "fetchMyTasksHierarchy"
      to: "MyTasksTab"
      via: "useQuery queryKey jira-issues/my-tasks"
      pattern: "ORDER BY rank ASC"
    - from: "fetchSprintIssues"
      to: "SprintBoardTab"
      via: "useQuery queryKey jira-issues/sprint-board"
      pattern: "ORDER BY rank ASC"
---

<objective>
Change MyTasks and SprintBoard to display issues in Jira rank order (the same order as in Jira's board/backlog views) instead of `ORDER BY updated DESC`.

Purpose: Users expect tasks to appear in the same priority order they see in Jira. Currently, MyTasks and SprintBoard sort by last-updated time, which shuffles the order every time any field changes.

Output: Updated JQL queries in `fetchSprintIssues` and `fetchMyTasksHierarchy` using `ORDER BY rank ASC`.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/services/jira.ts
@taskflow/src/routes/dashboard/MyTasksTab.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Change JQL ordering from updated DESC to rank ASC in sprint fetch functions</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
In `taskflow/src/services/jira.ts`, change the JQL `ORDER BY` clauses in two functions:

1. **`fetchSprintIssues`** (line ~302): Change the parent-issues JQL from:
   ```
   ORDER BY updated DESC
   ```
   to:
   ```
   ORDER BY rank ASC
   ```
   This is the JQL at line 302 inside the template literal for `jql`.

2. **`fetchMyTasksHierarchy`** (line ~398): Change the `myStoriesJql` from:
   ```
   ORDER BY updated DESC
   ```
   to:
   ```
   ORDER BY rank ASC
   ```
   This is at line 398 inside the `myStoriesJql` template literal.

Do NOT change:
- The subtask JQL queries (subtasks inherit order from their parent grouping, not from rank)
- The backlog view queries (already use `ORDER BY rank ASC`)
- The search/epic queries that use `ORDER BY updated DESC` (those are different use cases)
- The `mySubtasksJql` in fetchMyTasksHierarchy (subtasks don't support rank on Jira DC)

The `rank` field is supported by the Jira REST search API when Jira Software (boards) is installed — same assumption already validated by the backlog view which uses `ORDER BY rank ASC` successfully via `/rest/api/2/search`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && grep -n "ORDER BY" src/services/jira.ts | grep -v "rank ASC" | grep -v "created DESC" | grep -v "updated DESC"</automated>
    Verify that lines ~302 and ~398 now show `ORDER BY rank ASC`. The grep above should show NO results for the sprint query lines (they should all be rank ASC now). The remaining `updated DESC` lines should only be search queries (line ~698) and epic queries (lines ~1621, ~1697).

    Also run: `cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit` to confirm no type errors.
  </verify>
  <done>
    - fetchSprintIssues parent query uses `ORDER BY rank ASC`
    - fetchMyTasksHierarchy myStoriesJql uses `ORDER BY rank ASC`
    - All other queries unchanged
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
1. `grep -n "ORDER BY rank ASC" taskflow/src/services/jira.ts` shows the two changed lines plus the existing backlog lines
2. `grep -n "ORDER BY updated DESC" taskflow/src/services/jira.ts` shows only search/epic queries, NOT sprint queries
3. `cd taskflow && npx tsc --noEmit` passes
</verification>

<success_criteria>
- MyTasks and SprintBoard fetch functions request issues in Jira rank order
- Backlog view unchanged (already correct)
- No regressions in TypeScript compilation
</success_criteria>

<output>
After completion, create `.planning/quick/260316-uqt-make-the-tasks-in-mytasks-backlog-and-sp/260316-uqt-SUMMARY.md`
</output>
