import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  findWeekForDate,
  indexChildToWeek,
  mergeWeek,
  type PackageEditShape,
  type RmWeek,
} from '@/lib/deployment-package';
import {
  fetchDeploymentPackageEditShape,
  fetchRmPackage,
  fetchRmWeekChildren,
  fetchRmWeekList,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';

const EMPTY_WEEKS: RmWeek[] = [];
const STALE = 30 * 60_000;
const MAX_DIRECT_PACKAGE_LOOKUPS = 30;

async function requireToken(baseUrl: string | null | undefined): Promise<string> {
  const token = await readSecret('jira-pat').catch(() => null);
  if (!token || !baseUrl) throw new Error('No credentials');
  return token;
}

/**
 * Release Management weeks (quick 261014-eym), loaded lazily so it stays fast:
 *  1. a light list of WEEK parents (summary only), shared app-wide;
 *  2. children (per-application tasks) only for the weeks covering `dates`;
 *  3. packages in `pkgKeys` that still aren't covered are resolved directly
 *     (one issue + parent each, cached under the same key as useRmPackage).
 * The returned `weeks` have children populated only for those weeks. Disabled
 * (every deployment-package feature silently off) when no RM project is set in
 * Settings > Integrations.
 */
export function useRmWeekIndex(
  opts: {
    dates?: readonly (string | null | undefined)[];
    pkgKeys?: readonly (string | null)[];
  } = {},
) {
  const rmProject = useSettingsStore((s) => s.releaseManagementProjectKey);
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const enabled = !!rmProject && !!jiraBaseUrl;

  const listQuery = useQuery({
    queryKey: ['rm-week-list', rmProject, jiraBaseUrl],
    queryFn: async () => {
      const token = await requireToken(jiraBaseUrl);
      if (!rmProject) throw new Error('No RM project');
      return fetchRmWeekList(jiraBaseUrl as string, token, rmProject);
    },
    staleTime: STALE,
    enabled,
  });
  const lightWeeks = listQuery.data ?? EMPTY_WEEKS;

  const dateKey = [...new Set((opts.dates ?? []).filter((d): d is string => !!d))].sort().join(',');
  const neededKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const d of dateKey ? dateKey.split(',') : []) {
      const w = findWeekForDate(lightWeeks, d);
      if (w) keys.add(w.key);
    }
    return [...keys];
  }, [lightWeeks, dateKey]);

  const children = useQueries({
    queries: neededKeys.map((weekKey) => ({
      queryKey: ['rm-week-children', weekKey, jiraBaseUrl],
      queryFn: async () =>
        fetchRmWeekChildren(jiraBaseUrl as string, await requireToken(jiraBaseUrl), weekKey),
      staleTime: STALE,
      enabled,
    })),
    combine: (results) => ({
      data: results.map((r) => r.data),
      isLoading: results.some((r) => r.isLoading),
    }),
  });

  const withChildren = useMemo(
    () =>
      lightWeeks.map((w) => {
        const data = children.data[neededKeys.indexOf(w.key)];
        return data ? { ...w, children: data } : w;
      }),
    [lightWeeks, neededKeys, children],
  );

  const pkgKeyList = [...new Set((opts.pkgKeys ?? []).filter((k): k is string => !!k))];
  const covered = useMemo(() => indexChildToWeek(withChildren), [withChildren]);
  const missing =
    enabled && listQuery.isSuccess && !children.isLoading
      ? pkgKeyList.filter((k) => !covered.has(k)).slice(0, MAX_DIRECT_PACKAGE_LOOKUPS)
      : [];
  const packages = useQueries({
    queries: missing.map((key) => ({
      queryKey: ['rm-package', key, jiraBaseUrl],
      queryFn: async () =>
        fetchRmPackage(jiraBaseUrl as string, await requireToken(jiraBaseUrl), key),
      staleTime: STALE,
    })),
    combine: (results) => ({
      weeks: results.map((r) => r.data?.week ?? null),
      isLoading: results.some((r) => r.isLoading),
    }),
  });

  const weeks = useMemo(() => {
    let out = withChildren;
    for (const w of packages.weeks) if (w) out = mergeWeek(out, w);
    return out;
  }, [withChildren, packages]);
  const childToWeek = useMemo(() => indexChildToWeek(weeks), [weeks]);

  return {
    weeks,
    childToWeek,
    enabled,
    isLoading: listQuery.isLoading || children.isLoading || packages.isLoading,
    isError: listQuery.isError,
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
