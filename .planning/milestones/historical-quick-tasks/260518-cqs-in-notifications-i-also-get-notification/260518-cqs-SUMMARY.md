---
phase: quick-260518-cqs
plan: 01
subsystem: notifications
tags: [notifications, jira, gitlab, self-filter, tdd]
dependency_graph:
  requires: []
  provides: [self-author-filter-notifications]
  affects: [taskflow/src/services/notifications.ts]
tech_stack:
  added: []
  patterns: [TDD red-green, cursor-filter, self-author skip]
key_files:
  modified:
    - taskflow/src/services/notifications.ts
    - taskflow/src/services/notifications.test.ts
decisions:
  - "Query A: filter by history.author.displayName only — username is not exposed on changelog history.author in Jira REST v2"
  - "Query C: primary displayName filter + username fallback via author.name for when jiraUserDisplayName is null"
  - "GitLab approvals: skip entry.user.id === currentUserId after the cursor check so the cheap time filter still runs first"
  - "Query B (mentions) intentionally left unchanged — self-mention is rare and intentional"
  - "Query D (due-date reminders) intentionally left unchanged — time-based, not user actions"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-18"
  tasks_completed: 2
  files_modified: 2
---

# Phase quick-260518-cqs Plan 01: Self-Author Notification Filter Summary

**One-liner:** Three explicit self-author skip conditions added to Jira changelog (Query A), Jira all-comments fallback (Query C), and GitLab approvals — backed by 8 new regression tests (6 Jira + 2 GitLab).

## What Was Built

Users no longer receive notifications from their own actions. Three guard conditions were added to `notifications.ts`:

**Query A — Jira changelog (`fetchIssueUpdates`):**
Inside the `for (const history of histories)` loop, after the cursor check, a new guard skips any history entry where `history.author.displayName === displayName`. This suppresses both `jira-issue-*` change notifications and `jira-assign-*` self-assignment notifications in a single check.

**Query C — Jira all-comments (`fetchAllComments`):**
The existing `displayName` self-comment filter was extended with a username fallback. When `jiraUserDisplayName` is null but `jiraUsername` is set, comments where `comment.author.name === username` are now also skipped (Jira REST v2 returns a `name` field on comment authors containing the username).

**GitLab approvals (`processMR` approvals branch):**
Inside the `for (const entry of approvedBy)` loop, after the cursor check, `if (entry.user.id === currentUserId) continue` skips self-approvals.

## Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Pre-existing (15 tests) | 15 | PASS |
| NOTF-self-author filter — Jira (6 new) | 6 | PASS |
| NOTF-self-author filter — GitLab (2 new) | 2 | PASS |
| **Total** | **23** | **ALL GREEN** |

## TDD Gate Compliance

- RED commit: `07d972c` (Jira tests), `6104e38` (GitLab tests)
- GREEN commit: `6d25647` (Jira implementation), `aaab65f` (GitLab implementation)

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `07d972c` | test | RED — 6 Jira self-author filter failing tests |
| `6d25647` | feat | GREEN — Query A and Query C self-author filters |
| `6104e38` | test | RED — 2 GitLab self-approval failing tests |
| `aaab65f` | feat | GREEN — GitLab approvals self-filter |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — changes are purely client-side filter logic with no new network surface.

## Self-Check: PASSED

- `taskflow/src/services/notifications.ts` — modified, exists
- `taskflow/src/services/notifications.test.ts` — modified, exists
- Commit `07d972c` — verified
- Commit `6d25647` — verified
- Commit `6104e38` — verified
- Commit `aaab65f` — verified
- 23 tests green
