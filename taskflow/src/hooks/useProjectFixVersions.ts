import { useQuery } from '@tanstack/react-query';
import { fetchFixVersions } from '@/services/jira/versions';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/** Project fix versions; shares the ['jira-fix-versions', project, baseUrl] cache with the issue sidebar. */
export function useProjectFixVersions(enabled: boolean) {
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  return useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !activeJiraProject || !jiraBaseUrl) return [];
      return fetchFixVersions(jiraBaseUrl, token, activeJiraProject);
    },
    enabled: enabled && !!activeJiraProject && !!jiraBaseUrl,
  });
}
