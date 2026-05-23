---
phase: quick-7
plan: 7
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/SprintProgressTab.tsx
  - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "The assignee breakdown table shows a 'Stories' column with count of stories assigned to each person"
    - "The assignee breakdown table shows a 'Subtasks' column with count of subtasks assigned to each person"
    - "Story and subtask counts are independent of status (todo/in-progress/done)"
    - "Subtask count uses issuetype.subtask === true (not name comparison)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/SprintProgressTab.tsx"
      provides: "Updated component with stories and subtasks columns in assignee table"
      contains: "stories: number; subtasks: number"
    - path: "taskflow/src/routes/dashboard/SprintProgressTab.test.tsx"
      provides: "Tests verifying new columns render correct counts"
  key_links:
    - from: "SprintProgressTab.tsx assigneeMap"
      to: "assignee-row <td> cells"
      via: "stories and subtasks fields on assigneeMap entries"
      pattern: "assigneeMap.*stories.*subtasks"
---

<objective>
Add two new columns to the per-assignee breakdown table in SprintProgressTab: "Stories" (count of stories assigned) and "Subtasks" (count of subtasks assigned).

Purpose: Give PMs a quick count of how many items each person owns in the sprint, separate from story points.
Output: Updated SprintProgressTab.tsx with two new columns; updated tests verifying counts.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add stories and subtasks counts to assignee map and render new columns</name>
  <files>taskflow/src/routes/dashboard/SprintProgressTab.tsx, taskflow/src/routes/dashboard/SprintProgressTab.test.tsx</files>
  <behavior>
    - Test A: assignee with 2 stories (any status) and 1 subtask shows Stories=2, Subtasks=1
    - Test B: assignee with 0 subtasks shows Subtasks=0
    - Test C: subtask count uses issuetype.subtask boolean — a story named "Sub-task" is NOT counted as subtask
    - Test D: table header includes "Stories" and "Subtasks" column headers
  </behavior>
  <action>
    In SprintProgressTab.tsx:

    1. Extend the assigneeMap value type to include `stories: number; subtasks: number`:
       ```
       const assigneeMap = new Map<string, { todo: number; inProgress: number; done: number; stories: number; subtasks: number }>();
       ```
       Initialize with `stories: 0, subtasks: 0`.

    2. In the existing `for (const story of stories)` loop, increment `row.stories++` for each story added to the map. This loop already filters to `!issuetype.subtask`, so this is purely parent stories.

    3. Add a second loop over all `issues` to count subtasks per assignee:
       ```
       for (const issue of issues) {
         if (!issue.fields.issuetype?.subtask) continue;
         const assigneeName = (issue.fields.assignee as { displayName: string } | null)?.displayName ?? 'Unassigned';
         if (!assigneeMap.has(assigneeName)) {
           assigneeMap.set(assigneeName, { todo: 0, inProgress: 0, done: 0, stories: 0, subtasks: 0 });
         }
         assigneeMap.get(assigneeName)!.subtasks++;
       }
       ```

    4. In the JSX table, add two new `<th>` headers after "Assignee":
       ```
       <th className="pb-2 text-right font-normal">Stories</th>
       <th className="pb-2 text-right font-normal">Subtasks</th>
       ```
       Place these BEFORE the existing "To Do pts" column so the order is:
       Assignee | Stories | Subtasks | To Do pts | In Progress pts | Done pts

    5. In each `<tr>` in the tbody, add two new `<td>` cells after the assignee name cell:
       ```
       <td className="py-1.5 text-right tabular-nums text-muted-foreground">{buckets.stories}</td>
       <td className="py-1.5 text-right tabular-nums text-muted-foreground">{buckets.subtasks}</td>
       ```

    In SprintProgressTab.test.tsx, add tests (in a new describe block "SPPG-07: assignee stories and subtasks columns"):

    - Test A: Two stories for Alice (new + done), 1 subtask for Alice — Alice row shows Stories=2, Subtasks=1
    - Test B: Bob with 1 story and 0 subtasks — Bob row shows Subtasks=0
    - Test C: Subtask with issuetype.subtask=false but name "Sub-task" — not counted in subtasks column (verify issuetype.subtask boolean is used)
    - Test D: table header cells "Stories" and "Subtasks" visible

    Use the existing `makeIssue` helper. For subtasks pass `{ subtask: true }`. For the story-named-sub-task test, create an issue with `options?.subtask = false` but name "Sub-task".

    Note: the `makeIssue` helper hardcodes `name: options?.subtask ? 'Sub-task' : 'Story'` — for Test C create an issue via direct object literal with subtask=false but name "Sub-task".

    Cell index for new columns: after updating, Stories is index 1, Subtasks is index 2, To Do pts is index 3, In Progress pts is index 4, Done pts is index 5.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/dashboard/SprintProgressTab.test.tsx</automated>
  </verify>
  <done>All existing tests pass; new SPPG-07 tests pass; table renders Stories and Subtasks columns with correct counts per assignee.</done>
</task>

</tasks>

<verification>
Run full test suite to confirm no regressions: `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run`
</verification>

<success_criteria>
- SprintProgressTab assignee table has 6 columns: Assignee, Stories, Subtasks, To Do pts, In Progress pts, Done pts
- Stories column counts parent stories (issuetype.subtask === false) assigned to each person, all statuses included
- Subtasks column counts subtasks (issuetype.subtask === true) assigned to each person
- All SprintProgressTab tests pass (existing + new)
</success_criteria>

<output>
After completion, create `.planning/quick/7-in-sprint-progress-page-show-a-new-colum/7-SUMMARY.md`
</output>
