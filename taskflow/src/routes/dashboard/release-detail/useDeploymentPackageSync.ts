import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useRmWeekIndex } from '@/hooks/useRmWeekIndex';
import {
  buildPackageFieldValue,
  computeFixVersionsForFix,
  DEPLOYMENT_PACKAGE_FIELD,
  extractDeploymentPackageKey,
  type PackageEditShape,
  type PackageFix,
  type PackageFixVersion,
  type PackageStoryLike,
  planBulkSync,
  type RmWeek,
} from '@/lib/deployment-package';
import { bulkUpdateIssue, fetchDeploymentPackageEditShape } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

export interface PackageSyncItemResult {
  key: string;
  ok: boolean;
  error?: string;
}

export interface PackageSyncRun {
  /** True when editmeta says the field is not on the edit screen; nothing was written. */
  blocked: boolean;
  results: PackageSyncItemResult[];
}

export const NOT_EDITABLE_REASON =
  'The Deployment package field is not editable via the API (not on the Jira edit screen).';

/** Cached editmeta lookup shared by the sidebar hook (same key, same staleTime). */
export function resolvePackageEditShape(
  queryClient: QueryClient,
  jiraBaseUrl: string,
  token: string,
  issueKey: string,
): Promise<PackageEditShape> {
  return queryClient.fetchQuery({
    queryKey: ['jira-editmeta-deployment-package', issueKey],
    queryFn: () => fetchDeploymentPackageEditShape(jiraBaseUrl, token, issueKey),
    staleTime: 30 * 60_000,
  });
}

function invalidateAfterWrite(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['jira-fixversion-issues'] });
  queryClient.invalidateQueries({ queryKey: ['jira-issue-detail'] });
}

/**
 * Bulk fix version -> package sync for one release. Fetches the edit shape
 * once (from the first planned story), refuses to write when the field is not
 * editable, then writes sequentially. A 400/403 on one story never aborts the
 * loop: every outcome is collected per item.
 */
export async function executeDeploymentPackageSync(input: {
  queryClient: QueryClient;
  jiraBaseUrl: string;
  token: string;
  stories: PackageStoryLike[];
  version: { releaseDate?: string };
  weeks: RmWeek[];
}): Promise<PackageSyncRun> {
  const { queryClient, jiraBaseUrl, token, stories, version, weeks } = input;
  // Shape-independent pass: which stories need a write.
  const candidates = planBulkSync(stories, version, weeks, 'single');
  if (candidates.length === 0) return { blocked: false, results: [] };

  const shape = await resolvePackageEditShape(queryClient, jiraBaseUrl, token, candidates[0].key);
  if (shape === 'not-editable') return { blocked: true, results: [] };

  const plan = planBulkSync(stories, version, weeks, shape);
  const results: PackageSyncItemResult[] = [];
  for (const item of plan) {
    try {
      await bulkUpdateIssue(jiraBaseUrl, token, item.key, item.fields);
      results.push({ key: item.key, ok: true });
    } catch (e) {
      results.push({ key: item.key, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  invalidateAfterWrite(queryClient);
  return { blocked: false, results };
}

/**
 * Release-detail data layer for Deployment package sync: the bulk plan, a
 * runnable bulk sync and per-row single fixes (both directions).
 */
export function useDeploymentPackageSync(input: {
  version: { releaseDate?: string } | null;
  stories: PackageStoryLike[];
  projectVersions: PackageFixVersion[];
}) {
  const { version, stories, projectVersions } = input;
  const queryClient = useQueryClient();
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const { weeks, childToWeek } = useRmWeekIndex();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<PackageSyncItemResult[]>([]);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);

  const plan = useMemo(
    () => (version ? planBulkSync(stories, version, weeks, 'single') : []),
    [stories, version, weeks],
  );

  const getToken = useCallback(async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) throw new Error('No credentials');
    return { token, baseUrl: jiraBaseUrl };
  }, [jiraBaseUrl]);

  const run = useCallback(async (): Promise<PackageSyncRun> => {
    if (!version) return { blocked: false, results: [] };
    setIsRunning(true);
    setBlockedReason(null);
    try {
      const { token, baseUrl } = await getToken();
      const outcome = await executeDeploymentPackageSync({
        queryClient,
        jiraBaseUrl: baseUrl,
        token,
        stories,
        version,
        weeks,
      });
      if (outcome.blocked) setBlockedReason(NOT_EDITABLE_REASON);
      setResults(outcome.results);
      return outcome;
    } finally {
      setIsRunning(false);
    }
  }, [version, getToken, queryClient, stories, weeks]);

  /** Single-row fix. Throws with Jira's message on failure so the caller can show it. */
  const applyFix = useCallback(
    async (story: PackageStoryLike, fix: PackageFix): Promise<void> => {
      const { token, baseUrl } = await getToken();
      if (fix.kind === 'set-package') {
        const shape = await resolvePackageEditShape(queryClient, baseUrl, token, story.key);
        if (shape === 'not-editable') throw new Error(NOT_EDITABLE_REASON);
        await bulkUpdateIssue(baseUrl, token, story.key, {
          [DEPLOYMENT_PACKAGE_FIELD]: buildPackageFieldValue(fix.childKey, shape),
        });
      } else {
        const pkgKey = extractDeploymentPackageKey(story.fields[DEPLOYMENT_PACKAGE_FIELD]);
        const week = pkgKey ? childToWeek.get(pkgKey) : undefined;
        if (!week) throw new Error('The deployment package week is unknown.');
        await bulkUpdateIssue(baseUrl, token, story.key, {
          fixVersions: computeFixVersionsForFix(
            story.fields.fixVersions ?? [],
            fix.versionId,
            week,
            projectVersions,
          ),
        });
      }
      invalidateAfterWrite(queryClient);
    },
    [getToken, queryClient, childToWeek, projectVersions],
  );

  return { plan, run, applyFix, isRunning, results, blockedReason };
}
