---
phase: quick-19
plan: 19
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/notifications.ts
  - taskflow/src/services/notifications.test.ts
autonomous: true
requirements: [QUICK-19]

must_haves:
  truths:
    - "User receives in-app notifications when any Jira issue they are assigned to is updated"
    - "User receives in-app notifications when any Jira issue they reported is updated"
    - "User receives in-app notifications when any Jira issue they are watching is updated"
    - "Comment-mention notifications still work alongside the new assignee/reporter/watcher notifications"
  artifacts:
    - path: "taskflow/src/services/notifications.ts"
      provides: "Extended Jira JQL covering assignee + reporter + watcher + comment mentions"
    - path: "taskflow/src/services/notifications.test.ts"
      provides: "Tests for the broadened notification fetch"
  key_links:
    - from: "taskflow/src/hooks/useNotificationPolling.ts"
      to: "taskflow/src/services/notifications.ts"
      via: "fetchNewNotifications call — existing callers unchanged"
---

<objective>
Expand Jira notification polling to surface updates on any issue where the user is assignee, reporter, or watcher — not just comment mentions.

Purpose: The current system only fires on comment @-mentions. The user never sees issue status changes, field updates, or comments on their own tasks unless they are explicitly @-mentioned.

Output: A rewritten `fetchNewJiraComments` that queries for ALL recently-updated issues where the user has a stake (assignee OR reporter OR watcher) plus comment activity, deduplicates, and returns `NotificationItem[]` as before. No changes to callers (`useNotificationPolling`) or the store.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@taskflow/src/services/notifications.ts
@taskflow/src/hooks/useNotificationPolling.ts
@taskflow/src/stores/auth.store.ts
</context>

<interfaces>
<!-- Existing public contract — do NOT change the signature of fetchNewNotifications -->

From taskflow/src/services/notifications.ts:
```typescript
export async function fetchNewNotifications(
  jiraBaseUrl: string | null,
  gitlabBaseUrl: string | null,
  tokens: { jira: string | null; gitlab: string | null },
  opts: {
    activeJiraProject: string | null;
    jiraUserDisplayName: string | null;
    jiraUsername: string | null;
    gitlabUserId: number | null;
    mrList: GitLabMR[];
    lastSeenCursor: string | null;
  },
): Promise<NotificationItem[]>
```

From taskflow/src/stores/auth.store.ts:
- `jiraUsername: string | null`   — the Jira username/accountId (Jira DC login name)
- `jiraUserDisplayName: string | null`  — display name for @-mention matching

From useNotificationPolling.ts line 57:
```typescript
lastSeenCursor: store.lastSeenCursor,
```
Cursor is the ISO 8601 timestamp of the last seen notification. Use it as the `updatedDate >=` lower bound.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Broaden fetchNewJiraComments to cover assignee/reporter/watcher updates</name>
  <files>taskflow/src/services/notifications.ts, taskflow/src/services/notifications.test.ts</files>
  <behavior>
    - Test: returns items for issues where `jiraUsername` matches assignee (JQL `assignee = "username"` result)
    - Test: returns items for issues where user is reporter (JQL `reporter = "username"` result)
    - Test: returns items for issues where user is watcher (JQL `watcher = "username"` result)
    - Test: original comment-mention path still produces results (backwards compat)
    - Test: deduplicates when same issue appears in both mention and assignee results
    - Test: returns [] when jiraUsername and jiraUserDisplayName are both null (no identity guard)
  </behavior>
  <action>
Rewrite `fetchNewJiraComments` in `taskflow/src/services/notifications.ts`:

**New JQL strategy — two parallel queries:**

Query A (issue updates — assignee/reporter/watcher):
```
project = {projectKey}
AND (assignee = "{username}" OR reporter = "{username}" OR watcher = "{username}")
AND updatedDate >= "{sinceJql}"
ORDER BY updated DESC
```
Fields: `summary,status,assignee,reporter,updated`
maxResults: 20

For each issue returned, create a NotificationItem:
- id: `jira-issue-${issue.key}-${issue.fields.updated}` (timestamp in id prevents duplication across polls)
- source: `'jira'`
- entityTitle: `${issue.key}: ${issue.fields.summary}`
- author: `${issue.fields.assignee?.displayName ?? 'Unknown'}` (last person to touch it — use `issue.fields.reporter?.displayName` as fallback)
- bodyPreview: `Status: ${issue.fields.status?.name ?? 'Unknown'}` (concise summary of current state)
- fullBody: `Status: ${issue.fields.status?.name ?? 'Unknown'}`
- createdAt: `issue.fields.updated` (ISO 8601)

Query B (comment mentions — existing logic, unchanged):
Keep existing JQL: `project = {projectKey} AND comment ~ "{mentionTarget}" AND updatedDate >= "{sinceJql}"`.
Fields: `summary,comment`
Client-side filter for `[~username]` or `@displayName` in body, newer than cursor.
NotificationItem id: `jira-comment-${comment.id}` (unchanged)

Run both queries with `Promise.allSettled`. Merge and deduplicate (existing `seen Set` logic handles it).

**Guard:** If `username` is null, skip Query A (no identity to filter on). Query B still requires `displayName ?? username` as before — return [] if both null.

**Do NOT change** the function signature of `fetchNewJiraComments` or `fetchNewNotifications`. The opts object already passes both `jiraUsername` and `jiraUserDisplayName`.

In tests (`notifications.test.ts`), use `vi.mock('@tauri-apps/plugin-http', ...)` to mock the `fetch` import. Return mock issues with `fields.status.name`, `fields.updated`, etc. for Query A responses.
  </action>
  <verify>
    <automated>cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/notifications.test.ts --reporter=verbose</automated>
  </verify>
  <done>All notification service tests pass. The broadened JQL runs two queries per poll cycle. Existing callers (useNotificationPolling) require zero changes.</done>
</task>

</tasks>

<verification>
Run: `cd /Users/mimo/Desktop/Tasker/taskflow && npx vitest run src/services/notifications.test.ts`

All tests green. Manually verify by checking the bell icon after a Jira issue assigned to the user is updated (if connected to a live Jira instance).
</verification>

<success_criteria>
- `fetchNewJiraComments` issues two JQL queries per poll: one for assignee/reporter/watcher updates, one for comment mentions
- Both are run with `Promise.allSettled` (failure of one doesn't break the other)
- Deduplication by `id` prevents double notifications
- `fetchNewNotifications` public signature is unchanged — no caller updates needed
- Tests cover the new assignee/reporter/watcher path
</success_criteria>

<output>
After completion, create `.planning/quick/19-i-want-to-ask-how-notifications-work-cur/19-SUMMARY.md`
</output>
