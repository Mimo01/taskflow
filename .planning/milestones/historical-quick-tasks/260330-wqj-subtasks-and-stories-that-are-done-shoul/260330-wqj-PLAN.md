---
phase: quick-260330-wqj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/StoryHeaderRow.tsx
  - taskflow/src/routes/dashboard/TaskCard.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
autonomous: true
requirements: [STRIKETHROUGH-DONE]
must_haves:
  truths:
    - "Done stories show their PROJ-123 key with strikethrough on sprint board headers"
    - "Done subtask cards show their PROJ-123 key with strikethrough on sprint board"
    - "Done issues show their PROJ-123 key with strikethrough in backlog rows"
  artifacts:
    - path: "taskflow/src/routes/dashboard/StoryHeaderRow.tsx"
      provides: "Strikethrough on story key when statusCategoryKey is done"
      contains: "line-through"
    - path: "taskflow/src/routes/dashboard/TaskCard.tsx"
      provides: "Strikethrough on issue key when status category is done"
      contains: "line-through"
    - path: "taskflow/src/routes/dashboard/BacklogRow.tsx"
      provides: "Strikethrough on issue key when status category is done"
      contains: "line-through"
  key_links:
    - from: "StoryHeaderRow.tsx"
      to: "statusCategoryKey prop"
      via: "conditional line-through class"
      pattern: "statusCategoryKey.*done.*line-through"
---

<objective>
Add strikethrough styling to PROJ-123 issue keys when the issue status category is "done". This applies to sprint board story headers, sprint board task cards, and backlog rows.

Purpose: Visually communicate at a glance which stories and subtasks are completed.
Output: Updated StoryHeaderRow, TaskCard, and BacklogRow components with conditional strikethrough on issue keys.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/StoryHeaderRow.tsx
@taskflow/src/routes/dashboard/TaskCard.tsx
@taskflow/src/routes/dashboard/BacklogRow.tsx
@taskflow/src/routes/dashboard/SprintBoardTab.tsx (for understanding how statusCategoryKey flows)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add strikethrough to done issue keys in sprint board components</name>
  <files>taskflow/src/routes/dashboard/StoryHeaderRow.tsx, taskflow/src/routes/dashboard/TaskCard.tsx</files>
  <action>
**StoryHeaderRow.tsx** (line 53):
The `storyKey` span already receives `statusCategoryKey` as a prop. Add conditional `line-through` class to the key span when `statusCategoryKey === 'done'`:

Change:
```
<span className="font-mono text-xs text-muted-foreground shrink-0 group-hover:underline">{storyKey}</span>
```
To:
```
<span className={cn('font-mono text-xs text-muted-foreground shrink-0 group-hover:underline', statusCategoryKey === 'done' && 'line-through')}>{storyKey}</span>
```

Import `cn` from `@/lib/utils` (already imported in file).

**TaskCard.tsx** (line 98):
The issue key span needs conditional strikethrough. The `issue` prop contains `issue.fields.status.statusCategory?.key`. Add conditional `line-through` when status category is `done`:

Change:
```
<div className="text-xs font-mono text-muted-foreground group-hover:underline">{issue.key}</div>
```
To:
```
<div className={cn('text-xs font-mono text-muted-foreground group-hover:underline', issue.fields.status.statusCategory?.key === 'done' && 'line-through')}>{issue.key}</div>
```

`cn` is already imported in TaskCard.tsx.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>StoryHeaderRow and TaskCard issue keys display with line-through when statusCategoryKey is "done"; no line-through otherwise. TypeScript compiles clean.</done>
</task>

<task type="auto">
  <name>Task 2: Add strikethrough to done issue keys in backlog rows</name>
  <files>taskflow/src/routes/dashboard/BacklogRow.tsx</files>
  <action>
**BacklogRow.tsx** (line 100):
The issue key span needs conditional strikethrough. The `issue` prop contains `issue.fields.status.statusCategory?.key`. Add conditional `line-through` when status category is `done`:

Change:
```
<span className="font-mono text-xs text-muted-foreground">{issue.key}</span>
```
To:
```
<span className={cn('font-mono text-xs text-muted-foreground', issue.fields.status.statusCategory?.key === 'done' && 'line-through')}>{issue.key}</span>
```

`cn` is already imported in BacklogRow.tsx.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit --pretty 2>&1 | head -30</automated>
  </verify>
  <done>Backlog row issue keys display with line-through when status category is "done"; no line-through otherwise. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
1. `cd taskflow && npx tsc --noEmit` — no type errors
2. Visual: Open sprint board, confirm done stories have strikethrough on PROJ-123 key
3. Visual: Open backlog, confirm done issues have strikethrough on PROJ-123 key
</verification>

<success_criteria>
- All three components (StoryHeaderRow, TaskCard, BacklogRow) apply `line-through` CSS to the issue key when `statusCategory.key === 'done'`
- Non-done issues display keys normally without strikethrough
- No TypeScript errors introduced
</success_criteria>

<output>
After completion, create `.planning/quick/260330-wqj-subtasks-and-stories-that-are-done-shoul/260330-wqj-SUMMARY.md`
</output>
