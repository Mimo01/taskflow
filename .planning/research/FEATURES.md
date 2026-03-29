# Feature Research

**Domain:** Performance & Perceived Speed — React 19 + TanStack Query desktop app
**Researched:** 2026-03-29
**Confidence:** HIGH

## Context Note

This is a subsequent milestone for an existing ~51K-line Tauri 2 + React 19 + TanStack Query desktop app (Taskflow v1.6.3). All features below are scoped to performance optimization. The app already has: `@tanstack/react-virtual` virtualization, TanStack Query with 30s/60s poll intervals, `refetchIntervalInBackground: false` on some queries, 30+ files using `useMemo`/`useCallback`, and a `Skeleton` component from shadcn/ui that is used in only ~5 places. No `React.lazy` or `Suspense` is used anywhere — all routes are eagerly imported.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any performant production app. Missing these makes the app feel unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Skeleton screens replacing spinners on initial load | Users perceive skeleton-loaded content as loading up to 50% faster (Facebook research). Plain `isLoading &&` text/spinner blocks are the noticeable anti-pattern in modern apps. | MEDIUM | shadcn `Skeleton` component already exists. The work is replacing ~45 files that branch on `isLoading` with layout-matched skeleton variants. Priority targets: SprintBoardTab, BacklogPage, WorkloadTab, ReleasesTab, MyTasksTab. |
| Stale-while-revalidate on navigation | TanStack Query supports this natively via `staleTime`. Currently `staleTime: 0` is the test default and leaks into some production paths. When navigating back to a view, users should see the previous data instantly rather than a blank state while refetching. | LOW | Set `staleTime` to match or exceed `refetchInterval` on all dashboard queries. Pattern already used correctly in some hooks (`staleTime: pollIntervalMs - 5_000`). Audit and extend across all 45+ query-using files. |
| Route-level code splitting | All 16 routes are eagerly imported in `routes.tsx`. In a Tauri app the initial JS parse happens on every launch. Heavy routes (SprintBoardTab, BacklogPage, WorkloadTab, IssueDetailContent) add to startup parse time. | LOW | `React.lazy()` + `Suspense` on all route components in `routes.tsx`. Error boundary needed around each. No new dependencies required — React 19 + Vite support this natively. |
| No redundant or sequential API calls on view mount | Parallel queries already exist in theory, but several views fire sequential queries due to `enabled` guards that depend on prior query results. Users wait for chain of loading states. | MEDIUM | Audit and restructure query chains in SprintBoardTab (sprint issues + subtasks + statuses + quick filters — some sequential) and BacklogPage. Use `useQueries` for independent parallel fetches. |

### Differentiators (Competitive Advantage)

Features beyond baseline that distinguish the app's perceived speed.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Prefetch on sidebar hover/focus | Sidebar links are the primary navigation. Prefetching on hover means data is in cache by the time the user clicks. Common in polished desktop apps (Linear, Notion). | MEDIUM | `queryClient.prefetchQuery()` with appropriate staleTime on `onMouseEnter` / `onFocus` of sidebar nav items. Works for Sprint Board, Backlog, Workload — all have deterministic query keys from auth store. Must guard against running before credentials are loaded. |
| Smart polling — active view priority | Currently all polling runs at the same interval regardless of which route is active. A backlog that is not visible continues polling at 60s. Smart polling pauses non-active-route queries and concentrates intervals on the current view. | MEDIUM | `refetchIntervalInBackground: false` is already set on some queries. The remaining work is: (1) set it on all dashboard queries, (2) add a `usePageVisibility` hook that disables polling when the app window is minimized. TanStack Query's `refetchOnWindowFocus: true` handles the resume side natively. |
| Progressive data population | Show partial data as it arrives rather than blocking on the slowest sub-query. Example: sprint board can show story headers while subtasks still load; backlog can render the first page while epic data loads. | HIGH | Requires restructuring query dependency graphs so parent data renders independently, then child data fills in. Skeleton placeholders serve as the fallback for sections still loading. Risk: requires careful per-section loading state management to avoid jarring content shifts. |
| Avatar and image local caching | Jira returns avatar URLs that are fetched on every render cycle. In views with 10-20 team members (Workload, Sprint Board), this results in repeated authenticated network requests to the on-premise Jira server. | MEDIUM | `AuthImage` component already exists (`src/routes/dashboard/AuthImage.tsx`). Extend it with a session-scoped in-memory Map cache (URL to blob URL). IndexedDB persistence across sessions is an option but adds complexity — start with in-memory. The Tauri HTTP plugin handles the authenticated fetch; caching the result prevents re-fetching on re-render. |
| Memoization audit — targeted not blanket | 30+ files use `useMemo`/`useCallback` but there is no evidence of profiler-driven decisions. Some memoization may be counterproductive; high-render-count components (TaskCard, BacklogRow, DraggableCard, StoryHeaderRow) likely benefit from `React.memo`. | MEDIUM | Profile with React DevTools first. Apply `React.memo` to leaf list items rendered inside `useVirtualizer` rows — these are the highest-value targets since virtualizer calls them on every scroll event. React Compiler (released 1.0 in October 2025) is an alternative but adds build tooling complexity. |
| Bundle size analysis and dead code elimination | No `rollup-plugin-visualizer` is configured. Unknown whether large transitive dependencies (react-markdown, rehype-raw, remark-gfm, jira2md) are tree-shaken correctly. | LOW | Add `rollup-plugin-visualizer` to `vite.config.ts` (dev-only), generate treemap, identify top contributors. Check named vs default imports for heavy packages. `lucide-react` v0.577 supports per-icon named imports — verify no wildcard imports exist. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Global aggressive caching (`staleTime: Infinity` everywhere) | Feels like a quick win for perceived speed | Jira data changes constantly (sprint issues transition, comments added). Infinity staleTime means users see stale board states with no indication of drift. Rollback on optimistic updates breaks if cached data is wrong. | Use staleTime equal to the refetch interval minus a small buffer — already the correct pattern in `useNotificationPolling`. |
| Service Worker caching for API responses | Familiar from web apps; seems like "proper" caching | Tauri 2 uses `tauri-plugin-http` for all Jira/GitLab requests, which bypasses the webview's `fetch()` entirely. Service Workers intercept `fetch()` — they cannot intercept plugin-http requests. Would require a fundamental architecture change. | TanStack Query's in-memory + persisted cache is the right caching layer for this app. |
| React Compiler for automatic memoization | Eliminates manual useMemo/useCallback — attractive | React Compiler 1.0 requires a Babel plugin (`babel-plugin-react-compiler`). The project uses `@vitejs/plugin-react` with SWC, not Babel. Adding Babel back into the pipeline conflicts with the current SWC-based transform and adds a build-system dependency for uncertain yield. | Targeted manual memoization on the specific components identified by profiling. Revisit Compiler in v2 when Vite native support matures. |
| WebSocket or SSE real-time updates | Eliminates polling latency entirely | Jira Data Center on-premise does not emit WebSocket events. GitLab self-hosted webhooks require a public-facing server endpoint — directly contradicts the no-server architecture. | Smart polling with reduced intervals on the active view combined with refetchOnWindowFocus. |
| Streaming or chunked API responses | Instant first-byte experience | Jira REST API v2 does not support streaming. Responses are synchronous JSON. Simulating "streaming" by splitting queries adds artificial complexity. | Progressive loading via parallel independent queries — display each result set as it resolves rather than waiting for the slowest query. |
| Infinite scroll replacing pagination in backlog | Feels more fluid than page buttons | Backlog already uses `@tanstack/react-virtual` virtualization with discrete pagination. Infinite scroll combined with a virtualizer is significantly more complex (needs index tracking, scroll anchor restoration on refresh) and the existing paginated UX is already validated by the team. | Optimize the existing paginated approach: preload the next page while the user is reading the current one. |

---

## Feature Dependencies

```
Skeleton Screens
    └──requires──> Knowledge of per-view data shape (already known)
    └──enhances──> Stale-While-Revalidate (skeleton shows during background revalidation)

Stale-While-Revalidate Tuning
    └──requires──> Per-query staleTime audit
    └──enables──> Prefetch on Hover (prefetch only useful if staleTime > 0)

Prefetch on Hover
    └──requires──> Stale-While-Revalidate Tuning (otherwise prefetch is discarded immediately)
    └──requires──> Sidebar component access to queryClient

Route-Level Code Splitting
    └──requires──> ErrorBoundary wrapper (lazy loading can fail at chunk load time)
    └──independent of──> All other features

Query Parallelization
    └──requires──> Audit of existing query dependency chains
    └──enhances──> Progressive Data Loading (parallel = partial results arrive faster)

Progressive Data Loading
    └──requires──> Query Parallelization (can't show partial data from sequential chains)
    └──requires──> Skeleton Screens (placeholder for the not-yet-loaded sections)

Smart Polling
    └──requires──> refetchIntervalInBackground audit
    └──independent of──> Most other features

Memoization Audit
    └──requires──> React DevTools profiling session (must measure before applying)
    └──independent of──> Most other features

Avatar Caching
    └──requires──> AuthImage component extension (already exists)
    └──independent of──> All other features

Bundle Analysis
    └──requires──> rollup-plugin-visualizer install (dev-only)
    └──informs──> Dead code elimination targets
    └──independent of──> All other features
```

### Dependency Notes

- **Prefetch on hover requires stale-while-revalidate tuning first.** Prefetching data into cache is wasted if `staleTime: 0` immediately marks it stale. The prefetch and the staleTime configuration are a single logical unit that must ship together.
- **Progressive data loading requires both parallelization and skeletons.** Without parallelization, data arrives sequentially so there is nothing progressive. Without skeletons, the partially-loaded view looks broken during the gaps.
- **Route-level code splitting is fully independent.** It can be done in isolation as the first phase with zero risk to other features.
- **Bundle analysis informs but does not block.** Do it early to surface any large packages worth addressing before other phases finalize.

---

## MVP Definition

This is a subsequent milestone; the "MVP" concept maps to phase ordering within v1.7.

### Launch With (v1.7 core — highest perceived impact)

- [ ] Skeleton screens on all major data views — directly visible to every user on every navigation
- [ ] Stale-while-revalidate tuning — eliminates blank-screen flash on back-navigation
- [ ] Route-level code splitting — reduces startup parse time, low effort, high ROI
- [ ] Smart polling strategy — reduces unnecessary API calls, extends on-premise Jira server relief

### Add After Core (v1.7 secondary — visible but narrower impact)

- [ ] Query parallelization audit — addresses specific bottlenecks in sprint board and backlog
- [ ] Progressive data loading — depends on parallelization being done first
- [ ] Avatar and image caching — noticeable in team-heavy views (Workload, Sprint Board with 8+ members)
- [ ] Prefetch on sidebar hover — polish; only valuable after staleTime tuning is complete

### Future Consideration (v1.8+)

- [ ] Memoization audit — requires a profiler session; diminishing returns without measurement first; React Compiler may eventually automate this
- [ ] Bundle analysis and dead code elimination — good hygiene but unlikely to produce user-visible speed improvements given Tauri bundles are loaded locally

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Skeleton screens (all views) | HIGH | MEDIUM | P1 |
| Stale-while-revalidate tuning | HIGH | LOW | P1 |
| Route-level code splitting | MEDIUM | LOW | P1 |
| Smart polling (background pause) | MEDIUM | LOW | P1 |
| Query parallelization audit | HIGH | MEDIUM | P1 |
| Progressive data loading | HIGH | HIGH | P2 |
| Avatar and image caching | MEDIUM | MEDIUM | P2 |
| Prefetch on sidebar hover | MEDIUM | MEDIUM | P2 |
| Memoization audit | MEDIUM | MEDIUM | P2 |
| Bundle analysis | LOW | LOW | P3 |
| Dead code elimination | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Core v1.7 — directly addresses stated milestone goals, measurable perceived speed improvement
- P2: Secondary v1.7 — valuable but depends on P1 foundations or has narrower scope
- P3: Good hygiene, low user-visible impact

---

## Existing Architecture Integration Notes

These notes reflect the actual codebase state (v1.6.3) and directly affect implementation complexity.

| Feature | Existing Asset | Gap |
|---------|---------------|-----|
| Skeleton screens | `components/ui/skeleton.tsx` exists (shadcn); used in ~5 files | ~40 files use `isLoading` branches with no skeleton; need layout-matched skeletons per view |
| Stale-while-revalidate | Correct pattern in `useNotificationPolling` (`staleTime: pollIntervalMs - 5_000`) | Most dashboard queries use `staleTime: 0` or low values; test default `staleTime: 0` in QueryClient setup may be leaking into production |
| Code splitting | No `React.lazy` anywhere; all 16 routes eagerly imported in `routes.tsx` | Full replacement of 16 imports; needs `Suspense` fallback per route and an `ErrorBoundary` wrapper |
| Smart polling | `refetchIntervalInBackground: false` set on notification queries | Missing on most dashboard queries; no window visibility awareness in most hooks |
| Query parallelization | `useQueries` not used anywhere; parallel loading achieved by mounting multiple components | Sequential query chains in SprintBoardTab (status map needed before transitions can fire) are legitimate constraints; others (epics + sprint data) may be parallelizable |
| Avatar caching | `AuthImage.tsx` component exists and handles authenticated fetch | No caching layer; each render re-fetches from on-premise Jira |
| Memoization | `useMemo`/`useCallback` in 30 files; `React.memo` not used on list item components | List item components (TaskCard, BacklogRow, DraggableCard) re-render on every virtualizer scroll tick; highest-value targets |
| Bundle analysis | `rollup-plugin-visualizer` not installed | Clean gap; 10-minute addition to vite.config.ts |

---

## Sources

- [TanStack Query Prefetching and Router Integration](https://tanstack.com/query/v5/docs/framework/react/guides/prefetching)
- [TanStack Query Performance and Request Waterfalls](https://tanstack.com/query/v5/docs/react/guides/request-waterfalls)
- [TanStack Query Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries)
- [TanStack Query Mastering Polling (2025)](https://medium.com/@soodakriti45/tanstack-query-mastering-polling-ee11dc3625cb)
- [React code-splitting with Suspense — web.dev](https://web.dev/articles/code-splitting-suspense)
- [React Suspense and lazy loading tutorial — React 18/19](https://www.codewithseb.com/blog/react-suspense-tutorial-lazy-loading-async-rendering-data-fetching-react-18-19)
- [How to use useMemo and useCallback — developerway.com](https://www.developerway.com/posts/how-to-use-memo-use-callback)
- [React Compiler 1.0 released October 2025](https://dev.to/alexcloudstar/the-react-compiler-is-here-say-goodbye-to-usememo-and-usecallback-436g)
- [Skeleton Screens vs Loading Spinners — Onething Design](https://www.onething.design/post/skeleton-screens-vs-loading-spinners)
- [Efficient Polling with Page Visibility API in React](https://medium.com/@atulbanwar/efficient-polling-in-react-5f8c51c8fb1a)
- [Vite bundle analysis with rollup-plugin-visualizer 2025](https://codeparrot.ai/blogs/advanced-guide-to-using-vite-with-react-in-2025)
- Taskflow codebase v1.6.3: `routes.tsx`, `SprintBoardTab.tsx`, `BacklogPage.tsx`, `package.json`, `vite.config.ts` — direct inspection

---
*Feature research for: Taskflow v1.7 Performance and Perceived Speed*
*Researched: 2026-03-29*
