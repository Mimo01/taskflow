# Project Research Summary

**Project:** Taskflow v1.7 — Performance & Perceived Speed
**Domain:** Performance optimization for existing Tauri 2 + React 19 + TanStack Query desktop app
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

Taskflow v1.7 is not a greenfield build — it is a targeted performance pass on a ~51K-line production desktop app (Tauri 2, React 19, TanStack Query v5, @tanstack/react-virtual). The research confirms that perceived speed, not raw throughput, is the goal. The biggest gains come from three well-documented patterns: skeleton screens replacing spinners (removes blank-screen flash on every navigation), stale-while-revalidate tuning (eliminates wait on back-navigation), and route-level code splitting (reduces startup parse time). All three are low-to-medium effort and high visibility for every user. The React Compiler (v1.0, October 2025) replaces the need for a manual memoization audit entirely and should be wired up in the first phase so all subsequent work benefits automatically.

The recommended approach is to layer optimizations in dependency order: establish cache correctness first (staleTime tuning), then build loading UX on top of it (skeletons, progressive data), then add anticipatory behaviors (hover prefetch). Code splitting is independent and should go first since it carries the most production-build risk (Tauri's asset protocol requires `base: './'` in Vite config) and is easiest to validate in isolation. The net-new dependency footprint is minimal: one new runtime plugin (`@tauri-apps/plugin-fs` for optional avatar disk caching), three dev dependencies (React Compiler, its Rolldown transport, and a bundle analyzer), and the rest of v1.7 uses existing packages differently.

The key risk is the on-premise Jira DC target. Strategies that work fine against cloud APIs can cause 503 connection exhaustion against an on-premise server with unknown pool limits. Unbounded subtask chunk parallelism is already borderline in v1.6.3 and must not be amplified by outer query parallelization. Hover prefetch must be gated with a 100ms dwell timer and freshness check to prevent spurious Jira requests. Most critically, the `staleTime < refetchInterval` invariant must be maintained for all polled queries — violating it silently disables notification polling in production while unit tests (which use `staleTime: 0` overrides) continue to pass.

---

## Key Findings

### Recommended Stack

The existing stack requires only minimal additions for v1.7. One new runtime dependency (`@tauri-apps/plugin-fs@^2.4.5`) enables persistent avatar caching to `BaseDirectory.AppCache`. Three new dev dependencies handle build tooling: `babel-plugin-react-compiler@1.0.0` (exact pin) for automatic memoization at build time, `@rolldown/plugin-babel@^0.2.0` as its required Vite 8/Rolldown transport, and `rollup-plugin-visualizer@^7.0.1` for one-time bundle analysis. All other v1.7 work uses existing packages differently: `React.lazy` for code splitting, `queryClient.prefetchQuery` for hover prefetch, `Promise.all` restructuring inside query functions, and the existing shadcn `<Skeleton>` component.

**Core technologies (net-new):**
- `babel-plugin-react-compiler@1.0.0` (exact pin): automatic memoization at build time — replaces the need for a manual `React.memo`/`useMemo`/`useCallback` audit across ~50K lines; React 19 native, no shim needed
- `@rolldown/plugin-babel@^0.2.0`: required peer dependency for the React Compiler under Vite 8 + Rolldown; the legacy `rollup-plugin-babel` does NOT work
- `@tauri-apps/plugin-fs@^2.4.5`: official Tauri 2 plugin for writing blobs to `AppCache` — the only supported path for persistent avatar caching in a Tauri app
- `rollup-plugin-visualizer@^7.0.1`: dev-only, env-flag opt-in (`ANALYZE=true vite build`), Node >= 22 already satisfied

**Critical version note:** Pin `babel-plugin-react-compiler` to exact `1.0.0`. Compiler changes should be deliberate upgrades, not silent semver bumps.

See full details: `.planning/research/STACK.md`

### Expected Features

**Must have (table stakes — highest perceived impact, every user sees these):**
- Skeleton screens on all major data views — replaces `isLoading` spinner branches across ~45 files; shadcn `<Skeleton>` already exists, only layout-matched variants need authoring
- Stale-while-revalidate tuning — set `staleTime` to match or exceed `refetchInterval` on all dashboard queries; eliminates blank-screen flash on back-navigation; correct pattern already exists in `useNotificationPolling`
- Route-level code splitting — 16 routes are all eagerly imported in `routes.tsx`; convert 6 heavy routes to `React.lazy` with `ErrorBoundary` per route
- Smart polling — apply `refetchIntervalInBackground: false` to all dashboard queries (currently only set on notification queries); add `usePageVisibility` to pause polling when app is minimized

**Should have (secondary v1.7 — narrower impact, depends on must-haves):**
- Query parallelization — restructure sequential `await` chains in sprint board and backlog with `Promise.all`; safe parallelizable outer queries: `fetchProjectStatuses`, `fetchBoardQuickFilters`, `fetchActiveSprint`, `fetchEpicsBasic`
- Progressive data loading — render data sections independently as each query resolves; depends on parallelization and skeleton placeholders being in place first
- Avatar and image caching — extend `AuthImage.tsx` with a session-scoped `Map<url, objectURL>`; disk persistence via `@tauri-apps/plugin-fs` is optional
- Prefetch on sidebar hover — `queryClient.prefetchQuery` on `onMouseEnter` with 100ms dwell timer; only valuable after staleTime tuning is complete

**Defer to v1.8+:**
- Memoization audit (manual) — React Compiler 1.0 automates this; if the compiler is wired in Phase 1, the manual audit is redundant
- Bundle analysis and dead code elimination — low user-visible impact in a locally-served Tauri app; good hygiene but not perceived speed

**Anti-features (explicitly do not build):**
- Service Worker caching — Tauri's `tauri-plugin-http` bypasses `window.fetch`; service workers cannot intercept plugin requests
- Global `staleTime: Infinity` — Jira data changes constantly; stale board states with no indication of drift break optimistic mutation rollback
- WebSocket / SSE real-time — on-premise Jira DC does not emit WebSocket events; self-hosted GitLab webhooks require a public-facing server

See full details: `.planning/research/FEATURES.md`

### Architecture Approach

The performance layer integrates as four stacked modifications on top of the existing architecture: (1) a new Route Layer wrapping `routes.tsx` with `React.lazy`, `Suspense`, and `ErrorBoundary`; (2) a modified View Layer adding skeleton variants and progressive data display; (3) a modified Query Layer with staleTime tuning, hover prefetch, and visibility-aware polling; (4) a new/modified Cache Layer covering TanStack Query configuration and avatar caching. The Transport Layer (`tauri-plugin-http`) is unchanged.

**Major components:**
1. `routes.tsx` (modified) — convert 6 heavy routes to `React.lazy`; add `<Suspense fallback={<RouteSkeleton />}>` and `<ErrorBoundary>` per route
2. `src/components/skeletons/` (new) — `SprintBoardSkeleton`, `BacklogSkeleton`, `MyTasksSkeleton`, `NotificationsSkeleton`; layout dimensions must match real content exactly
3. `src/hooks/useDelayedLoading` (new) — 100-200ms delay before skeleton appears; prevents flicker on fast loads and cache-warm navigations
4. `src/hooks/usePageVisibility` (new) — detects app minimize/restore to pause and resume polling globally
5. `src/hooks/usePrefetch` (new) — dwell-timer-gated `prefetchQuery` call for sidebar navigation links
6. `AuthImage.tsx` (modified) — add session-scoped `Map<url, string>` cache before re-fetching from Jira

**Key pattern:** Skeleton shows only on `isLoading` (no cached data), never on `isFetching` (background revalidation). During revalidation, show stale data with the existing `StaleDataBanner` component.

See full details: `.planning/research/ARCHITECTURE.md`

### Critical Pitfalls

1. **Skeleton flicker on cache hits** — skeletons must show only on `isLoading` (no cached data), never on `isFetching` (background revalidation). Implement `useDelayedLoading` with a 100-200ms delay before any skeleton appears. The `StaleDataBanner` already exists for the revalidation case — use it.

2. **staleTime/refetchInterval invariant breakage** — increasing `staleTime` above `refetchInterval` silently disables polling. The invariant: `staleTime < refetchInterval` for all polled queries. Notification polling breaks invisibly when this is violated; the unit test suite will still pass (fake timers bypass the staleTime check), but production polling stops. Verify manually in DevTools for 2+ minutes after any staleTime change.

3. **Cache invalidation desync after mutations** — optimistic updates on the sprint board use `setQueryData`. After staleTime increases, `invalidateQueries` may find data "fresh" and skip the confirming refetch. Always use `invalidateQueries({ refetchType: 'active' })` in sprint board mutation handlers after any staleTime change.

4. **Code splitting breaking Tauri production builds** — dynamic imports require `base: './'` in `vite.config.ts` (relative paths). `tauri dev` uses Vite's dev server and masks path issues. Test every lazy-loaded route in an actual `tauri build` production binary before splitting the next route.

5. **Unbounded subtask chunk parallelism** — `fetchSprintIssues` already fires parallel chunk requests for subtasks. Adding outer query parallelization via `useQueries` creates a burst of 5-8+ simultaneous Jira DC requests. Limit concurrent chunk requests to 3. Do not prefetch the sprint board on hover — the request is too expensive.

See full details: `.planning/research/PITFALLS.md`

---

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Foundation — Code Splitting + React Compiler + Bundle Analysis
**Rationale:** Code splitting is fully independent of all other features and carries the highest production-build risk (Vite/Tauri asset path configuration). It must be validated on an actual `tauri build` binary before any other routes are split. React Compiler wired here means every subsequent phase gets automatic memoization for free, and the `ErrorBoundary` infrastructure created here is reused by all subsequent phases. Bundle analysis run once here surfaces any large initial-chunk packages worth addressing before later phases finalize.
**Delivers:** 6 heavy routes lazily loaded; React Compiler active across the codebase; `ErrorBoundary` infrastructure; bundle treemap for initial chunk analysis.
**Addresses:** Route-level code splitting (table stakes P1), React Compiler setup (replaces manual memoization audit), bundle analysis (P3 hygiene).
**Avoids:** Code splitting breaking Tauri production builds (Pitfall 4) — verify `base: './'` in `vite.config.ts` and test production binary on all three platforms before splitting more than one route.
**Research flag:** Standard patterns — React.lazy + Suspense + ErrorBoundary + Vite base config are well-documented in official Tauri and React docs. Skip research-phase.

### Phase 2: Cache Correctness — staleTime Tuning + Smart Polling
**Rationale:** staleTime tuning is the prerequisite for hover prefetch (prefetch is wasted if `staleTime: 0` immediately marks it stale) and for safe skeleton implementation (skeleton logic is only correct after `isLoading` vs `isFetching` semantics are stable across all queries). Smart polling belongs here because it modifies the same query configuration touch points. Both must be done before any UX features are layered on top.
**Delivers:** Per-query staleTime tuned across all dashboard queries with `staleTime = refetchInterval - 5000` invariant enforced; `refetchIntervalInBackground: false` on all dashboard queries; `usePageVisibility` hook; notification polling confirmed working in DevTools.
**Addresses:** Stale-while-revalidate tuning (table stakes P1), smart polling (table stakes P1).
**Avoids:** staleTime/refetchInterval invariant breakage (Pitfall 10) — audit every query's staleTime against its refetchInterval; verify sprint board mutation rollback paths still work after staleTime increases (Pitfall 3).
**Research flag:** Standard patterns — TanStack Query staleTime/gcTime/refetchInterval interactions are thoroughly documented with official sources. Skip research-phase.

### Phase 3: Loading UX — Skeleton Screens + Progressive Data
**Rationale:** Now that cache semantics are correct, skeleton implementation can be done safely — `isLoading` vs `isFetching` distinction is only meaningful after Phase 2 staleTime tuning is complete. Progressive data loading depends on skeleton placeholders for partially-loaded sections. Both belong together since they share the `useDelayedLoading` hook and the same loading state management patterns.
**Delivers:** `useDelayedLoading` hook; layout-matched skeleton components for all major views; `isLoading`-gated skeleton rendering (never `isFetching`); progressive data sections in sprint board and backlog rendering independently.
**Addresses:** Skeleton screens (table stakes P1), progressive data loading (secondary P2).
**Avoids:** Skeleton flicker on cache hits (Pitfall 2) — `useDelayedLoading` must be established as a reusable hook before skeletons are implemented broadly. Skeleton replacing stale data during revalidation (Architecture anti-pattern 1).
**Research flag:** Standard patterns — shadcn Skeleton already exists; `isLoading` vs `isFetching` distinction is documented TanStack Query behavior. Skip research-phase.

### Phase 4: Query Optimization — Parallelization + Hover Prefetch
**Rationale:** Query parallelization requires mapping existing dependency graphs before touching anything (Pitfall 5 — sprint board subtask amplification risk). Hover prefetch requires staleTime tuning already done (Phase 2) to be valuable. Both phases modify query execution patterns and share the same integration risk (on-premise Jira DC connection pool), so they belong together.
**Delivers:** Sprint board outer queries parallelized (`fetchProjectStatuses`, `fetchBoardQuickFilters`, `fetchActiveSprint`, `fetchEpicsBasic` via `Promise.all`); subtask chunk concurrency bounded to 3; `usePrefetch` hook with 100ms dwell timer and freshness check on sidebar nav links (lightweight queries only).
**Addresses:** Query parallelization (secondary P1), prefetch on sidebar hover (secondary P2).
**Avoids:** Two-query subtask amplification (Pitfall 5) — map sprint board dependency graph explicitly before implementation; do not add parallelism to queries that already parallelize internally. Unnecessary prefetch firing (Pitfall 9) — 100ms dwell timer + `getQueryState` freshness check mandatory; never prefetch `fetchSprintIssues`.
**Research flag:** Sprint board query dependency graph should be mapped explicitly during planning before writing implementation tasks. The safe concurrency ceiling for subtask chunks needs validation against the actual Jira DC instance — consider a measurement step in planning.

### Phase 5: Polish — Avatar Caching + Cleanup
**Rationale:** Avatar caching is independent of all other features but is the highest-complexity item relative to its impact (Pitfall 8 — must use `tauri-plugin-http`, not `window.fetch`; disk persistence adds Cargo.toml and capabilities complexity). Deferred until core perceived speed improvements are validated. Memoization audit is rendered redundant by React Compiler from Phase 1 — this phase confirms compiler coverage and closes out any components the compiler skipped.
**Delivers:** `AuthImage.tsx` extended with session-scoped `Map<url, objectURL>` cache; optional disk persistence to `AppCache` via `@tauri-apps/plugin-fs`; final test suite green across all phases.
**Addresses:** Avatar and image caching (secondary P2).
**Avoids:** Avatar caching CORS errors (Pitfall 8) — all fetch requests must use the existing `apiFetch` helper (tauri-plugin-http), not `window.fetch`. Evaluate whether the WebView HTTP cache already handles this before implementing custom caching.
**Research flag:** Evaluate WebView HTTP cache behavior before implementing. If Tauri's WKWebView / WebView2 honors `Cache-Control: max-age` headers from on-premise Jira avatars, custom caching may be unnecessary overhead. Measure first during Phase 5 planning.

### Phase Ordering Rationale

- **Code splitting first** because it is independent, carries the highest production-build risk, and the ErrorBoundary infrastructure it creates is needed by all subsequent phases. React Compiler active from day one means zero manual memoization work in later phases.
- **Cache tuning before loading UX** because skeleton behavior is only semantically correct after `isLoading` vs `isFetching` is stable. Prefetch is worthless before `staleTime > 0`.
- **Skeleton before prefetch** because progressive data loading depends on skeleton placeholders, and prefetch only provides user-visible value once cached data is served instantly (which requires skeleton/stale-data UX to be correct).
- **Parallelization and prefetch together** because they both modify query execution patterns and share the same on-premise Jira DC connection pool risk.
- **Avatar caching last** because it is the highest-complexity, narrowest-impact item, and the WebView may already handle it via HTTP cache headers.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Query Optimization):** Sprint board query dependency chain should be explicitly mapped before writing any implementation tasks — the chain `fetchActiveSprint → fetchSprintIssues (parent) → fetchSprintIssues (subtasks)` has non-obvious constraints about what is and is not parallelizable. The safe subtask chunk concurrency ceiling needs measurement against the actual Jira DC instance.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** React.lazy + Suspense + ErrorBoundary + Vite `base: './'` + React Compiler setup are all official documented patterns.
- **Phase 2 (Cache Correctness):** TanStack Query staleTime/refetchInterval/gcTime interactions are thoroughly documented with official sources at HIGH confidence.
- **Phase 3 (Loading UX):** shadcn Skeleton + `isLoading`/`isFetching` distinction is standard TanStack Query usage; no novel patterns.
- **Phase 5 (Polish):** Avatar caching with `tauri-plugin-http` is documented in official Tauri 2 plugin docs; session-scoped Map cache is a standard JS pattern.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All additions verified against official React, Tauri 2, and Vite 8 docs. React Compiler v1.0 release confirmed October 2025. `@rolldown/plugin-babel` peer dep requirement confirmed via vite-plugin-react issue thread (that specific detail is MEDIUM — issue thread vs official docs). |
| Features | HIGH | Based on direct codebase inspection of v1.6.3 plus official TanStack Query docs plus established UX research. Feature list is grounded in actual code gaps, not assumptions. |
| Architecture | HIGH | Derived from codebase structure plus official pattern documentation. Integration points mapped to actual files (`routes.tsx`, `AuthImage.tsx`, specific hooks). |
| Pitfalls | HIGH | Verified against official TanStack Query docs (staleTime/refetchInterval interaction is documented behavior), Tauri 2 asset serving docs, React Compiler release notes, and direct codebase inspection of existing fragile patterns (staleTime: 0 in test setup, unbounded subtask chunks, missing `refetchIntervalInBackground` on most dashboard queries). |

**Overall confidence:** HIGH

### Gaps to Address

- **WebView HTTP cache for avatars:** Unknown whether Tauri 2's WKWebView (macOS) and WebView2 (Windows) honor `Cache-Control` headers from on-premise Jira for authenticated image requests made through `tauri-plugin-http`. If they do, custom avatar caching in Phase 5 may be unnecessary. Measure before implementing.
- **On-premise Jira DC connection pool ceiling:** The "limit to 3 concurrent chunk requests" recommendation is based on general Jira DC guidance, not measurement against the specific customer instance. Phase 4 planning should include a measurement step.
- **React Compiler compatibility at scale:** The ~51K-line codebase should be compatible (React 19, clean hook patterns, zero-any TypeScript), but the compiler gracefully skips components it cannot analyze. The actual skip list will only be known after Phase 1 implementation — not a blocker, but worth tracking.

---

## Sources

### Primary (HIGH confidence)
- [React Compiler v1.0 Blog Post](https://react.dev/blog/2025/10/07/react-compiler-1) — stable release Oct 2025, React 19 native support confirmed
- [React Compiler Installation](https://react.dev/learn/react-compiler/installation) — `babel-plugin-react-compiler`, `@rolldown/plugin-babel`, `reactCompilerPreset` for Vite 8
- [Tauri 2 File System Plugin](https://v2.tauri.app/plugin/file-system/) — `BaseDirectory.AppCache`, read/write API, permissions model
- [TanStack Query v5 Prefetching Guide](https://tanstack.com/query/v5/docs/framework/react/guides/prefetching) — `prefetchQuery` API, hover/focus patterns, never-throws behavior
- [TanStack Query Important Defaults](https://tanstack.com/query/v5/docs/react/guides/important-defaults) — staleTime/gcTime/refetchInterval interactions and stale-while-revalidate behavior
- [TanStack Query Parallel Queries](https://tanstack.com/query/latest/docs/framework/react/guides/parallel-queries) — `useQueries`, waterfall avoidance
- [React code-splitting with Suspense — web.dev](https://web.dev/articles/code-splitting-suspense) — React.lazy + Suspense patterns
- [rollup-plugin-visualizer npm](https://www.npmjs.com/package/rollup-plugin-visualizer) — version 7.0.1, Node >= 22 requirement
- [@tauri-apps/plugin-fs npm](https://www.npmjs.com/package/@tauri-apps/plugin-fs) — version 2.4.5 confirmed
- Taskflow codebase v1.6.3 direct inspection — `routes.tsx`, `AuthImage.tsx`, `vite.config.ts`, `package.json`, all `useQuery` hooks

### Secondary (MEDIUM confidence)
- [vitejs/vite-plugin-react issue #1144](https://github.com/vitejs/vite-plugin-react/issues/1144) — `@rolldown/plugin-babel@^0.2.0` peer dep requirement for Vite 8 (issue thread, not official docs)
- [Efficient Polling with Page Visibility API in React](https://medium.com/@atulbanwar/efficient-polling-in-react-5f8c51c8fb1a) — `usePageVisibility` hook pattern
- [Skeleton Screens vs Loading Spinners — Onething Design](https://www.onething.design/post/skeleton-screens-vs-loading-spinners) — Facebook 50% faster perception research
- [TanStack Query Mastering Polling (2025)](https://medium.com/@soodakriti45/tanstack-query-mastering-polling-ee11dc3625cb) — polling best practices

---
*Research completed: 2026-03-29*
*Ready for roadmap: yes*
