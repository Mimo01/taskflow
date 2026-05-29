/**
 * GreenHopper /work/allData.json cache layer (Phase 73).
 *
 * Wraps the Phase 71 `fetchAllData` fetcher with a polling React Query hook,
 * its imperative twin (`getGhAllData`), and an invalidator
 * (`invalidateGhAllData`). Mirrors the Phase 72 `useGhTransitions` pattern
 * in `transitions.ts:307-358`, but uses STALE_TIME_MS (not Infinity) because
 * the sprint board polls per D-06.
 *
 * Cache key shape (Phase 72 D-01 carry-forward):
 *   - `['gh-all-data', boardId]` — single layer; raw `GhAllDataResponse`
 *     envelope returned untouched (adaptation happens caller-side via
 *     `useMemo` in SprintBoardTab per D-01 / Discretion).
 *
 * Public surface (D-02):
 *   - `useGhAllData(boardId)` — React hook for SprintBoardTab
 *   - `getGhAllData(qc, baseUrl, token, boardId)` — imperative for Sidebar
 *     prefetch warm (D-08); uses `ensureQueryData` so the warmed key matches
 *     what the hook reads.
 *   - `invalidateGhAllData(qc, boardId?)` — one board or all; used by the
 *     "Reload board" action (D-07 + R-01/R-02 expanded invalidation set).
 *
 * See Phase 73 CONTEXT.md D-01/D-02/D-06, RESEARCH §"Pattern 1: useGhAllData
 * hook", and PATTERNS.md §"useGhAllData.ts".
 */

import { type QueryClient, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { POLL_INTERVAL_MS, STALE_TIME_MS } from '../../../lib/query-constants';
import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchAllData } from './allData';
import type { GhAllDataResponse } from './types';

/**
 * React hook returning the raw `GhAllDataResponse` envelope for `boardId`.
 *
 * Polls every `POLL_INTERVAL_MS` while the sprint-board route is active.
 * Returns the raw envelope (no adapter pass) — SprintBoardTab adapts in a
 * `useMemo` per D-01 / Discretion section.
 */
export function useGhAllData(boardId: number | null): UseQueryResult<GhAllDataResponse> {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // WR-05: re-read the secret whenever the Jira instance changes (login
    // rotation, instance switch). An empty dep array would leave the hook
    // with a stale token across re-auth cycles (mirrors transitions.ts WR-05).
    let cancelled = false;
    readSecret('jira-pat')
      .then((t) => {
        if (!cancelled) setToken(t);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [jiraBaseUrl]);

  const isActive = useIsActiveRoute('/sprint-board');

  return useQuery<GhAllDataResponse>({
    queryKey: ['gh-all-data', boardId],
    queryFn: () => fetchAllData(jiraBaseUrl as string, token as string, boardId as number),
    refetchInterval: POLL_INTERVAL_MS,
    refetchIntervalInBackground: false,
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
  });
}

/**
 * Imperative twin of `useGhAllData` for non-component call sites
 * (Sidebar prefetch warm — D-08).
 *
 * Uses `ensureQueryData` with the SAME `queryKey` and `staleTime` as the
 * hook so the warmed cache entry is readable by SprintBoardTab on mount.
 */
export async function getGhAllData(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhAllDataResponse> {
  return queryClient.ensureQueryData({
    queryKey: ['gh-all-data', boardId],
    queryFn: () => fetchAllData(baseUrl, token, boardId),
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Invalidate the allData cache for one board or every board.
 *
 * Used by the "Reload board" toolbar action (D-07). Pass `boardId` to
 * invalidate a single board; omit to invalidate all cached boards.
 */
export function invalidateGhAllData(queryClient: QueryClient, boardId?: number): void {
  if (boardId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-all-data', boardId] });
  }
}
