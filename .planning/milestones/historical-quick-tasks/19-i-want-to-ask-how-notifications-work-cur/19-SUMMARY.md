---
phase: quick-19
plan: 19
subsystem: notifications
tags: [jira, notifications, jql, polling]
dependency_graph:
  requires: []
  provides: [broadened-jira-notifications]
  affects: [taskflow/src/services/notifications.ts]
tech_stack:
  added: []
  patterns: [Promise.allSettled dual-query, client-side cursor filtering]
key_files:
  created: []
  modified:
    - taskflow/src/services/notifications.ts
    - taskflow/src/services/notifications.test.ts
decisions:
  - Two-query strategy inside fetchNewJiraComments keeps fetchNewNotifications signature
    unchanged — zero caller updates required
  - Query A (issue updates) guarded by username null-check; Query B (comment mentions)
    guarded by the existing displayName/username null-check
  - jira-issue-{key}-{updated} id format prevents cross-poll duplicates without extra
    deduplication logic (timestamp in id makes each poll cycle unique)
  - Author field uses assignee.displayName with reporter.displayName fallback — covers
    watcher-only issues where assignee is null
  - Pre-existing NOTF-01 tests updated to supply empty-issues mock for new Query A call
    (Rule 1 auto-fix: tests were implicitly relying on single-fetch behavior)
metrics:
  duration: ~7 min
  completed_date: "2026-03-13"
  tasks_completed: 1
  files_changed: 2
---

# Quick Task 19: Broaden Jira Notification Polling Summary

**One-liner:** Two-query JQL strategy surfaces assignee/reporter/watcher issue updates alongside existing comment mentions, with zero caller changes.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| RED | Failing tests for assignee/reporter/watcher broadening | 8b39427 | notifications.test.ts |
| GREEN | Rewrite fetchNewJiraComments with dual-query strategy | 5fd923c | notifications.ts, notifications.test.ts |

## What Was Built

`fetchNewJiraComments` now runs two JQL queries per poll cycle via `Promise.allSettled`:

**Query A — issue updates:**
```
project = {key}
AND (assignee = "{username}" OR reporter = "{username}" OR watcher = "{username}")
AND updatedDate >= "{sinceJql}"
ORDER BY updated DESC
```
- Fields: `summary,status,assignee,reporter,updated`
- Each result produces a `NotificationItem` with `id: jira-issue-{key}-{updated}`
- Skipped entirely when `jiraUsername` is null

**Query B — comment mentions (unchanged logic):**
```
project = {key}
AND comment ~ "{mentionTarget}"
AND updatedDate >= "{sinceJql}"
```
- Client-side filter: `[~username]` or `@displayName` in body
- Each matching comment produces `id: jira-comment-{commentId}`

Both queries run concurrently. Failure of one doesn't prevent the other from returning results. The existing `seen Set` deduplication in `fetchNewNotifications` handles any id collisions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pre-existing NOTF-01 tests for dual-query mock contract**
- **Found during:** GREEN phase (tests ran 15 total, 3 pre-existing failures)
- **Issue:** 3 original comment-mention tests and the merge-and-sort test only mocked one `fetch` call. With two Jira queries now running, the first mock response was consumed by Query A (which silently discarded it as non-matching), leaving Query B with no mock — returning [].
- **Fix:** Added `emptyIssuesResp` mock as the first response in each affected test, so Query A consumes it and Query B receives the intended comment-mention fixture.
- **Files modified:** `taskflow/src/services/notifications.test.ts`
- **Commit:** 5fd923c

## Self-Check: PASSED

- taskflow/src/services/notifications.ts — FOUND
- taskflow/src/services/notifications.test.ts — FOUND
- Commit 8b39427 (RED) — FOUND
- Commit 5fd923c (GREEN) — FOUND
- All 15 tests pass
