import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate the lightweight issue cache (['jira', baseUrl, 'issue-lightweight', idOrKey])
 * for one issue. AIO pages key these entries by the defect's NUMERIC Jira id
 * (jiraDefectIDs), not its key, so a key-based invalidation never matches — match on
 * the cached issue's key (or the id/key in the query key) instead.
 */
export function invalidateLightweightIssue(
  queryClient: QueryClient,
  jiraBaseUrl: string | null | undefined,
  issueKey: string,
): void {
  queryClient.invalidateQueries({
    queryKey: ['jira', jiraBaseUrl, 'issue-lightweight'],
    predicate: (query) =>
      query.queryKey[3] === issueKey ||
      (query.state.data as { key?: string } | null | undefined)?.key === issueKey,
  });
}
