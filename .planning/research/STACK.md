# Stack Research

**Domain:** Performance optimization additions for Tauri 2 + React 19 desktop app (v1.7)
**Researched:** 2026-03-29
**Confidence:** HIGH

---

## What This Document Covers

This is a SUBSEQUENT MILESTONE stack document. The existing stack (Tauri 2, React 19, TanStack Query v5, @tanstack/react-virtual, shadcn/ui, Tailwind v4, Vitest, Biome, Zustand, react-grid-layout, cmdk) is validated and NOT re-researched here.

This document covers only net-new additions and configuration changes needed for v1.7 Performance & Perceived Speed.

---

## Recommended Stack

### New Runtime Dependencies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `@tauri-apps/plugin-fs` | `^2.4.5` | Read/write files to `BaseDirectory.AppCache` for avatar and image caching | Official Tauri 2 plugin — the only way to write files to the OS app cache directory from the renderer. `AuthImage.tsx` currently re-fetches avatars on every mount with no disk persistence. This enables a simple filename-keyed cache (URL hash → cached blob) that survives app restarts. No new Rust crates not already in the plugin workspace; just add to Cargo.toml and register in lib.rs. |

### New Dev Dependencies

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| `rollup-plugin-visualizer` | `^7.0.1` | Interactive treemap of production bundle — identifies which modules inflate the initial chunk | Run once during bundle analysis phase, leave wired as an env-flag opt-in (`ANALYZE=true vite build`). Node >= 22 required — already satisfied. Does not affect runtime. |
| `babel-plugin-react-compiler` | `1.0.0` (exact pin) | Automatic memoization of components and hooks at build time | React Compiler 1.0 released Oct 2025. Replaces the need for a manual `memo`/`useMemo`/`useCallback` audit across ~50K lines. Works with React 19 natively — no `react-compiler-runtime` shim needed. Pin exact: compiler changes should be deliberate upgrades, not silent semver bumps. |
| `@rolldown/plugin-babel` | `^0.2.0` | Babel transform pipeline for Vite 8 + Rolldown | Vite 8 uses Rolldown under the hood. `@vitejs/plugin-react` v6 exports a `reactCompilerPreset` helper that requires this package as a peer dep. The legacy `vite-plugin-babel` and `rollup-plugin-babel` do NOT work with Vite 8/Rolldown. |

---

## Installation

```bash
# From taskflow/ directory

# New runtime plugin
npm install @tauri-apps/plugin-fs

# React Compiler (pin exact version)
npm install --save-dev --save-exact babel-plugin-react-compiler@1.0.0
npm install --save-dev @rolldown/plugin-babel

# Bundle analyzer
npm install --save-dev rollup-plugin-visualizer
```

**Cargo.toml** (`src-tauri/Cargo.toml`) — add one line:
```toml
tauri-plugin-fs = "2"
```

**lib.rs** — register in `tauri::Builder::default()`:
```rust
.plugin(tauri_plugin_fs::init())
```

**Capabilities** — add to the default capability file:
```json
"fs:default"
```

---

## Configuration Changes (No New Dependencies)

These changes use existing packages differently — no new npm installs.

### 1. React Compiler — vite.config.ts

```typescript
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';

// In plugins array:
plugins: [
  tailwindcss(),
  react(),
  babel({ presets: [reactCompilerPreset()] }),
]
```

The compiler processes all components at build time. It automatically memoizes components and hooks that satisfy React's rules, replacing the need for scattered `memo`/`useMemo`/`useCallback` calls. Components that fail compiler analysis are skipped gracefully (they still render correctly, just without auto-memoization).

Use full compilation mode — do NOT use `compilationMode: 'annotation'` (opt-in per component). The codebase has zero-any policy and clean hook patterns; full mode is safe and provides maximum benefit.

### 2. Route-level code splitting — React.lazy + Suspense

`routes.tsx` currently imports all 15 route components eagerly — every route ships in the initial bundle regardless of whether the user ever visits it. Convert the heavy routes to `React.lazy()` with dynamic imports.

```typescript
// routes.tsx — no new packages, just React.lazy
import React from 'react';

const SprintBoardTab      = React.lazy(() => import('./dashboard/SprintBoardTab'));
const BacklogPage         = React.lazy(() => import('./dashboard/BacklogPage'));
const IssueDetailPage     = React.lazy(() => import('./dashboard/IssueDetailPage'));
const EpicsPage           = React.lazy(() => import('./dashboard/EpicsPage'));
const WorkloadTab         = React.lazy(() => import('./dashboard/WorkloadTab'));
const SprintProgressTab   = React.lazy(() => import('./dashboard/SprintProgressTab'));
// Lighter routes (Onboarding, Settings, DevTools) can stay eager
```

Wrap the route outlet in main.tsx with `<Suspense fallback={<RouteSkeleton />}>`. Vite splits each `React.lazy()` into its own chunk automatically. No `manualChunks` config needed at this scale.

Priority order for lazy-loading: SprintBoardTab first (largest component, heaviest imports), then BacklogPage, IssueDetailPage.

### 3. TanStack Query prefetching — queryClient.prefetchQuery

Already in the project via TanStack Query v5. No new install. Add hover/focus handlers to sidebar navigation links to warm the cache before the user clicks.

```typescript
// On onMouseEnter of sidebar sprint board link
queryClient.prefetchQuery({
  queryKey: ['jira-issues', jiraBaseUrl, sprintId],
  queryFn: () => fetchSprintIssues(jiraBaseUrl, token, projectKey, sprintFieldKey),
  staleTime: 5 * 60 * 1000,
});
```

`prefetchQuery` never throws — if the prefetch fails, `useQuery` retries on mount. Safe to call aggressively.

Priority prefetch targets: sprint board (highest frequency navigation), backlog, my-tasks.

### 4. TanStack Query staleTime tuning

The current global default is `staleTime: 5 * 60 * 1000`. This already enables stale-while-revalidate: cached data is served instantly on navigation and refetched in the background. The work is per-query tuning — no new packages, just adjusting numbers.

Recommended per-query overrides:
- Sprint issues: `staleTime: 10 * 60 * 1000` — board data changes less than every 5 min in practice
- Custom fields (`discoverCustomFields`): already `Infinity` — correct, leave it
- Notifications: already controlled by polling — keep `staleTime: 0`
- Backlog: keep at 5 min — moderate churn
- Epic list: `staleTime: 10 * 60 * 1000` — epics rarely change mid-session

No `gcTime` changes needed. Default 5-min gcTime ensures data survives navigation without accumulating indefinitely.

### 5. Skeleton UI — existing component

`src/components/ui/skeleton.tsx` already exists (shadcn `Skeleton` with `animate-pulse`). No new library needed. The v1.7 work is authoring per-view skeleton layouts using the existing primitive:

- `SprintBoardSkeleton` — three column headers, 3–4 card skeletons per column
- `BacklogSkeleton` — table header + 8 row skeletons
- `MyTasksSkeleton` — card list skeletons
- `NotificationsSkeleton` — row list skeletons

Mount skeleton immediately (no artificial delay), replace with data when `isSuccess === true` and `data` is defined. For navigations where cache is warm (stale-while-revalidate), skeleton never shows.

### 6. Query parallelization — Promise.all in query functions

Several query functions fetch sequentially today (fetch A, await, use result to fetch B). Sprint board is the clearest case: sprint metadata and sprint issues are fetched serially. Restructure to use `Promise.all` where dependencies allow.

No new packages. Pattern:
```typescript
// Before: sequential
const sprint = await fetchActiveSprint(...);
const issues = await fetchSprintIssues(..., sprint.id);

// After: parallel where possible
const [sprint, quickFilters] = await Promise.all([
  fetchActiveSprint(...),
  fetchBoardQuickFilters(...),
]);
const issues = await fetchSprintIssues(..., sprint.id); // still depends on sprint.id
```

TanStack Query already deduplicates concurrent queries with identical keys. The bottleneck is sequential `await` chains inside `queryFn` bodies, not re-render thrashing.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `react-loading-skeleton` | 12KB for functionality already in `<Skeleton>` from shadcn | Existing `src/components/ui/skeleton.tsx` |
| Manual `React.memo` / `useMemo` / `useCallback` audit | React Compiler 1.0 handles this automatically and more precisely than manual annotation | `babel-plugin-react-compiler` |
| `why-did-you-render` | Useful for diagnosing re-renders WITHOUT the compiler; redundant once the compiler is enabled | React Compiler + React DevTools Profiler |
| `vite-bundle-analyzer` (nonzzz) | Newer but less mature alternative; adds uncertainty for a one-time analysis task | `rollup-plugin-visualizer@7` (established, well-documented) |
| `tauri-plugin-cache` (third-party, Taiizor) | Community plugin at v0.1.x; unstable API, sparse docs | `@tauri-apps/plugin-fs` as the official primitive |
| `tauri-plugin-redb-cache` (community) | Adds `redb` as a Rust dependency for a simple avatar cache; overkill | `@tauri-apps/plugin-fs` with an in-memory Map index |
| Web Workers for query parallelization | Thread contention is not the bottleneck; sequential await chains inside queryFns are | `Promise.all` restructuring inside existing queryFns |
| Service Workers for caching | Not applicable — Tauri apps run in a webview, not a browser context with SW lifecycle | `@tauri-apps/plugin-fs` for persistence, TanStack Query for in-memory |
| `@tanstack/react-query` upgrade | Already at v5.90.21, which is current | N/A |

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `babel-plugin-react-compiler` (full mode) | `compilationMode: 'annotation'` opt-in per component | If the compiler causes a specific component to behave incorrectly. Start full, fall back to annotation mode for that component only. |
| `@tauri-apps/plugin-fs` for avatar cache | Session-only in-memory Map (no disk write) | If the Cargo.toml/permissions complexity is not worth the benefit. Session-only Map cache is 10 lines and zero new deps — delivers most of the UX win since avatars repeat within a session. |
| `React.lazy` on heavy routes | TanStack Router built-in lazy routes | Only relevant if the project migrates to TanStack Router (out of scope for v1.7). |
| `rollup-plugin-visualizer` | `vite-bundle-analyzer` (nonzzz) | Either works. `rollup-plugin-visualizer` has a longer track record and the treemap template is well-understood. |
| `queryClient.prefetchQuery` on sidebar hover | Route loaders (React Router v7 `loader`) | React Router 7 `loader` functions can prefetch in parallel with navigation. Valid but requires restructuring query logic into loaders — a larger refactor than prefetch-on-hover for v1.7. |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `babel-plugin-react-compiler@1.0.0` | React 19, `@vitejs/plugin-react@6.x` | React 19 target — no `react-compiler-runtime` shim needed. That shim is only for React 17/18 targets. |
| `@rolldown/plugin-babel@^0.2.0` | Vite 8, Rolldown, `@vitejs/plugin-react@6.x` | Vite 8 ships Rolldown. The legacy `rollup-plugin-babel` does NOT work. Must be `@rolldown/plugin-babel`. |
| `@tauri-apps/plugin-fs@^2.4.5` | Tauri 2, `@tauri-apps/api@^2` | Follows the same v2 major pattern as all other installed Tauri plugins. |
| `rollup-plugin-visualizer@^7.0.1` | Vite 8, Node >= 22 | Dev/analysis only — no runtime impact. |

---

## Existing Stack Reuse Summary

| Existing Dep | Reused For in v1.7 |
|--------------|-------------------|
| `@tanstack/react-query` v5 | `queryClient.prefetchQuery` on hover, staleTime tuning, `Promise.all` query restructuring |
| `src/components/ui/skeleton.tsx` (shadcn) | All skeleton screen layouts — no new skeleton library |
| `React.lazy` + `Suspense` (React 19 built-in) | Route-level code splitting — no new package |
| `@tauri-apps/plugin-http` | AuthImage already uses it; avatar cache will use it for the fetch side |
| `@tanstack/react-virtual` | Already in use for backlog, notifications, sprint board — no changes |
| Vite 8 code splitting | Automatic chunk per `React.lazy` import — no `manualChunks` config needed |

---

## Sources

- [React Compiler v1.0 Blog Post](https://react.dev/blog/2025/10/07/react-compiler-1) — stable release Oct 2025, React 19 native support confirmed (HIGH confidence)
- [React Compiler Installation](https://react.dev/learn/react-compiler/installation) — `babel-plugin-react-compiler`, `@rolldown/plugin-babel`, `reactCompilerPreset` for Vite 8 (HIGH confidence)
- [vitejs/vite-plugin-react issue #1144](https://github.com/vitejs/vite-plugin-react/issues/1144) — `@rolldown/plugin-babel@^0.2.0` peer dep requirement for Vite 8 (MEDIUM confidence — issue thread)
- [Tauri 2 File System Plugin](https://v2.tauri.app/plugin/file-system/) — `BaseDirectory.AppCache`, read/write API, permissions model (HIGH confidence)
- [@tauri-apps/plugin-fs npm](https://www.npmjs.com/package/@tauri-apps/plugin-fs) — version 2.4.5 confirmed (HIGH confidence)
- [rollup-plugin-visualizer npm](https://www.npmjs.com/package/rollup-plugin-visualizer) — version 7.0.1, Node >= 22 requirement (HIGH confidence)
- [TanStack Query v5 Prefetching Guide](https://tanstack.com/query/v5/docs/framework/react/guides/prefetching) — `queryClient.prefetchQuery` API, hover/focus patterns, never-throws behavior (HIGH confidence)
- [TanStack Query Important Defaults](https://tanstack.com/query/v5/docs/react/guides/important-defaults) — staleTime=0 default, gcTime=5min default, stale-while-revalidate behavior (HIGH confidence)

---

*Stack research for: Taskflow v1.7 Performance & Perceived Speed*
*Researched: 2026-03-29*
