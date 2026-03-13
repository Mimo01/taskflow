---
phase: quick-15
plan: 15
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/InlineComment.tsx
  - taskflow/src/routes/dashboard/TaskRow.tsx
autonomous: true
requirements: [QUICK-15]

must_haves:
  truths:
    - "Comment button shows a count badge when the issue has 1+ existing comments"
    - "Comment button shows no badge when the issue has zero comments"
    - "Clicking the comment button opens a panel showing all existing comments (author, date, body) above the composer"
    - "User can still submit a new comment and it posts to Jira"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "fetchComments function returning JiraComment[]"
      exports: ["fetchComments", "JiraComment"]
    - path: "taskflow/src/routes/dashboard/InlineComment.tsx"
      provides: "Expanded panel: existing comments list + new comment composer"
    - path: "taskflow/src/routes/dashboard/TaskRow.tsx"
      provides: "Comment count badge on MessageCircle button, comment query per row"
  key_links:
    - from: "TaskRow.tsx"
      to: "fetchComments"
      via: "useQuery per issueKey, enabled only when commentOpen=true"
      pattern: "fetchComments.*issueKey"
    - from: "InlineComment.tsx"
      to: "existingComments prop"
      via: "comments rendered before textarea"
      pattern: "existingComments\\.map"
---

<objective>
Add a comment count badge to the comment button on every task row, and expand the comment panel to show all existing comments above the new-comment composer.

Purpose: Developers can see at a glance whether a task has comments, and can read the full comment history before adding their own.
Output: Updated TaskRow, InlineComment, and jira.ts with fetchComments + JiraComment type.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<!-- Key interfaces the executor needs -->
<interfaces>
From taskflow/src/services/jira.ts (existing postComment):
```typescript
export async function postComment(
  baseUrl: string,
  token: string,
  issueKey: string,
  body: string,
): Promise<void>
// Uses apiFetch('jira', url, { method: 'POST', ... })
// GET endpoint for comments: GET /rest/api/2/issue/{issueKey}/comment
// Response shape: { comments: JiraComment[], total: number, maxResults: number, startAt: number }
```

From taskflow/src/routes/dashboard/InlineComment.tsx (current props):
```typescript
interface InlineCommentProps {
  issueKey: string
  isOpen: boolean
  onCancel: () => void
  onSubmit: (comment: string) => void
  isSubmitting: boolean
  error?: string
}
```

From taskflow/src/routes/dashboard/TaskRow.tsx (comment button area, line ~119):
```tsx
<button
  type="button"
  onClick={() => setCommentOpen((prev) => !prev)}
  className="text-muted-foreground hover:text-foreground transition-colors"
  aria-label={`Comment on ${issue.key}`}
>
  <MessageCircle className="size-4" />
</button>
```
TaskRow receives: jiraBaseUrl, jiraToken as props (already available for count query).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add fetchComments to jira.ts + JiraComment type</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
Add `JiraComment` interface and `fetchComments` function directly after the `postComment` function (around line 475).

JiraComment interface:
```typescript
export interface JiraComment {
  id: string;
  author: { displayName: string };
  body: string;
  created: string; // ISO 8601
  updated: string;
}
```

fetchComments function:
```typescript
export async function fetchComments(
  baseUrl: string,
  token: string,
  issueKey: string,
): Promise<JiraComment[]> {
  const url = `${baseUrl.replace(/\/$/, '')}/rest/api/2/issue/${issueKey}/comment`;
  let response: Response;
  try {
    response = await apiFetch('jira', url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error(`Cannot reach ${baseUrl} — check the base URL`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch comments for ${issueKey}: status ${response.status}`);
  }
  const data = await response.json() as { comments: JiraComment[] };
  return data.comments ?? [];
}
```
  </action>
  <verify>npx tsc --noEmit -p /Users/mimo/Desktop/Tasker/taskflow/tsconfig.json 2>&1 | grep -E "jira\.ts|error" | head -20</verify>
  <done>fetchComments and JiraComment exported from jira.ts, no TypeScript errors in that file</done>
</task>

<task type="auto">
  <name>Task 2: Expand InlineComment to show existing comments + update TaskRow with count badge</name>
  <files>
    taskflow/src/routes/dashboard/InlineComment.tsx
    taskflow/src/routes/dashboard/TaskRow.tsx
  </files>
  <action>
**InlineComment.tsx** — add `existingComments` and `isLoadingComments` props. When `isOpen=true`, render existing comments above the textarea:

New props added to interface:
```typescript
existingComments?: JiraComment[]
isLoadingComments?: boolean
```

Import `JiraComment` from `@/services/jira`.

Inside the returned JSX (before the textarea), add a comments list section:
```tsx
{isLoadingComments && (
  <p className="text-xs text-muted-foreground py-1">Loading comments...</p>
)}
{!isLoadingComments && existingComments && existingComments.length > 0 && (
  <div className="flex flex-col gap-2 mb-2 max-h-48 overflow-y-auto">
    {existingComments.map((c) => (
      <div key={c.id} className="rounded border border-border bg-muted/30 px-2 py-1.5 text-xs">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="font-medium text-foreground">{c.author.displayName}</span>
          <span className="text-muted-foreground">{new Date(c.created).toLocaleString()}</span>
        </div>
        <p className="text-foreground whitespace-pre-wrap">{c.body}</p>
      </div>
    ))}
  </div>
)}
```

**TaskRow.tsx** — add comment count query and badge:

1. Import `useQuery` from `@tanstack/react-query` and `fetchComments, JiraComment` from `@/services/jira`.

2. Add a query for comment count (lazy — only fires when commentOpen=true, using `enabled: commentOpen && !!jiraBaseUrl && !!jiraToken`):
```tsx
const { data: comments, isLoading: isLoadingComments } = useQuery({
  queryKey: ['jira-comments', issue.key],
  queryFn: () => fetchComments(jiraBaseUrl, jiraToken, issue.key),
  staleTime: 60_000,
  enabled: commentOpen && !!jiraBaseUrl && !!jiraToken,
})
```

3. Also derive comment count for the badge. To show a count before the panel is opened we need a separate lightweight query. Instead, keep it simple: show the count badge only when `comments` is loaded (after first open). Track in state: `const [commentCount, setCommentCount] = useState<number | null>(null)`. When `comments` data arrives, update: use a `useEffect` watching `comments` — `if (comments) setCommentCount(comments.length)`.

4. Update the comment button JSX to include a badge:
```tsx
<button
  type="button"
  onClick={() => setCommentOpen((prev) => !prev)}
  className="relative text-muted-foreground hover:text-foreground transition-colors"
  aria-label={`Comment on ${issue.key}`}
>
  <MessageCircle className="size-4" />
  {commentCount !== null && commentCount > 0 && (
    <span className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none">
      {commentCount > 99 ? '99+' : commentCount}
    </span>
  )}
</button>
```

5. Pass new props to `InlineComment`:
```tsx
<InlineComment
  issueKey={issue.key}
  isOpen={commentOpen}
  onCancel={() => setCommentOpen(false)}
  onSubmit={(comment) => {
    onCommentSubmit(issue.key, comment)
    setCommentOpen(false)
  }}
  isSubmitting={!!isCommentPending}
  error={commentError}
  existingComments={comments}
  isLoadingComments={isLoadingComments}
/>
```

Note: The `jiraToken` prop on TaskRow is already `string` (not `string | null`) — verify the type and cast if needed (use `jiraToken ?? ''` in the query).
  </action>
  <verify>npx tsc --noEmit -p /Users/mimo/Desktop/Tasker/taskflow/tsconfig.json 2>&1 | grep -E "TaskRow|InlineComment|error TS" | head -20 && cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20</verify>
  <done>TypeScript compiles clean; vitest passes; comment button has a badge showing count after first open; panel shows previous comments before the composer textarea</done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` exits 0 — no type errors across the project
2. `npx vitest run` passes — existing MyTasksTab tests still pass (InlineComment is mocked in tests so new props are backward-compatible)
3. Manual: open My Tasks, click a comment button on a task that has comments — the panel shows the existing comments list, then the composer below
4. Manual: badge appears on button after first panel open (count > 0 cases)
</verification>

<success_criteria>
- Comment button has a numeric badge (red/primary circle) showing count when comments exist
- Clicking button opens a panel: existing comments listed (author, date, body) above a scrollable area, composer textarea below
- New comments can still be submitted via the composer
- No regressions in existing tests
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/15-show-comment-count-on-my-tasks-page-and-/15-SUMMARY.md`
</output>
