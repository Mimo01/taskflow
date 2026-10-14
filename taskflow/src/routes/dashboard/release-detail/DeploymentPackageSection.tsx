import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
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

const FIX_BUTTON =
  'shrink-0 rounded border px-1.5 py-0.5 text-xs hover:bg-accent disabled:opacity-50';

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
  const { weeks, enabled } = useRmWeekIndex();

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

  const rows = useMemo(() => {
    if (!enabled || weeks.length === 0) return [];
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
  }, [enabled, weeks, onlyStories, projectVersions]);

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
      <div className="flex flex-col gap-1">
        {rows.map(({ issue, result }) => (
          <div key={issue.key} className="flex flex-col">
            <div className="flex items-center gap-2 text-sm min-w-0">
              <button
                type="button"
                onClick={() => onOpenIssue(issue.key)}
                className="shrink-0 font-mono text-xs text-primary hover:underline"
              >
                {issue.key}
              </button>
              <span className="truncate min-w-0 flex-1" title={issue.fields.summary}>
                {issue.fields.summary}
              </span>
              <span
                className="shrink-0 text-xs text-amber-600 dark:text-amber-400"
                title={result.hint}
              >
                {STATE_LABEL[result.state]}
              </span>
              {result.fixes.map((fix) =>
                fix.kind === 'set-fix-version' ? (
                  <button
                    key={`fv-${fix.versionId}`}
                    type="button"
                    className={FIX_BUTTON}
                    disabled={pending === issue.key}
                    onClick={() => onFix(issue, fix)}
                  >
                    Set fix version to {fix.versionName}
                  </button>
                ) : (
                  <button
                    key={`pkg-${fix.childKey}`}
                    type="button"
                    className={FIX_BUTTON}
                    disabled={pending === issue.key}
                    onClick={() => onFix(issue, fix)}
                  >
                    Set deployment package to {fix.childKey}
                  </button>
                ),
              )}
            </div>
            {errors[issue.key] && (
              <p className="text-xs text-destructive pl-1" role="alert">
                {errors[issue.key]}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
