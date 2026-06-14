/**
 * MyTasksPage — My Tasks personal command center (MYTASK-01 through MYTASK-08)
 *
 * Composes:
 * - Summary/filter strip (MYTASK-02, D-01): six count pills, single-select transient
 *   activeFilter (component useState — NEVER persisted to useMyTasksStore, per D-01/D-10)
 * - Grouping tabs (MYTASK-03): My Day | By Status | By Sprint & Parent
 * - Scope toggle (MYTASK-07/08): Current Sprint <-> All Assigned (persisted in store)
 * - Grouped/nested issue list: parents + indented subtasks (D-03)
 * - Per-section states (D-11): Skeleton while loading, ErrorState on failure, EmptyState for empty
 * - Progressive loading indicator (D-06): Skeleton rows + "Loading more tasks…" in All Assigned
 *
 * Data flow:
 * - scope='current-sprint' → fetchMyTasksHierarchy (active sprint, all subtasks for my parents)
 * - scope='all-assigned'   → fetchAllAssignedHierarchy (all assigned stories, full pagination)
 * - GitLab authored MRs → separate optional query for band 2 / MR health (graceful degrade)
 */

import { useQuery } from '@tanstack/react-query';
import { CheckSquare, ListFilter } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deriveCounts, groupByMyDay } from '@/lib/my-tasks-sort';
import { cn } from '@/lib/utils';
import { fetchAuthoredMRs } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { fetchAllAssignedHierarchy, fetchMyTasksHierarchy } from '@/services/jira';
import type { ReviewHealth } from '@/services/linkEngine';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useMyTasksStore } from '@/stores/my-tasks.store';
import { useSettingsStore } from '@/stores/settings.store';
import { MyTaskRow } from './MyTaskRow';

// ── Copywriting contract (UI-SPEC §Copywriting Contract) ───────────────────────

const MY_DAY_BAND_LABELS: Record<string, string> = {
  'flagged-blocked': 'Flagged / Blocked',
  overdue: 'Overdue',
  'in-review-my-mr': 'In Review with my MR',
  'in-progress': 'In Progress',
  'to-do': 'To Do',
  done: 'Done',
};

// ── Filter pill definitions ───────────────────────────────────────────────────

type FilterKey = 'toDo' | 'inProgress' | 'inReview' | 'doneSprint' | 'overdue' | 'mrAwaiting';

const FILTER_PILLS: Array<{ key: FilterKey; label: string }> = [
  { key: 'toDo', label: 'To Do' },
  { key: 'inProgress', label: 'In Progress' },
  { key: 'inReview', label: 'In Review' },
  { key: 'doneSprint', label: 'Done this sprint' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'mrAwaiting', label: 'MRs awaiting me' },
];

// ── Skeleton row ──────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
      <Skeleton className="size-4 rounded" />
      <Skeleton className="h-3 flex-1 rounded" />
      <Skeleton className="h-5 w-20 rounded" />
      <Skeleton className="h-3 w-12 rounded" />
    </div>
  );
}

// ── Group header ──────────────────────────────────────────────────────────────

function GroupHeader({ label }: { label: string }) {
  return (
    <div
      className="px-4 py-2 bg-muted text-sm font-semibold text-foreground"
      role="group"
      aria-label={label}
    >
      {label}
    </div>
  );
}

// ── Apply transient filter to flat issues list ────────────────────────────────

function matchesFilter(
  issue: JiraIssue,
  filterKey: FilterKey | null,
  mrAwaitingKeys: Set<string>,
): boolean {
  if (!filterKey) return true;
  const cat = issue.fields.status.statusCategory?.key;
  const name = issue.fields.status.name.toLowerCase();
  const duedate = issue.fields.duedate as string | null | undefined;

  switch (filterKey) {
    case 'toDo':
      return cat === 'new';
    case 'inProgress':
      return cat === 'indeterminate' && !name.includes('review');
    case 'inReview':
      return cat === 'indeterminate' && name.includes('review');
    case 'doneSprint':
      return cat === 'done';
    case 'overdue': {
      if (!duedate || cat === 'done') return false;
      const due = new Date(duedate);
      due.setHours(23, 59, 59, 999);
      return due < new Date();
    }
    case 'mrAwaiting':
      return mrAwaitingKeys.has(issue.key);
    default:
      return true;
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MyTasksPage() {
  const navigate = useNavigate();

  // Auth + project
  const { jiraBaseUrl, activeJiraProject, gitlabBaseUrl, gitlabUserId } = useAuthStore();

  // Fine-grained settings selectors (avoid re-renders on unrelated store mutations)
  const storyPointsFieldKey = useSettingsStore((s) => s.storyPointsFieldKey);
  const flaggedFieldKey = useSettingsStore((s) => s.flaggedFieldKey);

  // Persisted grouping mode + scope
  const groupingMode = useMyTasksStore((s) => s.groupingMode);
  const scope = useMyTasksStore((s) => s.scope);
  const setGroupingMode = useMyTasksStore((s) => s.setGroupingMode);
  const setScope = useMyTasksStore((s) => s.setScope);

  // Transient filter — component state only, NEVER in useMyTasksStore (D-01/D-10)
  const [activeFilter, setActiveFilter] = useState<FilterKey | null>(null);

  // Token loading (Sidebar.tsx pattern)
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

  // ── GitLab authored MRs (band 2 / MR health) ──────────────────────────────
  const gitlabEnabled = !!gitlabBaseUrl && !!gitlabToken && !!gitlabUserId;
  const { data: authoredMRs } = useQuery({
    queryKey: ['gitlab-authored-mrs', gitlabBaseUrl, gitlabUserId],
    queryFn: () => fetchAuthoredMRs(gitlabBaseUrl!, gitlabToken!, gitlabUserId!),
    staleTime: 60_000,
    enabled: gitlabEnabled,
  });

  // Build Set of issue keys with my authored open MRs
  const myOpenMRIssueKeys = new Set<string>();
  if (authoredMRs) {
    for (const mr of authoredMRs) {
      // Extract Jira key from MR title / branch (match "PROJ-123" pattern)
      const match = /([A-Z]+-\d+)/g;
      const title = mr.title ?? '';
      const branch = (mr.source_branch as string | undefined) ?? '';
      for (const m of `${title} ${branch}`.matchAll(match)) {
        myOpenMRIssueKeys.add(m[1]);
      }
    }
  }

  // ── Active scope data ──────────────────────────────────────────────────────
  const activeData = scope === 'current-sprint' ? sprintData : allData;
  const isLoading = scope === 'current-sprint' ? sprintLoading : allLoading;
  const isError = scope === 'current-sprint' ? sprintError : allError;
  const refetch = scope === 'current-sprint' ? sprintRefetch : allRefetch;

  const allIssues = activeData?.issues ?? [];
  const myIssueKeys = activeData?.myIssueKeys ?? new Set<string>();

  // ── Counts ─────────────────────────────────────────────────────────────────
  const counts = deriveCounts(allIssues, myOpenMRIssueKeys);

  // ── Filter function ────────────────────────────────────────────────────────
  function applyFilter(issues: JiraIssue[]): JiraIssue[] {
    if (!activeFilter) return issues;
    return issues.filter((i) => matchesFilter(i, activeFilter, myOpenMRIssueKeys));
  }

  function handleFilterClick(key: FilterKey) {
    setActiveFilter((prev) => (prev === key ? null : key));
  }

  // ── Navigation handlers ────────────────────────────────────────────────────
  function handleOpenPeek(_key: string) {
    // PeekPanel is provided by the app shell (AppLayout); in this phase
    // we navigate to full detail as the peek integration is wired in plan 82-05
    navigate(`/issue/${_key}`);
  }

  function handleOpenIssue(key: string) {
    navigate(`/issue/${key}`);
  }

  // ── MR health for an issue ─────────────────────────────────────────────────
  function getMrHealth(_issueKey: string): ReviewHealth | undefined {
    if (!authoredMRs) return undefined;
    // For now we just flag whether the issue has an authored MR
    // Full ReviewHealth derivation happens when MR approvals are fetched
    if (myOpenMRIssueKeys.has(_issueKey)) return 'waiting_for_review';
    return undefined;
  }

  // ── Render grouped list ────────────────────────────────────────────────────

  function renderMyDayList() {
    const filtered = applyFilter(allIssues);
    const bands = groupByMyDay(filtered, myIssueKeys, flaggedFieldKey, myOpenMRIssueKeys);

    if (bands.length === 0) {
      if (activeFilter) {
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
        {bands.map(({ band, parents }) => (
          <div key={band}>
            <GroupHeader label={MY_DAY_BAND_LABELS[band] ?? band} />
            {parents.map(({ parent, subtasks }) => (
              <div key={parent.key}>
                <MyTaskRow
                  issue={parent}
                  jiraBaseUrl={jiraBaseUrl!}
                  storyPointsFieldKey={storyPointsFieldKey}
                  flaggedFieldKey={flaggedFieldKey}
                  mrHealth={getMrHealth(parent.key)}
                  onOpenPeek={handleOpenPeek}
                  onOpenIssue={handleOpenIssue}
                />
                {subtasks.map((subtask) => (
                  <MyTaskRow
                    key={subtask.key}
                    issue={subtask}
                    isSubtask
                    jiraBaseUrl={jiraBaseUrl!}
                    storyPointsFieldKey={storyPointsFieldKey}
                    flaggedFieldKey={flaggedFieldKey}
                    mrHealth={getMrHealth(subtask.key)}
                    onOpenPeek={handleOpenPeek}
                    onOpenIssue={handleOpenIssue}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  function renderByStatusList() {
    const filtered = applyFilter(allIssues);
    const parents = filtered.filter((i) => !i.fields.issuetype?.subtask);
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

    // Group parents by status category
    const byStatus = new Map<string, { label: string; issues: JiraIssue[] }>();
    const STATUS_ORDER = ['new', 'indeterminate', 'done'];
    const STATUS_LABELS: Record<string, string> = {
      new: 'To Do',
      indeterminate: 'In Progress',
      done: 'Done',
    };

    for (const parent of parents) {
      const cat = parent.fields.status.statusCategory?.key ?? 'new';
      if (!byStatus.has(cat)) {
        byStatus.set(cat, { label: STATUS_LABELS[cat] ?? cat, issues: [] });
      }
      byStatus.get(cat)!.issues.push(parent);
    }

    if (byStatus.size === 0) {
      if (activeFilter) {
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
          const group = byStatus.get(cat)!;
          return (
            <div key={cat}>
              <GroupHeader label={group.label} />
              {group.issues.map((parent) => (
                <div key={parent.key}>
                  <MyTaskRow
                    issue={parent}
                    jiraBaseUrl={jiraBaseUrl!}
                    storyPointsFieldKey={storyPointsFieldKey}
                    flaggedFieldKey={flaggedFieldKey}
                    mrHealth={getMrHealth(parent.key)}
                    onOpenPeek={handleOpenPeek}
                    onOpenIssue={handleOpenIssue}
                  />
                  {(subtasksByParent.get(parent.key) ?? []).map((subtask) => (
                    <MyTaskRow
                      key={subtask.key}
                      issue={subtask}
                      isSubtask
                      jiraBaseUrl={jiraBaseUrl!}
                      storyPointsFieldKey={storyPointsFieldKey}
                      flaggedFieldKey={flaggedFieldKey}
                      mrHealth={getMrHealth(subtask.key)}
                      onOpenPeek={handleOpenPeek}
                      onOpenIssue={handleOpenIssue}
                    />
                  ))}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  function renderBySprintParentList() {
    const filtered = applyFilter(allIssues);
    const parents = filtered.filter((i) => !i.fields.issuetype?.subtask);
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

    // Group by sprint (D-05): active sprint(s) → closed newest-first → Backlog last
    interface SprintGroup {
      sprintId: number | null;
      sprintName: string;
      state: string;
      endDate: string | null;
      issues: JiraIssue[];
    }

    const sprintGroups = new Map<string, SprintGroup>();

    for (const parent of parents) {
      // customfield_10020 is the sprint field
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

    // Sort: ACTIVE first, then CLOSED newest-first (by endDate), then backlog
    const sortedGroups = Array.from(sprintGroups.values()).sort((a, b) => {
      if (a.state === 'ACTIVE' && b.state !== 'ACTIVE') return -1;
      if (b.state === 'ACTIVE' && a.state !== 'ACTIVE') return 1;
      if (a.sprintId === null) return 1; // backlog last
      if (b.sprintId === null) return -1;
      if (a.endDate && b.endDate) return b.endDate.localeCompare(a.endDate);
      return 0;
    });

    if (sortedGroups.length === 0) {
      if (activeFilter) {
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
        {sortedGroups.map((group) => (
          <div key={group.sprintId ?? '__backlog__'}>
            <GroupHeader label={group.sprintName} />
            {group.issues.map((parent) => (
              <div key={parent.key}>
                <MyTaskRow
                  issue={parent}
                  jiraBaseUrl={jiraBaseUrl!}
                  storyPointsFieldKey={storyPointsFieldKey}
                  flaggedFieldKey={flaggedFieldKey}
                  mrHealth={getMrHealth(parent.key)}
                  onOpenPeek={handleOpenPeek}
                  onOpenIssue={handleOpenIssue}
                />
                {(subtasksByParent.get(parent.key) ?? []).map((subtask) => (
                  <MyTaskRow
                    key={subtask.key}
                    issue={subtask}
                    isSubtask
                    jiraBaseUrl={jiraBaseUrl!}
                    storyPointsFieldKey={storyPointsFieldKey}
                    flaggedFieldKey={flaggedFieldKey}
                    mrHealth={getMrHealth(subtask.key)}
                    onOpenPeek={handleOpenPeek}
                    onOpenIssue={handleOpenIssue}
                  />
                ))}
              </div>
            ))}
          </div>
        ))}
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
      {/* Page header */}
      <div className="px-6 pt-6 pb-4 border-b border-border">
        <h1 className="text-xl font-semibold text-foreground">My Tasks</h1>
      </div>

      {/* Summary / filter strip (MYTASK-02, D-01) */}
      <div className="flex items-center gap-2 px-6 py-3 border-b border-border flex-wrap">
        {FILTER_PILLS.map(({ key, label }) => {
          const count = counts[key];
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleFilterClick(key)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <span className="tabular-nums">{count}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Single Tabs root wraps both the tab strip header and the content panels */}
      <Tabs
        value={groupingMode}
        onValueChange={(v) => setGroupingMode(v as 'my-day' | 'by-status' | 'by-sprint-parent')}
        className="flex flex-col flex-1 min-h-0"
      >
        {/* Grouping tabs + scope toggle row */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border shrink-0">
          <TabsList>
            <TabsTrigger value="my-day">My Day</TabsTrigger>
            <TabsTrigger value="by-status">By Status</TabsTrigger>
            <TabsTrigger value="by-sprint-parent">By Sprint &amp; Parent</TabsTrigger>
          </TabsList>

          {/* Scope toggle (MYTASK-07) */}
          <div
            role="group"
            aria-label="Scope"
            className="flex items-center rounded border border-border overflow-hidden ml-4 shrink-0"
          >
            <button
              type="button"
              aria-pressed={scope === 'current-sprint'}
              onClick={() => setScope('current-sprint')}
              className={cn(
                'h-9 px-3 text-xs font-medium transition-colors',
                scope === 'current-sprint'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              Current Sprint
            </button>
            <button
              type="button"
              aria-pressed={scope === 'all-assigned'}
              onClick={() => setScope('all-assigned')}
              className={cn(
                'h-9 px-3 text-xs font-medium transition-colors border-l border-border',
                scope === 'all-assigned'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              All Assigned
            </button>
          </div>
        </div>

        {/* Issue list — tab content panels */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="my-day" className="mt-0">
            {renderContent()}
          </TabsContent>
          <TabsContent value="by-status" className="mt-0">
            {renderContent()}
          </TabsContent>
          <TabsContent value="by-sprint-parent" className="mt-0">
            {renderContent()}
          </TabsContent>

          {/* Progressive loading indicator (D-06) — All Assigned scope while fetching */}
          {scope === 'all-assigned' && allFetching && !allLoading && (
            <div className="px-4 py-3">
              <SkeletonRow />
              <SkeletonRow />
              <p className="text-xs text-muted-foreground px-4 py-1">Loading more tasks…</p>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}
