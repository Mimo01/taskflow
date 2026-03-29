# Phase 44: Loading UX - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Every major data view shows a layout-matched skeleton instead of a spinner during initial load, data loads progressively without flicker, and refresh buttons invalidate caches to trigger skeleton-based reload. Skeleton screens replace the existing RouteSpinner and inline skeleton patterns for data loading. Query parallelization is Phase 45. Cache behavior (stale-while-revalidate, gcTime) was established in Phase 43.

</domain>

<decisions>
## Implementation Decisions

### Skeleton Design Approach
- **D-01:** Dedicated per-view skeleton components — SprintBoardSkeleton, BacklogSkeleton, MyTasksSkeleton, etc. Each matches the actual layout of its view (columns, rows, cards)
- **D-02:** Skeleton components co-located with their view files — e.g., SprintBoardSkeleton.tsx next to SprintBoardTab.tsx
- **D-03:** All skeleton components use the existing shadcn `Skeleton` primitive from `src/components/ui/skeleton.tsx` — not raw divs with animate-pulse
- **D-04:** Existing inline skeleton markup in SprintBoardTab and BacklogPage must be replaced with the new per-view skeleton components for consistency

### Progressive Loading Strategy
- **D-05:** Sprint board uses two-stage query rendering — parent issues (story headers) load and render first, subtask queries fire after and subtasks appear progressively beneath each parent. Leverages the existing two-query subtask strategy
- **D-06:** Backlog uses parallel queries with render-as-each-resolves — main backlog issues query renders the table immediately, epic metadata arrives via separate query and fills in alongside (rows show without epic badges first, then badges appear)

### Flicker Prevention
- **D-07:** Custom `useDelayedLoading` hook — takes `isPending` and returns `showSkeleton`. Returns false for the first 200ms, then true if still loading. Prevents skeleton flash when data loads quickly (LOAD-05)
- **D-08:** Uniform 200ms delay threshold applied to all views — same behavior everywhere, no per-view configuration

### Scope of Coverage
- **D-09:** All 8 major views get layout-matched skeletons in this phase: sprint board, backlog, my tasks, workload, epics, releases, notifications, dashboard widgets
- **D-10:** Complete coverage in one pass — no prioritization or phased rollout within the phase

### Refresh Button Behavior
- **D-11:** Refresh buttons on each page must invalidate caches (TanStack Query cache for that view's queries), show a skeleton, and reload all data for that page
- **D-12:** Whether refresh skeletons use the 200ms delay or show immediately is Claude's discretion

### Claude's Discretion
- Exact layout dimensions and proportions for each skeleton component
- Refresh button skeleton timing (immediate vs 200ms delayed)
- How to wire cache invalidation on refresh (queryClient.invalidateQueries vs removeQueries)
- Skeleton animation style details beyond the shadcn Skeleton defaults
- Dashboard widget skeleton granularity (one per widget type or generic widget skeleton)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — LOAD-01 (skeleton screens for all major views), LOAD-03 (sprint board progressive loading), LOAD-04 (backlog progressive loading), LOAD-05 (200ms flicker prevention)

### Skeleton primitive
- `taskflow/src/components/ui/skeleton.tsx` — shadcn Skeleton component (bg-accent, animate-pulse, rounded-md)

### Views requiring skeletons
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Sprint board with existing inline skeleton markup to replace
- `taskflow/src/routes/dashboard/BacklogPage.tsx` — Backlog with existing inline skeleton/loading patterns to replace
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — My tasks tab
- `taskflow/src/routes/dashboard/WorkloadTab.tsx` — Workload tab
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` — Sprint progress tab
- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — Releases tab
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — MR attention tab (notifications)
- `taskflow/src/routes/dashboard/EpicsPage.tsx` — Epics page

### Dashboard widgets
- `taskflow/src/routes/dashboard/widgets/` — Widget directory (SprintProgressWidget, WorkloadWidget, ReleasesWidget, SubtasksWidget, SprintHealthWidget, MrHealthWidget, MrAttentionWidget, CustomJqlWidget)

### Prior phase context
- `.planning/phases/42-foundation/42-CONTEXT.md` — Phase 42: RouteSpinner for lazy route chunks, React Compiler
- `.planning/phases/43-cache-correctness/43-CONTEXT.md` — Phase 43: gcTime Infinity, staleTime 5min, route-aware polling

### Query client
- `taskflow/src/main.tsx` — QueryClient default options, global query configuration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Skeleton` component (`src/components/ui/skeleton.tsx`): shadcn primitive with bg-accent, animate-pulse, rounded-md — use as building block for all skeleton screens
- `RouteSpinner` (`src/components/ui/route-spinner.tsx`): Loader2 spinner — currently used for lazy route Suspense fallback, NOT for data loading
- Existing inline skeleton patterns in SprintBoardTab (divs with bg-muted animate-pulse) and BacklogPage — reference for layout shapes, but replace with Skeleton primitive

### Established Patterns
- TanStack Query `isPending`/`isLoading` used across 30+ files for loading state detection
- Three-state pattern: EmptyState vs ErrorState vs data rendering — skeletons slot into the loading branch
- Phase 43 introduced `useIsActiveRoute()` for route-aware polling — skeleton visibility should align with this

### Integration Points
- Each view's loading branch (currently spinner or inline skeleton) replaced with new skeleton component
- `useDelayedLoading` hook needs to integrate with TanStack Query's `isPending` state
- Refresh buttons need to call `queryClient.invalidateQueries()` scoped to the view's query keys
- Dashboard widgets each have their own loading states — skeleton components needed per widget or generic

</code_context>

<specifics>
## Specific Ideas

- Refresh buttons must invalidate caches AND show skeletons — user specifically wants visible feedback that data is reloading
- Sprint board progressive loading should leverage the existing two-query subtask strategy (parent issues first, subtasks second)
- Backlog rows appear without epic badges first, then badges fill in when epic metadata arrives

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-loading-ux*
*Context gathered: 2026-03-29*
