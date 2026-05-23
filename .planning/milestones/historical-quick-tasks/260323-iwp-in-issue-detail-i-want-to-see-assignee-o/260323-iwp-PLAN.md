---
phase: quick-260323-iwp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira/types.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: true
requirements: [ASSIGNEE-SUBTASKS, ASSIGNEE-EPIC-STORIES]
must_haves:
  truths:
    - "Subtask rows in issue detail show assignee avatar"
    - "Story rows in epic detail show assignee avatar"
    - "Unassigned subtasks/stories show no avatar (no crash)"
  artifacts:
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Assignee avatars in subtask and epic story lists"
    - path: "taskflow/src/services/jira/types.ts"
      provides: "Updated subtask type with assignee field"
    - path: "taskflow/src/services/jira.ts"
      provides: "Updated JiraIssueDetail subtask type with assignee field"
  key_links:
    - from: "IssueDetailContent.tsx subtask rows"
      to: "subtask.fields.assignee"
      via: "optional chaining render"
      pattern: "sub\\.fields\\.assignee"
    - from: "IssueDetailContent.tsx epic story rows"
      to: "story.fields.assignee"
      via: "optional chaining render"
      pattern: "story\\.fields\\.assignee"
---

<objective>
Add assignee avatars to the subtask list in issue detail view and the stories list in epic detail view.

Purpose: Users need to see at a glance who is assigned to each subtask/story without opening individual issues.
Output: Updated IssueDetailContent.tsx with assignee avatars rendered inline on subtask and story rows.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/IssueDetailContent.tsx
@taskflow/src/services/jira/types.ts
@taskflow/src/services/jira.ts

<interfaces>
<!-- Subtask type in JiraIssueDetail (both types.ts line 117-121 and jira.ts line 995-999) -->
<!-- CURRENT — missing assignee: -->
subtasks: Array<{
  id: string;
  key: string;
  fields: { summary: string; status: { name: string } };
}>;

<!-- JiraIssue (used for epicStories) already has assignee: -->
assignee: {
  displayName: string;
  name: string;
  avatarUrls: { '48x48': string };
} | null;

<!-- EpicsPage.tsx has a getInitials helper and avatar pattern to reuse -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add assignee to subtask types and render assignee avatars on both lists</name>
  <files>
    taskflow/src/services/jira/types.ts
    taskflow/src/services/jira.ts
    taskflow/src/routes/dashboard/IssueDetailContent.tsx
  </files>
  <action>
1. Update the subtask type in `taskflow/src/services/jira/types.ts` (line 117-121) to include optional assignee:
   ```
   subtasks: Array<{
     id: string;
     key: string;
     fields: {
       summary: string;
       status: { name: string };
       assignee?: { displayName: string; name: string; avatarUrls: { '48x48': string } } | null;
     };
   }>;
   ```

2. Apply the same subtask type change in `taskflow/src/services/jira.ts` (line 995-999 in `JiraIssueDetail` interface). Keep the field optional (`assignee?`) since Jira may or may not include it in the subtask sub-resource.

3. In `IssueDetailContent.tsx`, add a small `getInitials` helper (same pattern as EpicsPage.tsx lines 26-33):
   ```ts
   function getInitials(displayName: string): string {
     return displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
   }
   ```

4. In the **subtasks list** (lines 158-174), add an assignee avatar BEFORE the status badge in each subtask row. Use the same avatar pattern as EpicsPage (img with onError fallback to initials div). The avatar should be a 5x5 (h-5 w-5) rounded-full element with `shrink-0`. If `sub.fields.assignee` is null/undefined, render nothing (no empty placeholder).

5. In the **epic stories list** (lines 127-143), add an assignee avatar BEFORE the status badge in each story row. `story.fields.assignee` is already typed on `JiraIssue`. Same avatar pattern: h-5 w-5 rounded-full, img with fallback initials, shrink-0. If null, render nothing.

Both avatar additions should be placed between the truncated summary `<span>` and the status `<Badge>`, wrapped in a `shrink-0` container so the layout remains: key | summary (truncate) | avatar | status badge.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - Subtask rows show assignee avatar (h-5 w-5 circle) between summary and status badge
    - Epic story rows show assignee avatar (h-5 w-5 circle) between summary and status badge
    - Null/undefined assignee renders no avatar element
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes with no errors
- Visual check: open an issue with subtasks — assignee avatars appear
- Visual check: open an epic — story rows show assignee avatars
- Unassigned items show no avatar, no empty space
</verification>

<success_criteria>
- Assignee avatars visible on subtask rows in issue detail
- Assignee avatars visible on story rows in epic detail
- No TypeScript errors
- Graceful handling of null assignee
</success_criteria>

<output>
After completion, create `.planning/quick/260323-iwp-in-issue-detail-i-want-to-see-assignee-o/260323-iwp-SUMMARY.md`
</output>
