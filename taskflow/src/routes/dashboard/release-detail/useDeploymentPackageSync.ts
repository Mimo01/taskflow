import { type QueryClient, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useRmWeekIndex } from '@/hooks/useRmWeekIndex';
import {
  buildPackageFieldValue,
  computeFixVersionsForFix,
  DEPLOYMENT_PACKAGE_FIELD,
  describeWriteError,
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

const projectKeyOf = (s: PackageStoryLike) => s.fields.project?.key ?? '';

/**
 * Edit shape per project key for the stories that need a write. editmeta is
 * per issue/project (edit screens differ), so it is resolved from the first
 * candidate of each project instead of once for the whole release.
 */
export async function resolveShapesForCandidates(
  queryClient: QueryClient,
  jiraBaseUrl: string,
  token: string,
  stories: PackageStoryLike[],
  candidates: { key: string }[],
): Promise<Map<string, PackageEditShape>> {
  const byKey = new Map(stories.map((s) => [s.key, s]));
  const shapes = new Map<string, PackageEditShape>();
  for (const c of candidates) {
    const story = byKey.get(c.key);
    const pk = story ? projectKeyOf(story) : '';
    if (shapes.has(pk)) continue;
    shapes.set(pk, await resolvePackageEditShape(queryClient, jiraBaseUrl, token, c.key));
  }
  return shapes;
}

/**
 * Bulk fix version -> package sync for one release. Resolves the edit shape per
 * project, refuses to write when the field is not editable anywhere, then writes
 * sequentially. A 400/403 on one story never aborts the loop: every outcome is
 * collected per item, and stories of a project where the field is not editable
 * are reported as failed rather than silently skipped.
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

  const shapes = await resolveShapesForCandidates(
    queryClient,
    jiraBaseUrl,
    token,
    stories,
    candidates,
  );
  if ([...shapes.values()].every((sh) => sh === 'not-editable')) {
    return { blocked: true, results: [] };
  }

  const results: PackageSyncItemResult[] = [];
  for (const [pk, shape] of shapes) {
    const projectStories = stories.filter((s) => projectKeyOf(s) === pk);
    if (shape === 'not-editable') {
      for (const c of planBulkSync(projectStories, version, weeks, 'single')) {
        results.push({
          key: c.key,
          ok: false,
          error: `Deployment package is not editable for project ${pk || 'unknown'}.`,
        });
      }
      continue;
    }
    for (const item of planBulkSync(projectStories, version, weeks, shape)) {
      try {
        await bulkUpdateIssue(jiraBaseUrl, token, item.key, item.fields);
        results.push({ key: item.key, ok: true });
      } catch (e) {
        results.push({
          key: item.key,
          ok: false,
          error: describeWriteError(e, item.key),
        });
      }
    }
  }
  invalidateAfterWrite(queryClient);
  return { blocked: false, results };
}

/**
 * Release-detail data layer for Deployment package sync: per-row single fixes
 * (both directions). Bulk sync lives in executeDeploymentPackageSync.
 */
export function useDeploymentPackageSync(input: {
  version: { releaseDate?: string } | null;
  stories: PackageStoryLike[];
  /** Fallback fix versions (the active project's). */
  projectVersions: PackageFixVersion[];
  /** Fix versions per project key, for stories outside the active project. */
  versionsByProject?: Record<string, PackageFixVersion[]>;
}) {
  const { version, stories, projectVersions, versionsByProject } = input;
  const queryClient = useQueryClient();
  const jiraBaseUrl = useAuthStore((s) => s.jiraBaseUrl);
  const pkgKeys = useMemo(
    () => stories.map((s) => extractDeploymentPackageKey(s.fields[DEPLOYMENT_PACKAGE_FIELD])),
    [stories],
  );
  const { childToWeek } = useRmWeekIndex({ dates: [version?.releaseDate], pkgKeys });

  const getToken = useCallback(async () => {
    const token = await readSecret('jira-pat').catch(() => null);
    if (!token || !jiraBaseUrl) throw new Error('No credentials');
    return { token, baseUrl: jiraBaseUrl };
  }, [jiraBaseUrl]);

  /** Single-row fix. Throws with Jira's message on failure so the caller can show it. */
  const applyFix = useCallback(
    async (story: PackageStoryLike, fix: PackageFix): Promise<void> => {
      const { token, baseUrl } = await getToken();
      const write = async (fields: Record<string, unknown>) => {
        try {
          await bulkUpdateIssue(baseUrl, token, story.key, fields);
        } catch (e) {
          throw new Error(describeWriteError(e, story.key));
        }
      };
      if (fix.kind === 'set-package') {
        const shape = await resolvePackageEditShape(queryClient, baseUrl, token, story.key);
        if (shape === 'not-editable') throw new Error(NOT_EDITABLE_REASON);
        await write({ [DEPLOYMENT_PACKAGE_FIELD]: buildPackageFieldValue(fix.childKey, shape) });
      } else {
        const pkgKey = extractDeploymentPackageKey(story.fields[DEPLOYMENT_PACKAGE_FIELD]);
        const week = pkgKey ? childToWeek.get(pkgKey) : undefined;
        if (!week) throw new Error('The deployment package week is unknown.');
        await write({
          fixVersions: computeFixVersionsForFix(
            story.fields.fixVersions ?? [],
            fix.versionId,
            week,
            versionsByProject?.[story.fields.project?.key ?? ''] ?? projectVersions,
          ),
        });
      }
      invalidateAfterWrite(queryClient);
    },
    [getToken, queryClient, childToWeek, projectVersions, versionsByProject],
  );

  return { applyFix };
}
