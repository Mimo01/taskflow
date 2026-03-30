# Phase 45: Query Optimization - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Sprint board and backlog load faster by eliminating sequential API call chains, sidebar navigation pre-warms the cache via prefetch on hover/focus, and a global concurrency limiter prevents overloading on-premise Jira DC. This phase also splits the sprint board query to enable progressive rendering (unblocking LOAD-03 from Phase 44).

</domain>

<decisions>
## Implementation Decisions

### Sprint Board Query Split
- **D-01:** Split `fetchSprintIssues` into two separate queries — a stories-only query and a subtasks query. Stories render immediately with skeleton placeholders for subtasks. Subtask chunk queries fire immediately after stories resolve (not after paint). This unblocks LOAD-03 (deferred from Phase 44).
- **D-02:** Parallelize all independent sprint board queries: stories query, `fetchActiveSprint`, `fetchEpicsBasic`, and `fetchProjectStatuses` fire simultaneously. `fetchBoardQuickFilters` waits only for board ID (not full activeSprint).

### Shared Board Discovery
- **D-03:** Create a shared `useBoardId()` hook that caches the board discovery result with `staleTime: Infinity` (board ID never changes mid-session). Both sprint board and backlog consume this hook, eliminating the redundant board discovery API call on navigation between views.

### Backlog Parallelization
- **D-04:** Remove the internal epic batch fetch (Step 4) from `fetchBacklogView`. Backlog rows get epic names/colors from the shared `fetchEpicsBasic` query cache instead. Fewer API calls, faster backlog load.
- **D-05:** Extract board discovery from `fetchBacklogView` to use the shared `useBoardId()` hook (D-03). Backlog skips the first sequential call entirely on return visits.

### Sidebar Prefetch
- **D-06:** Add `queryClient.prefetchQuery()` on sidebar nav links with hover (100ms debounce) + focus (immediate, for keyboard accessibility).
- **D-07:** Prefetch heavy data routes only: sprint board, backlog, epics, my tasks, and dashboard. Skip settings, notifications (already polling globally), and lightweight pages.

### Jira DC Concurrency
- **D-08:** Create a global concurrency limiter (semaphore) that caps total in-flight Jira API calls at 6. All parallel queries and subtask chunks go through it.
- **D-09:** Add a dev tools toggle to adjust the concurrency limit (following the existing granular dev tools toggle pattern from Phase 42). Default: 6.

### Pagination Safety
- **D-10:** All refactored queries MUST continue using `fetchAllSearchPages` (or equivalent pagination loop) to avoid dropping results. No query may use a single `maxResults` call without checking `total`. This is a non-negotiable constraint — the existing pagination helper handles it correctly and must be preserved through all refactoring.

### Claude's Discretion
- Exact implementation of the concurrency semaphore (p-limit, custom counter, or TanStack Query built-in)
- How to wire subtask chunk queries as dependent queries (useQueries with enabled flag, or manual trigger)
- Prefetch query key composition for each route
- Whether useBoardId() is a standalone hook or part of a broader useJiraContext

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — QOPT-01 (sprint board parallel queries), QOPT-02 (backlog parallel queries), QOPT-03 (sidebar prefetch on hover/focus), LOAD-03 (sprint board progressive loading — deferred from Phase 44, unblocked by D-01)

### Sprint board
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Sprint board component with 5 queries (stories, activeSprint, quickFilters, epicsBasic, projectStatuses)
- `taskflow/src/services/jira/issues.ts` — `fetchSprintIssues()` — current combined stories+subtasks query to be split
- `taskflow/src/services/jira/sprints.ts` — `fetchActiveSprint()` — 2 sequential API calls (board discovery → sprint fetch) to be refactored
- `taskflow/src/services/jira/board-config.ts` — `fetchBoardQuickFilters()` — depends on board ID

### Backlog
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Backlog page with fetchBacklogView + supporting queries
- `taskflow/src/services/jira/backlog.ts` — `fetchBacklogView()` — internal sequential steps to be refactored (board discovery → issues → epic batch removal)

### Pagination
- `taskflow/src/services/jira/client.ts` — `fetchAllSearchPages()` — paginated search helper that MUST be preserved through refactoring; `SUBTASK_CHUNK_SIZE = 50`, `PAGE_SIZE = 200`

### Sidebar
- `taskflow/src/components/app/Sidebar.tsx` — Sidebar component (static NavLink, no prefetch currently)
- `taskflow/src/components/app/sidebar-items.ts` — Nav item definitions (11 items)

### Query client
- `taskflow/src/main.tsx` — QueryClient setup (staleTime: 5min, gcTime: Infinity, retry: 1)
- `taskflow/src/lib/query-constants.ts` — `POLL_INTERVAL_MS = 60_000`, `STALE_TIME_MS = 30_000`

### Dev tools pattern
- `taskflow/src/routes/settings/` — Existing granular dev tools toggles (request logging, response body, operation profiling, waterfall, retention) — pattern for concurrency limit toggle

### Prior phase context
- `.planning/phases/43-cache-correctness/43-CONTEXT.md` — gcTime: Infinity, staleTime 5min, route-aware polling, useIsActiveRoute()
- `.planning/phases/44-loading-ux/44-CONTEXT.md` — Skeleton screens, useDelayedLoading, LOAD-03 deferred pending query split

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchAllSearchPages()` (client.ts): Paginated search helper — handles startAt/maxResults/total loop correctly. Must be used for all search queries.
- `useIsActiveRoute()` hook (Phase 43): Route-aware polling enable/disable — can be used to gate prefetch behavior
- `Skeleton` component + `useDelayedLoading` hook (Phase 44): Ready to show subtask loading skeletons when D-01 split is implemented
- `useQueries()` pattern (main.tsx pinned tabs): Existing parallel query pattern for batch fetching — reference for subtask chunk queries
- Granular dev tools toggles (Phase 42): Pattern for adding concurrency limit setting

### Established Patterns
- TanStack Query with `useQuery`/`useInfiniteQuery` across 52 files
- Polling hooks in AppLayout (global) vs route components (view-scoped)
- `SUBTASK_CHUNK_SIZE = 50` for chunked subtask fetching
- Two-query subtask strategy: parent JQL + subtask JQL (already sequential, to be split into independent queries)

### Integration Points
- `SprintBoardTab.tsx` — split fetchSprintIssues into stories query + subtask queries
- `BacklogPage.tsx` — remove internal epic batch, use shared fetchEpicsBasic cache
- `sprints.ts` / `backlog.ts` — extract board discovery into shared useBoardId() hook
- `Sidebar.tsx` — add onMouseEnter/onFocus handlers with prefetchQuery
- `main.tsx` or new utility — global concurrency semaphore
- Dev tools settings — new concurrency limit toggle

</code_context>

<specifics>
## Specific Ideas

- Pagination safety is non-negotiable: user specifically flagged that queries with limits must check total and fetch all pages (existing `fetchAllSearchPages` already does this correctly)
- Sprint board progressive rendering: stories appear first with subtask skeletons, subtasks fill in progressively — leverages Phase 44 skeleton infrastructure

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-query-optimization*
*Context gathered: 2026-03-30*
