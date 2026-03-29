# Pitfalls Research

**Domain:** Performance & perceived speed optimizations — adding to an existing Tauri 2 + React 18 + TanStack Query desktop app
**Researched:** 2026-03-29
**Confidence:** HIGH (verified against official React docs, TanStack Query docs, community post-mortems, and codebase inspection of ~51K line existing codebase)

## Critical Pitfalls

### Pitfall 1: Premature or Blanket Memoization Slows the App Down

**What goes wrong:**
`React.memo`, `useMemo`, and `useCallback` are applied to every component and value "just in case," treating memoization as a free optimization. This increases memory pressure, inflates the cost of every render (React must now compare dependencies in addition to rendering), and creates identity-reference traps where stable references prevent cache hits in TanStack Query.

The project already has targeted `useMemo` in `SprintBoardTab`, `BacklogPage`, `WorkloadTab`, `ReleasesTab`, and others. The risk is that an audit phase wraps everything indiscriminately, including components that render trivially (icon wrappers, badge chips, simple text cells) where comparison overhead exceeds render cost.

**Why it happens:**
"Memoization audit" sounds like a task with clear deliverables — wrap a list of components. The audit stops being an audit and becomes a wrap-all-the-things session. No profiling is done first.

**How to avoid:**
1. Profile before touching anything. Use React DevTools Profiler to identify components with >1ms render time that re-render unnecessarily. Only those are candidates.
2. Apply the three-question test before each `React.memo`: (a) Does this component re-render frequently from its parent? (b) Does the same parent pass the same props between renders? (c) Is the render cost measurable? All three must be YES.
3. `useCallback` on event handlers is only useful when the function is passed to a memoized child. `useCallback` alone does not reduce re-renders.
4. Never wrap leaf/presentational components (badge, icon, label). Always wrap heavy list rows first: `TaskCard`, `DraggableCard`, `TaskRow`, `StoryHeaderRow`.
5. Use `useMemo` exclusively for expensive derivations: swimlane grouping in `SprintBoardTab`, filter intersection logic with `savedFilterIssueKeys` as `Set<string>`, workload aggregation in `WorkloadTab`.

**Warning signs:**
- `useMemo` wrapping a single property access or string concatenation.
- `React.memo` on a component that receives new object/array props from an un-memoized parent (reference instability negates memo).
- `useCallback` on a function not passed to any child.
- Test suite performance gets significantly worse (memoized components require more setup to test render behavior).

**Phase to address:**
Memoization audit phase — must begin with a profiling session; the profiling results drive the work list, not a component inventory.

---

### Pitfall 2: Skeleton Screen Flicker on Fast Jira Responses

**What goes wrong:**
Skeleton screens are shown for every `isLoading` state. On fast connections or cached queries (stale-while-revalidate hits cache), the Jira response returns in under 100ms. The skeleton flashes on screen for one frame and immediately disappears. This is perceptually worse than a spinner or no loading state — it creates visual noise and feels broken.

The project's `staleTime: 5 * 60 * 1000` default means most navigations will serve cached data. Showing a skeleton for cached data that resolves instantly produces constant visual flicker as users navigate between tabs.

**Why it happens:**
Skeleton implementations show on `isLoading` (no cache) but also on `isFetching` (background refetch) without distinguishing them. Or `isLoading` is used correctly but there is no minimum display time — the skeleton flashes for 16ms when cache is warm.

**How to avoid:**
1. Distinguish `isLoading` (no cached data) from `isFetching` (background revalidation). Show skeletons only on `isLoading`. During `isFetching`, show the stale data with a subtle `StaleDataBanner` — the project already has this component.
2. For routes where stale-while-revalidate is the normal case (dashboard, sprint board, my tasks), do NOT show a skeleton on mount — show cached data immediately, refetch in background silently.
3. Implement a 100-200ms delay before showing any skeleton (via `useState` + `useEffect` with cleanup). If data arrives before the delay, skip the skeleton entirely.
4. Skeleton layout must match the real content dimensions precisely. If it does not, content reflow after skeleton removal is jarring — worse than the original spinner.

**Warning signs:**
- Skeleton renders for fewer than 3 animation frames before content appears.
- Users describe "flickering" after the optimization is applied.
- Skeletons display during background refetch polling even when stale data is shown.
- Layout shift (CLS) occurs when skeleton is replaced by content with different dimensions.

**Phase to address:**
Skeleton screens phase — skeleton delay pattern must be established as a reusable hook (`useDelayedLoading`) before implementing skeletons across 20+ views.

---

### Pitfall 3: Cache Invalidation Desync After Mutations Breaks Optimistic State

**What goes wrong:**
TanStack Query's `invalidateQueries` is called after a mutation but with a key that does not match the actual cached key. The cache is not invalidated. Users see stale data. Or: `invalidateQueries` is called with a partial key that is too broad, invalidating unrelated queries and triggering network waterfalls.

The existing sprint board uses optimistic updates (`setQueryData`) for drag-to-transition. Adding stale-while-revalidate tuning changes `staleTime` values. If `staleTime` increases for the sprint query and the optimistic update sets data that extends its own freshness window, the mutation's invalidation call finds the data "fresh" and skips the background refetch — leaving the UI showing the optimistic state as if it were confirmed, even if it was rolled back.

**Why it happens:**
`setQueryData` for optimistic updates uses the exact query key. `invalidateQueries` often uses a partial key or string prefix. When query keys include dynamic parameters (e.g., `['sprint-board', projectKey, boardId, jiraBaseUrl]`), a broad invalidation call (`invalidateQueries({ queryKey: ['sprint-board'] })`) hits all sprint queries. Developers who correctly tune `staleTime` upward forget that doing so can suppress the re-fetch that would confirm or roll back an optimistic update.

**How to avoid:**
1. Use exact query keys for invalidation on mutation success/rollback. `queryClient.invalidateQueries({ queryKey: EXACT_KEY, exact: true })` rather than prefix matching.
2. After a status transition mutation (optimistic update), always call `invalidateQueries` with `refetchType: 'active'` to force an immediate background refetch regardless of `staleTime`.
3. Never increase `staleTime` for queries that are targets of optimistic mutations without auditing the mutation's rollback path.
4. The project's existing status transition rollback (`onError: () => queryClient.setQueryData(...)`) must be tested after any `staleTime` change to the sprint board query.

**Warning signs:**
- Board card shows a status it was moved FROM after returning to the sprint board tab.
- `invalidateQueries` calls in mutation handlers that use plain string prefixes rather than full query key arrays.
- Test suite passes because `staleTime: 0` in test `QueryClient` config — the bug only appears at production `staleTime` values.

**Phase to address:**
Stale-while-revalidate tuning phase and query parallelization phase — both touch staleTime and query key structures. Must verify mutation + rollback paths after any staleTime change.

---

### Pitfall 4: Code Splitting Breaking createHashRouter Navigation

**What goes wrong:**
`React.lazy` + `Suspense` wrapping route components works in Vite dev mode but can fail in the Tauri production build. The portable executable serves assets from a bundled path. If a lazy-loaded chunk references an absolute asset path or if the Vite `base` config is wrong, the chunk fails to load in production with a 404 error in the Tauri webview's DevTools console — but the user sees a blank route with no error UI.

The project uses `createHashRouter`, which prevents path-based asset resolution issues for the main bundle, but dynamically imported chunks use a resolved `publicPath` that must match the Tauri webview's asset serving path.

**Why it happens:**
Vite's `build.assetsDir` and `base` config defaults work for browser deployments. Tauri 2's webview serves the frontend from a custom protocol (`tauri://localhost`). The `publicPath` for dynamic imports is resolved at build time. A mismatch produces silent 404s for chunks, especially on Windows where the asset protocol path differs from macOS/Linux.

**How to avoid:**
1. Before adding any `React.lazy` imports, verify the existing Vite config explicitly sets `base: './'` (relative asset paths). Tauri's official starter templates use `base: './'` — check `taskflow/vite.config.ts`.
2. After adding the first lazy-loaded route, test the production build on all three platforms (`tauri build`) before proceeding. Do not add 15 lazy routes and then discover they all break.
3. Add an `<ErrorBoundary>` around each `<Suspense>` boundary. Without it, a chunk load failure renders nothing — the user sees a blank route. With it, the error is catchable and `ErrorPage` can be shown.
4. Test the portable executable directly (not `tauri dev`) after each code splitting change. `tauri dev` uses Vite's dev server which bypasses chunk loading via the Tauri asset protocol.
5. The Vite build warning "Use of eval() is strongly discouraged" from some Tauri plugins can be safely ignored, but "Large initial bundle" warnings for lazy-loaded routes that didn't split indicate the `React.lazy` import is being eagerly resolved.

**Warning signs:**
- Blank screen when navigating to a lazy-loaded route in the production build only.
- DevTools console shows `Failed to fetch dynamically imported module` or 404 for a `.js` chunk.
- `tauri dev` works fine but `tauri build` + run produces blank routes.
- Suspense fallback never shows (Tauri webview network tab shows the chunk request never fires).

**Phase to address:**
Code splitting phase — verify Vite config and add error boundary wrappers before splitting any routes. Test production build after the first split before proceeding.

---

### Pitfall 5: Two-Query Subtask Strategy Amplifies Under Query Parallelization

**What goes wrong:**
The sprint board's `fetchSprintIssues` already executes two sequential queries: (1) parent stories, then (2) parallel subtask chunk queries. If the query parallelization phase wraps this in a `useQueries` call alongside other concurrent queries (e.g., status lookup, board config, quick filters, active sprint), it creates a burst of 5-8 simultaneous Jira API requests on every sprint board mount. On-premise Jira DC handles this poorly — connection pool exhaustion causes 503 responses, and the subtask queries (which silently degrade to empty) cause disappearing cards.

The Jira DC instance is on-premise with an unknown connection limit. The existing behavior triggers the two-query subtask strategy already. Parallelizing the outer queries that feed the board adds more simultaneous connections.

**Why it happens:**
`useQueries` for parallelization is the correct pattern for independent queries (e.g., fetching multiple issues in parallel). But the sprint board queries are not fully independent — the subtask query depends on the parent query's results. Wrapping the outer queries in `useQueries` increases concurrency without addressing the inner sequential dependency.

**How to avoid:**
1. Map existing query dependencies before adding parallelization. The sprint board query chain is: `fetchActiveSprint` → `fetchSprintIssues` (parent) → `fetchSprintIssues` (subtasks). The first two are inherently sequential. Only queries with no data dependency can run in parallel.
2. Parallelizable sprint board queries: `fetchProjectStatuses`, `fetchBoardQuickFilters`, `fetchActiveSprint`, and `fetchEpicsBasic`. These are independent and safe to run in parallel.
3. Do NOT parallelize `fetchSprintIssues` itself — its two-query subtask strategy already parallelizes the subtask chunks internally.
4. Add connection throttling for the subtask chunk queries: limit concurrent chunk requests to 3 (not all `SUBTASK_CHUNK_SIZE=50` chunks in parallel). The existing `Promise.all` on chunks is unbounded.
5. Measure with the actual on-premise Jira DC instance. Simulate 40+ stories (40+ subtask chunk calls) in a staging environment before shipping.

**Warning signs:**
- Sprint board shows parent stories but no subtask cards intermittently.
- Jira DC server logs show 503 responses during sprint board load.
- The `fetchSprintIssues` second query silently catches all errors (returns `[]`) — failures here are invisible without DevTools open.
- Network waterfall shows 8+ simultaneous Jira requests on sprint board mount.

**Phase to address:**
Query parallelization phase — explicitly map the sprint board query dependency graph before applying `useQueries`. Bound the subtask chunk concurrency.

---

### Pitfall 6: Over-Engineering the Polling Strategy Breaks the Test Suite

**What goes wrong:**
A "smart polling" implementation introduces new hooks (`useActiveViewPolling`, `useAdaptiveInterval`, `useVisibilityAwarePolling`) that read from Zustand stores, listen to router state, and modify TanStack Query's `refetchInterval` dynamically. These hooks are difficult to test in jsdom. Tests that previously mocked `refetchInterval: false` now need to also mock router location, visibility API, Zustand store state, and the `useActiveViewPolling` return value. The test suite breaks in bulk.

The 665+ test suite already has fragile `staleTime: 0` overrides in `SprintBoardTab.test.tsx`, `SprintProgressTab.test.tsx`, `SprintHealthPanel.test.tsx`, and `ReleasesTab.test.tsx`. Polling-aware hooks add another layer of test setup that existing tests do not account for.

**Why it happens:**
Polling optimization feels like a neat systems problem — adaptive intervals, visibility detection, active-tab priority. The implementation grows to cover edge cases. The result is a heavyweight hook that touches too many concerns and is hard to isolate in tests.

**How to avoid:**
1. Use TanStack Query's built-in `refetchIntervalInBackground: false` — this is already used correctly in `useUpdatePolling` and `useVersionPolicyCheck`. Apply the same pattern to sprint board and backlog queries.
2. Use the Page Visibility API at the `queryClient` level (one place) rather than per-hook. TanStack Query v5 supports `networkMode: 'always'` and `refetchOnWindowFocus` — configure these globally.
3. Active-view polling priority: simpler than it sounds. Set `refetchInterval` to `false` on queries for routes the user is not on (via `enabled: useIsActiveRoute('/sprint-board')`). This is one custom hook, not a system.
4. Any new polling hook must be extractable from the component without side effects. Test the hook in isolation with a mock `queryClient` and controlled visibility state.
5. The LazyStore mock in `setup.ts` is not designed for polling scenarios. New polling tests must use `vi.useFakeTimers()` and `act()` for interval advancement. Add this pattern to one test first and verify it works before applying broadly.

**Warning signs:**
- A new hook has more than 3 external dependencies (stores, router, query client, visibility API, settings).
- Existing tests that previously passed start failing with "cannot read properties of undefined" after polling changes.
- `vi.useFakeTimers()` is needed in 10+ test files that did not previously use fake timers.
- `refetchInterval` is being set from inside a Zustand store selector — this creates a re-render feedback loop.

**Phase to address:**
Smart polling phase — design the polling strategy to be maximally simple. Prefer built-in TanStack Query options over custom hooks. Test the hooks before applying to components.

---

### Pitfall 7: Bundle Analysis False Positives from Bundled-by-Design Dependencies

**What goes wrong:**
A bundle analyzer (Vite's `rollup-plugin-visualizer` or `vite-bundle-analyzer`) shows large "chunks" from `react-grid-layout`, `@dnd-kit/core`, `jira2md`, and `react-markdown`. These are flagged for tree shaking or splitting. Attempting to lazy-load `react-grid-layout` (used in the Dashboard widget grid) breaks the grid's layout persistence because `react-grid-layout` stores responsive breakpoints in component state — splitting it across async boundaries loses layout context on first render.

Similarly, `jira2md` + `react-markdown` appear large but are only loaded in `IssueDetailPage` and `IssueDetailContent` — they are already effectively lazy if those routes are split. Splitting them again at the component level produces redundant chunk files.

**Why it happens:**
Bundle analyzers show size without context. A 50KB library that is only used once is not a problem if it is on an infrequently visited route. The issue is the main bundle's blocking size, not total bundle size. Developers try to eliminate every "large" item in the visualizer without asking "is this on the critical path?"

**How to avoid:**
1. Measure the critical path metric, not total bundle size. The metric is: time from app launch to `<Dashboard>` component being interactive. Everything else is secondary.
2. Use `rollup-plugin-visualizer` with `template: 'treemap'` to see what is in the initial chunk vs lazy chunks. The initial chunk is the target.
3. Libraries that are already behind lazy-loaded routes (dashboard widgets, issue detail, MR detail) do not need additional splitting — they will naturally end up in the lazy chunk.
4. `react-grid-layout` uses `window.matchMedia` internally. Lazy loading it behind `<Suspense>` with an SSR/jsdom fallback requires careful handling — the grid will flash its initial state on hydration. For a desktop Tauri app this is less critical, but the layout persistence (saved to `LazyStore`) must be loaded before the grid renders to avoid a layout jump.
5. Tree shaking of `lucide-react` provides meaningful gains (icon library is large but most icons are unused). Use named imports only — the project already does this. Verify via the bundle analyzer that the lucide chunk is appropriately small.

**Warning signs:**
- Bundle analyzer flag on a library that is already in a lazy-loaded route.
- Dashboard widget grid loses its saved layout on first render after splitting.
- `react-grid-layout` renders at default layout for one frame before reading persisted layout (visible jank).
- `jira2md` being split into its own chunk for a component that renders inline (not behind a route).

**Phase to address:**
Bundle analysis phase — establish critical path metric first. Only optimize what is in the initial (blocking) bundle. Do not split libraries that are already behind lazy routes.

---

### Pitfall 8: Image/Avatar Caching Bypassing the Tauri HTTP Plugin

**What goes wrong:**
Jira avatar URLs point to the on-premise Jira instance (`https://jira.example.com/secure/useravatar?...`). Browsers normally cache these via HTTP `Cache-Control` headers. In Tauri 2, image requests made via `<img src="...">` tags go through the Tauri webview, which uses `tauri-plugin-http` for same-origin requests. If avatar fetching is re-implemented as JavaScript fetch calls to enable caching, it must use `fetch` from `tauri-plugin-http` — the same pattern the rest of the app uses. Plain browser `fetch` or `XMLHttpRequest` will hit CORS restrictions.

Alternatively, if avatar URLs are cached by writing to the filesystem via Tauri's `fs` plugin, the cache path must use `appLocalDataDir()` (writable without admin rights on all platforms), not `homeDir()` or a hardcoded path.

**Why it happens:**
Avatar caching seems like a simple optimization. Developers cache image blobs to `localStorage` (has 5-10MB limit, serialized as base64 = 33% size inflation) or use service workers (not supported in Tauri webviews). Neither approach works.

**How to avoid:**
1. For in-memory session caching: store avatar URLs → object URLs in a module-level `Map<string, string>`. Use `URL.createObjectURL()` on the fetched blob. This is zero-config, fast, and requires no new Tauri plugins.
2. For persistent disk caching: use `tauri-plugin-fs` to write blobs to `appLocalDataDir()/avatars/`. Use the Jira user account ID as the filename (URL-safe). Check existence before fetching.
3. All avatar fetch requests must use `tauri-plugin-http` (the existing `apiFetch` helper), not native browser fetch, to avoid CORS errors on the on-premise Jira instance.
4. Avatar cache invalidation: Jira avatar URLs include a version parameter (`?ownerId=...&avatarId=...`). Cache by the full URL including version — when the avatar changes, the URL changes, and the old cache entry is orphaned. Add a TTL-based cleanup to `appLocalDataDir/avatars/` on app start.
5. Consider whether avatar caching is worth the complexity. The primary perceived performance gain comes from skeletons, stale-while-revalidate, and code splitting. Avatars are small (1-5KB), and Jira's HTTP headers usually include `Cache-Control: max-age=31536000` for avatars — the webview may already cache them.

**Warning signs:**
- Avatar fetch uses `window.fetch()` instead of the Tauri HTTP plugin → CORS error on on-premise Jira.
- Avatars written to `localStorage` → 5MB limit exceeded after extended use.
- Cache stored as base64 strings → 33% size overhead compared to binary storage.
- `fs` plugin writes to a path that requires admin rights on Windows.

**Phase to address:**
Image/avatar caching phase — evaluate whether WebView cache is already sufficient before implementing custom caching. If implementing, use module-level Map for session caching as the first approach.

---

### Pitfall 9: Prefetching on Hover Triggering Unnecessary Jira API Calls

**What goes wrong:**
Sidebar navigation links are enhanced with `onMouseEnter` handlers that call `queryClient.prefetchQuery` for the target route's data. A developer who moves the mouse across the sidebar (scrolling past it, for example) fires 5-6 prefetch requests to Jira. Each request goes to the on-premise Jira DC. Under normal usage this is benign. During a slow network event, it creates a backlog of pending requests that delay the actual navigation the user wanted.

The notification polling hook (`useNotificationPolling`) already runs on a configurable interval. Prefetch requests compete with polling requests for the same HTTP connection pool in Tauri's webview.

**Why it happens:**
`onMouseEnter` fires immediately. There is no dwell time or intent detection. A developer who sees "prefetch on hover" as a pattern implements it without adding the debounce that makes it useful rather than aggressive.

**How to avoid:**
1. Add a 100-150ms dwell timer before firing any prefetch. If the mouse leaves before the timer fires, cancel the prefetch. This filters out incidental hover events.
2. Check `queryClient.getQueryState(queryKey)` before prefetching. If data is fresh (within `staleTime`), skip the prefetch — the data is already in cache.
3. Only prefetch for the currently active role's navigation items. PM users do not need sprint board prefetching; developer users do not need workload prefetching.
4. Add a prefetch budget per navigation event: maximum 2 prefetch requests per hover intent. If the user hovers over 3 links in rapid succession, only the first 2 trigger prefetches.
5. The sprint board `fetchSprintIssues` prefetch would trigger the two-query subtask strategy (Pitfall 5). Do not prefetch sprint board data on hover — the request is too expensive. Limit hover prefetching to lightweight queries: active sprint metadata, issue summaries.

**Warning signs:**
- DevTools network tab shows Jira API calls firing during sidebar mouseover without any navigation.
- Notification polling gets delayed because prefetch requests occupy the connection queue.
- Prefetch fires for routes the user visits infrequently (releases, epics) every time they hover past them in the sidebar.

**Phase to address:**
Prefetching phase — implement with dwell timer and freshness check from the start. Do not prefetch expensive queries (sprint board, backlog).

---

### Pitfall 10: Stale-While-Revalidate Tuning Causing Race Between Polling and Background Refetch

**What goes wrong:**
The notification polling hook (`useNotificationPolling`) uses `refetchInterval` to poll on a configurable schedule (default 60s in the codebase). Tuning `staleTime` for notification-related queries to be higher than `refetchInterval` creates a race condition: TanStack Query considers the data fresh (staleTime not expired), so `refetchInterval` fires but the refetch is skipped because the data is still "fresh." Notifications are not polled.

Conversely, setting `staleTime` too low on queries that were previously stable causes aggressive re-fetching from background components, burning through Jira API calls silently.

**Why it happens:**
`staleTime` and `refetchInterval` interact in a non-obvious way. From the TanStack Query docs: a query will refetch if `refetchInterval` fires AND the data is stale. If `staleTime > refetchInterval`, the refetch is skipped. Developers tuning `staleTime` for perceived speed (higher = show cached data longer) inadvertently disable polling.

**How to avoid:**
1. The invariant to maintain: `staleTime < refetchInterval` for any query that uses polling. The existing `useNotificationPolling` already enforces this correctly: `staleTime: pollIntervalMs - 5_000`. Apply this same formula anywhere `staleTime` is tuned for a polled query.
2. Before tuning `staleTime` for any query, check whether that query has a `refetchInterval`. If yes, staleTime must remain at `refetchInterval - smallBuffer` (5s or less).
3. Non-polled queries (sprint board, backlog, releases) can have `staleTime` tuned aggressively (5-30 minutes) without polling side effects.
4. After tuning, open DevTools and observe the network tab for 2+ minutes. Verify notification polling fires at the expected interval. This cannot be verified from unit tests (fake timers cannot reproduce the actual interaction).

**Warning signs:**
- Notification badge stops updating after stale-while-revalidate tuning is applied.
- Network tab shows no Jira API calls for notification queries after the first load.
- `useNotificationPolling` test suite passes (fake timers bypass the staleTime check), but production polling is broken.
- User reports "notifications not updating" after v1.7 ships.

**Phase to address:**
Stale-while-revalidate tuning phase — audit every query's `staleTime` against its `refetchInterval` before and after tuning. Test polling behavior manually, not just via unit tests.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Wrap all route components in `React.lazy` at once | Fast completion of "code splitting" task | Some routes are lightweight and gain nothing; chunk loading overhead for tiny components; production build untested per route | Never — split one route, verify build, then proceed |
| `isLoading \|\| isFetching` as skeleton trigger | Skeleton shows during all loading states | Skeleton flickers during background polling; stale data is hidden during revalidation | Never for polled queries; acceptable for initial load only |
| Increase `staleTime` globally in QueryClient default | Single change, immediate perceived speed improvement | Breaks polling invariant for notification queries; suppresses refetch after mutations | Never globally — tune per-query with dependency audit |
| `useMemo` on every component that "might be slow" | Looks like optimization coverage | Reference instability negates memo; adds memory overhead; makes tests harder | Only after profiler shows >1ms render time with unnecessary re-renders |
| Prefetch all sidebar routes on app mount (eager prefetch) | All data warm from the start | 8-12 Jira API requests on every cold start; batters on-premise Jira DC during morning standup rush | Never — prefetch only the default landing route on mount |
| Implement avatar caching before measuring impact | Feels like a clear win | `tauri-plugin-http` required; `localStorage` limit hit; complexity for marginal gain if WebView already caches | Defer until profiler shows avatar fetching as a measurable bottleneck |
| Add Suspense boundary at app root only | Simple setup | Entire app blanks on any lazy chunk failure; no granular error recovery | Never — Suspense must be co-located with the lazy component |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Tauri webview + `React.lazy` | Setting Vite `base: '/'` (absolute paths) for dynamic imports | Set `base: './'` (relative paths); verify with actual `tauri build` on all three platforms |
| On-premise Jira DC + prefetching | Prefetching expensive queries (fetchSprintIssues) on hover | Only prefetch lightweight queries (active sprint metadata, issue summaries); add 100ms dwell timer |
| TanStack Query + Zustand persist | Storing TanStack Query data in Zustand for cross-component sharing | Use TanStack Query's own cache as the source of truth; read from cache with `queryClient.getQueryData()` not from a Zustand selector |
| `@tanstack/react-virtual` + existing usage | Adding a second Virtualizer to a list already virtualized | Check for existing `useVirtualizer` before adding; double virtualization causes hidden overflow issues |
| TanStack Query + optimistic updates + staleTime | Increasing staleTime on a query that has optimistic mutations | Always pair staleTime increase with `invalidateQueries({ refetchType: 'active' })` in mutation handlers |
| LazyStore (Tauri plugin-store) + performance | Loading LazyStore in the render path for layout data | Load LazyStore data in an effect, not during render; react-grid-layout layouts must be available before first paint to avoid layout jump |
| `useNotificationPolling` + staleTime tuning | Setting staleTime ≥ refetchInterval on notification queries | Maintain `staleTime = refetchInterval - 5000` invariant; poll stops silently if data is "fresh" |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded subtask chunk parallelism | Jira DC 503 during sprint board load; cards disappear intermittently | Limit concurrent chunk requests to 3 via `p-limit` or manual batching | Sprint with >3 stories (3 chunk requests to Jira simultaneously) |
| Background polling competing with user-initiated requests | Slow response to user actions while polling fires | `refetchIntervalInBackground: false` on all non-notification queries | Any tabbed workflow where user switches away from and back to the app |
| Route-level Suspense without ErrorBoundary | Blank white screen on chunk load failure | Wrap every `<Suspense>` with an `<ErrorBoundary>` | Production builds; Tauri asset protocol path mismatches |
| Skeleton replaces stale data during revalidation | Content "jumps" away to skeleton then back | Show stale data + `StaleDataBanner` during refetch; skeleton only on `isLoading` (no cache) | Every background refetch after stale-while-revalidate tuning |
| `queryClient.prefetchQuery` on `onMouseEnter` without debounce | 5-10 extra Jira requests per sidebar hover | 100ms dwell timer + freshness check before prefetch | Constant during normal sidebar navigation |
| `useMemo` with unstable dependency | Memoized value recalculates on every render (worse than no memo) | Stabilize upstream objects/arrays or use deep-comparison sparingly | Immediately — defeats the purpose |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Caching Jira avatars to filesystem with PAT-derived path | Avatar path leaks PAT derivation pattern if path is guessable | Use hashed user ID as filename, never embed PAT in cache paths |
| Storing fetched issue data in Zustand persist store | Issue content (potentially sensitive) persists in plaintext on disk | Keep TanStack Query cache (memory-only) as the source of truth; only persist UI state (filter selections, layout) in Zustand |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Skeleton screen with wrong layout dimensions | Content reflows after skeleton removal — more disorienting than a spinner | Measure actual rendered content dimensions; match skeleton to final layout exactly |
| Skeleton on every navigation (even cache hits) | Constant visual noise; app feels jittery | Show skeleton only when `isLoading` is true (no cached data); show stale data with subtle banner during revalidation |
| Skeleton for <100ms loads | One-frame flash; worse than nothing | 100-200ms delay before skeleton appears; skip if data arrives first |
| Code splitting adds perceptible navigation delay | App feels slower after optimization | Only split routes with bundles >50KB; keep navigation-critical routes (dashboard, sprint board) eager-loaded |
| Prefetch warms data that users never visit | Wasted Jira API calls; delayed actual navigation | Prefetch only the most likely next navigation from current route; not all sidebar items |
| Avatar images reloading after every navigation | Flickering avatars in task cards, sprint board | Implement session-level URL→objectURL Map; persist to disk for frequently seen users |
| Sprint board shows empty while parent stories load | Two-phase visual — stories appear, then subtasks "pop in" | Stale-while-revalidate: show full prior data while refetching; skeleton for true initial load only |

## "Looks Done But Isn't" Checklist

- [ ] **Code splitting:** Often only tested in `tauri dev` — verify each lazy-loaded route works in a `tauri build` production binary on all three platforms
- [ ] **Skeleton screens:** Often show during background revalidation — verify skeleton does NOT appear when TanStack Query has cached data (`isLoading: false, isFetching: true`)
- [ ] **Stale-while-revalidate tuning:** Often breaks polling — verify notification polling fires at configured interval after every `staleTime` change
- [ ] **Memoization:** Often applied without profiling — run React DevTools Profiler before AND after; the "after" must show fewer highlighted re-renders
- [ ] **Query parallelization:** Often adds parallelism to already-parallelized queries — verify `fetchSprintIssues` subtask chunks are not receiving additional parallelism pressure
- [ ] **Prefetching:** Often fires for all sidebar links — verify prefetch only fires for the specific link hovered and only after 100ms dwell
- [ ] **Bundle analysis:** Often reports before/after total sizes without critical path metric — measure time-to-interactive on the Dashboard route specifically
- [ ] **Avatar caching:** Often implemented with browser `fetch` — verify avatar requests use `tauri-plugin-http` to avoid CORS errors on on-premise Jira
- [ ] **Test suite:** Often broken by polling/timing changes — run `vitest run` with full output after every phase; zero failures required before proceeding

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Code splitting breaks production routes | MEDIUM | Revert `React.lazy` imports for the broken route; restore eager import; fix Vite `base` config; re-test before re-splitting |
| Stale-while-revalidate breaks notification polling | LOW | Restore `staleTime = refetchInterval - 5000` for notification queries; one-line fix but requires revert to identify which query was changed |
| Cache invalidation desync causes stale sprint board | MEDIUM | Add `exact: true` and `refetchType: 'active'` to all mutation invalidation calls; run board transition E2E manually |
| Over-memoization causes reference instability | MEDIUM | Remove `React.memo` from components with unstable parent props; trace the prop reference chain via DevTools Profiler |
| Prefetch flood on Jira DC | LOW | Remove `onMouseEnter` prefetch handlers; add dwell timer and freshness check before re-enabling |
| Skeleton flicker after stale-while-revalidate | LOW | Change skeleton trigger from `isLoading \|\| isFetching` to `isLoading` only; add `useDelayedLoading` hook with 150ms threshold |
| Test suite broken by timing/polling changes | MEDIUM | Scope `vi.useFakeTimers()` to only the affected test file; add explicit `act()` wrappers around interval advances |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Premature/blanket memoization | Memoization audit phase | React DevTools Profiler shows target components highlighted fewer times; no useMemo on trivial values |
| Skeleton flicker on fast loads | Skeleton screens phase | Skeleton does not appear during background revalidation; no flash on tab navigation |
| Cache invalidation desync | Stale-while-revalidate tuning phase + mutation-touching phases | Manual test: drag card to new status, navigate away and back, confirm position persisted |
| Code splitting breaking Tauri production builds | Code splitting phase | `tauri build` tested on all three platforms; no blank routes in production binary |
| Subtask strategy amplified by parallelization | Query parallelization phase | DevTools network tab shows ≤3 simultaneous Jira requests on sprint board mount |
| Polling strategy breaking test suite | Smart polling phase | `vitest run` produces zero failures after polling changes |
| Bundle analysis false positives | Bundle analysis phase | Only libraries in the initial chunk are analyzed; already-lazy routes excluded |
| Avatar caching CORS via wrong fetch | Image/avatar caching phase | DevTools network tab shows avatar requests via Tauri HTTP plugin; no CORS errors |
| Prefetch flood on sidebar hover | Prefetching phase | Network tab shows at most 2 prefetch requests per deliberate hover; no requests on mouse-through |
| staleTime/refetchInterval race on polling | Stale-while-revalidate tuning phase | Manual 5-minute observation: notification polling fires at configured interval after staleTime changes |

## Sources

- [React.memo official docs](https://react.dev/reference/react/memo) — when memoization is and is not helpful
- [useMemo optimization guide — feature-sliced.design](https://feature-sliced.design/blog/react-usememo-optimization) — three-question test for useMemo
- [TanStack Query cache invalidation docs](https://tanstack.dev/query/latest/docs/framework/react/guides/query-invalidation) — invalidateQueries semantics, refetchType parameter
- [TanStack Query prefetching docs](https://tanstack.com/query/v5/docs/react/guides/prefetching) — prefetchQuery, ensureQueryData patterns
- [Efficient Polling in React — Medium/Atulbanwar](https://medium.com/@atulbanwar/efficient-polling-in-react-5f8c51c8fb1a) — visibility API integration
- [Skeleton Loading Screen Design — LogRocket](https://blog.logrocket.com/ux-design/skeleton-loading-screen-design/) — flicker prevention, delay threshold
- [A Bone to Pick with Skeleton Screens — Viget](https://www.viget.com/articles/a-bone-to-pick-with-skeleton-screens) — when skeletons backfire
- [React Suspense flicker prevention — Medium/Edekobifrank](https://medium.com/@edekobifrank/taming-the-white-flicker-from-lazy-loading-in-react-my-accidental-encounter-9d506b247042)
- [Vite code splitting large chunks — Mykola Aleksandrov](https://www.mykolaaleksandrov.dev/posts/2025/11/taming-large-chunks-vite-react/) — manualChunks, chunk size analysis
- [Tauri v2 Performance and Bundle Size Optimization](https://www.oflight.co.jp/en/columns/tauri-v2-performance-bundle-size) — Tauri-specific bundle considerations
- [TanStack Virtual nested items discussion](https://github.com/TanStack/virtual/discussions/315) — double virtualization pitfalls
- [Zustand persist store migration — official docs](https://zustand.docs.pmnd.rs/reference/integrations/persisting-store-data) — versioning, migrate function
- Codebase inspection: `taskflow/src/services/jira/issues.ts` — two-query subtask strategy, `SUBTASK_CHUNK_SIZE=50`, `Promise.all` on chunks
- Codebase inspection: `taskflow/src/hooks/useNotificationPolling.ts` — `staleTime: pollIntervalMs - 5_000` invariant (HIGH confidence pattern)
- Codebase inspection: `taskflow/src/main.tsx` — global `staleTime: 5 * 60 * 1000` default, `gcTime: Infinity` for pinned tabs
- Codebase inspection: `taskflow/src/routes/routes.tsx` — eager-loaded routes, no existing `React.lazy` usage

---
*Pitfalls research for: Taskflow v1.7 Performance & Perceived Speed*
*Researched: 2026-03-29*
