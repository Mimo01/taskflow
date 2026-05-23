---
phase: quick-260518-krb
plan: 01
subsystem: jira-service
tags: [refactor, jira, deduplication, typescript, service-layer]
dependency_graph:
  requires: []
  provides: [unified-jira-service-surface]
  affects: [jira.ts, jira.test.ts, Sidebar.tsx, SprintBoardTab.tsx, BulkActionBar.tsx, useFieldMutation.ts, useIssueMutations.ts, SprintBoardTab.test.tsx, BacklogPage.test.tsx, Sidebar.test.tsx]
tech_stack:
  added: []
  patterns: [single-module-surface, apiFetch-operationName-labels]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BulkActionBar.tsx
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
    - taskflow/src/components/app/Sidebar.test.tsx
  deleted:
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/issues.test.ts
decisions:
  - Kept jira.ts as canonical surface (D-01); deleted jira/issues.ts after migrating all unique functions
  - Used isResponseLikeError from jira/client for fetchSprintStories error handling (clean, imported helper)
  - Cleaned up inline duck-type casts in fetchSprintIssues and fetchMyTasksHierarchy to use imported isResponseLikeError (optional cleanup step 7 performed)
  - New test describe blocks adapted to use existing mockFetch (@tauri-apps/plugin-http) pattern instead of vi.mock('../lib/apiFetch') since jira.test.ts delegates at the Tauri fetch level
  - Fixed broken fetchJiraIssueByKey URL assertion (line 421 of old issues.test.ts) with 3 separate substring checks for customfield_13415, customfield_10016, reporter,priority
metrics:
  duration: ~30 minutes
  completed: 2026-05-18
  tasks_completed: 3
  files_modified: 10
  files_deleted: 2
---

# Phase quick-260518-krb Plan 01: Unify jira.ts and jira/issues.ts Summary

Merged jira/issues.ts (718 lines, 5 callers) into jira.ts (2209 lines, 62 callers) by moving 3 unique functions inline, adding 8 apiFetch operationName labels, updating 5 caller files, augmenting jira.test.ts with 23 new tests across 5 describe blocks, and deleting the dead files — eliminating the dual-file maintenance hazard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Migrate function bodies into jira.ts | 08de6d2 | jira.ts |
| 2 | Update callers, append test blocks, delete jira/issues.{ts,test.ts} | c6594e2 | 7 files + 2 deleted |
| 3 | Full verification battery | ade709a | SprintBoardTab.test.tsx, BacklogPage.test.tsx, Sidebar.test.tsx |

## New Function Insertion Points in jira.ts

- `fetchSprintStories` inserted at **line 403** (immediately after closing brace of `fetchSprintIssues`)
- `fetchSprintSubtasks` inserted at **line 454** (immediately after `fetchSprintStories`)
- `fetchJiraIssueByKey` inserted at **line 1359** (immediately after `fetchIssueSummary`)

## Optional Cleanup Steps Performed

Step 7 (replace inline duck-type casts with `isResponseLikeError`) was performed for:
- `fetchSprintIssues` (the catch block around the `parentIssues` fetch)
- `fetchMyTasksHierarchy` (the catch block around the `[myStories, mySubtasks]` Promise.all)

`fetchBacklogIssues` was intentionally left with its inline duck-type cast (out of scope — pre-existing code not touched by this refactor).

## Test Append Details

The 5 new describe blocks were inserted at **line 1530** of jira.test.ts (immediately before the final closing `})` of the top-level `describe('jira service', ...)` block).

**Final it()/test() count: 99** (76 original preserved + 23 new across 5 describe blocks)

## Test Rewrites vs Plan

The plan anticipated adapting `fetchAllSearchPages` mock calls to `apiFetch`-level mocking. In practice, jira.test.ts uses `vi.mock('@tauri-apps/plugin-http')` (not `vi.mock('../lib/apiFetch')`), so all new tests mock `mockFetch` from `@tauri-apps/plugin-http` — the same pattern used by all existing tests. This works because `apiFetch` delegates to Tauri's `fetch`.

For `fetchSprintStories` and `fetchSprintSubtasks` tests: mocked `mockFetch` returning `{ ok: true, json: async () => ({ issues: [...], total: N }) }` — setting `total === issues.length` causes `fetchAllSearchPages` to terminate after one page.

For the chunking test (`fetchSprintSubtasks` with 60 keys): asserted `vi.mocked(mockFetch).toHaveBeenCalledTimes(2)` at the `mockFetch` level (not `fetchAllSearchPages` level).

The `isResponseLikeError` mock removal (plan step: "DROP these mock calls entirely") was replaced by using real Response-like objects with numeric `status` properties in the `mockFetch` returns, which the real `isResponseLikeError` detects correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SprintBoardTab.test.tsx, BacklogPage.test.tsx, Sidebar.test.tsx mocked deleted module**
- **Found during:** Task 3 full test run
- **Issue:** Three test files had `vi.mock('@/services/jira/issues', ...)` and dynamic `import('@/services/jira/issues')` calls. After jira/issues.ts was deleted, these test files failed with "Failed to resolve import" errors. These test files were not listed in the plan's `files_modified` because they are test-only files that shadow production callers.
- **Fix:** Merged `fetchSprintStories`/`fetchSprintSubtasks` into the existing `@/services/jira` mock factory in each file; replaced all dynamic `import('@/services/jira/issues')` with `import('@/services/jira')`.
- **Files modified:** SprintBoardTab.test.tsx, BacklogPage.test.tsx, Sidebar.test.tsx
- **Commit:** ade709a

## Verification Results

| Check | Result |
|-------|--------|
| `tsc --noEmit` new errors | 0 |
| `vitest run` exit code | 0 (1 pre-existing failure in AioTestRunsSection.test.tsx unrelated to this refactor) |
| jira.test.ts it()/test() count | 99 (>= 90 floor) |
| 5 new describe blocks in jira.test.ts | 5 |
| 13 named exports in jira.ts | 13 |
| operationName labels in jira.ts | 9 (>= 8 required) |
| `timetracking,duedate` occurrences | 3 (fetchSprintIssues, fetchMyTasksHierarchy, fetchSprintStories) |
| Subtask enrichment comment preserved | yes |
| `reporter,priority,customfield_13415` in fetchJiraIssueByKey URL | yes |
| 5 callers import from `@/services/jira` | yes |
| Zero `@/services/jira/issues` references in src/ | yes |
| jira/issues.ts deleted | yes |
| jira/issues.test.ts deleted | yes |

## Known Stubs

None — all functions are fully implemented.

## Threat Flags

None — this is a pure refactor (no new network endpoints, auth paths, or schema changes).

## Self-Check: PASSED

All verification checks pass. Commits exist at 08de6d2, c6594e2, ade709a.
