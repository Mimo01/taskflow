import { useQuery } from '@tanstack/react-query';
import { fetchIssueLinkedMRs, type GitLabMR } from '@/services/gitlab';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/**
 * useLinkedMRs — returns GitLab MRs linked to the given issueKey.
 *
 * One server-side request per issue (`state=all`, so opened, merged and closed
 * MRs all show — 261103-fxn locked decision). The query key includes the
 * issueKey; TanStack Query dedupes the sidebar (two-column) and the
 * single-column peek layout calls because both pass the same issueKey.
 *
 * Limitation: the server search covers title/description, not source_branch,
 * so an MR whose key appears only in its branch name is not found — see the
 * fetchIssueLinkedMRs JSDoc.
 */
export function useLinkedMRs(issueKey: string) {
  const { gitlabBaseUrl, gitlabConnected, activeGitlabProject } = useAuthStore();

  const { data: issueMRs, isLoading: mrsLoading } = useQuery({
    queryKey: ['gitlab-issue-linked-mrs', gitlabBaseUrl, activeGitlabProject, issueKey],
    queryFn: async () => {
      const token = await readSecret('gitlab-pat').catch(() => null);
      if (!token || !gitlabBaseUrl || !activeGitlabProject) return [] as GitLabMR[];
      return fetchIssueLinkedMRs(gitlabBaseUrl, token, activeGitlabProject, issueKey);
    },
    staleTime: 60_000,
    enabled: !!gitlabBaseUrl && !!gitlabConnected && !!activeGitlabProject && !!issueKey,
  });

  // Exact-key match (title OR source branch): GitLab search is a substring
  // match, so this drops false positives (ABC-1234 for ABC-123) and
  // description-only mentions.
  const linkedMRs = !issueMRs
    ? []
    : issueMRs.filter((mr) => {
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
