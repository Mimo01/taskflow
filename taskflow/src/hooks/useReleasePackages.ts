import { useQuery } from '@tanstack/react-query';
import { useRmWeekIndex } from '@/hooks/useRmWeekIndex';
import { type DerivedPackage, derivePackage } from '@/lib/release-list';
import { listJiraProjects } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Lazy RM deployment-package lookup by release date. `enabled` is false when no
 * Release Management project is configured, so callers can hide the column.
 */
export function useReleasePackages({ dates }: { dates: readonly (string | null | undefined)[] }): {
  enabled: boolean;
  isLoading: boolean;
  /** The week list, a week's children or the project lookup failed. */
  isError: boolean;
  packageFor: (releaseDate: string | undefined) => DerivedPackage | null;
} {
  const { weeks, enabled, isLoading, isError, childrenError } = useRmWeekIndex({ dates });
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

  // Same key and payload as ReleaseManagementBlock (shared fetcher cache key).
  const projectsQuery = useQuery({
    queryKey: ['jira-projects-rm', jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat');
      return listJiraProjects(jiraBaseUrl ?? '', token ?? '');
    },
    enabled: enabled && !!jiraBaseUrl,
    staleTime: 10 * 60_000,
  });
  const activeProjectName =
    projectsQuery.data?.find((p) => p.key === activeJiraProject)?.name ?? null;

  return {
    enabled,
    // A disabled v5 query is pending forever, so gate on `enabled` first.
    isLoading: enabled && (isLoading || projectsQuery.isLoading),
    isError: enabled && (isError || childrenError || projectsQuery.isError),
    packageFor: (releaseDate) =>
      enabled
        ? derivePackage(weeks, releaseDate, activeProjectName, activeJiraProject ?? null)
        : null,
  };
}
