---
phase: quick-260316-wbp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/jira.ts
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
autonomous: true
requirements: [COMMENT-LAYOUT, COMMENT-EDIT-DELETE]

must_haves:
  truths:
    - "Comment composer is sticky at the bottom of the issue detail, always visible"
    - "Comments display oldest-first (chronological) in bordered cards with avatar, author name, and relative timestamp"
    - "Three-dot menu appears only on comments authored by the current user"
    - "User can edit own comment inline (textarea replaces body, save/cancel)"
    - "User can delete own comment after confirming in a dialog"
    - "Edit and delete call Jira REST API (PUT/DELETE on /rest/api/2/issue/{key}/comment/{id})"
  artifacts:
    - path: "taskflow/src/services/jira.ts"
      provides: "updateComment and deleteComment API functions"
      exports: ["updateComment", "deleteComment"]
    - path: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      provides: "Redesigned comment section with sticky composer, card layout, edit/delete"
      contains: "jiraUserDisplayName"
    - path: "taskflow/src/routes/dashboard/CommentComposer.tsx"
      provides: "Comment composer (unchanged API, used in sticky footer)"
  key_links:
    - from: "IssueDetailContent.tsx"
      to: "jira.ts updateComment/deleteComment"
      via: "useMutation calls"
      pattern: "updateComment|deleteComment"
    - from: "IssueDetailContent.tsx"
      to: "auth.store.ts jiraUserDisplayName"
      via: "useAuthStore selector"
      pattern: "useAuthStore.*jiraUserDisplayName"
---

<objective>
Redesign the comment section on the issue detail page to be more intuitive: sticky composer at bottom, bordered comment cards with author/timestamp headers, and edit/delete capabilities for own comments via a 3-dot menu.

Purpose: Current comment UX has the composer above the thread (counterintuitive), no visual separation between comments, and no ability to edit/delete. This makes the comment experience feel unfinished.

Output: Fully functional comment section with sticky composer, card-style comments, and edit/delete for own comments backed by Jira REST API.
</objective>

<execution_context>
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Desktop/Tasker/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/260316-wbp-make-comment-section-on-issue-detail-mor/260316-wbp-CONTEXT.md

<interfaces>
<!-- Key types and contracts the executor needs -->

From taskflow/src/services/jira.ts:
```typescript
export interface JiraComment {
  id: string;
  author: { displayName: string; name?: string };
  body: string;
  created: string; // ISO 8601
  updated: string;
}

export async function postComment(baseUrl: string, token: string, issueKey: string, body: string): Promise<void>;
// Pattern: apiFetch('jira', url, { method, headers: { Authorization: `Bearer ${token}` }, body })
```

From taskflow/src/stores/auth.store.ts:
```typescript
// Current Jira user identity — use to match against comment.author.displayName
jiraUserDisplayName: string | null;
jiraUsername: string | null;
// Access: useAuthStore((s) => s.jiraUserDisplayName)
```

From taskflow/src/routes/dashboard/CommentComposer.tsx:
```typescript
interface CommentComposerProps {
  issueKey: string;
  jiraBaseUrl: string;
}
// Has formatting toolbar (Bold, Italic, Code, List) + Textarea + submit mutation
// Invalidates query key: ['jira-issue-detail', issueKey, jiraBaseUrl]
```

From taskflow/src/routes/dashboard/IssueDetailContent.tsx:
```typescript
// Comments extracted as: issue.fields.comment?.comments ?? []
// relativeTime(iso: string): string — already exists, reuse for card timestamps
// WikiRenderer used for comment body rendering with attachmentMap + userMap
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add updateComment and deleteComment to Jira service</name>
  <files>taskflow/src/services/jira.ts</files>
  <action>
Add two new exported async functions after the existing `postComment` function:

1. `updateComment(baseUrl, token, issueKey, commentId, body)` — PUT to `/rest/api/2/issue/${issueKey}/comment/${commentId}` with JSON body `{ body }`. Same error handling pattern as postComment (catch network errors, throw on non-2xx). Returns void.

2. `deleteComment(baseUrl, token, issueKey, commentId)` — DELETE to `/rest/api/2/issue/${issueKey}/comment/${commentId}`. Same error handling pattern. Returns void.

Both functions follow the exact same pattern as `postComment`:
- Use `apiFetch('jira', url, { method, headers: { Authorization: \`Bearer ${token}\`, 'Content-Type': 'application/json' }, body? })`
- Catch block throws `Cannot reach ${baseUrl}` message
- Non-2xx throws descriptive error with status code
- For DELETE, Content-Type header is not needed (no body), but include it for consistency or omit — either is fine.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && npx tsc --noEmit --project taskflow/tsconfig.json 2>&1 | tail -5</automated>
  </verify>
  <done>updateComment and deleteComment exported from jira.ts, TypeScript compiles cleanly</done>
</task>

<task type="auto">
  <name>Task 2: Redesign comment section — sticky composer, card layout, edit/delete menu</name>
  <files>taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailPage.tsx</files>
  <action>
Restructure the comment section in IssueDetailContent.tsx with these changes:

**Layout restructure — sticky composer at bottom:**
- The comment section currently renders inline in the scrollable content. Restructure IssueDetailContent so the comment thread and composer are separated:
  - The main content (title, description, subtasks, action buttons) scrolls normally
  - The comment section at the bottom has: scrollable comment thread + sticky composer pinned to the bottom of the left column
- In IssueDetailPage.tsx, the left column div (`<div className="flex-1 overflow-auto p-6">`) needs to become a flex column: the IssueDetailContent scrolls, and the CommentComposer is sticky at the bottom outside the scroll.
- Approach: Extract the comment thread + composer out of IssueDetailContent's return. Instead, have IssueDetailContent render everything EXCEPT comments. Then in IssueDetailPage.tsx, render the comment section separately below IssueDetailContent within the left column, with the composer in a sticky bottom div.
- Left column structure becomes:
  ```
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="flex-1 overflow-auto p-6">
      <IssueDetailContent ... />  {/* no comments */}
      {/* Comment thread */}
      <section className="mt-6 pb-4">
        <h3>Comments ({count})</h3>
        <div className="space-y-3 mt-3">
          {comments oldest-first in cards}
        </div>
      </section>
    </div>
    {/* Sticky composer */}
    <div className="border-t p-4 bg-background shrink-0">
      <CommentComposer issueKey={issueKey} jiraBaseUrl={jiraBaseUrl} />
    </div>
  </div>
  ```

**Comment cards (oldest first, NOT reversed):**
- Remove the `.reverse()` call — render chronologically (oldest first)
- Each comment in a bordered card: `rounded-lg border bg-card p-3 space-y-2`
- Card header: flex row with author displayName (font-medium text-sm) + relative timestamp (text-xs text-muted-foreground) + 3-dot menu (if own comment)
- Card body: WikiRenderer rendering the comment body (same as current)

**Own-comment detection:**
- Import `useAuthStore` and read `jiraUserDisplayName`
- A comment is "own" when `comment.author.displayName === jiraUserDisplayName`
- Pass `jiraUserDisplayName` down from IssueDetailPage or read directly in the comment section

**3-dot menu (own comments only):**
- Use lucide `MoreVertical` icon (size-4) in a button, positioned at the right end of the card header
- On click, show a small dropdown with "Edit" and "Delete" options
- Use a simple useState-based popover: `showMenuId` state tracks which comment's menu is open. Click outside or selecting an option closes it.
- Position: absolute, right-0, top of the button, with `bg-popover border rounded-md shadow-md py-1` styling
- Each option: `px-3 py-1.5 text-sm hover:bg-accent cursor-pointer w-full text-left`
- "Delete" option in `text-destructive`

**Edit mode:**
- State: `editingCommentId: string | null` and `editText: string`
- When "Edit" clicked: set editingCommentId to comment.id, editText to comment.body
- In edit mode, replace the WikiRenderer body with a Textarea (same component from ui/textarea) pre-filled with the comment body
- Show Save and Cancel buttons below the textarea
- Save: call `updateComment` via useMutation (import from jira.ts). On success, invalidate `['jira-issue-detail', issueKey, jiraBaseUrl]` query, clear editing state.
- Cancel: clear editingCommentId

**Delete with confirmation:**
- When "Delete" clicked: use `window.confirm('Delete this comment? This cannot be undone.')` — simple confirm per user decision (not a modal)
- If confirmed: call `deleteComment` via useMutation. On success, invalidate the issue detail query.

**Mutations setup:**
- Import `useMutation, useQueryClient` from @tanstack/react-query
- Import `readSecret` from @/services/stronghold
- Import `updateComment, deleteComment` from @/services/jira
- Both mutations follow the same pattern as CommentComposer: read token from stronghold, call API, invalidate on success
- Show inline error text (text-xs text-destructive) if mutation fails, below the relevant card

**Props changes:**
- IssueDetailContent no longer renders the comment section — remove the `<section>` with comments and CommentComposer from its return
- Remove the CommentComposer import from IssueDetailContent
- The comment rendering logic moves to IssueDetailPage.tsx (or a new CommentThread component extracted inline)
- IssueDetailPage needs: `comments` array (from issue.fields.comment.comments), `attachmentMap`, `userMap` — either pass these as props or compute in IssueDetailPage. Simplest: compute in IssueDetailPage since it already has `issue`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker && npx tsc --noEmit --project taskflow/tsconfig.json 2>&1 | tail -10</automated>
  </verify>
  <done>
- Comment composer is sticky at the bottom of the left column, visible without scrolling
- Comments render oldest-first in bordered cards with author + relative timestamp header
- 3-dot menu appears only on own comments (matched via jiraUserDisplayName from auth store)
- Edit replaces comment body with textarea inline, Save calls PUT API and refreshes
- Delete shows window.confirm, then calls DELETE API and refreshes
- TypeScript compiles cleanly
  </done>
</task>

</tasks>

<verification>
1. Open any issue detail page in the app
2. Verify comment composer is sticky at the bottom, always visible
3. Verify comments are in chronological order (oldest first) in bordered cards
4. Verify own comments show 3-dot menu; other users' comments do not
5. Click Edit on own comment — verify inline textarea with save/cancel
6. Click Delete on own comment — verify confirmation dialog appears
7. TypeScript compiles: `npx tsc --noEmit --project taskflow/tsconfig.json`
</verification>

<success_criteria>
- Sticky bottom composer always visible without scrolling to bottom of thread
- Comments in bordered cards, chronological order, with author + timestamp
- Edit/delete only on own comments via 3-dot menu
- Edit saves to Jira API (PUT), delete removes via Jira API (DELETE)
- Query invalidation refreshes comment data after edit/delete
</success_criteria>

<output>
After completion, create `.planning/quick/260316-wbp-make-comment-section-on-issue-detail-mor/260316-wbp-SUMMARY.md`
</output>
