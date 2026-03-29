# Phase 43: Cache Correctness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-29
**Phase:** 43-cache-correctness
**Areas discussed:** Stale-while-revalidate strategy, Polling pause for hidden views, App minimize/restore behavior, staleTime/refetchInterval guardrails

---

## Stale-While-Revalidate Strategy

### Q1: How should stale data be handled on navigation?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep global 5min staleTime (Recommended) | Current default provides instant cache hits for <5min. TanStack Query shows cached data and refetches in background. | ✓ |
| Per-view staleTime tuning | Different staleTime per route. More complex, harder to maintain. | |
| Increase to 10min globally | Longer cache window, staler data. | |

**User's choice:** Keep global 5min staleTime
**Notes:** None

### Q2: Should gcTime be set to Infinity?

| Option | Description | Selected |
|--------|-------------|----------|
| gcTime: Infinity globally (Recommended) | Cache entries never GC'd during session. Navigating back always instant. | ✓ |
| Keep default gcTime (5min) | Entries GC'd after 5min inactive. Saves some memory. | |

**User's choice:** gcTime: Infinity globally
**Notes:** None

### Q3: First-visit loading scope?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 44 handles first visit (Recommended) | This phase only ensures return visits show instant cached data. | ✓ |
| Ensure no flash on return visits only | Same but with explicit test verification. | |

**User's choice:** Phase 44 handles first visit
**Notes:** None

---

## Polling Pause for Hidden Views

### Q1: How should per-view polling be paused?

| Option | Description | Selected |
|--------|-------------|----------|
| Route-aware enabled flag (Recommended) | useIsActiveRoute() hook + enabled flag on each polling query. | ✓ |
| Central polling manager | Global PollingManager tracks which queries should poll. | |
| focusManager override | Override TanStack Query's focusManager for route focus. | |

**User's choice:** Route-aware enabled flag
**Notes:** None

### Q2: Which queries are view-scoped vs global?

| Option | Description | Selected |
|--------|-------------|----------|
| Notifications global, view data view-scoped (Recommended) | Notification + update polling global; view refetchInterval queries view-scoped. | |
| Everything view-scoped except notifications | Even update polling pauses on non-settings routes. | |
| You decide | Claude determines the right split. | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on the exact split.

---

## App Minimize/Restore Behavior

### Q1: How should minimize/restore be detected?

| Option | Description | Selected |
|--------|-------------|----------|
| document.visibilitychange (Recommended) | Standard web API. TanStack Query already listens via focusManager. | ✓ |
| Tauri window visibility API | More precise but Tauri-specific. | |
| Both with fallback | Most robust but more complex. | |

**User's choice:** document.visibilitychange
**Notes:** None

### Q2: What should refetch on restore?

| Option | Description | Selected |
|--------|-------------|----------|
| Refetch active view only (Recommended) | Only visible route queries refetch. Fewer API calls. | ✓ |
| Refetch all stale queries | Invalidate all queries older than staleTime. Many API calls. | |

**User's choice:** Refetch active view only
**Notes:** None

### Q3: Should notification polling pause on minimize?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, pause notifications too (Recommended) | Aligns with SC-3. Notifications catch up on restore. | |
| Keep notification polling in background | Notifications are time-sensitive, keep polling. | ✓ |

**User's choice:** Keep notification polling in background
**Notes:** User wants real-time OS notifications even when app is minimized. SC-3 refined to exclude notification polling from the "all polling stops" rule.

---

## staleTime/refetchInterval Guardrails

### Q1: How should the invariant be enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared constants + code comments (Recommended) | Define POLL_INTERVALS and STALE_TIMES as constants. | |
| ESLint custom rule | Custom lint rule flags violations. | |
| Runtime assertion in dev mode | Wrapper asserts invariant when code runs. | |
| You decide | Claude picks the best approach. | ✓ |

**User's choice:** You decide
**Notes:** Claude has discretion on enforcement approach.

---

## Claude's Discretion

- Exact split of which queries are view-scoped vs global
- useIsActiveRoute() hook implementation details
- staleTime/refetchInterval guardrail enforcement mechanism

## Deferred Ideas

None — discussion stayed within phase scope
