/**
 * Shared board ID hook.
 *
 * Caches the Jira scrum board ID with staleTime: Infinity so the board
 * discovery API call is made at most once per session per project. Both
 * SprintBoardTab and BacklogPage consume this hook (D-03).
 */
import { useQuery } from '@tanstack/react-query';
import { fetchBoardId } from '@/services/jira/sprints';

export function useBoardId(
  jiraBaseUrl: string | null,
  jiraToken: string | null,
  projectKey: string | null,
): { boardId: number | null; isLoading: boolean } {
  const { data: boardId, isLoading } = useQuery({
    queryKey: ['jira-board-id', projectKey, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl!, jiraToken!, projectKey!),
    staleTime: Infinity,
    enabled: !!jiraBaseUrl && !!jiraToken && !!projectKey,
  });
  return { boardId: boardId ?? null, isLoading };
}
