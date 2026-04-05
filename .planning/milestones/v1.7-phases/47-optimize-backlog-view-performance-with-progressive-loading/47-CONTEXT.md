# Phase 47: Optimize Backlog View Performance with Progressive Loading - Context

**Gathered:** 2026-03-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Optimize the backlog view for faster perceived load and smoother scrolling with large issue counts. Split the monolithic `fetchBacklogView` into per-section queries for progressive rendering, fix disabled virtualization with div-based rows, and add per-row epic badge skeletons for complete LOAD-04 compliance. No new features — this is a performance refactor of the existing backlog page.

</domain>

<decisions>
## Implementation Decisions

### Loading Strategy
- **D-01:** Split `fetchBacklogView` into separate per-section queries — active sprint issues, future sprint issues, and backlog (unsprinted) issues. Each section renders independently as its query resolves.
- **D-02:** Sprint sections reuse the shared `jira-sprint-stories` query cache already used by SprintBoardTab. If the user visited the sprint board first, backlog sprint sections render instantly from cache with zero extra API calls.
- **D-03:** The backlog-only section gets its own dedicated query for unsprinted issues (no longer bundled with sprint data).

### Virtualization
- **D-04:** Replace `<table>`/`<tr>` rendering in `VirtualizedBacklogTable` with div-based rows using CSS grid or flex to mimic table layout. This fixes the `position: absolute` on `<tr>` overlap bug that currently forces `useVirtual = false`.
- **D-05:** All sections use the same div-based virtualized table component — no threshold-based conditional virtualization.

### Pagination
- **D-06:** Load all backlog issues upfront (no pagination or infinite scroll), rely on virtualization to keep DOM light. Works well for typical backlog sizes (up to ~500-1000 issues).
- **D-07:** ADVN-02 (infinite scroll) remains deferred — not in scope for this phase.

### LOAD-04 Progressive Epic Loading
- **D-08:** Add per-row Skeleton placeholders in each row's epic column until the `allEpics` query resolves. Replaces the current header-only Skeleton with a more polished per-row progressive feel.
- **D-09:** Once `allEpics` resolves, epic badge skeletons swap to actual epic name/color badges without layout shift.

### Claude's Discretion
- Whether the backlog-only query uses JQL via REST API (`sprint is EMPTY`) or the Agile board backlog endpoint — pick based on reliability and board-level JQL filter preservation
- Exact CSS grid/flex column widths for the div-based table replacement
- Virtualizer configuration (overscan count, estimated row size)
- How to handle the transition from `VirtualizedBacklogTable` to the new div-based component (rename vs new component)
- Whether future sprint sections need their own query or can derive from the board API

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — LOAD-04 (backlog progressive epic loading, currently partial), ADVN-02 (infinite scroll — deferred, NOT in scope)

### Backlog implementation
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Main backlog component with disabled virtualization, monolithic query, section rendering
- `taskflow/src/routes/dashboard/BacklogRow.tsx` — Individual backlog row component (needs epic Skeleton support)
- `taskflow/src/services/jira/backlog.ts` — `fetchBacklogView()` — monolithic query to be split
- `taskflow/src/routes/dashboard/BacklogSkeleton.tsx` — Backlog loading skeleton

### Shared infrastructure
- `taskflow/src/hooks/useBoardId.ts` — Shared board ID hook (Phase 45 D-03)
- `taskflow/src/services/jira/issues.ts` — `fetchSprintStories()`, `fetchSprintSubtasks()` — shared sprint query functions
- `taskflow/src/hooks/useDelayedLoading.ts` — 200ms flicker prevention hook (Phase 44 D-07)
- `taskflow/src/lib/query-constants.ts` — Shared `STALE_TIME_MS` constant

### Prior phase context
- `.planning/phases/44-loading-ux/44-CONTEXT.md` — D-06 (backlog parallel render-as-resolves pattern), D-07 (useDelayedLoading)
- `.planning/phases/45-query-optimization/45-CONTEXT.md` — D-03 (useBoardId), D-04/D-05 (backlog parallelization)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useBoardId()` hook — already extracts board discovery from queries, reusable for backlog-only query if Agile endpoint is chosen
- `useDelayedLoading()` hook — 200ms skeleton delay, apply to each per-section query independently
- `BacklogSkeleton` component — existing skeleton, may need updates for per-section progressive loading
- `Skeleton` primitive from shadcn — used for per-row epic badge placeholders
- `fetchSprintStories()` / `fetchSprintSubtasks()` — shared sprint query functions already cached by SprintBoardTab

### Established Patterns
- TanStack Query with shared query keys for cross-view cache sharing (sprint stories, epics, board ID)
- `useVirtualizer` from `@tanstack/react-virtual` — already imported, just needs div-based container to work
- Section-based rendering with collapsible headers and sticky active sprint header
- Filter application via `useFilterStore` across all sections

### Integration Points
- `VirtualizedBacklogTable` component — primary refactor target (table → div-based)
- `BacklogRow` component — needs epic Skeleton prop for per-row progressive loading
- `fetchBacklogView` in `backlog.ts` — to be split or replaced with per-section query functions
- Shared query cache keys (`jira-sprint-stories`, `jira-epics-basic`) — sprint sections read from these

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

- ADVN-02: Infinite scroll replacing pagination in backlog — remains a future requirement, not addressed in this phase

</deferred>

---

*Phase: 47-optimize-backlog-view-performance-with-progressive-loading*
*Context gathered: 2026-03-31*
