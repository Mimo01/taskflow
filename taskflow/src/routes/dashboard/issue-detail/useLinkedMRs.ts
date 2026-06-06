import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/apiFetch';
import type { GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/**
 * useLinkedMRs — returns GitLab MRs linked to the given issueKey.
 *
 * Extracted from IssueDetailSidebar so it can be called in both the sidebar
 * (two-column) and the bottom of the single-column peek layout without a
 * duplicate network request. The query key ['gitlab-project-mrs', gitlabBaseUrl,
 * activeGitlabProject] contains NO issueKey — TanStack Query dedupes the fetch
 * and the issueKey filter is applied client-side.
 */
export function useLinkedMRs(issueKey: string) {
  const { gitlabBaseUrl, gitlabConnected, activeGitlabProject } = useAuthStore();

  const { data: projectMRs, isLoading: mrsLoading } = useQuery({
    queryKey: ['gitlab-project-mrs', gitlabBaseUrl, activeGitlabProject],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl || !activeGitlabProject) return [] as GitLabMR[];
      const base = gitlabBaseUrl.replace(/\/$/, '');
      const url = `${base}/api/v4/projects/${activeGitlabProject}/merge_requests?per_page=20&order_by=updated_at&sort=desc`;
      try {
        const resp = await apiFetch(
          'gitlab',
          url,
          {
            headers: { 'PRIVATE-TOKEN': token, 'Content-Type': 'application/json' },
          },
          'Load Merge Requests',
        );
        if (!resp.ok) return [] as GitLabMR[];
        return (await resp.json()) as GitLabMR[];
      } catch {
        return [] as GitLabMR[];
      }
    },
    staleTime: 60_000,
    enabled: !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject,
  });

  // Filter MRs linked to the current issue key (client-side; query is issue-independent)
  const linkedMRs = !projectMRs
    ? []
    : projectMRs.filter((mr) => {
        const titleKeys = extractTicketKeys(mr.title);
        const branchKeys = extractTicketKeys(mr.source_branch);
        return titleKeys.includes(issueKey) || branchKeys.includes(issueKey);
      });

  return {
    linkedMRs,
    mrsLoading,
    gitlabConnected: !!gitlabConnected,
    gitlabBaseUrl: gitlabBaseUrl || '',
  };
}
