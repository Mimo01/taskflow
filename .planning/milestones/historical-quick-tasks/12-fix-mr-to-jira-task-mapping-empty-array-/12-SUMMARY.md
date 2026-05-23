---
phase: quick-12
plan: 01
subsystem: developer-dashboard
tags: [gitlab, mr-linking, tanstack-query, bug-fix]
dependency_graph:
  requires: []
  provides: [fetchProjectMRs, userId-resolved-mr-fetch, shared-gitlab-mrs-cache]
  affects: [MyTasksTab, MrAttentionTab]
tech_stack:
  added: []
  patterns: [TanStack shared cache via matching queryKey, project-level MR pool for Jira-key linking]
key_files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx
decisions:
  - fetchProjectMRs follows same error-handling pattern as fetchAssignedMRs (throws on network/non-OK)
  - MyTasksTab gitlabMrs queryKey now ['gitlab-mrs', gitlabBaseUrl, userId] matching MrAttentionTab
  - Project MR sprint-link bypass added in data useMemo (not queryFn) to keep queryFn pure
  - Pre-existing skeleton test failure confirmed out-of-scope (present before any changes)
metrics:
  duration: 4 min
  completed: 2026-03-13
  tasks: 3
  files_modified: 5
---

# Quick Task 12: Fix MR-to-Jira Task Mapping Empty Array

**One-liner:** Fixed userId=0 reviewer fetch bug and added project-level MR pool so Jira-key-linked MRs appear even when user is not a GitLab assignee/reviewer.

## What Was Built

### Bug 1: userId=0 in reviewer fetch (fixed)

`MyTasksTab` was calling `fetchReviewerMRs(..., 0)` (hardcoded) and using query key `['gitlab-mrs', gitlabBaseUrl]` (missing `userId`). This meant:
- Reviewer MRs were fetched for user ID 0 (wrong — returns empty or garbage)
- MyTasksTab and MrAttentionTab used different cache keys, causing duplicate fetches

Fix: Added `validateGitLab` query (same `useQuery` pattern as MrAttentionTab) to resolve the real user ID. Updated `gitlabMrs` query key to `['gitlab-mrs', gitlabBaseUrl, userId]` and guarded `enabled` with `!!userId`.

### Bug 2: Project-level MRs not included (fixed)

Both tabs only fetched MRs where user was assignee or reviewer. An MR authored by another developer but referencing a user's Jira ticket key would never appear.

Fix: Added `fetchProjectMRs` to `gitlab.ts` (GET `/api/v4/projects/{id}/merge_requests?state=opened&per_page=100`). Both tabs now call it when `activeGitlabProject` is set, and merge results into the pool before deduplication. The existing `linkMRToTask` / `fullLinkMap` logic in MyTasksTab already filters to only sprint-key-matched MRs. In MrAttentionTab, the `data` useMemo was extended to include merged MRs linked to sprint keys (bypassing the reviewer discussion filter).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing test for project MR linking | fd4ca0b | MyTasksTab.test.tsx |
| 1 (GREEN) | fetchProjectMRs + MyTasksTab fixes | d0b1e9a | gitlab.ts, MyTasksTab.tsx |
| 2 | MrAttentionTab project MR pool | d81be7a | MrAttentionTab.tsx, MrAttentionTab.test.tsx |
| 3 | Full suite verification | — | No regressions |

## Test Results

- MyTasksTab: 9/10 pass (1 pre-existing skeleton test failure — out of scope)
- MrAttentionTab: 8/8 pass
- Full suite: 218/220 pass (same 2 pre-existing failures as before, 0 regressions)

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- `taskflow/src/services/gitlab.ts` — fetchProjectMRs exported: FOUND
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — userId + query key fix: FOUND
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — project MRs + sprint bypass: FOUND
- commit fd4ca0b: FOUND
- commit d0b1e9a: FOUND
- commit d81be7a: FOUND

## Self-Check: PASSED
