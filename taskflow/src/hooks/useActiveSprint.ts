/**
 * Shared active-sprint lookup. Reads the same ['jira-active-sprint', …] cache
 * entry the Sidebar prefetches, so consumers add no extra request.
 */
import { useQuery } from '@tanstack/react-query';
import { useBoardId } from '@/hooks/useBoardId';
import { fetchActiveSprint, type JiraActiveSprint } from '@/services/jira';

export function activeSprintQueryKey(
  projectKey: string | null,
  jiraBaseUrl: string | null,
  boardId: number | null,
) {
  return ['jira-active-sprint', projectKey, jiraBaseUrl, boardId] as const;
}

export function useActiveSprint(
  jiraBaseUrl: string | null,
  jiraToken: string | null,
  projectKey: string | null,
): { activeSprint: JiraActiveSprint | null; noActiveSprint: boolean; isResolving: boolean } {
  const { boardId, isLoading: boardIsLoading } = useBoardId(jiraBaseUrl, jiraToken, projectKey);
  const enabled = !!jiraBaseUrl && !!jiraToken && !!projectKey && boardId != null;
  const query = useQuery({
    queryKey: activeSprintQueryKey(projectKey, jiraBaseUrl, boardId),
    queryFn: () =>
      fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '', projectKey ?? '', boardId ?? undefined),
    staleTime: 5 * 60_000,
    enabled,
  });
  return {
    activeSprint: query.data ?? null,
    // A disabled v5 query is pending forever, so isResolving is gated on enabled.
    noActiveSprint: query.isSuccess && query.data === null,
    isResolving: boardIsLoading || (enabled && query.isPending),
  };
}
