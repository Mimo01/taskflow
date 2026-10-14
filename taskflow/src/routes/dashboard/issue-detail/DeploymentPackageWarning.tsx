import type { UseMutationResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import {
  useDeploymentPackageEditShape,
  useRmPackage,
  useRmWeekIndex,
} from '@/hooks/useRmWeekIndex';
import {
  buildPackageFieldValue,
  computeFixVersionsForFix,
  DEPLOYMENT_PACKAGE_FIELD,
  evaluatePackageSync,
  extractDeploymentPackageKey,
  indexChildToWeek,
  type PackageFix,
} from '@/lib/deployment-package';
import { openExternal } from '@/lib/openExternal';
import { fetchFixVersions } from '@/services/jira/versions';
import { readSecret } from '@/services/stronghold';

interface DeploymentPackageWarningProps {
  issueKey: string;
  issueTypeName: string;
  projectKey: string | undefined;
  projectName: string | undefined;
  pkgField: unknown;
  fixVersions: Array<{ id: string; name: string; releaseDate?: string }>;
  mutation: UseMutationResult<unknown, Error, { fieldName: string; value: unknown }>;
  jiraBaseUrl: string;
}

const BUTTON_CLASS =
  'rounded border border-amber-500/40 px-1.5 py-0.5 text-xs hover:bg-accent disabled:opacity-50';

/**
 * Sidebar warning for a Story whose fix version and Deployment package
 * (customfield_15725) disagree, with one-click fixes in both directions
 * (quick 261014-eym). Renders nothing when no RM project is configured, the
 * issue is not a Story, or the two fields agree.
 */
export function DeploymentPackageWarning({
  issueKey,
  issueTypeName,
  projectKey,
  projectName,
  pkgField,
  fixVersions,
  mutation,
  jiraBaseUrl,
}: DeploymentPackageWarningProps) {
  const { weeks: indexWeeks, enabled: rmEnabled } = useRmWeekIndex();
  const active = rmEnabled && issueTypeName === 'Story';

  const versionsQuery = useQuery({
    queryKey: ['jira-fix-versions', projectKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !projectKey) return [];
      return fetchFixVersions(jiraBaseUrl, token, projectKey);
    },
    enabled: active && !!projectKey,
  });
  const projectVersions = versionsQuery.data;

  const pkgKey = extractDeploymentPackageKey(pkgField);
  // Fast path: resolve just this story's package week directly; the full index (slower)
  // takes over once loaded, which also enables deriving a package from the fix version.
  const direct = useRmPackage(active ? pkgKey : null);
  const weeks = useMemo(
    () => (indexWeeks.length > 0 ? indexWeeks : direct.week ? [direct.week] : indexWeeks),
    [indexWeeks, direct.week],
  );
  const childToWeek = useMemo(() => indexChildToWeek(weeks), [weeks]);
  const result = useMemo(
    () =>
      evaluatePackageSync({
        pkgKey,
        fixVersions,
        weeks,
        projectName: projectName ?? projectKey ?? '',
        projectKey,
        projectVersions: projectVersions ?? [],
      }),
    [pkgKey, fixVersions, weeks, projectName, projectKey, projectVersions],
  );

  const needsPackageWrite = result.fixes.some((x) => x.kind === 'set-package');
  const { shape } = useDeploymentPackageEditShape(issueKey, active && needsPackageWrite);

  if (!active || result.state === 'ok' || result.state === 'none') return null;
  // Don't flash a "package not found" warning while the index / versions are still loading.
  if (weeks.length === 0 || versionsQuery.isLoading) return null;

  const applyFix = (fix: PackageFix) => {
    if (fix.kind === 'set-package') {
      if (!shape || shape === 'not-editable') return;
      mutation.mutate({
        fieldName: DEPLOYMENT_PACKAGE_FIELD,
        value: buildPackageFieldValue(fix.childKey, shape),
      });
      return;
    }
    const week = pkgKey ? childToWeek.get(pkgKey) : undefined;
    if (!week) return;
    mutation.mutate({
      fieldName: 'fixVersions',
      value: computeFixVersionsForFix(fixVersions, fix.versionId, week, projectVersions ?? []),
    });
  };

  return (
    <div
      data-testid="deployment-package-warning"
      className="ml-[7.5rem] flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-amber-600 dark:text-amber-400"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{result.hint}</span>
      {result.fixes.map((fix) => {
        if (fix.kind === 'set-fix-version') {
          return (
            <button
              key={`fv-${fix.versionId}`}
              type="button"
              className={BUTTON_CLASS}
              disabled={mutation.isPending}
              onClick={() => applyFix(fix)}
            >
              Set fix version to {fix.versionName}
            </button>
          );
        }
        if (shape === 'not-editable') {
          return (
            <button
              key={`pkg-${fix.childKey}`}
              type="button"
              className={BUTTON_CLASS}
              onClick={() => openExternal(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`)}
            >
              Open in Jira
            </button>
          );
        }
        return (
          <button
            key={`pkg-${fix.childKey}`}
            type="button"
            className={BUTTON_CLASS}
            disabled={mutation.isPending || !shape}
            onClick={() => applyFix(fix)}
          >
            Set deployment package to {fix.childKey}
          </button>
        );
      })}
    </div>
  );
}
