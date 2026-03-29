# Phase 43: Cache Correctness - Context

**Gathered:** 2026-03-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see cached data instantly when revisiting views, and polling behaves correctly for active vs. inactive views. This phase delivers stale-while-revalidate cache configuration, view-scoped polling pause, and app minimize/restore polling behavior. Skeleton screens for first-visit loading are Phase 44. Query parallelization is Phase 45.

</domain>

<decisions>
## Implementation Decisions

### Stale-While-Revalidate Strategy
- **D-01:** Keep the global 5-minute staleTime — no per-query tuning needed. TanStack Query already shows cached data immediately and refetches in background.
- **D-02:** Set gcTime: Infinity globally on QueryClient so cache entries survive indefinitely during the session. Navigating back always shows instant data regardless of time away.
- **D-03:** First-visit loading (no cache yet) is Phase 44 scope. This phase only ensures return visits show instant cached data.

### Polling Pause for Hidden Views
- **D-04:** Use a route-aware `enabled` flag pattern. Each polling query gets `enabled: isOnThisRoute && ...otherConditions`. A shared `useIsActiveRoute()` hook checks current pathname.
- **D-05:** Notification polling (useNotificationPolling) and update polling (useUpdatePolling) remain global — they run in AppLayout regardless of route. View-specific refetchInterval queries only poll when their route is active.

### Claude's Discretion
- Exact split of which queries are view-scoped vs global (based on which queries actually have refetchInterval set)
- Implementation details of useIsActiveRoute() hook
- staleTime/refetchInterval guardrail enforcement approach (shared constants, runtime assertion, or lint rule)

### App Minimize/Restore Behavior
- **D-06:** Use `document.visibilitychange` (standard web API) for minimize detection. No Tauri-specific visibility code needed — TanStack Query's built-in focusManager already listens to this.
- **D-07:** Set `refetchIntervalInBackground: false` on all polling queries EXCEPT notification polling. Notification polling keeps `refetchIntervalInBackground: true` because notifications are time-sensitive and the cursor-based delta fetch handles catch-up.
- **D-08:** On restore, only the currently visible route's queries refetch (TanStack Query's default `refetchOnWindowFocus` behavior). No bulk invalidation of all stale queries.
- **D-09:** SC-3 is refined: "All polling stops when minimized EXCEPT notification polling, which continues in background."

### staleTime/refetchInterval Guardrails
- **D-10:** Claude's discretion on enforcement approach. The invariant `staleTime < refetchInterval` must be maintained for all polled queries. Options include shared constants, runtime assertions in dev mode, or code comments.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Query client setup
- `taskflow/src/main.tsx` — QueryClient default options (staleTime: 5min, retry: 1), AppLayout component where global hooks run
- `taskflow/src/hooks/useNotificationPolling.ts` — Notification polling with refetchIntervalInBackground: true, cursor-based delta fetch
- `taskflow/src/hooks/useUpdatePolling.ts` — Update polling with refetchIntervalInBackground: false (already correct pattern)

### Requirements
- `.planning/REQUIREMENTS.md` — LOAD-02 (stale-while-revalidate), QOPT-04 (smart polling with background pause), QOPT-05 (visibility-aware polling)

### Prior phase context
- `.planning/phases/42-foundation/42-CONTEXT.md` — Phase 42 decisions on React Compiler, route splitting, build config

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useUpdatePolling` hook: Already implements `refetchIntervalInBackground: false` — serves as the reference pattern for other polling queries
- `CommandPalette`: Already uses `keepPreviousData` from TanStack Query — only existing placeholderData usage
- `useSavedFilterSync` hook: Another global polling hook that needs minimize-aware config

### Established Patterns
- TanStack Query with `useQuery`/`useInfiniteQuery` across 52 files — all cache behavior flows through QueryClient defaults
- Polling hooks mounted in AppLayout (global) vs route components (view-scoped) — clear separation already exists
- `refetchInterval` + `staleTime` pattern used consistently (44 files) — staleTime typically matches or is slightly less than refetchInterval

### Integration Points
- `main.tsx` QueryClient constructor — add `gcTime: Infinity` to defaultOptions
- `useNotificationPolling.ts` — keep `refetchIntervalInBackground: true` (exception to the rule)
- All other polling queries — add `refetchIntervalInBackground: false`
- Route components with refetchInterval — add `enabled: isOnThisRoute` flag
- New `useIsActiveRoute()` hook — shared utility for route detection

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 43-cache-correctness*
*Context gathered: 2026-03-29*
