---
status: resolved
trigger: "User never sees any GitLab notifications in the app. Jira notifications work fine."
created: 2026-03-17T00:00:00Z
updated: 2026-03-18T01:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Shared lastSeenCursor stores raw Jira timestamps with non-UTC timezone offsets (e.g. "2026-03-18T13:45:00.123+0100") while GitLab always returns UTC ("2026-03-18T12:45:00.000Z"). String comparison `note.created_at <= since` treats the local-time Jira cursor as a LATER timestamp than the UTC GitLab note, even though they may represent the same or earlier instant. This causes ALL GitLab notes to be incorrectly filtered out as "already seen".
test: Verified by tracing string comparison of Jira +offset timestamps vs GitLab Z timestamps
expecting: Normalizing all timestamps to UTC ISO strings before comparison and storage will fix the filtering
next_action: Await human verification that GitLab notifications now appear

## Symptoms

expected: All GitLab activity (MR comments, approvals, pipeline results, mentions, etc.) should appear as notifications
actual: No GitLab notifications ever appear. Only Jira notifications show up.
errors: None reported
reproduction: Just use the app normally — GitLab notifications never appear
started: Never worked — GitLab notifications have never appeared since the feature was built

## Eliminated

- hypothesis: Cache key mismatch is the sole root cause
  evidence: Cache key was fixed (activeGitlabProject -> gitlabUserId) but GitLab notifications still don't appear. The key now matches, but the data shape is wrong.
  timestamp: 2026-03-17T00:04:00Z

- hypothesis: Cache data shape mismatch is the root cause
  evidence: Shape was fixed (extract .merged from { filtered, merged } object) but GitLab notifications STILL don't appear. The previous fix was correct but insufficient — the cache itself is empty because MR data is only fetched by dashboard components.
  timestamp: 2026-03-18T00:00:00Z

- hypothesis: MR cache empty because gitlab-mrs query only runs on dashboard
  evidence: Direct MR fetch added to notification poller, but GitLab notifications STILL don't appear. MR data is now available but the shared cursor mechanism filters out all GitLab notes.
  timestamp: 2026-03-18T01:00:00Z

## Evidence

- timestamp: 2026-03-17T00:01:00Z
  checked: useNotificationPolling.ts line 90 — cache key used to read MR list
  found: Key is ['gitlab-mrs', gitlabBaseUrl, activeGitlabProject] where activeGitlabProject is a string like "mygroup/myproject"
  implication: This is the key used to look up MR data for GitLab notifications

- timestamp: 2026-03-17T00:02:00Z
  checked: MrHealthPanel.tsx line 31, MyTasksTab.tsx line 92, MrAttentionTab.tsx line 107 — cache keys where MR data is actually stored
  found: All use key ['gitlab-mrs', gitlabBaseUrl, userId] where userId is gitlabUserId (a number)
  implication: The cache keys NEVER match — notification polling always gets [] for mrList

- timestamp: 2026-03-17T00:03:00Z
  checked: fetchNewNotifications line 685 — guard condition for GitLab tasks
  found: Condition is `opts.mrList.length > 0` — when mrList is empty (always, due to key mismatch), all 3 GitLab fetchers (notes, approvals, pipelines) are skipped entirely
  implication: This is the root cause. GitLab notifications are never fetched because the MR list is always empty due to cache key mismatch.

- timestamp: 2026-03-17T00:04:00Z
  checked: MR query return shape in MrHealthPanel (line 42), MyTasksTab (line 106), MrAttentionTab
  found: All return { filtered: GitLabMR[], merged: GitLabMR[] } — an object, not an array
  implication: The cache stores an object, not an array

- timestamp: 2026-03-17T00:04:30Z
  checked: useNotificationPolling.ts line 88-90 — getQueryData type annotation
  found: Type is GitLabMR[] but actual cached data is { filtered, merged }. Object has no .length property, so mrList.length evaluates to undefined, and `undefined > 0` is false.
  implication: Even with the correct cache key, the data shape mismatch means mrList is treated as having zero length, permanently skipping all GitLab fetchers. This is the second (real) root cause.

- timestamp: 2026-03-18T00:00:00Z
  checked: Where gitlab-mrs query runs — MrHealthPanel.tsx, MyTasksTab.tsx, MrAttentionTab.tsx
  found: All are route-specific dashboard components. The query only runs when these components render. useNotificationPolling (line 361 main.tsx) runs globally in AppLayout but reads from cache that only populates on dashboard routes.
  implication: Third compounding bug: even with correct cache key and shape, the cache is EMPTY unless the user has navigated to the dashboard. The notification poller depends on data from a page the user may not have visited.

- timestamp: 2026-03-18T00:00:30Z
  checked: fetchAssignedMRs and fetchReviewerMRs in services/gitlab.ts
  found: Simple API calls to GitLab /merge_requests endpoint. Available for direct use.
  implication: The notification poller should fetch MRs directly instead of reading from cache.

- timestamp: 2026-03-18T01:00:00Z
  checked: Cursor timestamp format difference between Jira and GitLab
  found: Jira returns timestamps with timezone offsets like "2026-03-18T13:45:00.123+0100" (local time). GitLab returns UTC "2026-03-18T12:45:00.000Z". Both represent the SAME instant but string-compare differently. The Jira local-time string "13:45" appears LATER than the GitLab UTC string "12:45" in string comparison, even though they're the same moment.
  implication: This is the FOURTH and final root cause. String comparison in fetchNewGitlabNotes (line 459: `note.created_at <= since`) and other GitLab fetchers incorrectly filters out ALL GitLab notes as "already seen" because the Jira-set cursor with a positive timezone offset has inflated hour/minute digits.

- timestamp: 2026-03-18T01:00:30Z
  checked: All timestamp comparisons across both Jira and GitLab fetchers in notifications.ts
  found: Lines 136, 245, 316, 459, 566, 633 — ALL use raw string comparison (`<=`) for timestamps. Jira-to-Jira comparisons accidentally work because both sides use the same timezone offset. GitLab-to-Jira cursor comparisons are broken because one side is UTC (Z) and the other has an offset (+0000, +0100, etc.). Even +0000 suffix causes issues because "Z" > "+" in ASCII, making GitLab timestamps always appear "newer" — but a positive offset like +0100 inflates the hour digits, making the Jira cursor appear LATER than any GitLab note at the same real instant.
  implication: The fix must normalize all timestamps to proper Date comparisons or normalize to UTC ISO strings.

## Resolution

root_cause: Four compounding bugs: (1) Cache key mismatch (fixed). (2) Cache data shape mismatch (fixed). (3) MR data only fetched from dashboard components (fixed). (4) CRITICAL — Shared polling cursor stores raw Jira timestamps with non-UTC timezone offsets. Jira returns e.g. "2026-03-18T13:45:00.123+0100" while GitLab returns "2026-03-18T12:45:00.000Z". All timestamp comparisons use string `<=` which treats the Jira local-time "13:45" as later than GitLab UTC "12:45" even though they represent the same instant. This causes the GitLab fetcher's cursor guard (`note.created_at <= since`) to skip ALL notes as "already seen".
fix: Added toUtcIso() helper that normalizes any ISO 8601 timestamp to UTC Z-suffix format via new Date(ts).toISOString(). Applied to: (1) all `since` cursor values in every fetcher function, (2) all timestamp comparisons (history.created, comment.updated, note.created_at, pipeline.updated_at, approvedAt), (3) all `createdAt` values stored on NotificationItems (which become the next cursor). This ensures Jira "+0100" offset timestamps and GitLab "Z" timestamps are compared correctly.
verification: TypeScript compiles clean (0 new errors), 15/15 notification service tests pass. Awaiting human verification.
files_changed: [taskflow/src/hooks/useNotificationPolling.ts, taskflow/src/services/notifications.ts]
