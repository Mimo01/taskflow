# Architecture Research

**Domain:** Performance optimization integration for existing Tauri 2 + React 19 + TanStack Query desktop app
**Researched:** 2026-03-29
**Confidence:** HIGH

## System Overview — Performance Layer Integration

```
┌─────────────────────────────────────────────────────────────┐
│                     Route Layer (NEW)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ React.lazy  │  │ Suspense +   │  │ ErrorBoundary     │  │
│  │ imports     │  │ Skeleton FB  │  │ per route         │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         └────────────────┴───────────────────┘              │
├─────────────────────────────────────────────────────────────┤
│                     View Layer (MODIFIED)                    │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Skeleton    │  │ Progressive  │  │ Memoized leaf     │  │
│  │ variants    │  │ data display │  │ components        │  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
├─────────┴────────────────┴───────────────────┴──────────────┤
│                     Query Layer (MODIFIED)                   │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ staleTime   │  │ Prefetch on  │  │ Smart polling     │  │
│  │ tuning      │  │ hover/focus  │  │ (visibility-aware)│  │
│  └──────┬──────┘  └──────┬───────┘  └────────┬──────────┘  │
│         └────────────────┴───────────────────┘              │
├─────────────────────────────────────────────────────────────┤
│                     Cache Layer (NEW + MODIFIED)             │
│  ┌──────────────────┐  ┌────────────────────────────────┐  │
│  │ TanStack Query   │  │ Avatar/image cache             │  │
│  │ (tuned gcTime,   │  │ (in-memory Map + optional      │  │
│  │  staleTime)      │  │  plugin-fs disk persistence)   │  │
│  └──────────────────┘  └────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                     Transport Layer (EXISTING)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ tauri-plugin-http (Jira DC / GitLab REST)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Integration Point |
|-----------|----------------|-------------------|
| Route splitting (React.lazy) | Lazy-load heavy route chunks on demand | `routes.tsx` — convert eager imports to dynamic |
| Suspense + Skeleton fallbacks | Show layout-matched placeholders during chunk load and data fetch | Wrap route outlet; per-view skeleton components |
| staleTime tuning | Serve cached data instantly on navigation | Per-query config in all TanStack Query hooks |
| Prefetch on hover | Warm cache before user clicks sidebar link | Sidebar nav component + `queryClient.prefetchQuery` |
| Smart polling | Pause background polling for inactive views | `refetchIntervalInBackground: false` + visibility hook |
| Query parallelization | Eliminate sequential await chains | `Promise.all` in queryFn bodies; `useQueries` where applicable |
| Progressive data display | Render partial data as queries resolve independently | Decouple parent/child query dependencies in views |
| Avatar cache | Prevent repeated authenticated image fetches | `AuthImage.tsx` + in-memory Map keyed by URL hash |
| Memoized leaf components | Prevent unnecessary re-renders in virtualized lists | `React.memo` on TaskCard, DraggableCard, BacklogRow |

## Architectural Patterns

### Pattern 1: Stale-While-Revalidate with Skeleton Fallback

**What:** TanStack Query serves cached data instantly. Skeletons only appear on first load (no cache). Background refetch is silent.

**When to use:** Every data-fetching view.

**Trade-offs:**
- Pro: Instant perceived navigation, zero blank screens on back-nav
- Con: Users may see briefly stale data before background refetch completes
- Mitigation: `StaleDataBanner` component (already exists) for explicit staleness indication

**Key implementation detail:**
```typescript
// Skeleton shows ONLY when isLoading (no cache), NOT during isFetching (background refresh)
if (isLoading) return <SprintBoardSkeleton />;
// isFetching with cached data → show data + optional StaleDataBanner
return <SprintBoard data={data} isFetching={isFetching} />;
```

### Pattern 2: Hover Prefetch Pipeline

**What:** Sidebar nav links trigger `queryClient.prefetchQuery` on `onMouseEnter`/`onFocus`. By the time the user clicks, data is in cache.

**When to use:** All sidebar navigation targets with deterministic query keys.

**Trade-offs:**
- Pro: Eliminates perceived load time for click-navigation
- Con: May fire unnecessary network requests for items user hovers but doesn't click
- Mitigation: `staleTime` must be > 0 (otherwise prefetched data is immediately stale and re-fetched on mount)

**Dependency:** Requires staleTime tuning to be completed first.

### Pattern 3: Progressive Data Population

**What:** Views display data sections independently as each query resolves, rather than waiting for all queries to complete.

**When to use:** Sprint board (story headers → subtasks → MR links), backlog (issues → epic metadata).

**Trade-offs:**
- Pro: User sees useful content sooner, can start interacting before everything loads
- Con: Layout shifts as sections fill in; more complex loading state management
- Mitigation: Skeleton placeholders hold space for pending sections; sections animate in

## Data Flow — Performance-Optimized

### Navigation Flow (After Optimization)

```
[Sidebar Hover]
    ↓ onMouseEnter
[prefetchQuery] → [TanStack Cache] (warm)
    ↓ user clicks
[React.lazy] → [Suspense] → [Chunk loaded]
    ↓
[useQuery] → [Cache HIT] → [Render immediately with cached data]
    ↓ background
[refetch] → [Update cache silently] → [Re-render if data changed]
```

### Polling Flow (After Optimization)

```
[View Active]
    ↓
[refetchInterval: 30s] → [Jira/GitLab API] → [Update cache]
    ↓ user switches tab
[View Inactive — refetchIntervalInBackground: false]
    ↓ polling paused
[App Minimized — usePageVisibility detects]
    ↓ all polling paused
[App Restored — refetchOnWindowFocus: true]
    ↓ immediate refetch of active view queries
```

## Integration Points — What Changes vs What Stays

### Modified Files (Existing)

| File/Area | Current State | Modification |
|-----------|--------------|--------------|
| `routes.tsx` | 16 eager imports | Convert 6+ heavy routes to `React.lazy` |
| `App.tsx` / main layout | No Suspense boundary | Add `<Suspense>` with skeleton fallback around route outlet |
| All `useQuery` hooks | Mixed staleTime values | Standardize per-query staleTime tuning |
| Sidebar nav component | No prefetch | Add `onMouseEnter` prefetch handlers |
| `AuthImage.tsx` | Re-fetches on every mount | Add in-memory Map cache layer |
| Sprint board queries | Sequential await chains | Restructure with `Promise.all` where safe |
| Dashboard polling hooks | Some have `refetchIntervalInBackground` | Ensure all dashboard queries have it |

### New Components

| Component | Purpose | Location |
|-----------|---------|----------|
| `SprintBoardSkeleton` | Layout-matched skeleton for sprint board | `src/components/skeletons/` |
| `BacklogSkeleton` | Layout-matched skeleton for backlog | `src/components/skeletons/` |
| `MyTasksSkeleton` | Layout-matched skeleton for my tasks | `src/components/skeletons/` |
| `useDelayedLoading` | Hook to prevent skeleton flicker on fast loads | `src/hooks/` |
| `usePageVisibility` | Hook to detect app minimized/restored | `src/hooks/` |
| `usePrefetch` | Hook to prefetch query on hover/focus | `src/hooks/` |

### Suggested Build Order

1. **Foundation** — Route splitting + error boundaries + bundle analysis (independent, zero risk)
2. **Cache tuning** — staleTime audit + refetchIntervalInBackground + usePageVisibility
3. **Loading states** — Skeleton components + useDelayedLoading + progressive data display
4. **Prefetching** — Hover prefetch on sidebar (depends on staleTime tuning)
5. **Query optimization** — Sprint board/backlog parallelization + deduplication
6. **Polish** — Avatar caching + memoization audit (profiler-driven) + dead code elimination

## Anti-Patterns

### Anti-Pattern 1: Skeleton on isFetching

**What people do:** Show skeleton screens whenever `isFetching` is true, including during background refetches.
**Why it's wrong:** With stale-while-revalidate, cached data is available. Replacing visible data with a skeleton during a background refresh defeats caching.
**Do this instead:** Show skeletons only on `isLoading` (no cached data).

### Anti-Pattern 2: Aggressive staleTime Without Mutation Audit

**What people do:** Set `staleTime: Infinity` globally to maximize cache hits.
**Why it's wrong:** Optimistic mutations rely on invalidation triggering a refetch. High staleTime can suppress the confirming refetch.
**Do this instead:** Set staleTime per-query. For mutation targets, use `refetchType: 'active'` in invalidation.

### Anti-Pattern 3: Code Splitting Everything

**What people do:** Wrap every route and component in `React.lazy`.
**Why it's wrong:** Lightweight routes don't benefit — extra network request overhead exceeds the bundle savings.
**Do this instead:** Only lazy-load the 6 heaviest routes; keep light routes eager.

## Sources

- TanStack Query v5 docs: Prefetching, Important Defaults, Query Invalidation
- React 19 docs: React.lazy, Suspense, code splitting
- Tauri 2 docs: plugin-fs, plugin-http, webview asset serving
- Vite 8 docs: code splitting, rolldown integration
- Stack/Features/Pitfalls research from this milestone

---
*Architecture research for: Taskflow v1.7 Performance & Perceived Speed*
*Researched: 2026-03-29*
