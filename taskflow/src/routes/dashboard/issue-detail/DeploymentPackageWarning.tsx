import type { UseMutationResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
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
  mergeWeek,
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
  /** Render inside the Deployment package value cell (no label gutter of its own). */
  embedded?: boolean;
}

const FIX_BUTTON_CLASS = 'h-auto min-h-6 max-w-full whitespace-normal break-words py-0.5 text-left';

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
      }),
    [pkgKey, fixVersions, weeks, projectName, projectKey, projectVersions],
  );

  const needsPackageWrite = result.fixes.some((x) => x.kind === 'set-package');
  const { shape } = useDeploymentPackageEditShape(issueKey, active && needsPackageWrite);

  if (!active || result.state === 'ok' || result.state === 'none') return null;
  // Don't flash a "package not found" warning while the index / versions are still loading.
  if (weeks.length === 0 || versionsQuery.isLoading || weeksLoading) return null;

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
      className="flex min-w-0 flex-1 items-start gap-1.5 text-xs"
    >
      <AlertTriangle
        className="mt-px size-3.5 shrink-0 text-amber-700 dark:text-amber-400"
        aria-hidden="true"
      />
      {/* Message, detail and actions share one column so they line up beside the icon. */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="min-w-0 break-words text-amber-700 dark:text-amber-400">
          {result.hint}
        </span>
        {result.detail && (
          <p className="min-w-0 break-words text-muted-foreground">{result.detail}</p>
        )}
        {result.fixes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {result.fixes.map((fix) => {
              if (fix.kind === 'set-fix-version') {
                return (
                  <Button
                    key={`fv-${fix.versionId}`}
                    type="button"
                    variant="outline"
                    size="xs"
                    className={FIX_BUTTON_CLASS}
                    disabled={mutation.isPending}
                    onClick={() => applyFix(fix)}
                  >
                    Set fix version to {fix.versionName}
                  </Button>
                );
              }
              if (shape === 'not-editable') {
                return (
                  <Button
                    key={`pkg-${fix.childKey}`}
                    type="button"
                    variant="outline"
                    size="xs"
                    className={FIX_BUTTON_CLASS}
                    onClick={() =>
                      openExternal(`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`)
                    }
                  >
                    Open in Jira
                  </Button>
                );
              }
              return (
                <Button
                  key={`pkg-${fix.childKey}`}
                  type="button"
                  variant="outline"
                  size="xs"
                  className={FIX_BUTTON_CLASS}
                  disabled={mutation.isPending || !shape}
                  onClick={() => applyFix(fix)}
                >
                  Set deployment package to {fix.childKey}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) return <div className="mt-1 flex min-w-0">{body}</div>;
  return (
    <div className="flex items-start gap-2">
      {/* Same label gutter as MetaRow, so the warning sits inside the value column. */}
      <span className="w-28 shrink-0" aria-hidden="true" />
      {body}
    </div>
  );
}
