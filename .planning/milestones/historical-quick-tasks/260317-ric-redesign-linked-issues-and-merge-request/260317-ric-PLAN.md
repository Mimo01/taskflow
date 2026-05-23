---
phase: quick
plan: 260317-ric
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
autonomous: true
requirements: [redesign-linked-issues, redesign-merge-requests]

must_haves:
  truths:
    - "Linked issues are grouped by link type label (blocks, is blocked by, relates to)"
    - "Each linked issue shows as a compact card with status color dot and colored status badge"
    - "Each MR shows as a compact card with author avatar, source branch, and state color"
    - "MR state badges use green for open, purple for merged, gray for closed"
    - "Linked issue cards are clickable to open the target issue"
    - "MR cards open web_url in external browser on click"
  artifacts:
    - path: "taskflow/src/routes/dashboard/IssueDetailSidebar.tsx"
      provides: "Redesigned linked issues and merge requests sections"
  key_links:
    - from: "IssueDetailSidebar linked issues section"
      to: "onOpenIssue callback"
      via: "onClick handler on linked issue card"
      pattern: "onOpenIssue.*target\\.key"
    - from: "IssueDetailSidebar MR section"
      to: "openUrl"
      via: "onClick handler on MR card"
      pattern: "openUrl.*mr\\.web_url"
---

<objective>
Redesign the linked issues and merge requests sections in IssueDetailSidebar from plain text lists to compact cards with richer metadata.

Purpose: Improve visual clarity and information density for linked issues (grouped by type, status color dots/badges) and merge requests (author avatar, branch name, state colors, reviewer count).
Output: Updated IssueDetailSidebar.tsx with redesigned sections.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
@taskflow/src/services/jira.ts (JiraIssueLink interface at line 884)
@taskflow/src/services/gitlab.ts (GitLabMR interface at line 170)

<interfaces>
From taskflow/src/services/jira.ts:
```typescript
export interface JiraIssueLink {
  id: string
  type: { id: string; name: string; inward: string; outward: string }
  inwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
  outwardIssue?: { id: string; key: string; fields: { summary: string; status: { name: string } } }
}
```

From taskflow/src/services/gitlab.ts:
```typescript
export interface GitLabMR {
  id: number;
  iid: number;
  project_id: number;
  title: string;
  source_branch: string;
  state: 'opened' | 'closed' | 'merged' | 'locked';
  author: { id: number; name: string; username: string; avatar_url: string };
  reviewers: Array<{ id: number; name: string; username: string }>;
  updated_at: string;
  web_url: string;
}
```

IMPORTANT constraints:
- Linked issue targets only have `summary` and `status.name` — NO `statusCategory`, NO `issuetype`, NO `priority`, NO `assignee`
- Since we lack statusCategory on linked issue targets, use status name heuristic for color coding: names containing "Done"/"Closed"/"Resolved" -> green, "In Progress"/"In Review" -> blue, default -> gray
- GitLabMR has `reviewers` array but NO approval status data
- The CONTEXT.md says to add issue type icon, priority icon, assignee avatar to linked issues, but these fields DO NOT exist on the linked issue target object. Plan within the actual data constraints: show status color dot + status badge + key + summary only.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Redesign linked issues section with grouped compact cards</name>
  <files>taskflow/src/routes/dashboard/IssueDetailSidebar.tsx</files>
  <action>
Replace the linked issues section (lines ~551-577) in IssueDetailSidebar.tsx with a redesigned version:

1. **Group by link type**: Use `useMemo` to group `f.issuelinks` by the resolved label string (the `link.inwardIssue ? link.type.inward : link.type.outward` value). Return a `Map<string, Array<{link, target, label}>>` or similar structure.

2. **Status color helper**: Add a local helper function `statusDotColor(statusName: string): string` that returns a Tailwind text color class:
   - Names matching /done|closed|resolved/i -> "text-green-500"
   - Names matching /in progress|in review|in development/i -> "text-blue-500"
   - Names matching /to do|open|backlog|new/i -> "text-gray-400"
   - Default -> "text-gray-400"

   Also add `statusBadgeClasses(statusName: string): string` returning background + text classes for the Badge:
   - Done/Closed/Resolved -> "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
   - In Progress/In Review -> "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
   - Default -> "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

3. **Render grouped sections**: For each link type group, render:
   - A small muted uppercase label showing the link type (e.g., "blocks", "is blocked by")
   - Below it, each linked issue as a compact card:
     ```
     <button onClick={() => onOpenIssue?.(target.key)}
       className="w-full text-left rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5
                  hover:bg-muted/60 transition-colors cursor-pointer flex items-center gap-2">
       <span className={`size-2 rounded-full shrink-0 ${statusDotColor(target.fields.status.name)}`} />
       <span className="font-mono text-xs font-medium shrink-0">{target.key}</span>
       <span className="text-xs text-muted-foreground truncate flex-1">{target.fields.summary}</span>
       <Badge className={`text-[10px] shrink-0 border-0 ${statusBadgeClasses(target.fields.status.name)}`}>
         {target.fields.status.name}
       </Badge>
     </button>
     ```

4. Keep the section header "Linked Issues" as-is (small uppercase text). Keep it inside the existing conditional `{f.issuelinks.length > 0 && (...)}`
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>Linked issues render as compact cards grouped by link type, each with a status color dot, issue key, truncated summary, and colored status badge. Cards are clickable via onOpenIssue.</done>
</task>

<task type="auto">
  <name>Task 2: Redesign merge requests section with compact cards</name>
  <files>taskflow/src/routes/dashboard/IssueDetailSidebar.tsx</files>
  <action>
Replace the merge requests section (lines ~579-609) in IssueDetailSidebar.tsx with a redesigned version:

1. **MR state color helper**: Add `mrStateClasses(state: GitLabMR['state']): string` returning badge classes:
   - 'opened' -> "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
   - 'merged' -> "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
   - 'closed' | 'locked' -> "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"

2. **MR state dot color**: `mrDotColor(state)`:
   - 'opened' -> "text-green-500"
   - 'merged' -> "text-purple-500"
   - default -> "text-gray-400"

3. **Add lucide imports**: Add `GitBranch` to the existing lucide import (alongside `GitMerge`).

4. **Render each MR as a compact card**:
   ```
   <button onClick={() => openUrl(mr.web_url)}
     className="w-full text-left rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5
                hover:bg-muted/60 transition-colors cursor-pointer space-y-1">
     {/* Row 1: state dot + title + state badge */}
     <div className="flex items-center gap-2">
       <span className={`size-2 rounded-full shrink-0 ${mrDotColor(mr.state)}`} />
       <span className="text-xs font-medium truncate flex-1">!{mr.iid} {mr.title}</span>
       <Badge className={`text-[10px] shrink-0 border-0 ${mrStateClasses(mr.state)}`}>
         {mr.state === 'merged' ? 'Merged' : mr.state === 'opened' ? 'Open' : mr.state}
       </Badge>
     </div>
     {/* Row 2: author avatar + branch + reviewers count */}
     <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pl-4">
       <img src={mr.author.avatar_url} alt={mr.author.name} className="size-4 rounded-full shrink-0" />
       <span className="truncate">{mr.author.name}</span>
       <span className="text-muted-foreground/50 mx-0.5">·</span>
       <GitBranch className="size-3 shrink-0" />
       <span className="font-mono truncate max-w-[120px]">{mr.source_branch}</span>
       {mr.reviewers.length > 0 && (
         <>
           <span className="text-muted-foreground/50 mx-0.5">·</span>
           <span>{mr.reviewers.length} reviewer{mr.reviewers.length > 1 ? 's' : ''}</span>
         </>
       )}
     </div>
   </button>
   ```

5. Keep the section header "Merge Requests" and the loading/empty states. Update the loading state to match card dimensions (e.g., two skeleton cards: `<div className="h-12 rounded-md bg-muted animate-pulse" />`).

6. Keep the `GitMerge` import even if unused elsewhere (or remove it if the new design no longer uses it — the new design uses `GitBranch` for branch display and a colored dot for state instead of `GitMerge`). Check if `GitMerge` is used anywhere else in the file; if not, replace it with `GitBranch` in the import.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>MR cards show author avatar, MR number + title, source branch with GitBranch icon, reviewer count, and colored state badge (green=open, purple=merged). Cards open web_url in browser on click.</done>
</task>

</tasks>

<verification>
1. TypeScript compiles without errors: `cd taskflow && npx tsc --noEmit`
2. Visual check: Open issue detail for an issue with linked issues — verify grouped layout with color dots and badges
3. Visual check: Open issue detail for an issue with MRs — verify author avatar, branch name, reviewer count, and state colors
4. Click linked issue card — should open that issue in the detail view
5. Click MR card — should open MR in external browser
</verification>

<success_criteria>
- Linked issues section renders grouped by link type with compact cards showing status dot + key + summary + colored badge
- MR section renders compact cards with author avatar, branch, reviewer count, colored state badge
- All existing click behaviors preserved (linked issues -> onOpenIssue, MRs -> openUrl)
- TypeScript compiles clean
</success_criteria>

<output>
After completion, create `.planning/quick/260317-ric-redesign-linked-issues-and-merge-request/260317-ric-SUMMARY.md`
</output>
