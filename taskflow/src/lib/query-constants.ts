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

/**
 * Query key for the release "wrong-milestone MR" summary signal.
 *
 * The ReleaseDetailPage seeds this entry (value: string[] of issue keys whose MR
 * is on the wrong/absent milestone); the Releases list reads it to render a
 * cache-only badge. Both sides MUST build the key through this helper so they can
 * never drift. The GitLab base URL is included so the same numeric project id on
 * two different GitLab instances cannot collide.
 */
export const wrongMilestoneMRKey = (
  gitlabBaseUrl: string | null | undefined,
  projectId: number | null | undefined,
  versionId: string,
) => ['gitlab-wrong-milestone', gitlabBaseUrl ?? '', projectId ?? 0, versionId] as const;
