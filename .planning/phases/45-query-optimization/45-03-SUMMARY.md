---
phase: 45-query-optimization
plan: "03"
subsystem: ui-components
tags: [query-optimization, sidebar-prefetch, backlog, boardId-chain, tanstack-query]
dependency_graph:
  requires:
    - 45-01 (fetchBoardId in sprints.ts, fetchBacklogView in backlog.ts with boardId param)
    - 45-02 (Sidebar prefetch infrastructure: queryClient, jiraToken, prefetchForPath, PREFETCH_ROUTES)
  provides:
    - Sidebar backlog prefetch with boardId chain: jira-board-id fetchQuery -> jira-backlog-view prefetchQuery
  affects:
    - taskflow/src/components/app/Sidebar.tsx
tech_stack:
  added: []
  patterns:
    - queryClient.fetchQuery for jira-board-id (staleTime: Infinity) chained to prefetchQuery for jira-backlog-view
    - Silent .catch() on prefetch chain — failures never surface to user
key_files:
  created: []
  modified:
    - taskflow/src/components/app/Sidebar.tsx (boardId-chained backlog prefetch)
key-decisions:
  - "queryClient.fetchQuery (not prefetchQuery) used for jira-board-id because we need the resolved value to pass as boardId to fetchBacklogView; fetchQuery returns data, prefetchQuery returns void"
  - "jira-backlog-view prefetch key ['jira-backlog-view', activeJiraProject, jiraBaseUrl] — no boardId in key, matches BacklogPage exactly (boardId only in queryFn)"
  - "staleTime: Infinity on board-id fetchQuery — after first visit board ID resolves instantly from cache with zero network cost"
patterns-established:
  - "Two-step prefetch chain pattern: fetchQuery for dependency (staleTime: Infinity) -> .then() -> prefetchQuery for main query"
requirements-completed: [QOPT-03]
duration: 10min
completed: 2026-03-30
---

# Phase 45 Plan 03: Backlog Prefetch BoardId Chain Summary

**Sidebar backlog prefetch wired with boardId chain: queryClient.fetchQuery on jira-board-id (staleTime: Infinity) resolves the board ID, then chains prefetchQuery for jira-backlog-view — completing QOPT-03 for all heavy sidebar routes.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-30T12:20:00Z
- **Completed:** 2026-03-30T12:31:14Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Added imports for `fetchBoardId` (from `@/services/jira/sprints`) and `fetchBacklogView` (from `@/services/jira/backlog`) to Sidebar.tsx
- Replaced the placeholder comment "skip prefetch for backlog-view itself" with a real chained prefetch
- Hovering the Backlog sidebar link now first resolves boardId via `queryClient.fetchQuery` (instant from cache with staleTime: Infinity after first visit), then fires `prefetchQuery` for `jira-backlog-view` with the resolved boardId
- Silent `.catch()` swallows board discovery failures without surfacing errors to the user
- QOPT-03 now fully satisfied: all 5 heavy routes in PREFETCH_ROUTES have real prefetch logic

## Task Commits

1. **Task 1: Chain boardId resolution into backlog prefetch in Sidebar** - `b245a8e` (feat)

## Files Created/Modified

- `taskflow/src/components/app/Sidebar.tsx` - Added fetchBoardId/fetchBacklogView imports and boardId-chained backlog prefetch in `/backlog` branch of prefetchForPath

## Decisions Made

- Used `queryClient.fetchQuery` (not `prefetchQuery`) for `jira-board-id` because we need the resolved data value — `prefetchQuery` returns void and cannot chain
- Prefetch key for jira-backlog-view is `['jira-backlog-view', activeJiraProject, jiraBaseUrl]` (no boardId) — matches BacklogPage.tsx line 194 exactly; boardId is only passed in queryFn
- `staleTime: Infinity` on the board-id fetchQuery matches the useBoardId hook's policy — board IDs never change mid-session

## Deviations from Plan

### Auto-fixed Issues

None planned — the worktree was behind main and missing 45-01/45-02 commits. Resolved by merging main into the worktree branch (fast-forward) before applying the 45-03 change. This is normal parallel agent behavior, not a plan deviation.

None - plan executed exactly as written (after baseline sync).

## Issues Encountered

The worktree was initialized from the v1.6.3 baseline (pre-Phase 45) and was missing 45-01 and 45-02 commits. Resolved by merging main into the worktree (fast-forward merge, no conflicts) before applying 45-03 changes. After merge, Sidebar.tsx had all 45-02 prefetch infrastructure in place and only needed the 45-03 boardId chain added.

## Next Phase Readiness

- All 5 PREFETCH_ROUTES now have real prefetch logic: /sprint-board, /dashboard, /epics (via epics-basic), /backlog (via epics-basic + boardId-chained backlog-view), /my-tasks (skipped — complex internal logic)
- QOPT-03 fully satisfied
- Phase 45 complete — all query optimization requirements (QOPT-01 through QOPT-03, LOAD-03) delivered across Plans 01-03

## Known Stubs

None — no stub patterns or placeholder data in this plan's changes.

---
*Phase: 45-query-optimization*
*Completed: 2026-03-30*

## Self-Check: PASSED

- [x] taskflow/src/components/app/Sidebar.tsx contains `jira-backlog-view` (backlog prefetch key present)
- [x] taskflow/src/components/app/Sidebar.tsx contains `fetchBoardId` import
- [x] taskflow/src/components/app/Sidebar.tsx contains `fetchBacklogView` import
- [x] taskflow/src/components/app/Sidebar.tsx contains `queryClient.fetchQuery(` with `'jira-board-id'`
- [x] taskflow/src/components/app/Sidebar.tsx contains `.then((boardId)` chain
- [x] taskflow/src/components/app/Sidebar.tsx contains `.catch(` silent error handling
- [x] taskflow/src/components/app/Sidebar.tsx backlog-view key is `['jira-backlog-view', activeJiraProject, jiraBaseUrl]` (no boardId)
- [x] taskflow/src/components/app/Sidebar.tsx does NOT contain "skip prefetch for backlog-view itself"
- [x] TypeScript compiles with 0 errors
- [x] 817 tests passing, 0 failures
- [x] commit b245a8e exists (Task 1)
- [x] 45-03-SUMMARY.md created at .planning/phases/45-query-optimization/
