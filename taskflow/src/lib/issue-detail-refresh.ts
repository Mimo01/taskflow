import type { QueryClient } from '@tanstack/react-query';

/**
 * Refresh every section of the issue detail view. Upstream-first (see
 * release-refresh.ts): subtask enrichment, parent, epic progress and transitions
 * are derived from the issue query, so invalidating them in parallel with it would
 * refetch against a stale upstream. Stage 1 awaits the issue; stage 2 the dependents.
 * Plain invalidateQueries refetches only mounted (active) queries and marks the rest stale.
 */
export async function refreshIssueDetail(
  queryClient: QueryClient,
  args: { issueKey: string; jiraBaseUrl: string | null | undefined },
): Promise<void> {
  const { issueKey, jiraBaseUrl } = args;
  await queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', issueKey, jiraBaseUrl] });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['jira-issue-comments', issueKey, jiraBaseUrl] }),
    queryClient.invalidateQueries({ queryKey: ['jira-issue-changelog', issueKey, jiraBaseUrl] }),
    queryClient.invalidateQueries({ queryKey: ['jira-worklogs', issueKey, jiraBaseUrl] }),
    queryClient.invalidateQueries({
      queryKey: ['jira-subtask-enrichment', issueKey, jiraBaseUrl],
    }),
    queryClient.invalidateQueries({ queryKey: ['jira-epic-stories', issueKey, jiraBaseUrl] }),
    // parentKey is derived from the issue and may change after stage 1.
    queryClient.invalidateQueries({ queryKey: ['jira-parent-detail'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-epic-worklogs', issueKey] }),
    queryClient.invalidateQueries({ queryKey: ['jira-epic-status-history', issueKey] }),
    queryClient.invalidateQueries({ queryKey: ['jira-issue-transitions-fields', issueKey] }),
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'issue-steps', issueKey] }),
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === 'gitlab-issue-linked-mrs' && q.queryKey[3] === issueKey,
    }),
  ]);
}
