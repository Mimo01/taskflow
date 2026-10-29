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
} from '@/lib/deployment-package';
import { bulkUpdateIssue, fetchDeploymentPackageEditShape } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';

const NOT_EDITABLE_REASON =
  'The Deployment package field is not editable via the API (not on the Jira edit screen).';

/** Cached editmeta lookup shared by the sidebar hook (same key, same staleTime). */
function resolvePackageEditShape(
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
 * Release-detail data layer for Deployment package sync: per-row single fixes
 * (both directions), one story at a time.
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
