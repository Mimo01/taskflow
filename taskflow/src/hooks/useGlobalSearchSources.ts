/**
 * Phase 92: data sources for the advanced global search palette.
 *
 * - Backlog envelope: shared `['gh-backlog', boardId]` cache, fetched from any
 *   route while the palette is open (D-03), 5-minute staleTime (D-21).
 * - Sprint board data: passive read of `['gh-all-data', boardId]` (D-19);
 *   never fetched from here.
 */
import { skipToken, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import type { GhAllDataResponse, GhBacklogResponse } from '../services/jira/greenhopper/types';
import { useGhBacklogData } from '../services/jira/greenhopper/useGhBacklogData';
import { readSecret } from '../services/stronghold';
import { useAuthStore } from '../stores/auth.store';
import { useBoardId } from './useBoardId';

export const GLOBAL_SEARCH_STALE_MS = 5 * 60_000;

export function useGlobalSearchSources(open: boolean): {
  boardId: number | null;
  backlog: GhBacklogResponse | undefined;
  allData: GhAllDataResponse | undefined;
  isIndexLoading: boolean;
  isIndexError: boolean;
} {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const [secret, setSecret] = useState<{
    baseUrl: string | null;
    token: string | null;
    read: boolean;
  }>({ baseUrl: null, token: null, read: false });

  useEffect(() => {
    let cancelled = false;
    readSecret('jira-pat')
      .then((t) => {
        if (!cancelled) setSecret({ baseUrl: jiraBaseUrl, token: t, read: true });
      })
      .catch(() => {
        if (!cancelled) setSecret({ baseUrl: jiraBaseUrl, token: null, read: true });
      });
    return () => {
      cancelled = true;
    };
  }, [jiraBaseUrl]);
  // WR-06: only trust a PAT read for the current instance — on the render where jiraBaseUrl
  // switches, the previous instance's token must not be sent to the new host.
  const token = secret.baseUrl === jiraBaseUrl ? secret.token : null;
  // `token` is null both before the read settles and after it failed; tell them apart so an
  // unread PAT counts as loading and a missing one as an error (never a forever-pending query).
  const secretRead = secret.baseUrl === jiraBaseUrl && secret.read;
  const patMissing = secretRead && !token && !!jiraBaseUrl;

  const { boardId, isLoading: boardIdLoading } = useBoardId(jiraBaseUrl, token, activeJiraProject);

  const backlogQuery = useGhBacklogData(boardId, {
    ignoreRoute: true,
    enabled: open,
    staleTime: GLOBAL_SEARCH_STALE_MS,
    refetchOnWindowFocus: false,
  });

  // Passive, reactive cache read — skipToken keeps the query disabled (never fetches).
  const allDataQuery = useQuery<GhAllDataResponse>({
    queryKey: ['gh-all-data', boardId],
    queryFn: skipToken,
  });

  return {
    boardId,
    backlog: backlogQuery.data,
    allData: allDataQuery.data,
    // A disabled query (no board for the active project) stays `isPending` forever in
    // TanStack v5 — only count it as loading when there is a board to load.
    isIndexLoading:
      open &&
      !backlogQuery.data &&
      (!secretRead ||
        (!!token && (boardIdLoading || (boardId !== null && backlogQuery.isPending)))),
    isIndexError: backlogQuery.isError || patMissing,
  };
}
