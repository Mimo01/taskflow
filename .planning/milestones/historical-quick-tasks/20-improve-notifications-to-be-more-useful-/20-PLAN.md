---
phase: quick-20
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/stores/notifications.store.ts
  - taskflow/src/services/notifications.ts
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/notifications/NotificationDetail.tsx
  - taskflow/src/routes/notifications/NotificationRow.test.tsx
autonomous: true
requirements:
  - QUICK-20
must_haves:
  truths:
    - "Each notification shows a type label (Comment mention / Issue update / MR note)"
    - "Each notification's entity title is clickable and opens the URL in the browser"
    - "Jira notifications show priority and labels metadata; GitLab notifications show MR state badge"
    - "Body text in both the row preview and detail panel linkifies HTTP/HTTPS URLs into clickable anchors"
    - "All existing notification service tests still pass"
  artifacts:
    - path: "taskflow/src/stores/notifications.store.ts"
      provides: "Extended NotificationItem interface with url, notificationType, priority, labels, entityState"
    - path: "taskflow/src/services/notifications.ts"
      provides: "Fetchers that populate new fields at capture time"
    - path: "taskflow/src/routes/notifications/NotificationRow.tsx"
      provides: "Row with type label badge, metadata chips, clickable title, linkified preview"
    - path: "taskflow/src/routes/notifications/NotificationDetail.tsx"
      provides: "Detail panel with Open button, linkified full body, metadata"
  key_links:
    - from: "taskflow/src/services/notifications.ts"
      to: "taskflow/src/stores/notifications.store.ts"
      via: "NotificationItem import"
      pattern: "NotificationItem"
    - from: "taskflow/src/routes/notifications/NotificationRow.tsx"
      to: "@tauri-apps/plugin-opener"
      via: "openUrl(item.url)"
      pattern: "openUrl"
---

<objective>
Make notifications richer and more actionable by adding type labels, metadata, clickable links, and linkified body text.

Purpose: Notifications currently show minimal info — no type context, no links, no status. After this task they carry enough information to act on without opening Jira or GitLab separately.
Output: Extended NotificationItem type, populated at fetch time, rendered in updated Row and Detail components.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/20-improve-notifications-to-be-more-useful-/20-CONTEXT.md

<interfaces>
<!-- Current NotificationItem — being extended -->
From taskflow/src/stores/notifications.store.ts:
```typescript
export interface NotificationItem {
  id: string;            // 'jira-comment-{id}' | 'gitlab-note-{id}'
  source: 'jira' | 'gitlab';
  entityTitle: string;   // "PROJ-123: Fix login bug"
  author: string;
  bodyPreview: string;   // first ~80 chars
  fullBody: string;
  createdAt: string;     // ISO 8601
}
```

<!-- New fields to add (all optional for backwards compat with persisted items) -->
```typescript
  url?: string;              // browser-openable URL for the entity
  notificationType?: 'comment-mention' | 'issue-update' | 'mr-note';
  priority?: string;         // Jira: "High" / "Medium" / "Low" etc.
  labels?: string[];         // Jira: issue label names
  entityState?: string;      // GitLab: "opened" | "merged" | "closed"
```

<!-- Tauri opener — already used in SearchResultPanel -->
import { openUrl } from '@tauri-apps/plugin-opener';

<!-- Jira fields currently fetched in fetchIssueUpdates -->
fields=summary,status,assignee,reporter,updated
// Need to also fetch: priority,labels

<!-- GitLab MR shape — mr.state and mr.web_url already available -->
interface GitLabMR {
  state: 'opened' | 'closed' | 'merged' | 'locked';
  web_url: string;
  title: string;
  ...
}

<!-- Jira issue URL pattern (already documented in CONTEXT.md) -->
`${jiraBaseUrl}/browse/${issue.key}`

<!-- Jira comment notification — issue.key available for URL -->
id: `jira-comment-{commentId}` — entityTitle = `${issue.key}: ${summary}`
url = `${base}/browse/${issue.key}`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend NotificationItem type and populate new fields in fetchers</name>
  <files>
    taskflow/src/stores/notifications.store.ts
    taskflow/src/services/notifications.ts
  </files>
  <action>
**In `taskflow/src/stores/notifications.store.ts`:**

Add five optional fields to the `NotificationItem` interface (keep all existing fields, add after `createdAt`):

```typescript
  url?: string;
  notificationType?: 'comment-mention' | 'issue-update' | 'mr-note';
  priority?: string;
  labels?: string[];
  entityState?: string;
```

**In `taskflow/src/services/notifications.ts`:**

The `NotificationItem` interface is duplicated here. Apply the same five optional fields to this local copy too, keeping both in sync.

**fetchIssueUpdates (Query A — Jira issue updates):**

1. Extend the JQL `fields` param to include `priority,labels`:
   `fields=summary,status,assignee,reporter,updated,priority,labels`

2. Extend the inline type annotation to include:
   ```typescript
   priority?: { name: string } | null;
   labels?: string[];
   ```

3. Populate new fields when pushing to results:
   ```typescript
   url: `${base}/browse/${issue.key}`,
   notificationType: 'issue-update',
   priority: issue.fields.priority?.name,
   labels: issue.fields.labels ?? [],
   entityState: undefined,
   ```

**fetchCommentMentions (Query B — comment mentions):**

Populate new fields when pushing to results:
```typescript
url: `${base}/browse/${issue.key}`,
notificationType: 'comment-mention',
priority: undefined,
labels: undefined,
entityState: undefined,
```

**fetchNewGitlabNotes (GitLab MR notes):**

The function already receives `mr: GitLabMR` in scope. Populate new fields:
```typescript
url: mr.web_url,
notificationType: 'mr-note',
priority: undefined,
labels: undefined,
entityState: mr.state,
```

No changes to function signatures or the combined `fetchNewNotifications`. No test changes needed in this task — existing tests don't assert on new optional fields and will continue to pass.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx tsc --noEmit 2>&1 | grep -E "notifications" | head -20; npx vitest run src/services/notifications.test.ts 2>&1 | tail -20</automated>
  </verify>
  <done>NotificationItem has all five new optional fields in both files. Fetchers populate url, notificationType, and entityState/priority/labels correctly. All existing notification service tests pass. TypeScript reports no new errors in notification files.</done>
</task>

<task type="auto">
  <name>Task 2: Update NotificationRow and NotificationDetail with rich UI</name>
  <files>
    taskflow/src/routes/notifications/NotificationRow.tsx
    taskflow/src/routes/notifications/NotificationDetail.tsx
    taskflow/src/routes/notifications/NotificationRow.test.tsx
  </files>
  <action>
**Shared linkify helper — add to BOTH files (or extract to a shared utility if preferred):**

```typescript
function linkifyText(text: string): string {
  return text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="underline text-blue-500 hover:text-blue-700">$1</a>');
}
```

Render linkified text using `dangerouslySetInnerHTML={{ __html: linkifyText(text) }}` on a `<span>` inside the `<pre>` for detail, and inside the preview `<p>` for the row. The linkify function only matches `https?://` URLs — no markdown, no other transformations.

---

**`NotificationRow.tsx` changes:**

Add import at top: `import { openUrl } from '@tauri-apps/plugin-opener';`

Keep the outer `<button onClick={onClick}>` as-is (opens the detail panel). Inside the content div, make the entity title itself also launch the URL when clicked — use a nested `<span>` with its own onClick that calls `openUrl(item.url)` and stops propagation, but ONLY when `item.url` is defined. If `item.url` is undefined, the title remains plain text (backwards compat for persisted items without url).

Type label badge — add between the source icon and the content div, or inline below the entity title. Place it as the first line inside the content div, before the entity title `<p>`:

```tsx
{item.notificationType && (
  <span className="inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground mb-0.5">
    {item.notificationType === 'comment-mention' ? 'Comment mention'
      : item.notificationType === 'issue-update' ? 'Issue update'
      : 'MR note'}
  </span>
)}
```

Metadata chips — add below the body preview line, before the timestamp line:

```tsx
<div className="flex flex-wrap gap-1 mt-0.5">
  {item.priority && (
    <span className="text-xs px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
      {item.priority}
    </span>
  )}
  {item.labels?.map((label) => (
    <span key={label} className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
      {label}
    </span>
  ))}
  {item.entityState && (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${
      item.entityState === 'merged'
        ? 'bg-purple-50 text-purple-700 border-purple-200'
        : item.entityState === 'closed'
        ? 'bg-red-50 text-red-700 border-red-200'
        : 'bg-green-50 text-green-700 border-green-200'
    }`}>
      {item.entityState}
    </span>
  )}
</div>
```

Body preview — replace the plain text `<p>` with a span using `dangerouslySetInnerHTML`:
```tsx
<p className="text-xs text-muted-foreground line-clamp-2">
  <span dangerouslySetInnerHTML={{ __html: linkifyText(item.bodyPreview) }} />
</p>
```

---

**`NotificationDetail.tsx` changes:**

Add import: `import { openUrl } from '@tauri-apps/plugin-opener';`

After the source badge, add type label:
```tsx
{item.notificationType && (
  <span className="ml-2 inline-block text-xs font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
    {item.notificationType === 'comment-mention' ? 'Comment mention'
      : item.notificationType === 'issue-update' ? 'Issue update'
      : 'MR note'}
  </span>
)}
```

Entity title — if `item.url` is defined, make it a clickable element that calls `openUrl(item.url)`:
```tsx
<h3 className="text-sm font-semibold mb-1 pr-6">
  {item.url ? (
    <button
      type="button"
      onClick={() => openUrl(item.url!)}
      className="text-left hover:underline text-blue-600"
    >
      {item.entityTitle}
    </button>
  ) : (
    item.entityTitle
  )}
</h3>
```

After the author/timestamp line, add metadata chips (same pattern as NotificationRow — priority, labels, entityState).

Add an "Open" button below metadata (only when `item.url` is defined):
```tsx
{item.url && (
  <button
    type="button"
    onClick={() => openUrl(item.url!)}
    className="mt-2 mb-2 text-xs px-3 py-1 rounded border hover:bg-muted transition-colors"
  >
    Open in {item.source === 'jira' ? 'Jira' : 'GitLab'} ↗
  </button>
)}
```

Full body — replace `<pre>` content with linkified HTML:
```tsx
<pre className="whitespace-pre-wrap text-sm overflow-auto max-h-48 bg-muted/30 p-2 rounded text-foreground">
  <span dangerouslySetInnerHTML={{ __html: linkifyText(item.fullBody) }} />
</pre>
```

---

**`NotificationRow.test.tsx` updates:**

The `makeItem` factory returns a `NotificationItem` — after the type gains optional fields, the factory object is still valid (optional fields absent). No test changes required UNLESS TypeScript requires them.

Add two new test cases:
1. Renders type label 'Comment mention' when `notificationType: 'comment-mention'` is in item
2. Renders priority chip when `priority: 'High'` is in item

Mock `@tauri-apps/plugin-opener` at top of test file:
```typescript
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }));
```
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/routes/notifications/NotificationRow.test.tsx 2>&1 | tail -25</automated>
  </verify>
  <done>NotificationRow shows type label badge, metadata chips, clickable title (when url present). NotificationDetail shows type label, Open button, clickable title, linkified body. All NotificationRow tests pass (including two new tests). TypeScript compiles cleanly for notification files.</done>
</task>

</tasks>

<verification>
After both tasks:

```bash
cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/notifications.test.ts src/routes/notifications/NotificationRow.test.tsx 2>&1 | tail -30
```

All existing tests pass. TypeScript: `npx tsc --noEmit 2>&1 | grep -c "error TS"` returns 0 (or same count as baseline — pre-existing errors are out of scope per project decisions).
</verification>

<success_criteria>
- NotificationItem has url, notificationType, priority, labels, entityState optional fields
- Jira issue updates: url=browse URL, notificationType='issue-update', priority and labels populated from API
- Jira comment mentions: url=browse URL, notificationType='comment-mention'
- GitLab MR notes: url=mr.web_url, notificationType='mr-note', entityState=mr.state
- NotificationRow renders type label badge and metadata chips for all three types
- Entity title in NotificationRow opens URL on click (without blocking the detail panel open — the title span calls openUrl and stops propagation; the outer button continues to toggle detail)
- NotificationDetail has Open button that calls openUrl, clickable title, type label, metadata chips
- Body preview (row) and full body (detail) linkify HTTP/HTTPS URLs to clickable anchors
- All notification tests pass
</success_criteria>

<output>
After completion, create `.planning/quick/20-improve-notifications-to-be-more-useful-/20-SUMMARY.md`
</output>
