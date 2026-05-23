---
phase: quick-260518-cqs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/notifications.ts
  - taskflow/src/services/notifications.test.ts
autonomous: true
requirements:
  - QUICK-260518-CQS-01

must_haves:
  truths:
    - "User does not receive Jira issue-update notifications for changes they themselves performed (status / assignee / priority / summary / etc.)"
    - "User does not receive a Jira issue-assignment notification when they assigned the issue to themselves"
    - "User does not receive a Jira comment notification (via Query C 'all comments') for comments they authored themselves, even when only jiraUsername is known and jiraUserDisplayName is null"
    - "User does not receive a GitLab approval notification for an approval performed by themselves"
    - "Existing notifications from OTHER users (assignee changes by others, status changes by others, comments by others, approvals by others) continue to be delivered unchanged"
  artifacts:
    - path: "taskflow/src/services/notifications.ts"
      provides: "Self-author filtering on Jira changelog histories, Jira all-comments fallback filter, and GitLab self-approval filter"
      contains: "history.author"
    - path: "taskflow/src/services/notifications.test.ts"
      provides: "Test coverage proving self-authored events are filtered out"
      contains: "filters out self"
  key_links:
    - from: "fetchIssueUpdates (Query A)"
      to: "displayName / username identity from auth.store"
      via: "skip changelog history entries where history.author.displayName === displayName"
      pattern: "history\\.author\\.displayName === displayName"
    - from: "fetchAllComments (Query C)"
      to: "displayName / username identity from auth.store"
      via: "skip comments where author.displayName === displayName OR (no displayName known and author.name === username)"
      pattern: "comment\\.author"
    - from: "fetchAllGitlabNotifications approvals branch"
      to: "currentUserId from auth.store"
      via: "skip approval entries where entry.user.id === currentUserId"
      pattern: "entry\\.user\\.id === currentUserId"
---

<objective>
Stop the notification feed from surfacing the user's own actions. The Jira changelog (Query A `fetchIssueUpdates`) currently emits an `issue-update` (and possibly `issue-assignment`) notification for ANY changelog history entry on issues where the user is assignee/reporter/watcher — including changes the user made themselves. The Jira "all comments" branch (Query C `fetchAllComments`) only filters self-authored comments by `displayName`, leaking self comments when `displayName` is null but `username` is set. The GitLab approvals branch never filters self-approvals.

Purpose: User reported "In notifications I also get notifications from my own actions. I should only get notifications for actions that someone else does." The notification feed should reflect activity FROM OTHERS only.

Output: Updated `notifications.ts` with three explicit self-author skip conditions plus regression tests in `notifications.test.ts`.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

@taskflow/src/services/notifications.ts
@taskflow/src/services/notifications.test.ts

<interfaces>
<!-- Identity inputs to fetchNewJiraComments / fetchAllGitlabNotifications come from auth.store.ts. -->
<!-- These are the ONLY fields available for self-author detection — do not invent new ones. -->

From taskflow/src/stores/auth.store.ts:
- jiraUserDisplayName: string | null  // Jira myself.displayName, e.g. "John Doe"
- jiraUsername: string | null         // Jira myself.name, e.g. "jdoe"
- gitlabUserId: number | null         // GitLab user.id
- gitlabUsername: string | null       // GitLab user.username

From taskflow/src/services/notifications.ts (existing shapes — DO NOT alter):
- Jira changelog history entry has author.displayName (no username field on history.author)
- Jira comment author has displayName only (no username field in Query B/C shapes)
- GitLab note author has id (filtered correctly already on line 543)
- GitLab approval entry has user.id, user.name, user.username
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Filter self-authored Jira changelog histories and all-comments</name>
  <files>taskflow/src/services/notifications.ts, taskflow/src/services/notifications.test.ts</files>
  <behavior>
    Tests to add in `taskflow/src/services/notifications.test.ts` (new `describe` block "NOTF-self-author filter — Jira"):
    - Test 1 (Query A — changelog by self is skipped): Mock Query A returning one issue whose `changelog.histories` has a single history entry where `history.author.displayName === 'John Doe'` (the current user) with a status change. Mocks for Queries B/C/D return empty. Call `fetchNewNotifications` with `jiraUserDisplayName: 'John Doe'`, `jiraUsername: 'jdoe'`. Assert result has length 0 (no `jira-issue-*` notification emitted).
    - Test 2 (Query A — changelog by someone else still produces notification): Same shape as Test 1 but `history.author.displayName === 'Alice'`. Assert exactly one notification with id matching `^jira-issue-` and `author === 'Alice'`.
    - Test 3 (Query A — self-assignment is skipped): Mock Query A returning a history entry where `history.author.displayName === 'John Doe'` AND assignee item `fromString: null, toString: 'John Doe'`. Assert no `jira-assign-*` notification (the user assigning themselves should NOT notify themselves).
    - Test 4 (Query A — assignment by someone else still produces notification): Same as Test 3 but `history.author.displayName === 'Alice'`. Assert exactly one `jira-assign-*` notification.
    - Test 5 (Query C — self comment skipped via displayName): Existing logic — keep working. Mock Query C returning a comment with `author.displayName === 'John Doe'`, with `jiraUserDisplayName: 'John Doe'`. Assert no `jira-allcomment-*` notification.
    - Test 6 (Query C — self comment skipped when displayName is null but username matches author.name): NEW fallback. Mock Query C comment with `author: { displayName: 'John Doe', name: 'jdoe' }`, call with `jiraUserDisplayName: null, jiraUsername: 'jdoe'`. Note: Jira REST v2 comment author payloads include a `name` field; we add a defensive check. Assert no `jira-allcomment-*` notification.

    Run `npx vitest run src/services/notifications.test.ts` from `taskflow/` — tests must initially RED before implementation, then GREEN after.
  </behavior>
  <action>
    Modify `taskflow/src/services/notifications.ts`:

    1. Inside `fetchIssueUpdates` (Query A), at the top of the `for (const history of histories)` loop (after the `if (toUtcIso(history.created) <= since) continue;` cursor filter), add a self-author skip:
       - If `displayName` is non-null and `history.author.displayName === displayName` → `continue;` (skip the entire history entry, none of its items become change lines, and no self-assignment notification is pushed for it).
       - Rationale: changelog entries have only `displayName` available; `username` is not exposed on `history.author` in Jira REST v2. Falling back to `username` here is not possible without a separate identity probe — but the user always has `displayName` populated when notifications run (see `fetchNewJiraComments` early-return on line 89 — at least one of the two must exist; if only `username` is set, this filter is skipped and the existing `[~username]` filter in Query B is still effective).

    2. Inside `fetchAllComments` (Query C), update the existing self-comment filter on line 371 to also handle the `displayName == null` case. Widen the `author` typedef in this function to include an optional `name` field (`author?: { displayName?: string; name?: string; avatarUrls?: { '48x48'?: string } }`). Replace the single line with:
       - Skip when `displayName` is non-null AND `comment.author?.displayName === displayName`.
       - OR skip when `username` is non-null AND `comment.author?.name === username` (Jira `name` field is the username — see also the JQL `assignee = "${username}"` usage in the same function which proves `username` is the Jira "name").

    3. Update the docstring at the top of `fetchNewJiraComments` (lines 60-80) to note that all four queries skip events authored by the current user.

    Do NOT touch:
    - Query B (`fetchCommentMentions`) — a self-mention is intentional and rare, and the existing mention-text filter already requires a literal `[~username]`/`@displayName` in the body which the user is unlikely to type when commenting as themselves. Leaving Query B unchanged keeps blast radius minimal.
    - Query D (`fetchDueDateReminders`) — these are not user actions, they are time-based reminders. Always relevant to the user.

    Test scaffolding: each new test must mock all four Jira queries (A/B/C/D) per the existing pattern (see test at line 83 — four `.mockResolvedValueOnce` calls). When a query is not under test, return `{ ok: true, status: 200, json: async () => ({ issues: [] }) }`.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/notifications.test.ts</automated>
  </verify>
  <done>
    All existing tests still pass. New self-author filter tests (at least 6 cases described above) all pass. `notifications.ts` lints clean (`npm run lint -- src/services/notifications.ts` from `taskflow/`).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Filter self-authored GitLab approvals</name>
  <files>taskflow/src/services/notifications.ts, taskflow/src/services/notifications.test.ts</files>
  <behavior>
    Tests to add in `taskflow/src/services/notifications.test.ts` (new `describe` block "NOTF-self-author filter — GitLab"):
    - Test 1 (Self-approval is skipped): Mock GitLab notes endpoint returning `[]`. Mock approvals endpoint returning `{ approved_by: [{ user: { id: 1, name: 'Alice', username: 'alice' }, approved_at: '2026-03-12T10:00:00Z' }] }` where `id: 1` matches `gitlabUserId: 1`. Mock pipelines returning `[]`. The MR's `author.id` must equal `currentUserId` so that approvals are fetched at all (existing branch on line 519). Assert no `gitlab-approval-*` notification.
    - Test 2 (Approval by someone else still produces notification): Same as Test 1 but `approved_by[0].user.id === 2` and `gitlabUserId === 1`. Assert exactly one `gitlab-approval-*` notification with `author === 'Alice'`.

    Run `npx vitest run src/services/notifications.test.ts` from `taskflow/`.
  </behavior>
  <action>
    Modify `taskflow/src/services/notifications.ts` inside `fetchAllGitlabNotifications` -> `processMR`, within the approvals branch (lines 590-617):

    Inside `for (const entry of approvedBy)` loop, BEFORE pushing the item, add:
    - `if (entry.user.id === currentUserId) continue;`

    Placement is after the existing `const approvedAt = ...; if (approvedAt <= since) continue;` cursor check (so cursor logic still runs cheaply).

    Do NOT touch the existing self-author filter on the notes branch (line 543 already correctly skips `note.author?.id === currentUserId` and applies to BOTH user notes AND system notes — this is the actor of the action, not the target).

    Do NOT touch the pipeline-failures branch — pipeline failures are CI events, not user actions.
  </action>
  <verify>
    <automated>cd taskflow && npx vitest run src/services/notifications.test.ts</automated>
  </verify>
  <done>
    All existing tests still pass. New GitLab self-approval tests (2 cases) pass. Full notifications test file is green.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    Self-author filters added to Jira changelog (Query A), Jira all-comments (Query C), and GitLab approvals branch. Vitest test suite extended with regression coverage.
  </what-built>
  <how-to-verify>
    1. Launch the app with `cd taskflow && npm run tauri dev`.
    2. Confirm you are logged in to Jira and GitLab and that notification polling is running (settings page > Notifications enabled).
    3. In Jira: pick an issue where you are assignee/reporter/watcher. Make a change YOURSELF — change status, change priority, post a comment. Wait one polling interval (default 60s or whatever your settings show).
    4. Open the notification popover (bell icon). EXPECTED: none of your own actions appear as notifications.
    5. Have a teammate (or use a second Jira account) make an analogous change on the SAME issue. Wait one polling interval. EXPECTED: the teammate's action appears as a notification.
    6. In GitLab: on one of your own MRs, self-approve (if the project allows). Wait one polling interval. EXPECTED: no approval notification appears for your self-approval. A teammate's approval still notifies.
    7. Comments / mentions FROM OTHER users on Jira issues and GitLab MRs must continue to arrive normally.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues</resume-signal>
</task>

</tasks>

<verification>
- `cd taskflow && npx vitest run src/services/notifications.test.ts` — all green
- `cd taskflow && npm run lint -- src/services/notifications.ts` — clean
- Manual smoke per checkpoint above
</verification>

<success_criteria>
- Self-authored Jira status / assignee / priority / summary / etc. changelog events do NOT appear in the notification feed
- Self-assigning an issue to oneself does NOT produce a `jira-assign-*` notification
- Self-authored Jira comments do NOT appear in the all-comments stream (Query C), including when only `jiraUsername` is available and `jiraUserDisplayName` is null
- Self-approvals on one's own GitLab MR do NOT appear in the notification feed
- All previously-passing notification tests still pass
- New regression tests (8 total: 6 Jira + 2 GitLab) all pass
- Activity from OTHER users continues to be surfaced unchanged
</success_criteria>

<output>
Create `.planning/quick/260518-cqs-in-notifications-i-also-get-notification/260518-cqs-SUMMARY.md` when done.
</output>
