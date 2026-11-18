import { useQuery } from '@tanstack/react-query';
import { fetchFixVersions } from '@/services/jira/versions';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Project fix versions; shares the ['jira-fix-versions', project, baseUrl] cache with the issue
 * sidebar. `projectKey` defaults to the active project (a resumed draft passes its own).
 */
export function useProjectFixVersions(enabled: boolean, projectKey?: string | null) {
  const activeJiraProject = useAuthStore((s) => s.activeJiraProject);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const project = projectKey || activeJiraProject;
  return useQuery({
    queryKey: ['jira-fix-versions', project, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !project || !jiraBaseUrl) return [];
      return fetchFixVersions(jiraBaseUrl, token, project);
    },
    enabled: enabled && !!project && !!jiraBaseUrl,
  });
}
