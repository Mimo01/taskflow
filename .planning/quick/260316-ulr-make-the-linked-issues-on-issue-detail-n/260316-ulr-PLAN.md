---
phase: quick
plan: 260316-ulr
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
autonomous: true
must_haves:
  truths:
    - "Clicking a linked issue in the sidebar navigates to that issue's detail page"
    - "Linked issues show the same hover/click affordance as epic links and parent links"
  artifacts:
    - path: "taskflow/src/routes/dashboard/IssueDetailSidebar.tsx"
      provides: "Clickable linked issue rows"
      contains: "onOpenIssue"
  key_links:
    - from: "IssueDetailSidebar linked issues section"
      to: "onOpenIssue callback"
      via: "button onClick"
      pattern: "onOpenIssue.*target\\.key"
---

<objective>
Make the linked issues in the issue detail sidebar clickable so they navigate to the linked issue's detail page.

Purpose: Currently linked issues (lines 426-445 of IssueDetailSidebar.tsx) render as plain text spans. The `onOpenIssue` prop is already wired through from IssueDetailPage but not used for linked issues. Epic links and parent links in the same sidebar already use `onOpenIssue` as clickable buttons -- linked issues should match.

Output: Linked issues rendered as clickable buttons that call `onOpenIssue(target.key)`.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make linked issues clickable in IssueDetailSidebar</name>
  <files>taskflow/src/routes/dashboard/IssueDetailSidebar.tsx</files>
  <action>
In the "Linked issues" section (around line 426-445), replace the plain `<li>` with spans to a clickable button that calls `onOpenIssue?.(target.key)`.

Current code renders:
```
<li key={link.id} className="text-xs">
  <span className="text-muted-foreground">{label}: </span>
  <span className="font-mono">{target.key}</span>
  <span className="text-muted-foreground"> — {target.fields.summary}</span>
</li>
```

Change to a button matching the pattern used for epic link (line 342-351) and parent link (line 357-365):
```
<li key={link.id} className="text-xs">
  <span className="text-muted-foreground">{label}: </span>
  <button
    type="button"
    onClick={() => onOpenIssue?.(target.key)}
    className="text-left hover:underline cursor-pointer inline"
  >
    <span className="font-mono">{target.key}</span>
    <span className="text-muted-foreground ml-1">— {target.fields.summary}</span>
  </button>
  <Badge variant="outline" className="text-[10px] ml-1.5 align-middle">{target.fields.status.name}</Badge>
</li>
```

Also add a status badge (Badge is already imported) since the JiraIssueLink type includes `fields.status.name` on both inwardIssue and outwardIssue, and showing status helps the user decide whether to navigate.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>Linked issues in the sidebar are clickable buttons that navigate to the linked issue detail page via onOpenIssue. Each linked issue shows its status badge. TypeScript compiles clean.</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors
- Linked issues section renders clickable buttons instead of plain text
- Clicking a linked issue navigates to that issue's detail page
</verification>

<success_criteria>
Linked issues in IssueDetailSidebar are navigable -- clicking one opens that issue's detail page using the existing onOpenIssue callback, matching the interaction pattern of epic links and parent links in the same sidebar.
</success_criteria>

<output>
After completion, create `.planning/quick/260316-ulr-make-the-linked-issues-on-issue-detail-n/260316-ulr-SUMMARY.md`
</output>
