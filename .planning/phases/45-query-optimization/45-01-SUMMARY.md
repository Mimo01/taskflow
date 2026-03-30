---
phase: 45-query-optimization
plan: "01"
subsystem: jira-services
tags: [query-optimization, concurrency, sprint-board, backlog, tdd]
dependency_graph:
  requires: []
  provides:
    - getJiraLimit/setJiraConcurrencyLimit (concurrency semaphore)
    - useBoardId hook (cached board ID with staleTime: Infinity)
    - fetchSprintStories (parent-only sprint query)
    - fetchSprintSubtasks (chunked subtask query)
    - fetchBoardId service function
    - fetchBacklogView accepts boardId parameter
  affects:
    - taskflow/src/services/jira/client.ts (getJiraLimit wired into fetchAllSearchPages)
    - taskflow/src/services/jira/backlog.ts (signature changed: boardId parameter added)
    - taskflow/src/services/jira/types.ts (BacklogViewData epicNames/epicColors optional)
tech_stack:
  added:
    - p-limit@7.3.0 (concurrency semaphore)
  patterns:
    - TDD (RED → GREEN for all 3 tasks)
    - p-limit singleton with no-op guard for same-value updates
    - staleTime: Infinity for board ID caching
    - fetchAllSearchPages used for all new queries (D-10 pagination safety)
key_files:
  created:
    - taskflow/src/lib/concurrency.ts
    - taskflow/src/lib/concurrency.test.ts
    - taskflow/src/hooks/useBoardId.ts
    - taskflow/src/hooks/useBoardId.test.ts
  modified:
    - taskflow/src/services/jira/client.ts (getJiraLimit import + fetchAllSearchPages wrap)
    - taskflow/src/services/jira/sprints.ts (fetchBoardId added)
    - taskflow/src/services/jira/issues.ts (fetchSprintStories + fetchSprintSubtasks added)
    - taskflow/src/services/jira/issues.test.ts (new test blocks added)
    - taskflow/src/services/jira/backlog.ts (boardId param, board discovery removed, epic batch removed)
    - taskflow/src/services/jira/backlog.test.ts (updated + new tests)
    - taskflow/src/services/jira/types.ts (BacklogViewData epicNames/epicColors made optional)
    - taskflow/package.json (p-limit added)
decisions:
  - "fetchSprintIssues kept as deprecated thin wrapper (backward compat for fetchMyTasksHierarchy)"
  - "BacklogViewData epicNames/epicColors made optional (not removed) for backward compat with existing consumers"
  - "fetchBoardId placed in sprints.ts (near existing board discovery logic) rather than a new board.ts"
  - "epicColorFieldKey removed from fetchBacklogView parameter list (only used in removed epic batch)"
metrics:
  duration: "~7 minutes"
  completed: "2026-03-30"
  tasks_completed: 3
  tasks_total: 3
  files_created: 4
  files_modified: 8
  tests_added: 22
  tests_total_passing: 142
requirements-completed: [QOPT-01, QOPT-02]
---

# Phase 45 Plan 01: Service Layer Infrastructure for Query Parallelization Summary

**One-liner:** p-limit concurrency semaphore (cap 6), useBoardId hook (staleTime: Infinity), sprint issues split into fetchSprintStories + fetchSprintSubtasks, fetchBacklogView refactored to accept boardId and remove internal epic batch — all service building blocks for Plan 02's parallel query wiring.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Concurrency limiter + useBoardId hook + install p-limit | 6ce0aed | concurrency.ts, concurrency.test.ts, useBoardId.ts, useBoardId.test.ts, client.ts, sprints.ts, package.json |
| 2 | Split fetchSprintIssues into fetchSprintStories + fetchSprintSubtasks | 9bc83c8 | issues.ts, issues.test.ts |
| 3 | Refactor fetchBacklogView to accept boardId and remove epic batch | e936696 | backlog.ts, backlog.test.ts, types.ts |

## What Was Built

### Task 1: Concurrency Infrastructure
- `taskflow/src/lib/concurrency.ts`: Singleton p-limit instance (default 6 concurrent calls). `getJiraLimit()` returns the active limiter; `setJiraConcurrencyLimit(n)` updates it with a no-op guard to avoid recreating when unchanged.
- Wired into `fetchAllSearchPages` in `client.ts`: every paginated search call now flows through the semaphore.
- `fetchBoardId()` extracted to `sprints.ts`: standalone function for board discovery, used by `useBoardId` hook.
- `taskflow/src/hooks/useBoardId.ts`: TanStack Query hook with `staleTime: Infinity` and `queryKey: ['jira-board-id', projectKey, jiraBaseUrl]` for project-scoped caching.

### Task 2: Sprint Issue Split
- `fetchSprintStories()`: Extracts the parent-only query (JQL: `issuetype not in subtaskIssueTypes()`). Same error handling as the original `fetchSprintIssues`. Default `assignedToMe=false` for sprint board use case.
- `fetchSprintSubtasks()`: Extracts the chunked subtask query with `Promise.all` over `SUBTASK_CHUNK_SIZE=50` chunks. Returns `[]` immediately when parentKeys is empty. Chunk failures return `[]` silently.
- `fetchSprintIssues()` preserved as a `@deprecated` thin wrapper calling both new functions, maintaining backward compatibility for `fetchMyTasksHierarchy`.

### Task 3: Backlog View Refactor
- `fetchBacklogView()` signature now has `boardId: number | null` as the 4th positional parameter.
- Board discovery (Step 1) removed — `boardId` comes from the caller (`useBoardId` hook).
- Epic batch fetch (Step 4) removed — callers use the shared `fetchEpicsBasic` query cache (D-04).
- `epicColorFieldKey` removed from parameters (was only used in the removed epic batch).
- `BacklogViewData` type: `epicNames?` and `epicColors?` are now optional for backward compatibility with consumers that already guard with `?? new Map()`.

## Test Coverage

All 3 tasks implemented with full TDD (RED → GREEN):
- 8 new tests for concurrency limiter and useBoardId hook
- 9 new tests for fetchSprintStories and fetchSprintSubtasks
- 5 new/updated tests for fetchBacklogView (boardId, no discovery, no epicNames)
- Total: 142 tests passing across all jira services (0 failures)

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no stub patterns or placeholder data in this plan's changes.

## Self-Check: PASSED

- [x] taskflow/src/lib/concurrency.ts exists
- [x] taskflow/src/lib/concurrency.test.ts exists
- [x] taskflow/src/hooks/useBoardId.ts exists
- [x] taskflow/src/hooks/useBoardId.test.ts exists
- [x] commit 6ce0aed exists (Task 1)
- [x] commit 9bc83c8 exists (Task 2)
- [x] commit e936696 exists (Task 3)
- [x] getJiraLimit() wired in client.ts
- [x] fetchSprintStories and fetchSprintSubtasks exported from issues.ts
- [x] fetchBacklogView accepts boardId parameter
- [x] BacklogViewData has epicNames? and epicColors? (optional)
- [x] 142 tests passing, 0 failures
