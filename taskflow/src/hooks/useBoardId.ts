/**
 * Shared board ID hook.
 *
 * Caches the Jira scrum board ID with staleTime: Infinity so the board
 * discovery API call is made at most once per session per project. Both
 * SprintBoardTab and BacklogPage consume this hook (D-03).
 */
import { useQuery } from '@tanstack/react-query';
import { fetchBoardId } from '@/services/jira/sprints';
import { useAuthStore } from '@/stores/auth.store';

export function useBoardId(
  jiraBaseUrl: string | null,
  jiraToken: string | null,
  projectKey: string | null,
): { boardId: number | null; isLoading: boolean } {
  // Prefer a user-chosen board id when one is stored for this project (FB8-3).
  // Reactive selector so a board change in Settings re-renders consumers.
  // `?.` guards old persisted auth blobs that predate jiraBoardIds.
  const storedBoardId = useAuthStore((s) =>
    projectKey ? s.jiraBoardIds?.[projectKey] : undefined,
  );

  const { data: fetchedBoardId, isLoading } = useQuery({
    queryKey: ['jira-board-id', projectKey, jiraBaseUrl],
    queryFn: () => fetchBoardId(jiraBaseUrl ?? '', jiraToken ?? '', projectKey ?? ''),
    staleTime: Infinity,
    // Skip discovery entirely when a choice is already stored.
    enabled: !!jiraBaseUrl && !!jiraToken && !!projectKey && storedBoardId == null,
  });

  return {
    boardId: storedBoardId ?? fetchedBoardId ?? null,
    isLoading: storedBoardId != null ? false : isLoading,
  };
}
