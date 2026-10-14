import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { indexChildToWeek, type PackageEditShape, type RmWeek } from '@/lib/deployment-package';
import { fetchDeploymentPackageEditShape, fetchRmPackage, fetchRmWeekIndex } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

const EMPTY_WEEKS: RmWeek[] = [];

/**
 * Shared Release Management week index (quick 261014-eym). One query for the
 * whole app; disabled (and every deployment-package feature silently off) when
 * no RM project is configured in Settings > Integrations.
 */
export function useRmWeekIndex() {
  const rmProject = useSettingsStore((s) => s.releaseManagementProjectKey);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const enabled = !!rmProject && !!jiraBaseUrl;

  const query = useQuery({
    queryKey: ['rm-week-index', rmProject, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !rmProject) throw new Error('No credentials');
      return fetchRmWeekIndex(jiraBaseUrl, token, rmProject);
    },
    staleTime: 5 * 60_000,
    enabled,
  });

  const weeks = query.data ?? EMPTY_WEEKS;
  const childToWeek = useMemo(() => indexChildToWeek(weeks), [weeks]);
  return {
    weeks,
    childToWeek,
    enabled,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/**
 * Whether (and in which shape) the Deployment package field is writable on an
 * issue, per editmeta. `shape` is undefined until loaded.
 */
export function useDeploymentPackageEditShape(issueKey: string | undefined, active = true) {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const query = useQuery<PackageEditShape>({
    queryKey: ['jira-editmeta-deployment-package', issueKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !issueKey) throw new Error('No credentials');
      return fetchDeploymentPackageEditShape(jiraBaseUrl, token, issueKey);
    },
    staleTime: 30 * 60_000,
    enabled: active && !!jiraBaseUrl && !!issueKey,
  });
  return { shape: query.data, isLoading: query.isLoading };
}

/**
 * Direct (fast) lookup of one story's RM package + its WEEK parent, without
 * waiting for the full week index. Independent of the RM project setting.
 */
export function useRmPackage(pkgKey: string | null | undefined) {
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const query = useQuery({
    queryKey: ['rm-package', pkgKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !pkgKey) throw new Error('No credentials');
      return fetchRmPackage(jiraBaseUrl, token, pkgKey);
    },
    staleTime: 30 * 60_000,
    enabled: !!pkgKey && !!jiraBaseUrl,
  });
  return { child: query.data?.child, week: query.data?.week ?? null, isLoading: query.isLoading };
}
