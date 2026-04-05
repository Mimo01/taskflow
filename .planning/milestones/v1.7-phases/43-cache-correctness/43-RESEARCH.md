# Phase 43: Cache Correctness - Research

**Researched:** 2026-03-29
**Domain:** TanStack Query v5 cache configuration, polling lifecycle, React Router DOM v7 route awareness
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Keep the global 5-minute staleTime — no per-query tuning needed. TanStack Query already shows cached data immediately and refetches in background.
- **D-02:** Set gcTime: Infinity globally on QueryClient so cache entries survive indefinitely during the session. Navigating back always shows instant data regardless of time away.
- **D-03:** First-visit loading (no cache yet) is Phase 44 scope. This phase only ensures return visits show instant cached data.
- **D-04:** Use a route-aware `enabled` flag pattern. Each polling query gets `enabled: isOnThisRoute && ...otherConditions`. A shared `useIsActiveRoute()` hook checks current pathname.
- **D-05:** Notification polling (useNotificationPolling) and update polling (useUpdatePolling) remain global — they run in AppLayout regardless of route. View-specific refetchInterval queries only poll when their route is active.
- **D-06:** Use `document.visibilitychange` (standard web API) for minimize detection. No Tauri-specific visibility code needed — TanStack Query's built-in focusManager already listens to this.
- **D-07:** Set `refetchIntervalInBackground: false` on all polling queries EXCEPT notification polling. Notification polling keeps `refetchIntervalInBackground: true` because notifications are time-sensitive and the cursor-based delta fetch handles catch-up.
- **D-08:** On restore, only the currently visible route's queries refetch (TanStack Query's default `refetchOnWindowFocus` behavior). No bulk invalidation of all stale queries.
- **D-09:** SC-3 is refined: "All polling stops when minimized EXCEPT notification polling, which continues in background."
- **D-10:** Claude's discretion on enforcement approach. The invariant `staleTime < refetchInterval` must be maintained for all polled queries. Options include shared constants, runtime assertions in dev mode, or code comments.

### Claude's Discretion
- Exact split of which queries are view-scoped vs global (based on which queries actually have refetchInterval set)
- Implementation details of useIsActiveRoute() hook
- staleTime/refetchInterval guardrail enforcement approach (shared constants, runtime assertion, or lint rule)

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOAD-02 | User sees cached data instantly when navigating back to a previously visited view (stale-while-revalidate) | Addressed by D-02: gcTime: Infinity prevents cache eviction. TanStack Query v5 serves cached data synchronously before background refetch. Query data persists for the full session. |
| QOPT-04 | App pauses polling for views not currently visible (smart polling with background pause) | Addressed by D-04/D-05: `enabled: isOnThisRoute` pattern stops the refetchInterval scheduler entirely when the component's route is not active. Queries mounted in AppLayout (notifications, updates) are explicitly excluded. |
| QOPT-05 | App pauses all polling when minimized and refetches active view on restore (visibility-aware polling) | Addressed by D-06/D-07/D-08/D-09: TanStack Query's focusManager listens to `visibilitychange`. `refetchIntervalInBackground: false` stops interval polling when focusManager.isFocused() returns false (document.visibilityState === 'hidden'). Notification polling is the sole exception. |
</phase_requirements>

---

## Summary

Phase 43 is a pure infrastructure phase. There are no new UI components — only QueryClient configuration changes, new hook(s), and additions to existing polling query options.

The three main changes are: (1) add `gcTime: Infinity` to QueryClient defaultOptions so cache entries are never evicted during the session (LOAD-02); (2) add `refetchIntervalInBackground: false` to all view-scoped polling queries so TanStack Query's built-in focusManager pauses their intervals when the app is minimized (QOPT-05); (3) create a `useIsActiveRoute()` hook and add `enabled: isOnThisRoute && ...` to view-scoped polling queries so polling stops when a different route is active (QOPT-04).

TanStack Query v5.91.2 (installed) handles the hard work. The `focusManager` already subscribes to `visibilitychange` and sets `isFocused()` to false when `document.visibilityState === 'hidden'`. When `isFocused()` is false and `refetchIntervalInBackground: false`, the query scheduler skips the refetch. `refetchOnWindowFocus` (default: true) handles the restore refetch automatically. No Tauri-specific code, no custom event listeners.

**Primary recommendation:** Three atomic changes — QueryClient defaultOptions, a new `useIsActiveRoute()` hook used in 5 polling queries, and `refetchIntervalInBackground: false` added to those same queries.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | 5.91.2 (installed) | Query caching, polling, background refetch | Already the app's data-fetching layer |
| react-router-dom | 7.13.1 (installed) | `useLocation()` for route detection in `useIsActiveRoute()` | Already the app's router |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest + @testing-library/react | 4.0.18 + 16.3.2 (installed) | Unit test for `useIsActiveRoute()` hook | Testing route-awareness logic |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `enabled: isOnThisRoute` flag | `useQueryClient().cancelQueries()` on route leave | Cancellation is more complex — `enabled: false` is simpler and is the idiomatic TanStack Query pattern |
| Shared constants for staleTime/refetchInterval values | Runtime assertions in dev mode | Constants are zero-overhead and catch violations at write time; assertions catch them at runtime in dev |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure
```
taskflow/src/
├── hooks/
│   ├── useIsActiveRoute.ts         # NEW: route-awareness hook
│   ├── useNotificationPolling.ts   # UNCHANGED (keeps refetchIntervalInBackground: true)
│   ├── useUpdatePolling.ts         # UNCHANGED (already has refetchIntervalInBackground: false)
│   ├── useSavedFilterSync.ts       # No polling — no change needed
│   └── useVersionPolicyCheck.ts    # UNCHANGED (already has refetchIntervalInBackground: false)
├── lib/
│   └── query-constants.ts          # NEW: POLL_INTERVAL_MS, STALE_TIME_MS shared constants
└── main.tsx                        # ADD gcTime: Infinity to QueryClient defaultOptions
```

View-scoped polling queries (all in `taskflow/src/routes/dashboard/`):
- `SprintBoardTab.tsx` — refetchInterval: 60_000, currently `refetchIntervalInBackground: true` → needs `false` + `enabled: isOnThisRoute`
- `WorkloadTab.tsx` — refetchInterval: 60_000, currently no `refetchIntervalInBackground` → needs `false` + `enabled: isOnThisRoute`
- `SprintProgressTab.tsx` — refetchInterval: 60_000, currently no `refetchIntervalInBackground` → needs `false` + `enabled: isOnThisRoute`
- `MyTasksTab.tsx` — refetchInterval: 60_000 on 2 queries, currently `refetchIntervalInBackground: true` → needs `false` + `enabled: isOnThisRoute`
- `MrAttentionTab.tsx` — refetchInterval: 60_000, currently `refetchIntervalInBackground: true` → needs `false` + `enabled: isOnThisRoute`

### Pattern 1: gcTime: Infinity on QueryClient

**What:** Set `gcTime: Infinity` in QueryClient `defaultOptions.queries` so that inactive query entries are never garbage-collected. Data cached on first visit survives indefinitely for the session and is served synchronously on return navigation.

**When to use:** Session-scoped apps where users navigate back and expect to see their last data immediately.

**Important exception:** The per-query `gcTime: Infinity` already set on `pinnedQueries` in `main.tsx` is intentional and does not need changing. The global default will make it redundant, but it is harmless to leave explicit overrides.

**Example:**
```typescript
// taskflow/src/main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes — unchanged
      gcTime: Infinity,          // NEW: never evict cache during session
      retry: 1,
    },
  },
});
```

**Why Infinity and not a large number:** gcTime is a session-scoped decision. The session ends when the app closes (Tauri window close). There is no memory concern from holding Jira/GitLab API responses in a desktop Tauri app with a single active user.

**Known safe:** The REQUIREMENTS.md explicitly rules out `staleTime: Infinity` globally (it breaks optimistic mutation rollbacks), but `gcTime: Infinity` is safe — it only controls eviction of inactive queries, not the staleness clock.

### Pattern 2: useIsActiveRoute() Hook

**What:** A hook that checks whether the caller's route is the currently active pathname. Returns a boolean. Used in the `enabled` prop of polling queries.

**When to use:** Any view-scoped query that has `refetchInterval` set and should only poll while the user is viewing that route.

**Implementation approach** (Claude's discretion — recommend shared constants approach):

```typescript
// taskflow/src/hooks/useIsActiveRoute.ts
import { useLocation } from 'react-router-dom';

/**
 * Returns true when the given pathname prefix matches the current route.
 * Used to pause polling queries when their view is not visible.
 *
 * @param routePath — exact pathname or prefix (e.g., '/sprint-board')
 * @param options.exact — if true, requires exact match; default false (prefix match)
 */
export function useIsActiveRoute(routePath: string, options?: { exact?: boolean }): boolean {
  const { pathname } = useLocation();
  if (options?.exact) return pathname === routePath;
  return pathname === routePath || pathname.startsWith(routePath + '/');
}
```

**Usage in a view component:**
```typescript
// taskflow/src/routes/dashboard/SprintBoardTab.tsx
import { useIsActiveRoute } from '@/hooks/useIsActiveRoute';

function SprintBoardTab() {
  const isActive = useIsActiveRoute('/sprint-board');

  const { data } = useQuery({
    queryKey: ['jira-issues', ...],
    queryFn: ...,
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });
}
```

**Route-to-path mapping** (from routes.tsx):
| Component | Route path |
|-----------|-----------|
| SprintBoardTab | `/sprint-board` |
| WorkloadTab | `/workload` |
| SprintProgressTab | `/sprint-progress` |
| MyTasksTab | `/my-tasks` |
| MrAttentionTab | `/mr-attention` |

### Pattern 3: refetchIntervalInBackground: false (Minimize Pause)

**What:** TanStack Query's `focusManager` already subscribes to `document.visibilitychange`. When `document.visibilityState === 'hidden'` (app minimized), `focusManager.isFocused()` returns false. The query scheduler checks `refetchIntervalInBackground || focusManager.isFocused()` before firing each interval tick — confirmed in source: `queryObserver.cjs` line: `if (this.options.refetchIntervalInBackground || import_focusManager.focusManager.isFocused())`.

**When to use:** All polling queries except `useNotificationPolling` (D-07).

**Example:**
```typescript
// Before (SprintBoardTab.tsx)
refetchInterval: 60_000,
refetchIntervalInBackground: true,  // polls even when minimized

// After
refetchInterval: POLL_INTERVAL_MS,        // 60_000 — from shared constants
refetchIntervalInBackground: false,        // pauses when minimized
enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
```

**Restore behavior (QOPT-05):** When app is restored (visibilityState becomes 'visible'), `focusManager.onFocus()` fires. The QueryClient subscriber (confirmed in `queryClient.cjs`) runs `invalidateQueries` for stale queries and triggers `refetchOnWindowFocus` behavior. No code changes needed — this is automatic.

### Pattern 4: Shared Query Constants (staleTime/refetchInterval Guardrail — D-10)

**What:** Extract magic numbers into a shared constants file so the invariant `staleTime < refetchInterval` is enforceable by code review and grep.

**Why constants over runtime assertions:** Assertions require the dev server to be running to catch violations. A constants file catches them at write time (code review) and makes the invariant visible in one place. This is zero-overhead in production.

**Recommendation:**
```typescript
// taskflow/src/lib/query-constants.ts

/**
 * Shared polling constants for view-scoped queries.
 *
 * INVARIANT: STALE_TIME_MS must be strictly less than POLL_INTERVAL_MS.
 * TanStack Query silently disables polling when staleTime >= refetchInterval
 * because the query is never considered stale enough to refetch.
 *
 * Verified via: DevTools Network tab, observe requests repeat every ~60s.
 * Unit tests with fake timers will NOT catch this — test in production build.
 */
export const POLL_INTERVAL_MS = 60_000;   // 1 minute
export const STALE_TIME_MS = 30_000;      // 30 seconds — half the poll interval
```

**Scope:** Only view-scoped polling queries (5 files). Notification and update polling have their own derived values and should not use these constants — they have different intervals.

### Anti-Patterns to Avoid

- **Setting `gcTime: 0`** on any query: This evicts immediately on component unmount, defeating LOAD-02. Only applies if someone adds it as a per-query override.
- **Using `staleTime: Infinity` globally**: Explicitly ruled out in REQUIREMENTS.md — breaks optimistic mutation rollbacks.
- **Adding `enabled: isOnThisRoute` to non-polling queries**: Only applies to queries with `refetchInterval`. Non-polling queries should fetch once and use the cache — adding a route guard prevents data from loading until the exact route is active.
- **Adding `enabled: false` unconditionally to global hooks** (useNotificationPolling, useUpdatePolling, useSavedFilterSync): These run in AppLayout and must fire regardless of route.
- **Calling `useIsActiveRoute` in AppLayout**: The hook only makes sense in route components that are unmounted on navigation. AppLayout is always mounted.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| App minimize detection | Custom Tauri event listeners for window focus | TanStack Query's built-in `focusManager` with `visibilitychange` | Already wired up in QueryClient; adding Tauri events would create two competing systems |
| Polling pause on route change | Manual `queryClient.cancelQueries()` calls in route components | `enabled: isOnThisRoute` flag | `enabled: false` is declarative — TanStack Query handles scheduling; cancel is imperative and error-prone |
| Cache invalidation on restore | `queryClient.invalidateQueries()` on `visibilitychange` listener | `refetchOnWindowFocus: true` (the default) | Built-in behavior; custom listener would double-invalidate |

**Key insight:** TanStack Query v5 handles all three behaviors (background pause, restore refetch, cache-while-revalidate) through existing config flags. This phase is primarily about setting the right config values, not writing new behavior.

---

## Common Pitfalls

### Pitfall 1: staleTime >= refetchInterval Silently Disables Polling
**What goes wrong:** If `staleTime` is set equal to or greater than `refetchInterval`, TanStack Query never considers the query stale enough to trigger the interval refetch. The query runs once on mount and never polls again. No error, no warning.
**Why it happens:** The interval tick checks staleness before refetching. The current codebase already gets this right (staleTime: 30_000 < refetchInterval: 60_000) but it is easy to accidentally violate when changing either value.
**How to avoid:** Use shared constants from `query-constants.ts`. The comment documents the invariant.
**Warning signs:** DevTools Network tab shows no repeated requests after the first load. Polling hook tests with fake timers pass (they mock time, not the staleness check).

### Pitfall 2: gcTime: Infinity + staleTime Does Not Mean Stale Data Is Served Forever
**What goes wrong:** Misreading the semantics — `gcTime: Infinity` means data is never evicted from the cache after a component unmounts. It does NOT mean stale data is served instead of fetching. The query still background-refetches on mount if `staleTime` has elapsed.
**Why it happens:** gcTime and staleTime are often conflated.
**How to avoid:** Document the distinction in QueryClient setup comments.

### Pitfall 3: useIsActiveRoute in a Component That Renders Across Multiple Routes
**What goes wrong:** If `useIsActiveRoute('/dashboard')` is called in a component that is mounted at `/dashboard/sprint-board`, `/dashboard/backlog` etc., the check may be too narrow or too broad.
**Why it happens:** The current routing is flat (not nested for these views), so this is not a real risk for the current routes. But it is worth noting.
**How to avoid:** Use the exact route path from `routes.tsx`. The 5 affected components each have unique, non-nested paths (`/sprint-board`, `/workload`, etc.).

### Pitfall 4: Adding refetchIntervalInBackground: false to useNotificationPolling
**What goes wrong:** Notifications stop arriving when the user has the app in the background (e.g., docked on macOS). This is explicitly prohibited by D-07.
**Why it happens:** Easy to apply the change mechanically to all polling hooks without reading D-07.
**How to avoid:** `useNotificationPolling.ts` already has `refetchIntervalInBackground: true` — leave it as-is. The change only touches the 5 view-scoped polling queries.

### Pitfall 5: Forgetting useSavedFilterSync Has No refetchInterval
**What goes wrong:** Developer adds `refetchIntervalInBackground: false` or `enabled: isOnThisRoute` to `useSavedFilterSync` thinking it is a polling hook.
**Why it happens:** It is mounted in AppLayout alongside the polling hooks.
**How to avoid:** `useSavedFilterSync` has `staleTime: 2 * 60 * 1000` but no `refetchInterval` — it only fetches once on mount. No changes needed.

---

## Code Examples

### QueryClient with gcTime: Infinity
```typescript
// taskflow/src/main.tsx — modified QueryClient constructor
// Source: TanStack Query v5 docs, confirmed against installed v5.91.2
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes — unchanged
      gcTime: Infinity,            // never evict cache during session (LOAD-02)
      retry: 1,
    },
  },
});
```

### useIsActiveRoute Hook
```typescript
// taskflow/src/hooks/useIsActiveRoute.ts
import { useLocation } from 'react-router-dom';

export function useIsActiveRoute(routePath: string): boolean {
  const { pathname } = useLocation();
  return pathname === routePath || pathname.startsWith(routePath + '/');
}
```

### View-Scoped Polling Query (after changes)
```typescript
// Pattern for SprintBoardTab, WorkloadTab, SprintProgressTab, MyTasksTab, MrAttentionTab
import { useIsActiveRoute } from '@/hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '@/lib/query-constants';

// Inside component:
const isActive = useIsActiveRoute('/sprint-board'); // varies per component

const { data } = useQuery({
  queryKey: [...],
  queryFn: ...,
  refetchInterval: POLL_INTERVAL_MS,
  refetchIntervalInBackground: false,
  staleTime: STALE_TIME_MS,
  enabled: isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
});
```

### Query Constants File
```typescript
// taskflow/src/lib/query-constants.ts
/**
 * Shared polling constants for view-scoped queries.
 *
 * INVARIANT: STALE_TIME_MS must be strictly less than POLL_INTERVAL_MS.
 * Violating this silently disables polling — staleTime >= refetchInterval
 * prevents the interval from ever considering the query stale enough to refetch.
 *
 * Manual verification: DevTools Network tab — requests should repeat ~every 60s.
 * Unit tests with fake timers will NOT catch this invariant violation.
 */
export const POLL_INTERVAL_MS = 60_000;  // 1 minute
export const STALE_TIME_MS = 30_000;     // 30 seconds
```

---

## Complete Audit: Which Queries Need Changes

### View-scoped polling queries (5 files — all need both changes):

| File | Route | refetchIntervalInBackground current | enabled current | Changes needed |
|------|-------|--------------------------------------|-----------------|----------------|
| SprintBoardTab.tsx | /sprint-board | `true` | credentials only | set `false`, add `isActive &&` |
| WorkloadTab.tsx | /workload | missing (defaults to false) | credentials only | add explicit `false`, add `isActive &&` |
| SprintProgressTab.tsx | /sprint-progress | missing (defaults to false) | credentials only | add explicit `false`, add `isActive &&` |
| MyTasksTab.tsx (query 1) | /my-tasks | `true` | credentials only | set `false`, add `isActive &&` |
| MyTasksTab.tsx (query 2) | /my-tasks | `true` | credentials only | set `false`, add `isActive &&` |
| MrAttentionTab.tsx | /mr-attention | `true` | credentials only | set `false`, add `isActive &&` |

**Note on WorkloadTab and SprintProgressTab defaults:** TanStack Query v5 defaults `refetchIntervalInBackground` to `false`. Adding it explicitly is still valuable — it documents the intent and makes the behavior visible during code review.

### Global polling hooks (no changes):

| Hook | Runs in | refetchIntervalInBackground | Why unchanged |
|------|---------|-----------------------------|----|
| useNotificationPolling | AppLayout | `true` (D-07 exception) | Time-sensitive, cursor-based catch-up |
| useUpdatePolling | AppLayout | `false` (already correct) | Already the reference pattern |
| useVersionPolicyCheck | AppLayout | `false` (already correct) | Paired with useUpdatePolling |
| useSavedFilterSync | AppLayout | N/A (no polling) | Not a polling hook |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `cacheTime` option name | `gcTime` in TanStack Query v5 | TanStack Query v5.0 (2023) | `cacheTime` was renamed; `gcTime: Infinity` is the correct v5 syntax |
| Manual `focusManager.setEventListener()` for visibility | Built-in `visibilitychange` listener in focusManager | TanStack Query v4+ | No custom setup required |

**Deprecated/outdated:**
- `cacheTime`: Renamed to `gcTime` in TanStack Query v5. The app uses v5.91.2 — use `gcTime`.

---

## Open Questions

1. **Default refetchIntervalInBackground when omitted**
   - What we know: TanStack Query v5 source confirms the default is `false` (the scheduler check is `this.options.refetchIntervalInBackground || focusManager.isFocused()`)
   - What's unclear: The official docs say "defaults to false" but the codebase omits it on some queries (WorkloadTab, SprintProgressTab) — those were already correct by default
   - Recommendation: Add it explicitly to all 5 queries for documentation clarity

2. **Whether MyTasksTab's two polling queries share route context**
   - What we know: Both queries are in the same component file at `/my-tasks`
   - What's unclear: Whether they should share a single `isActive` variable or declare it twice
   - Recommendation: Declare `const isActive = useIsActiveRoute('/my-tasks')` once at the top of the component; use in both query `enabled` props

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/config changes. No external tools, services, or CLIs beyond the project's existing stack.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.0.18 + @testing-library/react 16.3.2 |
| Config file | `taskflow/vitest.config.ts` |
| Quick run command | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test -- --reporter=verbose` |
| Full suite command | `cd /Users/mimo/Desktop/Tasker/taskflow && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOAD-02 | gcTime: Infinity set on QueryClient | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ Wave 0 |
| QOPT-04 | useIsActiveRoute returns true only for matching route | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ Wave 0 |
| QOPT-04 | polling enabled flag flips with route change | unit | `npm test -- --reporter=verbose src/hooks/useIsActiveRoute.test.ts` | ❌ Wave 0 |
| QOPT-05 | refetchIntervalInBackground: false set on polling queries | code review / manual-only | DevTools Network tab: no background requests when app minimized | manual-only |

**Note on QOPT-05 manual verification:** TanStack Query's `focusManager` uses `document.visibilityState` which jsdom does not simulate reliably. The build-level behavior (minimize pauses intervals, restore triggers refetch) must be verified manually in the Tauri dev build. Unit tests cannot substitute for this.

### Sampling Rate
- **Per task commit:** `cd /Users/mimo/Desktop/Tasker/taskflow && npm test`
- **Per wave merge:** `cd /Users/mimo/Desktop/Tasker/taskflow && npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/hooks/useIsActiveRoute.test.ts` — covers QOPT-04 (route matching logic) and LOAD-02 (integration check)
- [ ] No framework install needed — vitest already configured

---

## Sources

### Primary (HIGH confidence)
- TanStack Query v5.91.2 installed source (`node_modules/@tanstack/query-core/build/legacy/focusManager.cjs`) — confirmed `visibilitychange` listener and `isFocused()` implementation
- TanStack Query v5.91.2 installed source (`node_modules/@tanstack/query-core/build/legacy/queryObserver.cjs`) — confirmed `refetchIntervalInBackground || focusManager.isFocused()` check
- `taskflow/src/main.tsx` — verified current QueryClient config (staleTime: 5min, retry: 1, no gcTime)
- `taskflow/src/hooks/useNotificationPolling.ts` — confirmed `refetchIntervalInBackground: true` (must not change)
- `taskflow/src/hooks/useUpdatePolling.ts` — confirmed reference pattern with `refetchIntervalInBackground: false`
- `taskflow/src/routes/dashboard/` — audited all 5 view-scoped polling files for current config
- `taskflow/src/routes/routes.tsx` — confirmed exact route paths for all 5 affected components
- `.planning/REQUIREMENTS.md` — confirmed `staleTime: Infinity` explicitly ruled out

### Secondary (MEDIUM confidence)
- `taskflow/vitest.config.ts` and `taskflow/src/test/setup.ts` — test infrastructure verified in repo

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against installed package versions and source code
- Architecture: HIGH — all integration points identified by reading actual files; no assumptions
- Pitfalls: HIGH — staleTime/gcTime pitfalls verified against TanStack Query source; others from code audit
- Test coverage: MEDIUM — Wave 0 gap identified; manual verification required for QOPT-05

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable library, 30-day window)
