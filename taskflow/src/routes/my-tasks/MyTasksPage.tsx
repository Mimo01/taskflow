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
 * - 3 scopes (transient, not persisted), epic exclusion, paging
 * - peek (onOpenIssue) + breadcrumb (onIssueClick) wiring
 * - per-section loading/error/empty states
 */

import { useQuery } from '@tanstack/react-query';
import { Check, CheckSquare, Clock, ListFilter, RefreshCw } from 'lucide-react';
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
  isIssueFlagged,
} from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';
import { extractTicketKeys } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
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

// ── Scope (transient — never persisted; resets to current-sprint on reload) ──

type Scope = 'current-sprint' | 'all-assigned' | 'all-reported';

// ── Group header band dot colors (subtle identity dot, replaces heavy left stripe) ──

const MY_DAY_BAND_DOT: Record<string, string> = {
  'flagged-blocked': 'bg-red-500',
  overdue: 'bg-destructive',
  'in-review-my-mr': 'bg-purple-500',
  'in-progress': 'bg-blue-500',
  'to-do': 'bg-muted-foreground/60',
  done: 'bg-green-500',
};

// ── Sprint grouping (All Assigned / All Reported scopes) ─────────────────────

type SprintState = 'active' | 'future' | 'closed';
interface SprintMeta {
  id: number;
  name: string;
  state: SprintState;
}

const SPRINT_STATE_DOT: Record<SprintState, string> = {
  active: 'bg-blue-500',
  future: 'bg-muted-foreground/60',
  closed: 'bg-green-500',
};

const normalizeSprintState = (raw: string | undefined): SprintState => {
  const s = (raw ?? '').toLowerCase();
  return s === 'active' || s === 'future' ? s : 'closed';
};

/**
 * Extract the most-relevant sprint from a Jira sprint custom field
 * (customfield_10020), which may be an array of objects, an array of Java
 * toString strings, a single object, or null.
 *
 * When an issue belongs to multiple sprints (carry-over), we group it under the
 * active one if present, else the future one, else the most recent closed sprint
 * (highest id). Returns null → the issue groups under "Backlog".
 */
function extractSprintMeta(raw: unknown): SprintMeta | null {
  const arr = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  const parsed: SprintMeta[] = [];

  for (const item of arr) {
    if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      const id = typeof o.id === 'number' ? o.id : Number(o.id);
      if (!Number.isFinite(id)) continue;
      parsed.push({
        id,
        name: typeof o.name === 'string' ? o.name : `Sprint ${id}`,
        state: normalizeSprintState(typeof o.state === 'string' ? o.state : undefined),
      });
    } else if (typeof item === 'string') {
      const id = Number(item.match(/id=(\d+)/)?.[1]);
      if (!Number.isFinite(id)) continue;
      parsed.push({
        id,
        name: item.match(/name=([^,\]]+)/)?.[1] ?? `Sprint ${id}`,
        state: normalizeSprintState(item.match(/state=([^,\]]+)/)?.[1]),
      });
    }
  }

  if (parsed.length === 0) return null;
  return (
    parsed.find((s) => s.state === 'active') ??
    parsed.find((s) => s.state === 'future') ??
    parsed.reduce((a, b) => (b.id > a.id ? b : a))
  );
}

const sprintGroupRank = (meta: SprintMeta | null): number =>
  meta == null ? 3 : meta.state === 'active' ? 0 : meta.state === 'future' ? 1 : 2;

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border/40">
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 flex-1 rounded" />
      <Skeleton className="h-5 w-20 rounded" />
      <Skeleton className="h-3 w-12 rounded" />
    </div>
  );
}

// ── Group header — standup-style: dot + label + count + hr + pts ──────────────

function GroupHeader({
  label,
  count,
  dotClass,
  sectionPts,
}: {
  label: string;
  count?: number;
  dotClass?: string;
  sectionPts?: number;
}) {
  return (
    <div className="flex items-center gap-3 px-2 mb-2 select-none">
      {dotClass && <span className={cn('h-2 w-2 rounded-full shrink-0', dotClass)} aria-hidden />}
      <h3 className="text-sm font-semibold text-muted-foreground/60 shrink-0">{label}</h3>
      {count !== undefined && (
        <span className="text-sm font-normal text-muted-foreground/60 shrink-0 tabular-nums">
          {count}
        </span>
      )}
      <hr className="flex-1 border-t border-border" />
      {sectionPts !== undefined && sectionPts > 0 && (
        <span className="text-sm text-muted-foreground/60 tabular-nums shrink-0">
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const navigate = useNavigate();

  // Outlet context — peek opener, breadcrumb-aware issue click
  const outletCtx =
    useOutletContext<{
      onIssueClick?: (key: string) => void;
      onOpenIssue?: (key: string) => void;
    }>() ?? {};
  const { onIssueClick, onOpenIssue: onOpenIssuePeek } = outletCtx;

  // Auth + project
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, gitlabUserId } = useAuthStore();

  // Settings
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);
  const sprintFieldKey = useSettingsStore((s) => s.sprintFieldKey);

  // Scope is transient component state — intentionally NOT persisted, so it always
  // resets to the current sprint on reload (page always uses My Day grouping).
  const [scope, setScope] = useState<Scope>('current-sprint');

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
      sprintFieldKey,
    ],
    queryFn: () =>
      fetchAllAssignedHierarchy(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        flaggedFieldKey,
        storyPointsFieldKey,
        sprintFieldKey,
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
      sprintFieldKey,
    ],
    queryFn: () =>
      fetchAllReportedHierarchy(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        flaggedFieldKey,
        storyPointsFieldKey,
        sprintFieldKey,
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

  // ── Status line derivation ─────────────────────────────────────────────────
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

  // Actionable highlights
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = parents.filter((i) => {
    if (i.fields.status.statusCategory?.key === 'done') return false;
    const due = (i.fields.duedate as string | null | undefined) ?? '';
    return due !== '' && due < today;
  }).length;

  const flaggedCount = parents.filter((i) => {
    if (i.fields.status.statusCategory?.key === 'done') return false;
    return isIssueFlagged(i, flaggedFieldKey);
  }).length;

  const mrsAwaitingCount =
    mrHealthByKey.size > 0
      ? Array.from(mrHealthByKey.values()).filter((h) => h === 'waiting_for_review').length
      : 0;

  // ── Stat tile counts (3 buckets: toDo, inProgress, done) ──────────────────
  const tileToDoCount = parents.filter((i) => i.fields.status.statusCategory?.key === 'new').length;
  const tileInProgressCount = parents.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;
  const tileDoneCount = parents.filter(
    (i) => i.fields.status.statusCategory?.key === 'done',
  ).length;

  // ── Sprint donut (points done / points total) ──────────────────────────────
  const ptsDone = parents.reduce((sum, i) => {
    if (i.fields.status.statusCategory?.key !== 'done') return sum;
    const sp =
      (i.fields[storyPointsFieldKey] as number | null | undefined) ??
      (i.fields.customfield_10016 as number | null | undefined) ??
      0;
    return sum + (sp || 0);
  }, 0);
  const ptsTotal = parents.reduce((sum, i) => {
    const sp =
      (i.fields[storyPointsFieldKey] as number | null | undefined) ??
      (i.fields.customfield_10016 as number | null | undefined) ??
      0;
    return sum + (sp || 0);
  }, 0);
  const DONUT_R = 25;
  const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_R; // ≈ 157
  const donutOffset =
    ptsTotal > 0 ? DONUT_CIRCUMFERENCE * (1 - ptsDone / ptsTotal) : DONUT_CIRCUMFERENCE;

  // ── Stat tile proportion (share of total for mini bar) ────────────────────
  const tileTotalCount = tileToDoCount + tileInProgressCount + tileDoneCount;

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

  // ── Accumulated time helper ────────────────────────────────────────────────

  function accumulateTime(parent: JiraIssue, subtasks: JiraIssue[]) {
    function getTracking(issue: JiraIssue) {
      const t = issue.fields.timetracking as
        | { timeSpentSeconds?: number; originalEstimateSeconds?: number }
        | null
        | undefined;
      return {
        spent: t?.timeSpentSeconds ?? 0,
        estimate: t?.originalEstimateSeconds ?? 0,
      };
    }
    const parentT = getTracking(parent);
    const subtaskSpent = subtasks.reduce((sum, s) => sum + getTracking(s).spent, 0);
    const subtaskEst = subtasks.reduce((sum, s) => sum + getTracking(s).estimate, 0);
    return {
      accumulatedSpentSeconds: parentT.spent + subtaskSpent,
      accumulatedEstimateSeconds: parentT.estimate + subtaskEst,
    };
  }

  // ── Render flat parent + subtask rows (subtask collapse handled inside MyTaskRow) ──

  function renderFlatRows(parent: JiraIssue, subtasks: JiraIssue[]) {
    const { accumulatedSpentSeconds, accumulatedEstimateSeconds } = accumulateTime(
      parent,
      subtasks,
    );
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
        accumulatedSpentSeconds={accumulatedSpentSeconds}
        accumulatedEstimateSeconds={accumulatedEstimateSeconds}
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
      <div className="px-4 py-3 space-y-4">
        {bands.map(({ band, parents: bandParents }) => {
          const sortedParents = bandParents.map((r) => r.parent);
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
                dotClass={MY_DAY_BAND_DOT[band]}
                sectionPts={sectionPts}
              />
              <div className="space-y-0.5">
                {sortedParents.map((parent) =>
                  renderFlatRows(parent, subtasksByKey.get(parent.key) ?? []),
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Render sprint-grouped list (All Assigned / All Reported) ───────────────

  function renderBySprintList() {
    const filtered = applyBucketFilter(allIssues);
    const parentsOnly = filtered.filter((i) => !i.fields.issuetype?.subtask);

    // Attach any subtasks to their parent (these scopes are parent-only by design,
    // but be defensive in case nesting is ever returned).
    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const i of filtered) {
      if (i.fields.issuetype?.subtask) {
        const pk = i.fields.parent?.key;
        if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), i]);
      }
    }

    if (parentsOnly.length === 0) {
      if (activeBucket) {
        return (
          <EmptyState
            icon={ListFilter}
            title="No matches"
            subtitle="No tasks match the active filter. Click the filter again to clear it."
          />
        );
      }
      const reported = scope === 'all-reported';
      return (
        <EmptyState
          icon={CheckSquare}
          title={reported ? 'No reported issues' : 'No assigned issues'}
          subtitle={
            reported
              ? 'You have no issues reported across all sprints and the backlog.'
              : 'You have no issues assigned across all sprints and the backlog.'
          }
        />
      );
    }

    // Group parents by sprint (or Backlog), preserving JQL rank order within a group.
    const groups = new Map<string, { meta: SprintMeta | null; parents: JiraIssue[] }>();
    for (const p of parentsOnly) {
      const meta = extractSprintMeta(p.fields[sprintFieldKey] ?? p.fields.customfield_10020);
      const key = meta ? String(meta.id) : 'backlog';
      const group = groups.get(key) ?? { meta, parents: [] };
      group.parents.push(p);
      groups.set(key, group);
    }

    // Order: active → future → closed (newest id first) → Backlog last.
    const ordered = Array.from(groups.values()).sort((a, b) => {
      const ra = sprintGroupRank(a.meta);
      const rb = sprintGroupRank(b.meta);
      if (ra !== rb) return ra - rb;
      return (b.meta?.id ?? 0) - (a.meta?.id ?? 0);
    });

    return (
      <div className="px-4 py-3 space-y-4">
        {ordered.map(({ meta, parents: groupParents }) => {
          const sectionPts = groupParents.reduce((sum, p) => {
            const sp =
              (p.fields[storyPointsFieldKey] as number | null | undefined) ??
              (p.fields.customfield_10016 as number | null | undefined) ??
              0;
            return sum + (sp || 0);
          }, 0);
          return (
            <div key={meta?.id ?? 'backlog'}>
              <GroupHeader
                label={meta ? meta.name : 'Backlog'}
                count={groupParents.length}
                dotClass={meta ? SPRINT_STATE_DOT[meta.state] : 'bg-muted-foreground/40'}
                sectionPts={sectionPts}
              />
              <div className="space-y-0.5">
                {groupParents.map((parent) =>
                  renderFlatRows(parent, subtasksByParent.get(parent.key) ?? []),
                )}
              </div>
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

    return scope === 'current-sprint' ? renderMyDayList() : renderBySprintList();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="@container flex flex-col h-full overflow-auto">
      {/* ── 1. Hero header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-5 border-b border-border/50 shrink-0">
        {/* Left: title + actionable subtitle */}
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-3xl font-semibold text-foreground">My Tasks</h1>
          <p className="text-xs text-muted-foreground tabular-nums mt-1 truncate">
            <span className="text-slate-600 dark:text-slate-300 font-medium">{openCount} open</span>
            <span className="mx-1">·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {doneCount} done
            </span>
            <span className="mx-1">·</span>
            <span className="text-blue-600 dark:text-blue-400 font-medium">
              {pointsInFlight} pts in flight
            </span>
            {overdueCount > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {overdueCount} overdue
                </span>
              </>
            )}
            {flaggedCount > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  {flaggedCount} flagged
                </span>
              </>
            )}
            {mrsAwaitingCount > 0 && (
              <>
                <span className="mx-1">·</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {mrsAwaitingCount} MRs awaiting you
                </span>
              </>
            )}
          </p>
        </div>

        {/* Right: donut + scope segmented control + New issue */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Sprint-progress donut — hidden when the CONTAINER (not viewport) is narrow,
              so it also disappears when a drawer shrinks the content area. */}
          <div className="hidden @[1000px]:flex items-center gap-3">
            <svg
              width="56"
              height="56"
              viewBox="0 0 60 60"
              aria-hidden="true"
              style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}
            >
              {/* Track */}
              <circle
                cx="30"
                cy="30"
                r={DONUT_R}
                fill="none"
                className="stroke-muted"
                strokeWidth="8"
              />
              {/* Fill */}
              <circle
                cx="30"
                cy="30"
                r={DONUT_R}
                fill="none"
                stroke="#10b981"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={DONUT_CIRCUMFERENCE}
                strokeDashoffset={donutOffset}
              />
            </svg>
            <div className="leading-tight">
              <div className="text-lg font-semibold tabular-nums text-foreground leading-none">
                {ptsDone}
                <span className="text-muted-foreground font-normal">/{ptsTotal}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">pts done</div>
            </div>
          </div>

          {/* Scope segmented control */}
          <fieldset className="inline-flex rounded-lg bg-muted p-0.5 border-0 m-0">
            <legend className="sr-only">Scope</legend>
            {(
              [
                { value: 'current-sprint', label: 'Current Sprint' },
                { value: 'all-assigned', label: 'All Assigned' },
                { value: 'all-reported', label: 'All Reported' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-pressed={scope === value}
                onClick={() => setScope(value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  scope === value
                    ? 'bg-foreground text-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </fieldset>
        </div>
      </div>

      {/* ── 2. Enriched stat tiles ───────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-border/50 shrink-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* To Do tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'toDo'}
            onClick={() => handleBucketClick('toDo')}
            className={cn(
              'relative overflow-hidden rounded-lg border p-3 text-left transition-colors',
              activeBucket === 'toDo'
                ? 'ring-1 ring-inset ring-primary/60 bg-primary/5 border-primary/30'
                : 'border-border/60 bg-card hover:bg-muted/30',
            )}
          >
            <Clock
              className="pointer-events-none absolute -top-4 -right-3 size-20 text-slate-500/10 dark:text-slate-400/10"
              aria-hidden
            />
            <div className="relative">
              <span className="text-2xl font-semibold tabular-nums text-foreground leading-none">
                {tileToDoCount}
              </span>
              <div className="mt-2 text-sm text-muted-foreground">To Do</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all"
                  style={{
                    width:
                      tileTotalCount > 0
                        ? `${Math.round((tileToDoCount / tileTotalCount) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </button>

          {/* In Progress tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'inProgress'}
            onClick={() => handleBucketClick('inProgress')}
            className={cn(
              'relative overflow-hidden rounded-lg border p-3 text-left transition-colors',
              activeBucket === 'inProgress'
                ? 'ring-1 ring-inset ring-primary/60 bg-primary/5 border-primary/30'
                : 'border-border/60 bg-card hover:bg-muted/30',
            )}
          >
            <RefreshCw
              className="pointer-events-none absolute -top-4 -right-3 size-20 text-blue-500/10 dark:text-blue-400/15"
              aria-hidden
            />
            <div className="relative">
              <span className="text-2xl font-semibold tabular-nums text-blue-600 dark:text-blue-400 leading-none">
                {tileInProgressCount}
              </span>
              <div className="mt-2 text-sm text-muted-foreground">In Progress</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width:
                      tileTotalCount > 0
                        ? `${Math.round((tileInProgressCount / tileTotalCount) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </button>

          {/* Done tile */}
          <button
            type="button"
            aria-pressed={activeBucket === 'done'}
            onClick={() => handleBucketClick('done')}
            className={cn(
              'relative overflow-hidden rounded-lg border p-3 text-left transition-colors',
              activeBucket === 'done'
                ? 'ring-1 ring-inset ring-primary/60 bg-primary/5 border-primary/30'
                : 'border-border/60 bg-card hover:bg-muted/30',
            )}
          >
            <Check
              className="pointer-events-none absolute -top-4 -right-3 size-20 text-emerald-500/10 dark:text-emerald-400/15"
              aria-hidden
            />
            <div className="relative">
              <span className="text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 leading-none">
                {tileDoneCount}
              </span>
              <div className="mt-2 text-sm text-muted-foreground">Done</div>
              <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width:
                      tileTotalCount > 0
                        ? `${Math.round((tileDoneCount / tileTotalCount) * 100)}%`
                        : '0%',
                  }}
                />
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ── 3. Issue list ────────────────────────────────────────────────────── */}
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
