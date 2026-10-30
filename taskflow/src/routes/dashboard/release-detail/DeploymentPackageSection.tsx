import { useQueries, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useLayoutEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  /** Reports whether the section shows rows, so the page can tell "nothing to
   *  show" from "only this section has content" (94-REVIEW CR-03). */
  onHasRowsChange?: (hasRows: boolean) => void;
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
// Breakpoints are on the section's own width (@container), like the Issues table:
// people collapse to avatars at 860, reporter goes at 760, the type icon at 640,
// the fix text at 600 (Apply keeps it as a tooltip), the state pill turns into an
// icon at 520. Summary and Fix split the leftover width 2:1 (Fix 7rem–280px,
// truncating), so neither starves and a row never overflows.
const COL_ICON = 'size-3.5 flex-none @max-[640px]:hidden';
const COL_KEY = 'w-[5.5rem] flex-none whitespace-nowrap @max-[520px]:w-[5rem]';
const COL_STATE = 'w-[84px] flex-none @max-[520px]:w-7';
const COL_ASSIGNEE = 'w-[6.75rem] flex-none min-w-0 @max-[860px]:w-5';
const COL_REPORTER = 'w-[6.75rem] flex-none min-w-0 @max-[860px]:w-5 @max-[760px]:hidden';
const COL_FIX_TARGET = 'flex-[1_1_0%] min-w-[7rem] max-w-[280px] @max-[600px]:hidden';
const COL_SUMMARY = 'flex-[2_1_0%] min-w-[6rem] @max-[600px]:min-w-[3rem]';
/** Warning-tone outline shared by Apply and "Apply ▾": same width, one clean edge. */
const APPLY_CLASS =
  'w-full justify-center border-orange-300 bg-background text-orange-700 hover:bg-orange-100 hover:text-orange-800 dark:border-orange-500/40 dark:bg-transparent dark:text-orange-300 dark:hover:bg-orange-500/15 dark:hover:text-orange-200';
const COL_FIX_ACTION = 'flex w-[4.75rem] flex-none justify-end';
const HEADER_CLASS =
  'flex items-center gap-3 border-b border-orange-200/70 px-2 py-1 text-xs font-medium text-muted-foreground @max-[860px]:gap-2 dark:border-orange-500/20';

function fixKey(fix: PackageFix): string {
  return fix.kind === 'set-fix-version' ? `fv-${fix.versionId}` : `pkg-${fix.childKey}`;
}

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
  onHasRowsChange,
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

  // Layout effect: the page swaps its empty notice for this section in the same
  // frame the section appears.
  const hasRows = enabled && rows.length > 0;
  useLayoutEffect(() => {
    onHasRowsChange?.(hasRows);
  }, [hasRows, onHasRowsChange]);

  if (!hasRows) return null;

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

  return (
    <section
      data-testid="deployment-package-section"
      className="@container mt-6 border-l-[3px] border-orange-400 bg-orange-50/60 px-6 py-4 dark:border-orange-500/70 dark:bg-orange-500/[0.06]"
    >
      <h3 className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold">
        <AlertTriangle className="size-3.5 text-orange-600 dark:text-orange-400" />
        Deployment package mismatches
        <span
          className="rounded-full bg-orange-500/15 px-1.5 text-xs font-medium tabular-nums text-orange-700 dark:text-orange-300"
          data-testid="deployment-package-count"
        >
          {rows.length}
        </span>
        <span className="text-xs font-normal text-muted-foreground @max-[760px]:hidden">
          Issues whose fix version and deployment package disagree. Apply to fix.
        </span>
      </h3>
      <div data-testid="package-column-header" className={HEADER_CLASS}>
        <span className={COL_ICON} aria-hidden="true" />
        <span className={COL_KEY}>Key</span>
        <span className={COL_STATE}>
          <span className="@max-[520px]:sr-only">State</span>
        </span>
        <span className={COL_ASSIGNEE}>
          <span className="@max-[860px]:sr-only">Assignee</span>
        </span>
        <span className={COL_REPORTER}>
          <span className="@max-[860px]:sr-only">Reporter</span>
        </span>
        <span className={COL_SUMMARY}>Summary</span>
        <span className={COL_FIX_TARGET}>Fix</span>
        <span className={COL_FIX_ACTION} aria-hidden="true" />
      </div>
      <div className="flex flex-col divide-y divide-orange-200/60 dark:divide-orange-500/15">
        {shown.map(({ issue, result }) => (
          <div key={issue.key} data-testid={`package-row-${issue.key}`} className="min-w-0">
            <div className="flex min-h-8 min-w-0 items-center gap-3 px-2 @max-[860px]:gap-2 py-1 text-sm transition-colors hover:bg-orange-100/50 dark:hover:bg-orange-500/10">
              <IssueTypeIcon
                typeName={issue.fields.issuetype?.name ?? 'Story'}
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
                <AlertTriangle aria-hidden className="hidden size-3 @max-[520px]:block" />
                <span className="@max-[520px]:sr-only">{STATE_LABEL[result.state]}</span>
              </span>
              <PersonCell
                person={issue.fields.assignee}
                label="Assignee"
                none="Unassigned"
                className={COL_ASSIGNEE}
                nameClassName="@max-[860px]:sr-only"
              />
              <PersonCell
                person={issue.fields.reporter}
                label="Reporter"
                none="—"
                className={COL_REPORTER}
                nameClassName="@max-[860px]:sr-only"
              />
              <span className={`${COL_SUMMARY} truncate`} title={issue.fields.summary}>
                {issue.fields.summary}
              </span>
              <span
                className={`${COL_FIX_TARGET} truncate text-xs text-muted-foreground`}
                title={result.fixes.map(packageFixTarget).join('\n')}
                data-testid="package-fix"
              >
                {result.fixes.map((fix, i) => (
                  <span key={fixKey(fix)}>
                    {i > 0 ? <span aria-hidden="true"> or </span> : null}
                    <span aria-hidden="true">→ </span>
                    {shortFixTarget(fix)}
                  </span>
                ))}
              </span>
              <span className={COL_FIX_ACTION}>
                {result.fixes.length === 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    className={APPLY_CLASS}
                    disabled={pending === issue.key}
                    aria-label={packageFixLabel(result.fixes[0])}
                    title={packageFixLabel(result.fixes[0])}
                    onClick={() => onFix(issue, result.fixes[0])}
                  >
                    Apply
                  </Button>
                ) : result.fixes.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className={APPLY_CLASS}
                          disabled={pending === issue.key}
                          aria-label="Choose a fix"
                          title="Choose a fix"
                        />
                      }
                    >
                      Apply
                      <ChevronDown aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {result.fixes.map((fix) => (
                        <DropdownMenuItem
                          key={fixKey(fix)}
                          className="cursor-pointer text-xs"
                          onClick={() => onFix(issue, fix)}
                        >
                          {packageFixLabel(fix)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </span>
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
          className="mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {expanded ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </section>
  );
}
