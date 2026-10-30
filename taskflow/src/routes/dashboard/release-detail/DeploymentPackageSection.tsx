import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { useRmWeekIndex } from '@/hooks/useRmWeekIndex';
import {
  evaluatePackageSync,
  extractDeploymentPackageKey,
  findWeekForDate,
  isPackageFieldUnreadable,
  type PackageFix,
  type PackageFixVersion,
  type PackageSyncResult,
  type PackageSyncState,
  packageFixLabel,
} from '@/lib/deployment-package';
import type { JiraIssue } from '@/services/jira';
import { fetchFixVersions, fetchStoriesWithPackageNoFixVersion } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { packageFixTarget } from '../PackageFixAction';
import { useDeploymentPackageSync } from './useDeploymentPackageSync';

interface DeploymentPackageSectionProps {
  /** All issues of the release (Stories are filtered here). */
  stories: JiraIssue[];
  version: { releaseDate?: string } | null;
  jiraBaseUrl: string | null;
  activeJiraProject: string | null;
  onOpenIssue: (key: string) => void;
}

type Person = { displayName: string; avatarUrls?: { '48x48': string } } | null | undefined;

/**
 * Avatar + name cell (same treatment as the task table's Assignee column: 20px
 * avatar, truncating name). `none` is the label for a missing person; reporters
 * have no 'Unassigned' notion, so a missing one is a muted dash.
 */
function PersonCell({
  person,
  label,
  none,
  className,
  nameClassName,
}: {
  person: Person;
  label: string;
  none: 'Unassigned' | '—';
  className?: string;
  nameClassName?: string;
}) {
  const name = person?.displayName;
  return (
    <span
      data-testid={`package-${label.toLowerCase()}`}
      title={`${label}: ${name ?? none}`}
      className={`flex min-w-0 items-center gap-1.5 text-xs ${className ?? ''}`}
    >
      {person ? (
        <>
          <CachedAvatar
            url={person.avatarUrls?.['48x48'] ?? null}
            name={person.displayName}
            size={20}
          />
          <span className={`truncate ${nameClassName ?? ''}`}>{person.displayName}</span>
        </>
      ) : none === 'Unassigned' ? (
        <>
          <CachedAvatar url={null} name="Unassigned" size={20} />
          <span className={`truncate text-muted-foreground ${nameClassName ?? ''}`}>
            Unassigned
          </span>
        </>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </span>
  );
}

// Column widths shared by the header strip and every row so they align exactly and
// hide together at the narrow breakpoints (reporter, then fix text, then the
// assignee name, then the pill text).
const COL_ICON = 'size-3.5 flex-none';
const COL_KEY = 'w-[5.5rem] flex-none whitespace-nowrap @max-[560px]/page:w-[5rem]';
const COL_STATE = 'w-[84px] flex-none @max-[440px]/page:w-7';
const COL_ASSIGNEE = 'w-[7.5rem] flex-none min-w-0 @max-[560px]/page:w-5';
const COL_REPORTER = 'w-[7.5rem] flex-none min-w-0 @max-[900px]/page:hidden';
const COL_FIX_TARGET = 'w-[190px] flex-none min-w-0 @max-[700px]/page:hidden';
const COL_FIX_ACTION = 'w-14 flex-none';
const HEADER_CLASS =
  'flex items-center gap-3 border-b px-2 py-1 @max-[560px]/page:gap-2 text-xs font-medium text-muted-foreground bg-[color-mix(in_oklab,var(--color-muted)_10%,var(--color-background))]';

/** Short, readable target ("Week 45 · RM-18"); the full text stays in the tooltip. */
function shortFixTarget(fix: PackageFix): string {
  if (fix.kind === 'set-fix-version') {
    // What it replaces stays in the tooltip (packageFixTarget).
    return fix.versionName;
  }
  const week = fix.weekSummary ? /week\s*(\d+)/i.exec(fix.weekSummary) : null;
  return week ? `Week ${Number(week[1])} · ${fix.childKey}` : packageFixTarget(fix);
}

/** Rows shown before the "Show all N" toggle. */
const VISIBLE_ROWS = 5;

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

  // Stories whose package belongs to this release's week but that have NO fix version never
  // show up in the release's "fixVersion = X" issue list, so they are fetched separately.
  const releaseWeek = useMemo(
    () => (version?.releaseDate ? findWeekForDate(weeks, version.releaseDate) : null),
    [weeks, version],
  );
  const weekChildKeys = useMemo(
    () => (releaseWeek?.children ?? []).map((c) => c.key),
    [releaseWeek],
  );
  const orphansQuery = useQuery({
    queryKey: ['jira-package-no-fixversion', activeJiraProject, jiraBaseUrl, weekChildKeys],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !activeJiraProject) return [];
      return fetchStoriesWithPackageNoFixVersion(
        jiraBaseUrl,
        token,
        activeJiraProject,
        weekChildKeys,
      );
    },
    enabled:
      enabled && !weeksLoading && !!jiraBaseUrl && !!activeJiraProject && weekChildKeys.length > 0,
    staleTime: 60_000,
  });
  const allStories = useMemo(() => {
    const have = new Set(onlyStories.map((s) => s.key));
    return [...onlyStories, ...(orphansQuery.data ?? []).filter((s) => !have.has(s.key))];
  }, [onlyStories, orphansQuery.data]);

  // Stories can belong to other projects than the active one (shared versions): their fix
  // versions must come from their own project. The active project's list is reused.
  const otherProjectKeys = useMemo(
    () => [
      ...new Set(
        allStories
          .map((s) => s.fields.project?.key)
          .filter((k): k is string => !!k && k !== activeJiraProject),
      ),
    ],
    [allStories, activeJiraProject],
  );
  const otherVersions = useQueries({
    queries: otherProjectKeys.map((projectKey) => ({
      queryKey: ['jira-fix-versions', projectKey],
      queryFn: async () => {
        const token = await readSecret('jira-pat').catch(() => null);
        if (!token || !jiraBaseUrl) throw new Error('No credentials');
        return fetchFixVersions(jiraBaseUrl, token, projectKey);
      },
      enabled: enabled && !!jiraBaseUrl,
      staleTime: 5 * 60_000,
    })),
    combine: (results) => ({
      data: results.map((r) => r.data),
      isLoading: results.some((r) => r.isLoading),
    }),
  });
  const versionsByProject = useMemo(() => {
    const out: Record<string, PackageFixVersion[]> = {};
    otherProjectKeys.forEach((k, i) => {
      const v = otherVersions.data[i];
      if (v) out[k] = v;
    });
    if (activeJiraProject) out[activeJiraProject] = projectVersions;
    return out;
  }, [otherProjectKeys, otherVersions, activeJiraProject, projectVersions]);

  const { applyFix } = useDeploymentPackageSync({
    version,
    stories: onlyStories,
    projectVersions,
    versionsByProject,
  });

  const rows = useMemo(() => {
    if (!enabled || weeks.length === 0 || weeksLoading || otherVersions.isLoading) return [];
    const out: Array<{ issue: JiraIssue; result: PackageSyncResult }> = [];
    for (const issue of allStories) {
      const result = evaluatePackageSync({
        pkgKey: extractDeploymentPackageKey(issue.fields.customfield_15725),
        fixVersions: issue.fields.fixVersions ?? [],
        weeks,
        projectName: issue.fields.project?.name ?? issue.fields.project?.key ?? '',
        projectKey: issue.fields.project?.key,
        projectVersions: versionsByProject[issue.fields.project?.key ?? ''] ?? projectVersions,
        pkgUnreadable: isPackageFieldUnreadable(issue.fields.customfield_15725),
      });
      if (result.state !== 'ok' && result.state !== 'none') out.push({ issue, result });
    }
    return out;
  }, [
    enabled,
    weeks,
    weeksLoading,
    otherVersions.isLoading,
    allStories,
    projectVersions,
    versionsByProject,
  ]);

  const [pending, setPending] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);

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

  const shown = expanded ? rows : rows.slice(0, VISIBLE_ROWS);
  const hiddenCount = rows.length - VISIBLE_ROWS;
  const fixSlots = Math.max(1, ...rows.map((r) => r.result.fixes.length));

  return (
    <section data-testid="deployment-package-section" className="px-6 pt-5">
      <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
        <AlertTriangle className="size-3.5 text-muted-foreground" />
        Deployment package mismatches
        <span className="font-normal text-muted-foreground" data-testid="deployment-package-count">
          {rows.length}
        </span>
      </h3>
      <div data-testid="package-column-header" className={HEADER_CLASS}>
        <span className={COL_ICON} aria-hidden="true" />
        <span className={COL_KEY}>Key</span>
        <span className={COL_STATE}>
          <span className="@max-[440px]/page:sr-only">State</span>
        </span>
        <span className={COL_ASSIGNEE}>
          <span className="@max-[560px]/page:sr-only">Assignee</span>
        </span>
        <span className={COL_REPORTER}>Reporter</span>
        <span className="min-w-[8rem] flex-1 @max-[700px]/page:min-w-[3rem]">Summary</span>
        {Array.from({ length: fixSlots }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed slot positions
          <div key={i} className="flex flex-none items-center gap-2">
            <span className={COL_FIX_TARGET}>{i === 0 ? 'Fix' : ''}</span>
            <span className={COL_FIX_ACTION} aria-hidden="true" />
          </div>
        ))}
      </div>
      <div className="flex flex-col divide-y border-b">
        {shown.map(({ issue, result }) => (
          <div key={issue.key} data-testid={`package-row-${issue.key}`} className="min-w-0">
            <div className="flex min-h-8 min-w-0 items-center gap-3 px-2 @max-[560px]/page:gap-2 py-1 text-sm transition-colors hover:bg-muted/50">
              <IssueTypeIcon
                typeName={issue.fields.issuetype?.name ?? 'Story'}
                muted
                className={COL_ICON}
              />
              <button
                type="button"
                onClick={() => onOpenIssue(issue.key)}
                className={`${COL_KEY} text-left font-mono text-xs text-primary hover:underline`}
              >
                {issue.key}
              </button>
              <span
                className={`inline-flex items-center justify-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-700 dark:text-amber-400 ${COL_STATE}`}
                title={`${result.hint}${result.detail ? ` ${result.detail}` : ''}`}
                data-testid="package-state"
              >
                <AlertTriangle aria-hidden className="hidden size-3 @max-[440px]/page:block" />
                <span className="@max-[440px]/page:sr-only">{STATE_LABEL[result.state]}</span>
              </span>
              <PersonCell
                person={issue.fields.assignee}
                label="Assignee"
                none="Unassigned"
                className={COL_ASSIGNEE}
                nameClassName="@max-[560px]/page:sr-only"
              />
              <PersonCell
                person={issue.fields.reporter}
                label="Reporter"
                none="—"
                className={COL_REPORTER}
              />
              <span
                className="min-w-[8rem] flex-1 @max-[700px]/page:min-w-[3rem] truncate"
                title={issue.fields.summary}
              >
                {issue.fields.summary}
              </span>
              {Array.from({ length: fixSlots }, (_, i) => {
                const fix = result.fixes[i];
                return (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed slot positions
                  <div key={i} className="flex flex-none items-center gap-2 text-xs">
                    <span
                      className={`${COL_FIX_TARGET} truncate text-muted-foreground`}
                      title={fix ? packageFixTarget(fix) : undefined}
                    >
                      {fix ? (
                        <>
                          <span aria-hidden="true">→ </span>
                          {shortFixTarget(fix)}
                        </>
                      ) : null}
                    </span>
                    <span className={COL_FIX_ACTION}>
                      {fix ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          disabled={pending === issue.key}
                          aria-label={packageFixLabel(fix)}
                          title={packageFixLabel(fix)}
                          onClick={() => onFix(issue, fix)}
                        >
                          Apply
                        </Button>
                      ) : null}
                    </span>
                  </div>
                );
              })}
            </div>
            {errors[issue.key] && (
              <p className="break-words px-2 pb-1.5 text-xs text-destructive" role="alert">
                {errors[issue.key]}
              </p>
            )}
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          data-testid="package-show-all"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
