import type { QueryClient } from '@tanstack/react-query';

/**
 * Refresh the Releases list. Upstream-first (see aio-refresh.ts): the batch status
 * chunks are keyed by the version ids the fix-version list returns, and RM week
 * children by the week list, so invalidating dependents in parallel would refetch
 * against stale inputs. Stage 1 awaits the sources; stage 2 the dependents.
 */
export async function refreshReleaseList(
  queryClient: QueryClient,
  activeJiraProject: string | null | undefined,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['jira-fix-versions', activeJiraProject] }),
    queryClient.invalidateQueries({ queryKey: ['rm-week-list'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-projects-rm'] }),
  ]);
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['rm-week-children'] }),
    queryClient.invalidateQueries({ queryKey: ['jira-version-counts', 'batch'] }),
  ]);
}
