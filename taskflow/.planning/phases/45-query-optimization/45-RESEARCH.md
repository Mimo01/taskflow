# Phase 45: Query Optimization - Research

**Researched:** 2026-03-30
**Domain:** TanStack Query parallelization, Jira service layer refactoring, sidebar prefetch, concurrency limiting
**Confidence:** HIGH

## Summary

Phase 45 addresses three performance bottlenecks: (1) sequential API call chains on sprint board load, (2) an internal epic batch fetch inside `fetchBacklogView` that duplicates work already done by the shared `fetchEpicsBasic` cache, and (3) sidebar nav links that fire data fetches only on click rather than on hover. The skeleton infrastructure from Phase 44 is already wired into `VirtualizedSwimlanes` — the `subtasksLoading` prop accepts a boolean and renders `<Skeleton>` placeholders in subtask cells — but it is always `false` because `fetchSprintIssues` returns stories and subtasks in a single combined query. Splitting that query unblocks LOAD-03.

The sprint board currently fires five queries, but the most expensive one — `fetchSprintIssues` — blocks the other four from seeing cache data sooner. The fix is to break it into two independent TanStack Query entries: a fast stories-only query that renders swimlane headers immediately, and dependent per-chunk subtask queries that fill in the cards progressively. Separately, `fetchActiveSprint` contains its own sequential board discovery step (two API calls internally), as does `fetchBacklogView` (one call internally). A shared `useBoardId()` hook with `staleTime: Infinity` deduplicates that call across both views.

A global concurrency semaphore (6 slots) prevents the parallelized queries and subtask chunks from overwhelming the on-premise Jira DC connection pool. The sidebar prefetch is straightforward: `queryClient.prefetchQuery()` on `onMouseEnter` (debounced 100ms) and `onFocus` (immediate) using the same query keys the destination views use.

**Primary recommendation:** Split `fetchSprintIssues` at the service layer, extract board discovery into a shared hook, add prefetch to Sidebar nav links, and introduce a `p-limit` semaphore wrapped around `fetchAllSearchPages` calls in the refactored service functions.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Split `fetchSprintIssues` into two separate queries — a stories-only query and a subtasks query. Stories render immediately with skeleton placeholders for subtasks. Subtask chunk queries fire immediately after stories resolve (not after paint). This unblocks LOAD-03 (deferred from Phase 44).
- **D-02:** Parallelize all independent sprint board queries: stories query, `fetchActiveSprint`, `fetchEpicsBasic`, and `fetchProjectStatuses` fire simultaneously. `fetchBoardQuickFilters` waits only for board ID (not full activeSprint).
- **D-03:** Create a shared `useBoardId()` hook that caches the board discovery result with `staleTime: Infinity` (board ID never changes mid-session). Both sprint board and backlog consume this hook, eliminating the redundant board discovery API call on navigation between views.
- **D-04:** Remove the internal epic batch fetch (Step 4) from `fetchBacklogView`. Backlog rows get epic names/colors from the shared `fetchEpicsBasic` query cache instead. Fewer API calls, faster backlog load.
- **D-05:** Extract board discovery from `fetchBacklogView` to use the shared `useBoardId()` hook (D-03). Backlog skips the first sequential call entirely on return visits.
- **D-06:** Add `queryClient.prefetchQuery()` on sidebar nav links with hover (100ms debounce) + focus (immediate, for keyboard accessibility).
- **D-07:** Prefetch heavy data routes only: sprint board, backlog, epics, my tasks, and dashboard. Skip settings, notifications (already polling globally), and lightweight pages.
- **D-08:** Create a global concurrency limiter (semaphore) that caps total in-flight Jira API calls at 6. All parallel queries and subtask chunks go through it.
- **D-09:** Add a dev tools toggle to adjust the concurrency limit (following the existing granular dev tools toggle pattern from Phase 42). Default: 6.
- **D-10:** All refactored queries MUST continue using `fetchAllSearchPages` (or equivalent pagination loop) to avoid dropping results. No query may use a single `maxResults` call without checking `total`. This is a non-negotiable constraint — the existing pagination helper handles it correctly and must be preserved through all refactoring.

### Claude's Discretion
- Exact implementation of the concurrency semaphore (p-limit, custom counter, or TanStack Query built-in)
- How to wire subtask chunk queries as dependent queries (useQueries with enabled flag, or manual trigger)
- Prefetch query key composition for each route
- Whether useBoardId() is a standalone hook or part of a broader useJiraContext

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| QOPT-01 | Sprint board loads faster by parallelizing independent API calls (sprint metadata + quick filters fetched simultaneously) | D-01 stories/subtasks split + D-02 parallel fire for activeSprint, epicsBasic, projectStatuses; quickFilters unblocked by shared useBoardId() |
| QOPT-02 | Backlog loads faster by parallelizing independent queries where dependency chains allow | D-04 removes internal epic batch from fetchBacklogView; D-05 extracts board discovery into shared useBoardId() |
| QOPT-03 | User experiences pre-warmed cache when clicking sidebar navigation (data prefetched on hover/focus) | D-06 prefetchQuery on onMouseEnter + onFocus; D-07 limits prefetch to heavy routes only |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.90.21 (installed) | Query management, prefetchQuery, useQueries | Already in project; v5 API is the target |
| p-limit | 7.3.0 (latest npm) | Concurrency semaphore | ESM, zero-dep, battle-tested; ideal for capping Promise concurrency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | (installed) | Unit tests for new hooks and service functions | All new service functions and the semaphore need tests |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| p-limit | Custom semaphore counter | p-limit is simpler, well-tested, already available on npm; custom counter is fine but adds test surface |
| p-limit | TanStack Query `networkMode` | TQ does not expose a concurrency cap for query execution; it is not the right tool here |
| p-limit | p-queue | p-queue adds priority queuing — unnecessary for this use case; p-limit is lighter |

**Installation:**
```bash
npm install p-limit
```
p-limit 7.3.0 is the latest (verified via `npm view p-limit version`).

---

## Architecture Patterns

### Recommended Project Structure
New files this phase introduces:
```
src/
├── hooks/
│   └── useBoardId.ts          # Shared board discovery hook (D-03)
├── lib/
│   └── concurrency.ts         # Global p-limit semaphore (D-08/D-09)
├── services/jira/
│   ├── issues.ts              # fetchSprintStories(), fetchSprintSubtasks() split from fetchSprintIssues
│   └── backlog.ts             # fetchBacklogView() without Step 4 epic batch + accepts boardId param
```

### Pattern 1: Shared `useBoardId()` hook
**What:** A standalone hook that issues one board discovery API call and caches the result with `staleTime: Infinity`. Returns `{ boardId, isLoading }`. Both `SprintBoardTab` and `BacklogPage` call it; the second caller hits cache.

**When to use:** Any view that needs board ID before firing a board-scoped query.

**Current state:** Both `fetchActiveSprint` and `fetchBacklogView` contain internal board discovery (`apiFetch` to `/rest/agile/1.0/board?projectKeyOrId=...`). These are inlined — they do not use TanStack Query and are not shared.

**Implementation approach:**
```typescript
// src/hooks/useBoardId.ts
export function useBoardId(
  jiraBaseUrl: string | null,
  jiraToken: string | null,
  projectKey: string | null,
): { boardId: number | null; isLoading: boolean } {
  const { data: boardId, isLoading } = useQuery({
    queryKey: ['jira-board-id', projectKey, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl!, jiraToken!, projectKey!),
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraToken && !!projectKey,
  });
  return { boardId: boardId ?? null, isLoading };
}
```
`fetchBoardId` is a new thin service function extracted from the board-discovery step currently duplicated in `fetchActiveSprint` and `fetchBacklogView`.

### Pattern 2: Split stories/subtasks into two TanStack Query entries
**What:** `fetchSprintIssues` currently returns `[...parentIssues, ...subtasks]` in a single `Promise`. After the split, `SprintBoardTab` has two separate `useQuery` calls — one for stories (fast), one for subtasks (dependent on stories resolving).

**When to use:** LOAD-03 progressive rendering requires subtask loading state to be separately observable.

**Current state:**
```typescript
// SprintBoardTab.tsx — current: single combined query
const { data } = useQuery({
  queryKey: ['jira-issues', 'sprint-board', activeJiraProject, ...],
  queryFn: () => fetchSprintIssues(..., false, ...),
  ...
});
// subtasksLoading is always false — data contains both stories + subtasks
```

**After split:**
```typescript
// Query 1: stories only (no enabled dependency on boardId — fires immediately)
const { data: stories, isLoading: storiesLoading } = useQuery({
  queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
  queryFn: () => fetchSprintStories(jiraBaseUrl!, jiraToken!, activeJiraProject!, ...),
  refetchInterval: POLL_INTERVAL_MS,
  staleTime: STALE_TIME_MS,
  enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});

// Query 2: subtasks for all resolved parent keys
const parentKeys = (stories ?? [])
  .filter(i => !i.fields.issuetype.subtask)
  .map(i => i.key);

const { data: subtasks, isLoading: subtasksLoading } = useQuery({
  queryKey: ['jira-sprint-subtasks', activeJiraProject, jiraBaseUrl, parentKeys],
  queryFn: () => fetchSprintSubtasks(jiraBaseUrl!, jiraToken!, parentKeys),
  staleTime: STALE_TIME_MS,
  enabled: isActive && !!jiraBaseUrl && !!jiraToken && parentKeys.length > 0,
});
```
`subtasksLoading` is now a real boolean — passes directly into `VirtualizedSwimlanes` which already renders `<Skeleton>` when it is true.

**Important:** The existing `BacklogPage` has a query with key `['jira-issues', 'sprint-board', ...]` that reads the combined stories+subtasks cache for filter purposes. After the split, this key changes. BacklogPage will need to read from the new `jira-sprint-stories` cache and combine with `jira-sprint-subtasks` cache, or the filter logic adapts to use the two separate caches.

### Pattern 3: Sidebar prefetch with debounce
**What:** Sidebar `NavLink` elements get `onMouseEnter` (debounced 100ms) and `onFocus` (immediate) handlers that call `queryClient.prefetchQuery()` with the same query keys the destination view uses.

**Current state:** `Sidebar.tsx` uses React Router `NavLink` with no event handlers — just `to` and `className`. No queryClient access.

**Pattern (heavy routes only — D-07):**
```typescript
// Sidebar.tsx
const queryClient = useQueryClient();

function usePrefetch(path: string) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      prefetchForPath(queryClient, path, credentials);
    }, 100);
  };
  const onMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  const onFocus = () => {
    prefetchForPath(queryClient, path, credentials);
  };
  return { onMouseEnter, onMouseLeave, onFocus };
}
```

The `prefetchForPath` function maps route paths to their primary query keys and calls `queryClient.prefetchQuery`. For sprint board, this means prefetching `jira-sprint-stories`, `jira-active-sprint`, `jira-epics-basic`, and `project-statuses`. For backlog, prefetch `jira-backlog-view` and `jira-epics-basic`.

### Pattern 4: p-limit concurrency semaphore
**What:** A module-level `p-limit` instance caps total in-flight Jira HTTP requests at `maxConcurrency` (default 6, adjustable via dev tools). All calls that go through `fetchAllSearchPages` wrap their inner `apiFetch` call with the limiter.

**Semaphore placement:** A new `src/lib/concurrency.ts` module exports a single `jiraConcurrencyLimit` instance. The `fetchAllSearchPages` function in `client.ts` wraps the `apiFetch` call with the limiter. This is the single control point — all Jira search calls go through it.

```typescript
// src/lib/concurrency.ts
import pLimit from 'p-limit';

// Configurable limit — set by dev tools toggle (D-09), default 6
let _limit = pLimit(6);
let _current = 6;

export function getJiraLimit() {
  return _limit;
}

export function setJiraConcurrencyLimit(n: number) {
  if (n !== _current) {
    _limit = pLimit(n);
    _current = n;
  }
}
```

```typescript
// client.ts — fetchAllSearchPages wraps apiFetch
import { getJiraLimit } from '../../lib/concurrency';
// ...
const response = await getJiraLimit()(() =>
  apiFetch('jira', url, { headers }, 'Search Issues')
);
```

### Anti-Patterns to Avoid
- **Wrapping at the useQuery level:** Adding a semaphore at the React Query layer (e.g., in `queryFn`) would work, but wrapping at the `apiFetch`/`fetchAllSearchPages` level is lower and catches all call paths including non-query direct calls.
- **Using `staleTime >= POLL_INTERVAL_MS` for any polled query:** Documented invariant in `query-constants.ts` — would silently disable polling.
- **Using a single `maxResults` call without checking total:** D-10 prohibition. The `fetchAllSearchPages` helper already handles pagination correctly; all refactored service functions must continue to call it.
- **Recreating p-limit instance on every render:** Module-level singleton avoids this. The `setJiraConcurrencyLimit` function creates a new instance only when the value changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrency capping | Custom Promise queue with counter | `p-limit` | p-limit handles edge cases (rejection propagation, pending count, clearance) and is 0-dependency |
| Hover debounce | setTimeout in component body without cleanup | `useRef` + `clearTimeout` in `onMouseLeave` | Must cancel on leave to avoid stale prefetch after fast mouse-over; inline setTimeout without ref leaks |
| Pagination | Single `maxResults=200` call | `fetchAllSearchPages` | Already handles total > 200 correctly; do not bypass |
| Board discovery | New board API calls in each view | `useBoardId()` hook | Shared cache with `staleTime: Infinity` means second caller is free |

---

## Current Query Dependency Chains (Audit)

### Sprint Board — Current (Sequential Bottleneck)

```
jiraToken available
│
├── useQuery(['jira-issues', 'sprint-board', ...])    ← fetchSprintIssues
│     internally:
│       1. fetchAllSearchPages (stories JQL)           ← WAIT ~800ms
│       2. Promise.all(chunk subtask fetches)          ← WAIT ~400ms
│     Total: ~1200ms before any data
│
├── useQuery(['jira-epics-basic', ...])               ← fires immediately (independent)
├── useQuery(['jira-active-sprint', ...])             ← fires immediately
│     internally: board discovery + sprint fetch     ← 2 sequential calls
│
└── useQuery(['jira-board-quickfilters', boardId])   ← BLOCKED until activeSprint resolves
      boardId = activeSprint?.originBoardId
      (waits for activeSprint, which itself has 2 sequential internal calls)
```

**Problem:** The `boardId` for quick filters comes from `activeSprint?.originBoardId`. Since `fetchActiveSprint` makes 2 sequential calls internally (board discovery → sprint), `boardQuickFilters` waits for both. With D-03 (`useBoardId()` hook), `boardId` is available as soon as board discovery completes — before the sprint fetch — so quick filters unblock faster.

### Sprint Board — After Phase 45

```
jiraToken available
│
├── useBoardId()                                       ← fires immediately (~200ms)
│     queryKey: ['jira-board-id', ...]
│     staleTime: Infinity (never re-fetches after first load)
│
├── useQuery(['jira-sprint-stories', ...])             ← fires immediately
│     fetchSprintStories — stories-only JQL
│     renders swimlane headers as soon as it resolves
│
├── useQuery(['jira-sprint-subtasks', ..., parentKeys])  ← enabled when stories.length > 0
│     fetchSprintSubtasks — subtask chunk queries via p-limit
│     subtasksLoading=true until resolved → Skeleton in cells
│
├── useQuery(['jira-active-sprint', ...])             ← fires immediately
│     fetchActiveSprint still has internal 2-call sequence
│     BUT boardId from useBoardId() is already available for quickFilters
│
├── useQuery(['jira-board-quickfilters', boardId])   ← enabled: boardId from useBoardId()
│     no longer waits for full activeSprint
│
├── useQuery(['jira-epics-basic', ...])              ← fires immediately
└── useQuery(['project-statuses', ...])              ← fires immediately
```

### Backlog — Current (Sequential Steps)

```
fetchBacklogView (single service function):
  Step 1: board discovery (apiFetch)                  ← sequential
  Step 2: Promise.all([active sprint issues, future sprint issues])
  Step 3: fetchAllSearchPages (backlog JQL)
  Step 4: fetchAllSearchPages (epic batch)            ← duplicates fetchEpicsBasic cache
```

`fetchActiveSprint` is also called separately from `BacklogPage` as a second `useQuery`, duplicating the board discovery in Step 1.

### Backlog — After Phase 45

```
useBoardId()                                          ← shared cache, likely already warm
  ↓
fetchBacklogView(boardId: number, ...)               ← accepts boardId, skips Step 1
  Step 2: Promise.all([active, future sprint issues])
  Step 3: fetchAllSearchPages (backlog JQL)
  Step 4: REMOVED — epic names/colors from fetchEpicsBasic cache
  Returns: { sprints, backlog }  (no epicNames/epicColors)

BacklogPage renders epic badges from allEpics query cache (already has jira-epics-basic query)
```

**BacklogViewData type change:** `epicNames` and `epicColors` fields removed from the return type (or made optional). `BacklogPage` already queries `fetchEpicsBasic` separately — it builds `epicNames`/`epicColors` maps from `allEpics` data. The `BacklogRow` component receives these maps as props from `BacklogPage`, not from `backlogView`.

---

## Common Pitfalls

### Pitfall 1: Subtask query key includes parentKeys array
**What goes wrong:** If `parentKeys` is used directly in the query key as `[...parentKeys]`, any re-render that produces a new array reference triggers a new query fetch even when parent keys have not changed.
**Why it happens:** TanStack Query deep-compares query key arrays, so using a sorted stable array (or a stable serialized string) avoids unnecessary refetches.
**How to avoid:** Sort `parentKeys` before including in query key. TanStack Query v5 deep-compares arrays, so `['PROJ-1', 'PROJ-2']` === `['PROJ-1', 'PROJ-2']` — no issue if derived from a stable source. But confirm sorted order to avoid `['PROJ-2', 'PROJ-1']` vs `['PROJ-1', 'PROJ-2']` treating same data as different keys.
**Warning signs:** Network tab shows subtask fetches re-firing on every render.

### Pitfall 2: p-limit instance recreation invalidates in-flight requests
**What goes wrong:** If `pLimit(n)` is called during a render cycle, in-flight requests from the old limiter instance continue running outside the new limit's accounting.
**Why it happens:** p-limit tracks concurrency per-instance. Recreating the instance creates a fresh counter.
**How to avoid:** Module-level singleton in `src/lib/concurrency.ts`. Only `setJiraConcurrencyLimit()` creates a new instance, and only when the value actually changes.
**Warning signs:** Concurrency limit changes in dev tools do not take effect until all current requests finish.

### Pitfall 3: fetchBacklogView epic removal breaks BacklogPage epicNames display
**What goes wrong:** `BacklogPage` currently reads `backlogView.epicNames` and `backlogView.epicColors` and passes them to `VirtualizedBacklogTable` → `BacklogRow`. Removing Step 4 from `fetchBacklogView` leaves these maps empty.
**Why it happens:** The transition assumes `allEpics` (from `jira-epics-basic` query) is already populated — but on cold load the two queries fire in parallel and `allEpics` may not be ready when `backlogView` resolves.
**How to avoid:** `BacklogPage` already queries `fetchEpicsBasic` separately and builds its own `epicNames`/`epicColors` maps from `allEpics`. The `VirtualizedBacklogTable` `epicsLoading` prop already shows a skeleton when `allEpicsPending` is true. The data connection is already correct — removing Step 4 just means the backlog rows show the epic column skeleton momentarily, exactly as already designed.
**Warning signs:** Epic column permanently blank after removing Step 4.

### Pitfall 4: useBoardId() staleTime: Infinity + project switch
**What goes wrong:** If the user changes `activeJiraProject` in settings (mid-session project switch), the cached board ID for the old project remains in cache and is served to the new project's queries.
**Why it happens:** `staleTime: Infinity` prevents re-fetch; the old board ID stays fresh forever.
**How to avoid:** The query key includes `projectKey` and `jiraBaseUrl` — `['jira-board-id', projectKey, jiraBaseUrl]`. A project switch changes `projectKey`, so TanStack Query treats it as a new query and fetches fresh. `staleTime: Infinity` is per-key, not global. This is safe.
**Warning signs:** None expected — this is correct behavior by design.

### Pitfall 5: BacklogPage ['jira-issues', 'sprint-board', ...] query key after split
**What goes wrong:** `BacklogPage` currently has a `useQuery` with key `['jira-issues', 'sprint-board', ...]` to access the combined stories+subtasks for filter/status purposes. After the split, that key no longer exists (replaced by `jira-sprint-stories` + `jira-sprint-subtasks`).
**Why it happens:** The BacklogPage reads from the SprintBoardTab's query cache by sharing the same query key — a deliberate cross-view cache sharing pattern.
**How to avoid:** Update BacklogPage to read from `['jira-sprint-stories', ...]` and optionally `['jira-sprint-subtasks', ...]`. The `subtaskStatusMap` build logic in BacklogPage needs to read from the new key. Alternatively, keep a single `jira-issues-sprint` key that returns stories only, and the subtask key is separate.
**Warning signs:** Status filter in BacklogPage stops showing subtask statuses.

### Pitfall 6: Sidebar queryClient access requires being inside QueryClientProvider
**What goes wrong:** `Sidebar.tsx` does not currently call `useQueryClient()`. Adding it works because `Sidebar` is rendered inside `AppLayout` which is inside `QueryClientProvider`.
**Why it happens:** No issue — just needs the import and hook call.
**How to avoid:** Verify `useQueryClient()` is called inside the component body, not at module level.

### Pitfall 7: Prefetch staleTime must be <= default staleTime
**What goes wrong:** `prefetchQuery` options with `staleTime: Infinity` mean the prefetched data never triggers a real fetch when the route loads — but if `staleTime` is too short, the prefetched data expires before the user clicks.
**Why it happens:** Prefetch fires up to ~5 seconds before click. With default `staleTime: 5 * 60 * 1000` (5 minutes), data is fresh at click time.
**How to avoid:** Use the same `staleTime` values in prefetch as in the destination component's `useQuery` calls.

---

## Code Examples

Verified patterns from existing codebase:

### useQueries pattern (for subtask chunks as parallel queries)
From `main.tsx` pinned queries:
```typescript
// Source: taskflow/src/main.tsx lines 165-177
const pinnedQueries = useQueries({
  queries: pinnedKeys.map((issueKey) => ({
    queryKey: ['jira-pinned-summary', issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) throw new Error('No credentials');
      return fetchIssueSummary(jiraBaseUrl, token, issueKey);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraConnected,
  })),
});
```
The subtask chunk queries can follow this exact same `useQueries` pattern with `parentKeys` chunks as the input array.

### Dependent query with enabled flag (for subtasks depending on stories)
From `SprintBoardTab.tsx` quickFilters query:
```typescript
// Source: taskflow/src/routes/dashboard/SprintBoardTab.tsx lines 553-558
const boardId = activeSprint?.originBoardId;
const { data: boardQuickFilters } = useQuery({
  queryKey: ['jira-board-quickfilters', boardId],
  queryFn: () => fetchBoardQuickFilters(jiraBaseUrl!, jiraToken!, boardId!),
  staleTime: 5 * 60 * 1000,
  enabled: !!jiraBaseUrl && !!jiraToken && !!boardId,
});
```
The same `enabled: condition && dependency !== undefined` pattern applies for the subtasks query enabled by `parentKeys.length > 0`.

### Dev tools toggle pattern (for concurrency limit)
From `DebugModeSection.tsx` — existing granular toggle structure:
```typescript
// Source: taskflow/src/routes/settings/DebugModeSection.tsx lines 87-95
<label className="flex items-center justify-between gap-4 cursor-pointer">
  <p className="text-sm font-medium">Request logging</p>
  <input
    type="checkbox"
    aria-label="Request logging"
    checked={requestLogging}
    onChange={(e) => setRequestLogging(e.target.checked)}
    className="h-4 w-4 accent-primary shrink-0"
  />
</label>
```
The concurrency limit toggle uses a `<Select>` (like the `retentionLimit` selector) rather than a checkbox, since it is a numeric value.

### fetchAllSearchPages signature (must be preserved in all refactored callers)
```typescript
// Source: taskflow/src/services/jira/client.ts lines 57-96
export async function fetchAllSearchPages(
  baseSearchUrl: string,
  headers: Record<string, string>,
): Promise<JiraIssue[]>
// Usage: every search query MUST use this, never a raw single-page fetch
```

### prefetchQuery call pattern
TanStack Query v5 `prefetchQuery` is available on the `QueryClient` instance:
```typescript
queryClient.prefetchQuery({
  queryKey: ['jira-sprint-stories', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey],
  queryFn: () => fetchSprintStories(jiraBaseUrl!, jiraToken!, activeJiraProject!, ...),
  staleTime: STALE_TIME_MS,
});
```
`prefetchQuery` is a no-op if the query is already fresh (within staleTime). It returns a Promise but callers do not need to await it for prefetch use.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single combined fetchSprintIssues | Split fetchSprintStories + fetchSprintSubtasks | Phase 45 | Enables LOAD-03 progressive rendering |
| Board discovery duplicated in each service function | Shared useBoardId() hook | Phase 45 | Eliminates redundant API call on nav between sprint board and backlog |
| Epic batch inside fetchBacklogView | fetchEpicsBasic shared cache | Phase 45 | Removes one sequential step from backlog load |
| No prefetch on nav | Sidebar hover/focus prefetch | Phase 45 | Cache pre-warms before click |
| Unlimited parallel Jira calls | p-limit semaphore (6 slots) | Phase 45 | Protects Jira DC connection pool |

---

## Open Questions

1. **fetchActiveSprint internal board discovery vs useBoardId hook**
   - What we know: `fetchActiveSprint` contains its own 2-call internal sequence (board discovery → sprint fetch). D-03 creates a separate `useBoardId` hook.
   - What's unclear: Should `fetchActiveSprint` be refactored to accept a `boardId` parameter (using the shared hook's result), or should it remain self-contained? The Context says to parallelize by making quickFilters depend on `useBoardId()` instead of `activeSprint?.originBoardId` — so `fetchActiveSprint` itself does not need to change.
   - Recommendation: Leave `fetchActiveSprint` as-is. The sprint board switches `quickFilters` to depend on `useBoardId()` result instead of `activeSprint?.originBoardId`. This gives quickFilters a ~400ms head start (board ID resolves before the full sprint fetch completes).

2. **Subtask query as single useQuery vs useQueries chunks**
   - What we know: `fetchSprintIssues` already uses `Promise.all(chunks.map(...))` internally. The split can either: (a) expose a single `fetchSprintSubtasks(parentKeys)` service function that does the chunking internally (simpler, one useQuery), or (b) expose per-chunk `useQueries` at the component level (more granular loading state but more complex).
   - What's unclear: Does TanStack Query observe individual chunk completion if they are all inside one `queryFn`? No — a single queryFn is atomic to TQ.
   - Recommendation: Single `useQuery` with `fetchSprintSubtasks(parentKeys)` service function that does `Promise.all(chunks)` internally. This is the simpler approach consistent with the existing pattern and matches D-01 ("subtask chunk queries fire immediately after stories resolve"). Per-chunk `useQueries` is not required by the decisions.

3. **BacklogPage useIsActiveRoute guard**
   - What we know: `BacklogPage` currently has no `useIsActiveRoute` check — its `fetchBacklogView` query always runs when credentials are available. `SprintBoardTab` uses `isActive` to gate its queries.
   - What's unclear: Should the backlog query gain an `isActive` guard in this phase?
   - Recommendation: Out of scope for Phase 45 (polling pause was Phase 43's domain). Keep existing behavior.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code changes with no new external dependencies. p-limit is an npm package installed at build time.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (vitest.config.ts present) |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npx vitest run --reporter=verbose 2>&1 | tail -20` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QOPT-01 | `fetchSprintStories` returns only non-subtask issues using paginated search | unit | `npx vitest run src/services/jira/issues.test.ts -t "fetchSprintStories"` | ❌ Wave 0 |
| QOPT-01 | `fetchSprintSubtasks` returns subtasks for given parent keys in chunks | unit | `npx vitest run src/services/jira/issues.test.ts -t "fetchSprintSubtasks"` | ❌ Wave 0 |
| QOPT-01 | `useBoardId` hook returns board ID and caches with staleTime Infinity | unit | `npx vitest run src/hooks/useBoardId.test.ts` | ❌ Wave 0 |
| QOPT-02 | `fetchBacklogView` with explicit boardId skips board discovery step | unit | `npx vitest run src/services/jira/backlog.test.ts -t "fetchBacklogView.*boardId"` | ❌ Wave 0 (extends existing) |
| QOPT-02 | `fetchBacklogView` no longer includes epic names in return value | unit | `npx vitest run src/services/jira/backlog.test.ts -t "fetchBacklogView.*epic"` | ❌ Wave 0 (extends existing) |
| QOPT-03 | Concurrency semaphore limits concurrent p-limit calls to configured max | unit | `npx vitest run src/lib/concurrency.test.ts` | ❌ Wave 0 |
| QOPT-03 | `setJiraConcurrencyLimit` creates new limiter instance with updated count | unit | `npx vitest run src/lib/concurrency.test.ts` | ❌ Wave 0 |

### Existing test coverage relevant to this phase
| File | Coverage |
|------|---------|
| `src/services/jira/issues.test.ts` | Existing tests for `fetchSprintIssues` — will break when function is split; tests must be updated |
| `src/services/jira/backlog.test.ts` | Existing tests for `fetchBacklogView` — Step 4 removal changes return shape |
| `src/services/jira/sprints.test.ts` | `fetchActiveSprint` — unmodified, tests remain valid |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/services/jira/ --reporter=verbose 2>&1 | tail -30`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/services/jira/issues.test.ts` — add tests for `fetchSprintStories` and `fetchSprintSubtasks` (extends existing file)
- [ ] `taskflow/src/hooks/useBoardId.test.ts` — covers QOPT-01 board ID caching
- [ ] `taskflow/src/lib/concurrency.test.ts` — covers QOPT-03 semaphore behavior
- [ ] `taskflow/src/services/jira/backlog.test.ts` — update existing tests for `fetchBacklogView` boardId param + Step 4 removal

---

## Sources

### Primary (HIGH confidence)
- Direct codebase reading — `SprintBoardTab.tsx`, `BacklogPage.tsx`, `issues.ts`, `backlog.ts`, `sprints.ts`, `client.ts`, `board-config.ts`, `Sidebar.tsx`, `sidebar-items.ts`, `main.tsx`, `DebugModeSection.tsx`, `settings.store.ts`, `useIsActiveRoute.ts`, `useDelayedLoading.ts`, `query-constants.ts` — all code patterns documented from source of truth
- npm registry — `npm view p-limit version` returned 7.3.0 (current), `npm view @tanstack/react-query version` returned 5.95.2

### Secondary (MEDIUM confidence)
- TanStack Query v5 `prefetchQuery` and `useQueries` APIs — documented from existing usage patterns in `main.tsx` and project code; matches TQ v5 documented behavior

### Tertiary (LOW confidence)
- None — all claims verified from codebase or npm registry

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages verified at npm registry, TQ already installed
- Architecture: HIGH — all patterns derived from existing working code in the codebase
- Pitfalls: HIGH — derived from direct reading of the affected code paths; no speculation

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable library versions; TQ v5 API is not changing)
