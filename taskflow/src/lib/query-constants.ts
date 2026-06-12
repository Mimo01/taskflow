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
export const POLL_INTERVAL_MS = 60_000; // 1 minute
export const STALE_TIME_MS = 30_000; // 30 seconds
