# Phase 45: Query Optimization - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 45-query-optimization
**Areas discussed:** Sprint board query split, Backlog parallelization, Sidebar prefetch strategy, Jira DC concurrency limits

---

## Sprint Board Query Split

| Option | Description | Selected |
|--------|-------------|----------|
| Split into two queries | Stories render immediately, subtasks load progressively. Unblocks LOAD-03. | ✓ |
| Keep single query, parallelize siblings only | Only parallelize independent queries alongside combined query. LOAD-03 stays deferred. | |

**User's choice:** Split into two queries (Recommended)
**Notes:** None

### Subtask Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fire immediately after stories resolve | Subtask chunks fire in parallel as soon as stories query returns. | ✓ |
| Wait for board paint, then fire | Render story-only board first, trigger subtask fetches on next tick. | |

**User's choice:** Fire immediately after stories resolve (Recommended)
**Notes:** None

### Board Discovery Caching

| Option | Description | Selected |
|--------|-------------|----------|
| Shared board discovery hook | useBoardId() with staleTime: Infinity. Both sprint board and backlog consume it. | ✓ |
| Keep separate, rely on TanStack cache | Both pages share query key, TanStack deduplicates. No code change. | |

**User's choice:** Shared board discovery hook (Recommended)
**Notes:** None

---

## Backlog Parallelization

### Epic Fetch Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Use shared epic cache | Remove Step 4 from fetchBacklogView, use fetchEpicsBasic cache. | ✓ |
| Keep internal epic batch | fetchBacklogView self-contained, fetches only needed epics by key. | |
| You decide | Claude picks best approach. | |

**User's choice:** Use shared epic cache (Recommended)
**Notes:** None

### Backlog Board Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, use shared useBoardId() | Extract board discovery to shared hook, skip on return visits. | ✓ |
| Keep board discovery internal | fetchBacklogView manages own board discovery. | |

**User's choice:** Yes, use shared useBoardId() (Recommended)
**Notes:** None

---

## Sidebar Prefetch Strategy

### Prefetch Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Hover with 100ms debounce | Prefetch after 100ms hover. Focus triggers immediately for accessibility. | ✓ |
| Hover immediately, no debounce | Prefetch on mouseenter with no delay. More aggressive. | |
| Focus only (keyboard navigation) | Only prefetch on keyboard focus. Conservative. | |

**User's choice:** Hover with 100ms debounce (Recommended)
**Notes:** None

### Routes to Prefetch

| Option | Description | Selected |
|--------|-------------|----------|
| Heavy data routes only | Sprint board, backlog, epics, my tasks, dashboard. | ✓ |
| All sidebar routes | Every sidebar route. Simpler but wastes requests. | |
| You decide | Claude picks optimal set. | |

**User's choice:** Heavy data routes only (Recommended)
**Notes:** None

---

## Jira DC Concurrency Limits

### Concurrency Cap

| Option | Description | Selected |
|--------|-------------|----------|
| Global concurrency limiter at 6 | Shared semaphore caps total in-flight Jira API calls at 6. | ✓ |
| Per-view limit of 3 | Each view gets own cap of 3. No cross-view coordination. | |
| No explicit cap | Rely on browser's ~6 connection limit per origin. | |

**User's choice:** Global concurrency limiter at 6 (Recommended)
**Notes:** None

### Configurability

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed at 6 | Hardcoded, adjust in code if needed. | |
| Dev tools toggle | Granular dev tools setting to adjust concurrency limit. | ✓ |
| You decide | Claude picks approach. | |

**User's choice:** Dev tools toggle
**Notes:** None

---

## Additional User Input

### Pagination Safety
**User concern:** When refactoring queries, ensure no results are dropped. If a query has a limit of 50 and returns 50, there may be more results requiring offset-based pagination.
**Resolution:** Captured as D-10. Existing `fetchAllSearchPages` in `client.ts` already handles this correctly (loops with startAt/maxResults/total). All refactored queries must continue using this helper.

## Claude's Discretion

- Concurrency semaphore implementation (p-limit, custom counter, or TanStack Query built-in)
- Subtask chunk query wiring (useQueries with enabled flag, or manual trigger)
- Prefetch query key composition per route
- Whether useBoardId() is standalone or part of broader useJiraContext
