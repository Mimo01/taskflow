/**
 * GreenHopper /plan/backlog/data.json cache layer (Phase 74).
 *
 * Wraps the Phase 71 `fetchBacklogData` fetcher with a React Query hook,
 * its imperative twin (`getGhBacklogData`), and an invalidator
 * (`invalidateGhBacklogData`). Mirrors `useGhAllData.ts` (Phase 73) with
 * two intentional deltas:
 *   1. NO `refetchInterval` — backlog is opened-on-demand, not polled
 *      (Phase 74 D-02).
 *   2. Route literal `/backlog` instead of `/sprint-board`.
 *
 * Cache key shape (Phase 72 D-01 / Phase 73 carry-forward):
 *   - `['gh-backlog', boardId]` — single layer; raw `GhBacklogResponse`
 *     envelope returned untouched (adaptation happens caller-side via
 *     `useMemo` in BacklogPage per Phase 74 D-02 / Discretion).
 *
 * Public surface (D-03):
 *   - `useGhBacklogData(boardId)` — React hook for BacklogPage.
 *   - `getGhBacklogData(qc, baseUrl, token, boardId)` — imperative for
 *     Sidebar prefetch warm (D-08); uses `ensureQueryData` so the warmed
 *     key matches what the hook reads.
 *   - `invalidateGhBacklogData(qc, boardId?)` — one board or all; used by
 *     the "Reload backlog" action (D-07) and by mutation handlers (D-06).
 *
 * See Phase 74 CONTEXT.md D-01/D-02/D-03/D-07, RESEARCH §"Pattern 1", and
 * PATTERNS.md §"useGhBacklogData.ts".
 *
 * NOTE (Phase 74 Plan 01 — Wave 0): The plan originally intended to land
 * only RED scaffolding here and ship the real hook in Plan 02. The repo's
 * husky pre-commit hook runs the full vitest suite, which means a test
 * file that fails to load blocks every subsequent commit. To unblock,
 * `useGhBacklogData.ts` lands here in Plan 01 as a Rule-3 auto-fix; Plan
 * 02 then has nothing new to add for this module.
 */

import { type QueryClient, type UseQueryResult, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useIsActiveRoute } from '../../../hooks/useIsActiveRoute';
import { STALE_TIME_MS } from '../../../lib/query-constants';
import { useAuthStore } from '../../../stores/auth.store';
import { readSecret } from '../../stronghold';
import { fetchBacklogData } from './data';
import type { GhBacklogResponse } from './types';

/**
 * React hook returning the raw `GhBacklogResponse` envelope for `boardId`.
 *
 * Does NOT poll — staleTime is the only freshness gate. BacklogPage adapts
 * the raw envelope in a `useMemo` chain per Phase 74 D-02 / Discretion.
 */
export function useGhBacklogData(boardId: number | null): UseQueryResult<GhBacklogResponse> {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    // WR-05 (Phase 71/73 carry-forward): re-read the secret whenever the
    // Jira instance changes (login rotation, instance switch). Empty deps
    // would leave the hook with a stale token across re-auth cycles.
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

  const isActive = useIsActiveRoute('/backlog');

  return useQuery<GhBacklogResponse>({
    queryKey: ['gh-backlog', boardId],
    queryFn: () => fetchBacklogData(jiraBaseUrl as string, token as string, boardId as number),
    staleTime: STALE_TIME_MS,
    enabled: isActive && !!boardId && !!jiraBaseUrl && !!token,
  });
}

/**
 * Imperative twin of `useGhBacklogData` for non-component call sites
 * (Sidebar prefetch warm — Phase 74 D-08).
 *
 * Uses `ensureQueryData` with the SAME `queryKey` and `staleTime` as the
 * hook so the warmed cache entry is readable by BacklogPage on mount.
 */
export async function getGhBacklogData(
  queryClient: QueryClient,
  baseUrl: string,
  token: string,
  boardId: number,
): Promise<GhBacklogResponse> {
  return queryClient.ensureQueryData({
    queryKey: ['gh-backlog', boardId],
    queryFn: () => fetchBacklogData(baseUrl, token, boardId),
    staleTime: STALE_TIME_MS,
  });
}

/**
 * Invalidate the backlog cache for one board or every board.
 *
 * Used by the "Reload backlog" toolbar action (D-07) and by mutation
 * handlers (D-06). Pass `boardId` to invalidate a single board; omit to
 * invalidate all cached boards.
 */
export function invalidateGhBacklogData(queryClient: QueryClient, boardId?: number): void {
  if (boardId === undefined) {
    queryClient.invalidateQueries({ queryKey: ['gh-backlog'] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['gh-backlog', boardId] });
  }
}
