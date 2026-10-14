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
  isPackageFieldUnreadable,
  mergeWeek,
  type PackageFix,
} from '@/lib/deployment-package';
import { openExternal } from '@/lib/openExternal';
import { fetchFixVersions } from '@/services/jira/versions';
import { readSecret } from '@/services/stronghold';
import { PackageFixAction } from '../PackageFixAction';

interface DeploymentPackageWarningProps {
  issueKey: string;
  issueTypeName: string;
  projectKey: string | undefined;
  projectName: string | undefined;
  pkgField: unknown;
  fixVersions: Array<{ id: string; name: string; releaseDate?: string }>;
  mutation: UseMutationResult<unknown, Error, { fieldName: string; value: unknown }>;
  jiraBaseUrl: string;
  /** Render inside the Deployment package value cell (no label gutter of its own). */
  embedded?: boolean;
  /** Embedded mode only: rendered instead of the warning whenever there is nothing to warn about. */
  fallback?: React.ReactNode;
}

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
  embedded = false,
  fallback = null,
}: DeploymentPackageWarningProps) {
  const { enabled: rmEnabled } = useRmWeekIndex();
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
  // Children are loaded lazily, only for the week(s) of this story's fix versions. The story's
  // own package week is resolved directly (fast) and merged in.
  const fixVersionDates = useMemo(
    () =>
      fixVersions.map(
        (v) => v.releaseDate ?? projectVersions?.find((p) => p.id === v.id)?.releaseDate,
      ),
    [fixVersions, projectVersions],
  );
  const { weeks: indexWeeks, isLoading: weeksLoading } = useRmWeekIndex({
    dates: active ? fixVersionDates : [],
  });
  const direct = useRmPackage(active ? pkgKey : null);
  const weeks = useMemo(
    () => (direct.week ? mergeWeek(indexWeeks, direct.week) : indexWeeks),
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
        pkgUnreadable: isPackageFieldUnreadable(pkgField),
      }),
    [pkgKey, pkgField, fixVersions, weeks, projectName, projectKey, projectVersions],
  );

  const needsPackageWrite = result.fixes.some((x) => x.kind === 'set-package');
  const { shape } = useDeploymentPackageEditShape(issueKey, active && needsPackageWrite);

  const nothing = embedded ? fallback : null;
  if (!active || result.state === 'ok' || result.state === 'none') return nothing;
  // Don't flash a "package not found" warning while the index / versions are still loading.
  if (weeks.length === 0 || versionsQuery.isLoading || weeksLoading) return nothing;

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

  const body = (
    <div
      data-testid="deployment-package-warning"
      className="flex min-w-0 flex-1 flex-col gap-1.5 text-xs"
    >
      <div className="flex min-w-0 items-start gap-1.5 text-amber-700 dark:text-amber-400">
        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 break-words">{result.hint}</span>
      </div>
      {result.detail && (
        <p className="min-w-0 break-words pl-5 text-muted-foreground">{result.detail}</p>
      )}
      {result.fixes.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2 pl-5">
          {result.fixes.map((fix) => {
            const key =
              fix.kind === 'set-fix-version' ? `fv-${fix.versionId}` : `pkg-${fix.childKey}`;
            if (fix.kind === 'set-package' && shape === 'not-editable') {
              return (
                <PackageFixAction
                  key={key}
                  fix={fix}
                  actionLabel="Open in Jira"
                  disabled={mutation.isPending}
                  onApply={() =>
                    openExternal(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`)
                  }
                />
              );
            }
            return (
              <PackageFixAction
                key={key}
                fix={fix}
                disabled={mutation.isPending || (fix.kind === 'set-package' && !shape)}
                onApply={() => applyFix(fix)}
              />
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) return <div className="flex min-w-0">{body}</div>;
  return (
    <div className="flex items-start gap-2">
      {/* Same label gutter as MetaRow, so the warning sits inside the value column. */}
      <span className="w-28 shrink-0" aria-hidden="true" />
      {body}
    </div>
  );
}
