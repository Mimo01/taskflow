import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useRmWeekIndex } from '@/hooks/useRmWeekIndex';
import {
  evaluatePackageSync,
  extractDeploymentPackageKey,
  type PackageFix,
  type PackageSyncResult,
  type PackageSyncState,
} from '@/lib/deployment-package';
import type { JiraIssue } from '@/services/jira';
import { fetchFixVersions } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useDeploymentPackageSync } from './useDeploymentPackageSync';

interface DeploymentPackageSectionProps {
  /** All issues of the release (Stories are filtered here). */
  stories: JiraIssue[];
  version: { releaseDate?: string } | null;
  jiraBaseUrl: string | null;
  activeJiraProject: string | null;
  onOpenIssue: (key: string) => void;
}

const STATE_LABEL: Record<PackageSyncState, string> = {
  none: '',
  ok: '',
  'pkg-only': 'No fix version',
  'fv-only': 'No package',
  mismatch: 'Mismatch',
  unresolved: 'Unresolved',
};

/**
 * Stories of this release whose fix version and Deployment package
 * (customfield_15725) disagree, with per-row fixes (quick 261014-eym).
 * Separate from MR drift (driftDetection.ts stays MR-only). Renders nothing
 * without an RM project or without drift.
 */
export function DeploymentPackageSection({
  stories,
  version,
  jiraBaseUrl,
  activeJiraProject,
  onOpenIssue,
}: DeploymentPackageSectionProps) {
  const { enabled } = useRmWeekIndex();

  const versionsQuery = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !activeJiraProject) throw new Error('No credentials');
      return fetchFixVersions(jiraBaseUrl, token, activeJiraProject);
    },
    enabled: enabled && !!jiraBaseUrl && !!activeJiraProject,
    staleTime: 5 * 60_000,
  });
  const projectVersions = versionsQuery.data ?? [];

  const onlyStories = useMemo(
    () => stories.filter((s) => s.fields.issuetype?.name === 'Story'),
    [stories],
  );
  const { applyFix } = useDeploymentPackageSync({ version, stories: onlyStories, projectVersions });

  // Children are loaded lazily: only for the weeks of the stories' fix versions, and packages
  // outside those weeks are resolved directly per key.
  const weekDates = useMemo(
    () => [
      version?.releaseDate,
      ...onlyStories.flatMap((s) =>
        (s.fields.fixVersions ?? []).map(
          (v) => v.releaseDate ?? projectVersions.find((p) => p.id === v.id)?.releaseDate,
        ),
      ),
    ],
    [version, onlyStories, projectVersions],
  );
  const packageKeys = useMemo(
    () => onlyStories.map((s) => extractDeploymentPackageKey(s.fields.customfield_15725)),
    [onlyStories],
  );
  const { weeks, isLoading: weeksLoading } = useRmWeekIndex({
    dates: weekDates,
    pkgKeys: packageKeys,
  });

  const rows = useMemo(() => {
    if (!enabled || weeks.length === 0 || weeksLoading) return [];
    const out: Array<{ issue: JiraIssue; result: PackageSyncResult }> = [];
    for (const issue of onlyStories) {
      const result = evaluatePackageSync({
        pkgKey: extractDeploymentPackageKey(issue.fields.customfield_15725),
        fixVersions: issue.fields.fixVersions ?? [],
        weeks,
        projectName: issue.fields.project?.name ?? issue.fields.project?.key ?? '',
        projectKey: issue.fields.project?.key,
        projectVersions,
      });
      if (result.state !== 'ok' && result.state !== 'none') out.push({ issue, result });
    }
    return out;
  }, [enabled, weeks, weeksLoading, onlyStories, projectVersions]);

  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!enabled || rows.length === 0) return null;

  const onFix = async (issue: JiraIssue, fix: PackageFix) => {
    setPending(issue.key);
    setErrors((e) => {
      const { [issue.key]: _drop, ...rest } = e;
      return rest;
    });
    try {
      await applyFix(issue, fix);
    } catch (err) {
      setErrors((e) => ({
        ...e,
        [issue.key]: err instanceof Error ? err.message : String(err),
      }));
    } finally {
      setPending(null);
    }
  };

  return (
    <section data-testid="deployment-package-section">
      <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
        <AlertTriangle className="size-3.5" />
        Deployment package ({rows.length})
      </h3>
      <div className="flex flex-col divide-y">
        {rows.map(({ issue, result }) => (
          <div key={issue.key} className="flex min-w-0 flex-col gap-1 py-2 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <button
                type="button"
                onClick={() => onOpenIssue(issue.key)}
                className="shrink-0 font-mono text-xs text-primary hover:underline"
              >
                {issue.key}
              </button>
              <span className="min-w-0 flex-1 truncate" title={issue.fields.summary}>
                {issue.fields.summary}
              </span>
              <span className="shrink-0 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                {STATE_LABEL[result.state]}
              </span>
            </div>
            <p className="min-w-0 break-words text-xs text-muted-foreground">
              {result.hint}
              {result.detail ? ` ${result.detail}` : ''}
            </p>
            {result.fixes.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.fixes.map((fix) => (
                  <Button
                    key={
                      fix.kind === 'set-fix-version' ? `fv-${fix.versionId}` : `pkg-${fix.childKey}`
                    }
                    type="button"
                    variant="outline"
                    size="xs"
                    className="h-auto min-h-6 max-w-full whitespace-normal break-words py-0.5 text-left"
                    disabled={pending === issue.key}
                    onClick={() => onFix(issue, fix)}
                  >
                    {fix.kind === 'set-fix-version'
                      ? `Set fix version to ${fix.versionName}`
                      : `Set deployment package to ${fix.childKey}`}
                  </Button>
                ))}
              </div>
            )}
            {errors[issue.key] && (
              <p className="break-words text-xs text-destructive" role="alert">
                {errors[issue.key]}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
