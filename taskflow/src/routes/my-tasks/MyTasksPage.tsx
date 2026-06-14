/**
 * MyTasksPage — My Tasks personal command center (redesigned for 82-DESIGN-TARGET)
 *
 * Layout (top → bottom):
 * 1. Page header: large "My Tasks" title + context subtitle (calendar icon, project, counts, pts)
 *    Right toolbar: 3-way scope segmented control | States ▾ | Spec | + New issue
 * 2. THREE stat tiles (To Do / In Progress / Done) — single-select transient filter
 * 3. GROUP control row: GROUP label + grouping segmented | ≡ Updated sort toggle
 * 4. Grouped list: sticky group headers (left stripe + label + count + N pts) + flat rows
 *
 * Data flow (unchanged):
 * - scope='current-sprint' → fetchMyTasksHierarchy
 * - scope='all-assigned'   → fetchAllAssignedHierarchy
 * - scope='all-reported'   → fetchAllReportedHierarchy
 * - GitLab authored MRs → deriveReviewHealth via matchMrsToStories-style key matching
 *
 * Behavior preserved:
 * - 3 scopes, epic exclusion, paging, persistence of groupingMode + scope
 * - peek (onOpenIssue) + breadcrumb (onIssueClick) wiring
 * - per-section loading/error/empty states
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar, Check, CheckSquare, GitBranch, List, ListFilter, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { groupByMyDay } from '@/lib/my-tasks-sort';
import { cn } from '@/lib/utils';
import { fetchAuthoredMRs } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import {
  fetchAllAssignedHierarchy,
  fetchAllReportedHierarchy,
  fetchMyTasksHierarchy,
} from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useMyTasksStore } from '@/stores/my-tasks.store';
import { useSettingsStore } from '@/stores/settings.store';
import { MyTaskRow } from './MyTaskRow';

// ── Copywriting contract ──────────────────────────────────────────────────────

const MY_DAY_BAND_LABELS: Record<string, string> = {
  'flagged-blocked': 'Flagged / Blocked',
  overdue: 'Overdue',
  'in-review-my-mr': 'In Review with my MR',
  'in-progress': 'In Progress',
  'to-do': 'To Do',
  done: 'Done',
};

// ── Transient filter (3 buckets replacing the old 6) ─────────────────────────

type FilterBucket = 'toDo' | 'inProgress' | 'done';

// ── Group header accent stripe colors ─────────────────────────────────────────

const MY_DAY_BAND_STRIPE: Record<string, string> = {
  'flagged-blocked': 'border-l-red-500',
  overdue: 'border-l-destructive',
  'in-review-my-mr': 'border-l-purple-500',
  'in-progress': 'border-l-blue-500',
  'to-do': 'border-l-muted-foreground',
  done: 'border-l-green-500',
};

const STATUS_CATEGORY_STRIPE: Record<string, string> = {
  new: 'border-l-muted-foreground',
  indeterminate: 'border-l-blue-500',
  done: 'border-l-green-500',
};

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 flex-1 rounded" />
      <Skeleton className="h-5 w-20 rounded" />
      <Skeleton className="h-3 w-12 rounded" />
    </div>
  );
}

// ── Group header (sticky) with left accent stripe, count, and section SP total ──

function GroupHeader({
  label,
  count,
  stripeClass,
  sectionPts,
}: {
  label: string;
  count?: number;
  stripeClass?: string;
  sectionPts?: number;
}) {
  return (
    <div
      className={cn(
        'sticky top-0 z-10 flex items-center gap-3 px-4 py-1.5',
        'bg-muted/95 backdrop-blur-sm border-b border-border',
        'text-sm font-semibold text-foreground select-none',
        'border-l-4',
        stripeClass ?? 'border-l-muted-foreground',
      )}
    >
      <span className="flex-1">{label}</span>
      {count !== undefined && (
        <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>
      )}
      {sectionPts !== undefined && sectionPts > 0 && (
        <span className="text-xs font-normal text-muted-foreground tabular-nums ml-2">
          {sectionPts} pts
        </span>
      )}
    </div>
  );
}

// ── Apply transient 3-bucket filter ──────────────────────────────────────────

function matchesBucket(issue: JiraIssue, bucket: FilterBucket | null): boolean {
  if (!bucket) return true;
  const cat = issue.fields.status.statusCategory?.key;
  switch (bucket) {
    case 'toDo':
      return cat === 'new';
    case 'inProgress':
      return cat === 'indeterminate';
    case 'done':
      return cat === 'done';
    default:
      return true;
  }
}

// ── Story-point sum helper (parents only) ─────────────────────────────────────

function sumParentSP(issues: JiraIssue[], spKey: string): number {
  return issues
    .filter((i) => !i.fields.issuetype?.subtask)
    .reduce((sum, i) => {
      const sp =
        (i.fields[spKey] as number | null | undefined) ??
        (i.fields.customfield_10016 as number | null | undefined) ??
        0;
      return sum + (sp || 0);
    }, 0);
}

// ── Sort issues within a group by updated desc ────────────────────────────────

function sortByUpdated(issues: JiraIssue[]): JiraIssue[] {
  return [...issues].sort((a, b) => {
    const aUp = (a.fields.updated as string | null | undefined) ?? '';
    const bUp = (b.fields.updated as string | null | undefined) ?? '';
    return bUp.localeCompare(aUp);
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const navigate = useNavigate();

  // Outlet context — peek opener, breadcrumb-aware issue click, create story
  const outletCtx =
    useOutletContext<{
      onIssueClick?: (key: string) => void;
      onOpenIssue?: (key: string) => void;
      openCreateStory?: () => void;
    }>() ?? {};
  const { onIssueClick, onOpenIssue: onOpenIssuePeek, openCreateStory } = outletCtx;

  // Auth + project
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, gitlabUserId } = useAuthStore();

  // Settings
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);

  // Persisted grouping mode + scope
  const groupingMode = useMyTasksStore((s) => s.groupingMode);
  const scope = useMyTasksStore((s) => s.scope);
  const setGroupingMode = useMyTasksStore((s) => s.setGroupingMode);
  const setScope = useMyTasksStore((s) => s.setScope);

  // Transient filter (3 buckets, never persisted)
  const [activeBucket, setActiveBucket] = useState<FilterBucket | null>(null);

  // Token loading
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const [gitlabToken, setGitlabToken] = useState<string | null>(null);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then(setJiraToken)
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  useEffect(() => {
    if (gitlabBaseUrl) {
      readSecret('gitlab-pat')
        .then(setGitlabToken)
        .catch(() => setGitlabToken(null));
    }
  }, [gitlabBaseUrl]);

  const enabled = !!jiraBaseUrl && !!activeJiraProject && !!jiraToken;

  // ── Current sprint query ───────────────────────────────────────────────────
  const {
    data: sprintData,
    isLoading: sprintLoading,
    isError: sprintError,
    refetch: sprintRefetch,
  } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey, flaggedFieldKey],
    queryFn: () =>
      fetchMyTasksHierarchy(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        storyPointsFieldKey,
        flaggedFieldKey,
      ),
    staleTime: 30_000,
    enabled: enabled && scope === 'current-sprint',
    placeholderData: (prev) => prev,
  });

  // ── All assigned query ─────────────────────────────────────────────────────
  const {
    data: allData,
    isLoading: allLoading,
    isFetching: allFetching,
    isError: allError,
    refetch: allRefetch,
  } = useQuery({
    queryKey: [
      'jira-issues',
      'my-tasks-all',
      activeJiraProject,
      storyPointsFieldKey,
      flaggedFieldKey,
    ],
    queryFn: () =>
      fetchAllAssignedHierarchy(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        flaggedFieldKey,
        storyPointsFieldKey,
      ),
    staleTime: 30_000,
    enabled: enabled && scope === 'all-assigned',
    placeholderData: (prev) => prev,
  });

  // ── All reported query ─────────────────────────────────────────────────────
  const {
    data: reportedData,
    isLoading: reportedLoading,
    isError: reportedError,
    refetch: reportedRefetch,
  } = useQuery({
    queryKey: [
      'jira-issues',
      'my-tasks-reported',
      activeJiraProject,
      storyPointsFieldKey,
      flaggedFieldKey,
    ],
    queryFn: () =>
      fetchAllReportedHierarchy(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        flaggedFieldKey,
        storyPointsFieldKey,
      ),
    staleTime: 30_000,
    enabled: enabled && scope === 'all-reported',
    placeholderData: (prev) => prev,
  });

  // ── GitLab authored MRs (for real MR health) ──────────────────────────────
  const gitlabEnabled = !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId;
  const { data: authoredMRs } = useQuery({
    queryKey: ['gitlab-authored-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: () => fetchAuthoredMRs(gitlabBaseUrl!, gitlabToken!, gitlabUserId!),
    staleTime: 60_000,
    enabled: gitlabEnabled,
  });

  // Build map: issue key → ReviewHealth, derived from authored MR title/branch matching
  const mrHealthByKey = new Map<string, ReviewHealth>();
  if (authoredMRs) {
    for (const mr of authoredMRs) {
      const title = mr.title ?? '';
      const branch = (mr.source_branch as string | undefined) ?? '';
      const keys = [...extractTicketKeys(title), ...extractTicketKeys(branch)];
      for (const key of keys) {
        if (!mrHealthByKey.has(key)) {
          // Without per-MR approvals data, default to 'waiting_for_review'.
          // Full deriveReviewHealth would need approvals+discussions — those are
          // not fetched here (graceful degradation: show waiting state).
          mrHealthByKey.set(key, 'waiting_for_review');
        }
      }
    }
  }

  // ── Active scope data ──────────────────────────────────────────────────────
  const activeData =
    scope === 'current-sprint' ? sprintData : scope === 'all-assigned' ? allData : reportedData;
  const isLoading =
    scope === 'current-sprint'
      ? sprintLoading
      : scope === 'all-assigned'
        ? allLoading
        : reportedLoading;
  const isError =
    scope === 'current-sprint' ? sprintError : scope === 'all-assigned' ? allError : reportedError;
  const refetch =
    scope === 'current-sprint'
      ? sprintRefetch
      : scope === 'all-assigned'
        ? allRefetch
        : reportedRefetch;

  const allIssues = activeData?.issues ?? [];
  const myIssueKeys = activeData?.myIssueKeys ?? new Set<string>();

  // ── Context subtitle derivation ────────────────────────────────────────────
  // Derive from active scope: project name, open/done counts, points in flight
  const parents = allIssues.filter((i) => !i.fields.issuetype?.subtask);
  const openCount = parents.filter((i) => i.fields.status.statusCategory?.key !== 'done').length;
  const doneCount = parents.filter((i) => i.fields.status.statusCategory?.key === 'done').length;
  const pointsInFlight = parents
    .filter((i) => i.fields.status.statusCategory?.key !== 'done')
    .reduce((sum, i) => {
      const sp =
        (i.fields[storyPointsFieldKey] as number | null | undefined) ??
        (i.fields.customfield_10016 as number | null | undefined) ??
        0;
      return sum + (sp || 0);
    }, 0);

  // Project name from first parent (all same project)
  const projectName =
    (parents[0]?.fields.project as { name?: string } | null | undefined)?.name ??
    activeJiraProject ??
    '';

  function buildSubtitle(): string {
    if (scope === 'current-sprint') {
      // Sprint name not in fetched fields — omit sprint prefix
      return `${projectName} · ${openCount} open · ${doneCount} done · ${pointsInFlight} points in flight`;
    }
    const scopeLabel = scope === 'all-assigned' ? 'All Assigned' : 'All Reported';
    return `${scopeLabel} · ${openCount} open · ${doneCount} done · ${pointsInFlight} points in flight`;
  }

  const subtitle = buildSubtitle();

  // ── Stat tile counts (3 buckets: toDo, inProgress, done) ──────────────────
  const tileToDoCount = parents.filter((i) => i.fields.status.statusCategory?.key === 'new').length;
  const tileInProgressCount = parents.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;
  const tileDoneCount = parents.filter(
    (i) => i.fields.status.statusCategory?.key === 'done',
  ).length;

  // ── Filter function ────────────────────────────────────────────────────────
  function applyBucketFilter(issues: JiraIssue[]): JiraIssue[] {
    if (!activeBucket) return issues;
    // Filter parents by bucket; always include subtasks of matching parents
    const matchingParentKeys = new Set<string>();
    for (const issue of issues) {
      if (!issue.fields.issuetype?.subtask && matchesBucket(issue, activeBucket)) {
        matchingParentKeys.add(issue.key);
      }
    }
    return issues.filter((i) => {
      if (!i.fields.issuetype?.subtask) return matchingParentKeys.has(i.key);
      const parentKey = i.fields.parent?.key;
      return parentKey ? matchingParentKeys.has(parentKey) : false;
    });
  }

  function handleBucketClick(bucket: FilterBucket) {
    setActiveBucket((prev) => (prev === bucket ? null : bucket));
  }

  // ── Navigation handlers ────────────────────────────────────────────────────
  function handleOpenPeek(key: string) {
    if (onOpenIssuePeek) {
      onOpenIssuePeek(key);
    } else {
      navigate(`/issue/${key}`);
    }
  }

  function handleOpenIssue(key: string) {
    if (onIssueClick) {
      onIssueClick(key);
    } else {
      navigate(`/issue/${key}`);
    }
  }

  // ── Render flat parent + subtask rows (subtask collapse handled inside MyTaskRow) ──

  function renderFlatRows(parent: JiraIssue, subtasks: JiraIssue[]) {
    return (
      <MyTaskRow
        key={parent.key}
        issue={parent}
        subtasks={subtasks}
        jiraBaseUrl={jiraBaseUrl!}
        storyPointsFieldKey={storyPointsFieldKey}
        flaggedFieldKey={flaggedFieldKey}
        mrHealth={mrHealthByKey.get(parent.key)}
        onOpenPeek={handleOpenPeek}
        onOpenIssue={handleOpenIssue}
      />
    );
  }

  // ── Render grouped list ────────────────────────────────────────────────────

  function renderMyDayList() {
    const filtered = applyBucketFilter(allIssues);
    const bands = groupByMyDay(
      filtered,
      myIssueKeys,
      flaggedFieldKey,
      new Set(mrHealthByKey.keys()),
    );

    if (bands.length === 0) {
      if (activeBucket) {
        return (
          <EmptyState
            icon={ListFilter}
            title="No matches"
            subtitle="No tasks match the active filter. Click the filter again to clear it."
          />
        );
      }
      return (
        <EmptyState
          icon={CheckSquare}
          title="You're all caught up"
          subtitle="No tasks need your attention right now. Check back after standup."
        />
      );
    }

    return (
      <div>
        {bands.map(({ band, parents: bandParents }) => {
          const sortedParents = sortByUpdated(bandParents.map((r) => r.parent));
          const sectionPts = sortedParents.reduce((sum, p) => {
            const sp =
              (p.fields[storyPointsFieldKey] as number | null | undefined) ??
              (p.fields.customfield_10016 as number | null | undefined) ??
              0;
            return sum + (sp || 0);
          }, 0);
          // Rebuild lookup from original bandParents to get subtasks for each sorted parent
          const subtasksByKey = new Map(bandParents.map((r) => [r.parent.key, r.subtasks]));
          return (
            <div key={band}>
              <GroupHeader
                label={MY_DAY_BAND_LABELS[band] ?? band}
                count={sortedParents.length}
                stripeClass={MY_DAY_BAND_STRIPE[band]}
                sectionPts={sectionPts}
              />
              {sortedParents.map((parent) =>
                renderFlatRows(parent, subtasksByKey.get(parent.key) ?? []),
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderByStatusList() {
    const filtered = applyBucketFilter(allIssues);
    const filteredParents = filtered.filter((i) => !i.fields.issuetype?.subtask);
    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const issue of filtered) {
      if (issue.fields.issuetype?.subtask) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) {
          const arr = subtasksByParent.get(parentKey) ?? [];
          arr.push(issue);
          subtasksByParent.set(parentKey, arr);
        }
      }
    }

    const STATUS_ORDER = ['new', 'indeterminate', 'done'];
    const STATUS_LABELS: Record<string, string> = {
      new: 'To Do',
      indeterminate: 'In Progress',
      done: 'Done',
    };

    const byStatus = new Map<string, JiraIssue[]>();
    for (const parent of filteredParents) {
      const cat = parent.fields.status.statusCategory?.key ?? 'new';
      const arr = byStatus.get(cat) ?? [];
      arr.push(parent);
      byStatus.set(cat, arr);
    }

    if (byStatus.size === 0) {
      if (activeBucket) {
        return (
          <EmptyState
            icon={ListFilter}
            title="No matches"
            subtitle="No tasks match the active filter. Click the filter again to clear it."
          />
        );
      }
      return (
        <EmptyState
          icon={CheckSquare}
          title="No assigned issues"
          subtitle="You have no issues assigned across all sprints and the backlog."
        />
      );
    }

    return (
      <div>
        {STATUS_ORDER.filter((cat) => byStatus.has(cat)).map((cat) => {
          const issues = sortByUpdated(byStatus.get(cat)!);
          const sectionPts = sumParentSP(issues, storyPointsFieldKey);
          return (
            <div key={cat}>
              <GroupHeader
                label={STATUS_LABELS[cat] ?? cat}
                count={issues.length}
                stripeClass={STATUS_CATEGORY_STRIPE[cat]}
                sectionPts={sectionPts}
              />
              {issues.map((parent) =>
                renderFlatRows(parent, subtasksByParent.get(parent.key) ?? []),
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderBySprintParentList() {
    const filtered = applyBucketFilter(allIssues);
    const filteredParents = filtered.filter((i) => !i.fields.issuetype?.subtask);
    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const issue of filtered) {
      if (issue.fields.issuetype?.subtask) {
        const parentKey = issue.fields.parent?.key;
        if (parentKey) {
          const arr = subtasksByParent.get(parentKey) ?? [];
          arr.push(issue);
          subtasksByParent.set(parentKey, arr);
        }
      }
    }

    interface SprintGroup {
      sprintId: number | null;
      sprintName: string;
      state: string;
      endDate: string | null;
      issues: JiraIssue[];
    }

    const sprintGroups = new Map<string, SprintGroup>();
    for (const parent of filteredParents) {
      const sprints = parent.fields.customfield_10020 as
        | Array<{ id: number; name: string; state: string; endDate?: string }>
        | null
        | undefined;
      const activeSprint = Array.isArray(sprints)
        ? (sprints.find((s) => s.state === 'ACTIVE') ?? sprints[0])
        : null;

      const sprintKey = activeSprint ? String(activeSprint.id) : '__backlog__';
      const sprintName = activeSprint?.name ?? 'Backlog';
      const sprintState = activeSprint?.state ?? 'BACKLOG';
      const endDate = activeSprint?.endDate ?? null;

      if (!sprintGroups.has(sprintKey)) {
        sprintGroups.set(sprintKey, {
          sprintId: activeSprint?.id ?? null,
          sprintName,
          state: sprintState,
          endDate,
          issues: [],
        });
      }
      sprintGroups.get(sprintKey)!.issues.push(parent);
    }

    const sortedGroups = Array.from(sprintGroups.values()).sort((a, b) => {
      if (a.state === 'ACTIVE' && b.state !== 'ACTIVE') return -1;
      if (b.state === 'ACTIVE' && a.state !== 'ACTIVE') return 1;
      if (a.sprintId === null) return 1;
      if (b.sprintId === null) return -1;
      if (a.endDate && b.endDate) return b.endDate.localeCompare(a.endDate);
      return 0;
    });

    if (sortedGroups.length === 0) {
      if (activeBucket) {
        return (
          <EmptyState
            icon={ListFilter}
            title="No matches"
            subtitle="No tasks match the active filter. Click the filter again to clear it."
          />
        );
      }
      return (
        <EmptyState
          icon={CheckSquare}
          title="No assigned issues"
          subtitle="You have no issues assigned across all sprints and the backlog."
        />
      );
    }

    return (
      <div>
        {sortedGroups.map((group) => {
          const issues = sortByUpdated(group.issues);
          const sectionPts = sumParentSP(issues, storyPointsFieldKey);
          return (
            <div key={group.sprintId ?? '__backlog__'}>
              <GroupHeader
                label={group.sprintName}
                count={issues.length}
                stripeClass="border-l-blue-500"
                sectionPts={sectionPts}
              />
              {issues.map((parent) =>
                renderFlatRows(parent, subtasksByParent.get(parent.key) ?? []),
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderContent() {
    if (isLoading) {
      return (
        <div>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      );
    }

    if (isError) {
      return (
        <ErrorState
          error={new Error('Failed to load My Tasks')}
          viewName="My Tasks"
          onRetry={() => refetch()}
        />
      );
    }

    if (groupingMode === 'my-day') return renderMyDayList();
    if (groupingMode === 'by-status') return renderByStatusList();
    return renderBySprintParentList();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto">
      {/* ── 1. Page header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border shrink-0">
        {/* Left: title + subtitle */}
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-3xl font-bold text-foreground leading-none">My Tasks</h1>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" />
            <span>{subtitle}</span>
          </p>
        </div>

        {/* Right: scope segmented control + toolbar buttons */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Scope segmented control — 3-way pill group */}
          <div
            role="group"
            aria-label="Scope"
            className="flex items-center rounded-md border border-border overflow-hidden"
          >
            {(
              [
                { value: 'current-sprint', label: 'Current Sprint' },
                { value: 'all-assigned', label: 'All Assigned' },
                { value: 'all-reported', label: 'All Reported' },
              ] as const
            ).map(({ value, label }, idx) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={cn(
                  'h-8 px-3 text-xs font-medium transition-colors',
                  idx > 0 && 'border-l border-border',
                  scope === value
                    ? 'bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:bg-muted/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* States ▾ — visual only, no behavior defined yet */}
          <button
            type="button"
            className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/60 transition-colors"
            title="States filter (not yet implemented)"
          >
            States ▾
          </button>

          {/* Spec — visual only */}
          <button
            type="button"
            className="h-8 px-3 text-xs font-medium rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/60 transition-colors"
            title="Spec (not yet implemented)"
          >
            Spec
          </button>

          {/* + New issue */}
          <button
            type="button"
            className="h-8 px-3 text-xs font-medium rounded-md bg-foreground text-background hover:bg-foreground/90 transition-colors flex items-center gap-1"
            onClick={() => openCreateStory?.()}
            title={openCreateStory ? undefined : 'Create issue (not available in this context)'}
          >
            <Plus className="size-3.5" />
            New issue
          </button>
        </div>
      </div>

      {/* ── 2. Three stat tiles ──────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="grid grid-cols-3 gap-4">
          {/* To Do tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'toDo'}
            onClick={() => handleBucketClick('toDo')}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-all',
              activeBucket === 'toDo'
                ? 'ring-1 ring-inset ring-primary bg-primary/5'
                : 'hover:bg-muted/40',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {tileToDoCount}
                </span>
                <span className="text-sm text-muted-foreground">To Do</span>
              </div>
              <List className="size-5 text-muted-foreground shrink-0" />
            </div>
          </button>

          {/* In Progress tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'inProgress'}
            onClick={() => handleBucketClick('inProgress')}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-all',
              activeBucket === 'inProgress'
                ? 'ring-1 ring-inset ring-primary bg-primary/5'
                : 'hover:bg-muted/40',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {tileInProgressCount}
                </span>
                <span className="text-sm text-muted-foreground">In Progress</span>
              </div>
              <GitBranch className="size-5 text-muted-foreground shrink-0" />
            </div>
          </button>

          {/* Done tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'done'}
            onClick={() => handleBucketClick('done')}
            className={cn(
              'rounded-xl border bg-card p-4 text-left transition-all',
              activeBucket === 'done'
                ? 'ring-1 ring-inset ring-primary bg-primary/5'
                : 'hover:bg-muted/40',
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {tileDoneCount}
                </span>
                <span className="text-sm text-muted-foreground">Done</span>
              </div>
              <Check className="size-5 text-green-600 dark:text-green-400 shrink-0" />
            </div>
          </button>
        </div>
      </div>

      {/* ── 3. GROUP control row ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-2 border-b border-border shrink-0">
        {/* Left: GROUP label + segmented grouping control */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
            Group
          </span>
          <div
            role="group"
            aria-label="Grouping"
            className="flex items-center rounded-md border border-border overflow-hidden"
          >
            {(
              [
                { value: 'my-day', label: 'My Day' },
                { value: 'by-status', label: 'By Status' },
                { value: 'by-sprint-parent', label: 'By Sprint & Parent' },
              ] as const
            ).map(({ value, label }, idx) => (
              <button
                key={value}
                type="button"
                aria-pressed={groupingMode === value}
                onClick={() => setGroupingMode(value)}
                className={cn(
                  'h-7 px-2.5 text-xs font-medium transition-colors',
                  idx > 0 && 'border-l border-border',
                  groupingMode === value
                    ? 'bg-foreground text-background'
                    : 'bg-card text-muted-foreground hover:bg-muted/60',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Updated sort control (sorts within groups by updated desc — always active) */}
        <button
          type="button"
          className="flex items-center gap-1 h-7 px-2.5 text-xs font-medium rounded-md border border-border bg-card text-muted-foreground hover:bg-muted/60 transition-colors"
          title="Sort by last updated (descending)"
        >
          <span>≡</span>
          <span>Updated</span>
        </button>
      </div>

      {/* ── 4. Issue list ────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto min-h-0">
        {renderContent()}

        {/* Progressive loading indicator — All Assigned / All Reported scope while fetching */}
        {scope === 'all-assigned' && allFetching && !allLoading && (
          <div className="px-4 py-3">
            <SkeletonRow />
            <SkeletonRow />
            <p className="text-xs text-muted-foreground px-4 py-1">Loading more tasks…</p>
          </div>
        )}
      </div>
    </div>
  );
}
