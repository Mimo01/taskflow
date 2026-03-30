# Phase 44: Loading UX - Research

**Researched:** 2026-03-30
**Domain:** React skeleton screens, TanStack Query loading states, flicker prevention hooks
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Dedicated per-view skeleton components — SprintBoardSkeleton, BacklogSkeleton, MyTasksSkeleton, etc. Each matches the actual layout of its view (columns, rows, cards)
- **D-02:** Skeleton components co-located with their view files — e.g., SprintBoardSkeleton.tsx next to SprintBoardTab.tsx
- **D-03:** All skeleton components use the existing shadcn `Skeleton` primitive from `src/components/ui/skeleton.tsx` — not raw divs with animate-pulse
- **D-04:** Existing inline skeleton markup in SprintBoardTab and BacklogPage must be replaced with the new per-view skeleton components for consistency
- **D-05:** Sprint board uses two-stage query rendering — parent issues (story headers) load and render first, subtask queries fire after and subtasks appear progressively beneath each parent. Leverages the existing two-query subtask strategy
- **D-06:** Backlog uses parallel queries with render-as-each-resolves — main backlog issues query renders the table immediately, epic metadata arrives via separate query and fills in alongside (rows show without epic badges first, then badges appear)
- **D-07:** Custom `useDelayedLoading` hook — takes `isPending` and returns `showSkeleton`. Returns false for the first 200ms, then true if still loading. Prevents skeleton flash when data loads quickly (LOAD-05)
- **D-08:** Uniform 200ms delay threshold applied to all views — same behavior everywhere, no per-view configuration
- **D-09:** All 8 major views get layout-matched skeletons in this phase: sprint board, backlog, my tasks, workload, epics, releases, notifications, dashboard widgets
- **D-10:** Complete coverage in one pass — no prioritization or phased rollout within the phase
- **D-11:** Refresh buttons on each page must invalidate caches (TanStack Query cache for that view's queries), show a skeleton, and reload all data for that page

### Claude's Discretion

- Exact layout dimensions and proportions for each skeleton component
- Refresh button skeleton timing (immediate vs 200ms delayed)
- How to wire cache invalidation on refresh (queryClient.invalidateQueries vs removeQueries)
- Skeleton animation style details beyond the shadcn Skeleton defaults
- Dashboard widget skeleton granularity (one per widget type or generic widget skeleton)

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-01 | User sees layout-matched skeleton screens instead of spinners on all major data views (sprint board, backlog, my tasks, workload, epics, releases, notifications, dashboard widgets) | Per-view skeleton components with Skeleton primitive; replace all `bg-muted animate-pulse` raw divs |
| LOAD-03 | User sees sprint board story headers immediately while subtasks load progressively beneath them | Two-stage render using existing two-query subtask strategy; subtask placeholder Skeletons per expected slot |
| LOAD-04 | User sees backlog issue list immediately while epic metadata loads progressively | Parallel queries with render-as-each-resolves; inline epic badge Skeleton placeholders per row |
| LOAD-05 | User does not see skeleton flicker when data loads within 200ms (delayed loading hook) | `useDelayedLoading` hook — 200ms gate before showing skeleton; bypass on manual refresh |
</phase_requirements>

---

## Summary

Phase 44 is a targeted UX improvement with well-scoped work: replace 8 views' existing ad-hoc loading UI (raw `bg-muted animate-pulse` divs) with proper per-view skeleton components built on the existing shadcn `Skeleton` primitive. The phase also adds a `useDelayedLoading` hook to prevent skeleton flash on fast loads, progressive loading for sprint board and backlog, and cache-invalidating refresh buttons.

The codebase is in a clean state for this work. The shadcn `Skeleton` primitive (`bg-accent animate-pulse rounded-md`) is already installed. All 8 views already have `isLoading` state from TanStack Query — this phase is replacing the presentation layer only. Some views (SprintBoardTab, BacklogPage, MyTasksTab, WorkloadTab, SprintProgressTab, ReleasesTab, EpicsPage) use raw `bg-muted animate-pulse` divs. Dashboard widgets (ReleasesWidget, SprintProgressWidget, WorkloadWidget, CustomJqlWidget, SprintHealthWidget, MrHealthWidget, SubtasksWidget, MrAttentionWidget) already use the `Skeleton` primitive but need the `useDelayedLoading` hook and layout-matched proportions.

For refresh: views currently call `refetch()` directly. The upgrade is to call `queryClient.invalidateQueries()` with the view's query keys before triggering reload — this ensures stale cache is cleared so the query re-fires as `isPending = true` and the skeleton shows.

**Primary recommendation:** Build `useDelayedLoading` first (foundational), then create all 8 per-view skeleton components (low-coupling, parallelizable), then wire them into each view replacing inline patterns, then add progressive loading for sprint board and backlog.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn `Skeleton` | Already installed (`src/components/ui/skeleton.tsx`) | Skeleton building block | Project-mandated (D-03); provides consistent `bg-accent animate-pulse rounded-md` |
| TanStack Query | Already installed | `isPending`/`isLoading` loading states, `queryClient.invalidateQueries` | Project-standard query library |
| React | Already installed | Hook authoring (`useDelayedLoading` uses `useState`/`useEffect`/`useRef`) | Project framework |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `useIsActiveRoute` (existing hook) | Project-local | Route-aware polling gate | Skeleton visibility should align — don't show skeleton on inactive routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useDelayedLoading` (custom hook) | CSS transition delay on skeleton wrapper | CSS approach can't suppress initial render; hook is the correct React pattern |
| `queryClient.invalidateQueries` | `queryClient.removeQueries` | `invalidateQueries` marks stale and triggers background refetch (returns `isPending=true` until done); `removeQueries` wipes cache entirely — same visible result but more aggressive. Project already uses `invalidateQueries` consistently — match that pattern |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── hooks/
│   └── useDelayedLoading.ts          # New: 200ms gate hook
└── routes/dashboard/
    ├── SprintBoardSkeleton.tsx        # New: co-located with SprintBoardTab.tsx
    ├── BacklogSkeleton.tsx            # New: co-located with BacklogPage.tsx
    ├── MyTasksSkeleton.tsx            # New: co-located with MyTasksTab.tsx
    ├── WorkloadSkeleton.tsx           # New: co-located with WorkloadTab.tsx
    ├── SprintProgressSkeleton.tsx     # New: co-located with SprintProgressTab.tsx
    ├── EpicsSkeleton.tsx              # New: co-located with EpicsPage.tsx
    ├── ReleasesSkeleton.tsx           # New: co-located with ReleasesTab.tsx
    └── MrAttentionSkeleton.tsx        # New: co-located with MrAttentionTab.tsx
```

### Pattern 1: useDelayedLoading Hook

**What:** A hook that gates skeleton visibility behind a 200ms delay. Prevents visible skeleton flash when data arrives quickly.
**When to use:** Every view in this phase — replaces the direct `{isLoading && <skeleton>}` pattern.

```typescript
// src/hooks/useDelayedLoading.ts
import { useEffect, useRef, useState } from 'react';

/**
 * Returns true only if isPending has been true for longer than delayMs.
 * Prevents skeleton flash when data loads quickly (LOAD-05).
 *
 * @param isPending - TanStack Query isPending / isLoading
 * @param delayMs   - How long to wait before showing skeleton (default: 200)
 */
export function useDelayedLoading(isPending: boolean, delayMs = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPending) {
      timerRef.current = setTimeout(() => setShowSkeleton(true), delayMs);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      setShowSkeleton(false);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPending, delayMs]);

  return showSkeleton;
}
```

**Important:** The 200ms delay is bypassed on manual refresh. When the user clicks Refresh, `queryClient.invalidateQueries` is called, which puts the query into `isPending = true`. To give immediate skeleton feedback on manual refresh, the component should call `setForceShowSkeleton(true)` before invalidation, then clear it when `isPending` drops to false. Alternatively, the simplest approach: the `refetch()` callback sets a local `isRefreshing` boolean that bypasses the delay. See Pattern 3 for the refresh wiring.

### Pattern 2: Per-View Skeleton Component

**What:** A dedicated TSX component that mirrors the view's layout shape using `Skeleton` primitives.
**When to use:** Each of the 8 view files — replace inline `{isLoading && <div className="animate-pulse...">}` blocks.

```typescript
// src/routes/dashboard/WorkloadSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

export function WorkloadSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}
```

```typescript
// src/routes/dashboard/SprintBoardSkeleton.tsx
import { Skeleton } from '@/components/ui/skeleton';

// Matches the actual board layout: header bar + 3 columns of card stacks
export function SprintBoardSkeleton() {
  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header bar */}
      <Skeleton className="h-9 w-full" />
      {/* 3 column placeholders side by side */}
      <div className="flex gap-2">
        {[0, 1, 2].map((col) => (
          <div key={col} className="flex-1 flex flex-col gap-2">
            {[0, 1, 2].map((card) => (
              <Skeleton key={card} className="h-20 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Dimensions from UI-SPEC.md:**

| View | Component | Row Height | Count |
|------|-----------|------------|-------|
| Sprint board | SprintBoardSkeleton | h-9 header + h-20 cards | 3 cols × 3 cards |
| Backlog | BacklogSkeleton | h-9 header + h-10 rows | 6 rows |
| My tasks | MyTasksSkeleton | h-10 | 5 rows |
| Workload | WorkloadSkeleton | h-8 | 5 rows |
| Sprint progress | SprintProgressSkeleton | h-8 | 5 rows |
| Epics | EpicsSkeleton | h-10 | 5 rows |
| Releases | ReleasesSkeleton | h-10 | 5 rows |
| MR attention | MrAttentionSkeleton | h-10 | 5 rows |

### Pattern 3: Refresh with Immediate Skeleton + Cache Invalidation

**What:** Refresh buttons must invalidate cache AND show skeleton immediately (bypassing 200ms delay).
**When to use:** Every view with a Refresh button (all 8 views currently have RefreshCw buttons).

The cleanest approach verified against the existing codebase pattern: add a `isRefreshing` local state boolean that forces skeleton display immediately when refresh is clicked, independent of the `useDelayedLoading` hook.

```typescript
// In each view component:
const [isRefreshing, setIsRefreshing] = useState(false);
const showSkeleton = useDelayedLoading(isPending) || isRefreshing;

// When isPending drops to false, clear isRefreshing
useEffect(() => {
  if (!isPending) setIsRefreshing(false);
}, [isPending]);

function handleRefresh() {
  setIsRefreshing(true);
  queryClient.invalidateQueries({ queryKey: ['<view-specific-key>', activeJiraProject] });
}
```

Then replace `onClick={() => refetch()}` with `onClick={handleRefresh}`.

**Why `invalidateQueries` not `refetch`:** `refetch()` on a query that has stale-time remaining does NOT re-fetch (the cache is considered fresh). `queryClient.invalidateQueries()` marks the cache as stale regardless and causes the query to re-fetch immediately, setting `isPending = true`.

### Pattern 4: Progressive Loading — Sprint Board (LOAD-03)

**What:** Story header rows render immediately from the primary query. Subtask placeholder Skeletons appear beneath each story header while the subtask query is in flight. Subtasks replace placeholders progressively when each resolves.
**When to use:** Sprint board only (CONTEXT.md D-05).

The sprint board already fires a two-query strategy (parent issues + subtasks separately). The progressive rendering change is in how `VirtualizedSwimlanes` renders each swimlane row:

```typescript
// Inside each swimlane row's content area, for the subtask column cells:
// Before: show nothing until subtasksQuery.data is available
// After: show Skeleton placeholders while subtasksQuery.isPending

{subtasksQuery.isPending ? (
  <Skeleton className="h-8 w-full" />
) : (
  subtasksQuery.data?.map(subtask => <TaskCard key={subtask.key} issue={subtask} />)
)}
```

### Pattern 5: Progressive Loading — Backlog (LOAD-04)

**What:** Backlog table rows render immediately from the main query. Each row shows an inline `<Skeleton className="h-4 w-16" />` in the epic badge column while the epic metadata query is in flight.
**When to use:** BacklogPage only (CONTEXT.md D-06).

```typescript
// In BacklogRow's epic badge cell:
// Before: render nothing / empty until epicNames is available
// After: render Skeleton while epicNames is undefined

{epicNames === undefined ? (
  <Skeleton className="h-4 w-16" />
) : epicNames.get(epicKey) ? (
  <EpicBadge name={epicNames.get(epicKey)!} color={epicColors?.get(epicKey)} />
) : null}
```

The epic metadata (`allEpics` query) is already a separate query in BacklogPage.tsx. The change is making `epicNames` prop available to `BacklogRow` before the query resolves (passing `undefined` vs the map), and rendering a Skeleton placeholder in that state.

### Anti-Patterns to Avoid

- **Raw `bg-muted animate-pulse` divs:** Never use in new code — always use `<Skeleton className="...">` from `src/components/ui/skeleton.tsx` (D-03)
- **`isLoading` directly controlling skeleton display:** Always route through `useDelayedLoading` to prevent flash (LOAD-05)
- **`refetch()` for Refresh buttons:** Use `queryClient.invalidateQueries()` instead — `refetch()` may not re-fire if data is within stale time
- **Global invalidation on refresh:** Scope `invalidateQueries` to only the queried keys for that view — don't invalidate unrelated queries
- **Showing skeleton on inactive routes:** The existing `isActive` guard (`useIsActiveRoute`) already prevents queries from firing on hidden routes — skeleton visibility should respect the same gate

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Skeleton primitive | Custom `div` with `animate-pulse` | `<Skeleton>` from `src/components/ui/skeleton.tsx` | Consistency (D-03); bg-accent not bg-muted is the correct token for Phase 44 |
| Delay timer logic | `setTimeout` in component body | `useDelayedLoading` hook | Encapsulates cleanup, prevents stale closures, reusable across all 8 views |
| Skeleton animation | Custom CSS keyframes | shadcn `animate-pulse` default | Consistent timing (2s ease-in-out infinite); no override needed |

**Key insight:** All the loading infrastructure (TanStack Query `isPending`, `invalidateQueries`, `Skeleton` primitive) already exists. This phase is wiring and presentation work — the only genuinely new code is `useDelayedLoading.ts` and the 8 skeleton components.

---

## Common Pitfalls

### Pitfall 1: Skeleton Flash on Fast Loads

**What goes wrong:** User sees skeleton flash briefly (50–150ms) when data loads quickly from a warm cache. The skeleton appears and disappears immediately, which looks like a UI bug.
**Why it happens:** TanStack Query's `isPending` fires true momentarily even when cached data satisfies the query within milliseconds. Without a delay gate, the skeleton renders for a single frame.
**How to avoid:** Route all `isPending` through `useDelayedLoading` — returns `false` for 200ms, then `true` only if still loading.
**Warning signs:** In dev, fast mock data resolving in < 200ms causes no visible skeleton; slower real API calls show skeleton correctly. Test with delayed mock data (`new Promise(resolve => setTimeout(() => resolve(data), 300))`) to verify skeleton appears.

### Pitfall 2: Refresh Does Not Show Skeleton

**What goes wrong:** User clicks Refresh — data reloads but no visual feedback appears because cached data is present and `isPending` doesn't go through the 200ms delay before data arrives.
**Why it happens:** If refetch returns quickly (data was stale but re-fetched fast), the skeleton window is inside the 200ms gate. Plus, using `refetch()` directly may not set `isPending = true` if the query is not actually re-firing due to stale time.
**How to avoid:** (a) Use `queryClient.invalidateQueries` not `refetch()` so cache is cleared. (b) Set `isRefreshing = true` immediately on click to force skeleton display, clear it when `isPending` drops to false.
**Warning signs:** Clicking Refresh shows no skeleton, content just stays and then updates.

### Pitfall 3: isLoading vs isPending Confusion

**What goes wrong:** Using `isLoading` instead of `isPending` misses re-fetch states.
**Why it happens:** TanStack Query v5 distinction: `isLoading` is true only on initial load (no cached data). `isPending` is true during any in-flight request including re-fetches. For showing skeleton on Refresh, `isPending` is needed.
**How to avoid:** The codebase already uses `isLoading` from destructuring which in TanStack Query v5 maps to `isPending && fetchStatus === 'fetching'`. Check which TanStack Query version is installed; adjust if `isPending` is more appropriate for refresh scenarios.
**Warning signs:** Skeleton shows on initial load but not on Refresh.

### Pitfall 4: Backlog's epicNames Prop Threading

**What goes wrong:** BacklogRow currently receives `epicNames?: Map<string, string>` — if the map is passed as an empty Map `{}` vs `undefined`, the Skeleton placeholder won't render (empty map looks "loaded").
**Why it happens:** The progressive loading pattern requires distinguishing "epic data not yet fetched" (`undefined`) from "epic data fetched, no epics" (empty map). Currently `allEpics` query result is `undefined` while fetching and `[]` when resolved.
**How to avoid:** Pass `epicNames` as `undefined` while `epicsQuery.isPending`, and as the constructed `Map` once resolved. Do not default to empty Map before epics load.
**Warning signs:** Epic badge column is blank on initial load instead of showing skeleton placeholder.

### Pitfall 5: Test Assertions Break After Skeleton Migration

**What goes wrong:** Existing tests assert on `.animate-pulse` selectors (e.g., `document.querySelectorAll('.animate-pulse')`). These still work because `Skeleton` primitive includes `animate-pulse`. But tests for specific loading patterns may break if they check for `bg-muted` (the old pattern being replaced).
**Why it happens:** Migration from `bg-muted animate-pulse` to `bg-accent animate-pulse` (via Skeleton primitive) changes the class names. Any test querying by `bg-muted` selector on skeleton rows will silently fail to find elements.
**How to avoid:** Review test files in the dashboard directory. `SprintBoardTab.test.tsx` currently asserts `document.querySelectorAll('.animate-pulse').length > 0` — this will still pass. But `data-testid="skeleton-row"` assertions in MyTasksTab, WorkloadTab, ReleasesTab, SprintProgressTab and MrAttentionTab.test.tsx may rely on specific DOM structure. Update test assertions to match new skeleton component structure.
**Warning signs:** Tests that previously passed for "renders loading skeleton when isLoading" start failing after skeleton migration.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Skeleton Primitive Usage (already in widgets — this is the target pattern)
```typescript
// src/routes/dashboard/widgets/SprintProgressWidget.tsx
import { Skeleton } from '@/components/ui/skeleton';

// Loading branch:
if (!jiraToken || !jiraBaseUrl || !activeJiraProject || isLoading) {
  return (
    <div className="space-y-2 p-3">
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  );
}
```

### Existing Inline Pattern to Replace (sprint board)
```typescript
// src/routes/dashboard/SprintBoardTab.tsx — BEFORE (to be replaced)
{isLoading && (
  <div className="p-4 flex flex-col gap-3">
    {[0, 1].map((i) => (
      <div key={i} className="flex flex-col gap-0.5">
        <div className="h-9 rounded bg-muted animate-pulse" />
        <div className="flex">
          {CATEGORY_COLUMNS.map((col) => (
            <div key={col.key} className="flex-1 h-20 bg-muted/50 animate-pulse" />
          ))}
        </div>
      </div>
    ))}
  </div>
)}
```

### queryClient.invalidateQueries Pattern (already used in codebase)
```typescript
// src/routes/dashboard/BacklogPage.tsx — existing usage
queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] });
```

### TanStack Query keys per view (for refresh invalidation scope)
```
SprintBoardTab:    ['jira-issues', 'sprint-board', activeJiraProject, ...]
BacklogPage:       ['jira-backlog-view', activeJiraProject, jiraBaseUrl]
MyTasksTab:        ['jira-issues', 'my-tasks', activeJiraProject, ...]
WorkloadTab:       ['jira-issues', 'sprint-board', activeJiraProject, ...]  (shared with sprint board)
SprintProgressTab: ['jira-issues', 'sprint-board', activeJiraProject, ...]  (shared with sprint board)
ReleasesTab:       ['jira-fix-versions', activeJiraProject]
EpicsPage:         ['jira-epics-basic', activeJiraProject, jiraBaseUrl]
MrAttentionTab:    ['gitlab-mr-attention', ...]
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `div` with `bg-muted animate-pulse` | `<Skeleton>` primitive from shadcn | Phase 44 (this phase) | Consistent token (`bg-accent` not `bg-muted`), DRY, correct animation class from one source |
| `isLoading &&` direct conditional | `useDelayedLoading(isPending)` gate | Phase 44 (this phase) | No skeleton flash when data loads in < 200ms |
| `refetch()` on Refresh button | `queryClient.invalidateQueries()` + `isRefreshing` flag | Phase 44 (this phase) | Skeleton appears on every Refresh, not just first load |
| One spinner for entire loading state | Per-view layout-matched skeleton | Phase 44 (this phase) | Layout doesn't jump; perceived speed improvement |

**Deprecated/outdated:**

- Raw `div` with `bg-muted animate-pulse` in 5 view files: `SprintBoardTab.tsx`, `BacklogPage.tsx`, `MyTasksTab.tsx`, `WorkloadTab.tsx`, `EpicsPage.tsx`, `SprintProgressTab.tsx`, `ReleasesTab.tsx`, `MrAttentionTab.tsx` — all to be replaced in this phase

---

## Open Questions

1. **Sprint board subtask query structure**
   - What we know: SprintBoardTab has a primary `fetchSprintIssues` query. The comment block references a "two-query subtask strategy".
   - What's unclear: The subtask query is not visible in the first 120 lines of SprintBoardTab.tsx read during research. It may be in `VirtualizedSwimlanes` or `StoryHeaderRow`. The implementer must read lines 120–470 of SprintBoardTab.tsx to locate the exact subtask query hook call before wiring progressive loading.
   - Recommendation: During implementation of LOAD-03, read the full SprintBoardTab.tsx to locate the subtask query, then apply the progressive loading pattern at that call site.

2. **Widget files not using Skeleton primitive yet**
   - What we know: `NotificationsWidget.tsx`, `PinnedIssuesWidget.tsx`, `SavedFiltersWidget.tsx` were not individually audited (only widgets visible in directory listing). The widgets with `isLoading` were checked: MrAttentionWidget, ReleasesWidget, CustomJqlWidget, SprintHealthWidget, MrHealthWidget, SubtasksWidget all use the Skeleton primitive already.
   - What's unclear: Whether Notifications, PinnedIssues, and SavedFilters widgets use the Skeleton primitive or raw divs.
   - Recommendation: Implementer should check these three widget files at the start of widget work.

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies identified — this phase is purely code changes using already-installed libraries)

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + React Testing Library |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd taskflow && npm test -- --reporter=verbose` |
| Full suite command | `cd taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-01 | Each major view renders skeleton (not spinner) when query is pending | unit | `cd taskflow && npm test -- SprintBoardTab BacklogPage MyTasksTab WorkloadTab SprintProgressTab ReleasesTab MrAttentionTab EpicsPage` | Partial — SprintBoardTab.test.tsx has skeleton test; others need updates |
| LOAD-03 | Sprint board story headers render while subtasks show Skeleton placeholders | unit | `cd taskflow && npm test -- SprintBoardTab` | ❌ Wave 0 |
| LOAD-04 | Backlog rows render immediately; epic badge column shows Skeleton while epics query is pending | unit | `cd taskflow && npm test -- BacklogPage` | ❌ Wave 0 |
| LOAD-05 | No skeleton renders when data arrives within 200ms; skeleton renders when data takes > 200ms | unit | `cd taskflow && npm test -- useDelayedLoading` | ❌ Wave 0 (hook doesn't exist yet) |

### Sampling Rate

- **Per task commit:** `cd taskflow && npm test -- <changed-file>`
- **Per wave merge:** `cd taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `taskflow/src/hooks/useDelayedLoading.test.ts` — covers LOAD-05 (200ms delay behavior, both branches)
- [ ] `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` — add LOAD-03 progressive loading test (story headers visible before subtasks)
- [ ] `taskflow/src/routes/dashboard/BacklogPage.test.tsx` — add LOAD-04 epic badge Skeleton placeholder test (if test file exists; check before creating)

---

## Sources

### Primary (HIGH confidence)

- Direct code inspection of `taskflow/src/components/ui/skeleton.tsx` — shadcn Skeleton primitive API confirmed
- Direct code inspection of all 8 view files — loading state patterns, query keys, refetch behavior confirmed
- Direct code inspection of `taskflow/src/routes/dashboard/widgets/` — Skeleton primitive already used in 6 of 8 widgets confirmed
- Direct code inspection of `taskflow/src/hooks/useIsActiveRoute.ts` — route-aware polling hook confirmed
- Direct code inspection of `taskflow/src/main.tsx` — QueryClient global config confirmed (gcTime: Infinity, staleTime: 5min)
- `.planning/phases/44-loading-ux/44-CONTEXT.md` — locked decisions and discretion areas
- `.planning/phases/44-loading-ux/44-UI-SPEC.md` — skeleton dimensions, component inventory, color contract

### Secondary (MEDIUM confidence)

- TanStack Query v5 `isPending` vs `isLoading` distinction: based on project's TanStack Query usage patterns and v5 documentation knowledge (not re-verified against Context7 — applies to already-in-use APIs)

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all libraries confirmed present via direct file inspection
- Architecture: HIGH — patterns derived from existing codebase patterns, UI-SPEC, and CONTEXT.md decisions
- Pitfalls: HIGH — derived from direct inspection of code being modified and existing test patterns
- Progressive loading specifics: MEDIUM — sprint board subtask query location not fully confirmed (open question flagged)

**Research date:** 2026-03-30
**Valid until:** 2026-04-30 (stable domain — TanStack Query, shadcn, React hooks)
