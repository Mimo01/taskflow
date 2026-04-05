/**
 * BacklogPage — Jira-style backlog view with sprint sections.
 *
 * Renders:
 *   1. Active sprint section (if any) — collapsible, with sprint name, badge, issue count
 *   2. Future sprint sections — one per sprint, ordered by start date
 *   3. Backlog section — issues with no sprint assignment, always at bottom
 *
 * Each section uses BacklogRow for individual issue rows.
 * BacklogFilterBar applies filters across ALL sections combined.
 * Right-click on any row opens a context menu to move the issue to a sprint.
 * Create story entry point via Outlet context remains unchanged.
 *
 * Architecture: Per-section queries with progressive loading (Phase 48).
 * - jira-sprint-stories: shared cache with SprintBoardTab
 * - jira-sprint-list: canonical board sprint ordering
 * - jira-backlog-issues: unassigned issues
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useBoardId } from '@/hooks/useBoardId';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { useListNavigation } from '@/hooks/useListNavigation';
import { STALE_TIME_MS } from '@/lib/query-constants';
import { fetchBacklogIssues, fetchBacklogSprintStories, fetchSprintList } from '@/services/jira/backlog';
import type { JiraIssue } from '@/services/jira';
import {
  addIssuesToSprint,
  fetchEpicsBasic,
  fetchProjectStatuses,
  moveIssuesToBacklog,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { ConfirmSprintMoveDialog } from '@/components/ui/confirm-sprint-move-dialog';
import { BacklogRow } from './BacklogRow';
import { BacklogSkeleton } from './BacklogSkeleton';

// ── Virtualized table body ────────────────────────────────────────────────────

function VirtualizedBacklogTable({
  filteredIssues,
  scrollElement,
  onIssueClick,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicNames,
  epicColors,
  epicsLoading,
  visibleIssueKeys,
  focusIndex,
  rowRefs,
  sprints,
  onMoveToSprint,
  onMoveToBacklog,
}: {
  filteredIssues: JiraIssue[];
  scrollElement: HTMLDivElement | null;
  onIssueClick: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  epicsLoading?: boolean;
  visibleIssueKeys: string[];
  focusIndex: number;
  rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
  sprints: Array<{ id: number; name: string; state: string }>;
  onMoveToSprint: (issueKey: string, sprintId: number, sprintName: string) => void;
  onMoveToBacklog?: (issueKey: string) => void;
}) {
  const rowVirtualizer = useVirtualizer({
    count: filteredIssues.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 44,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  // Disable virtualization for table rows — position: absolute on <tr> elements
  // is undefined behavior in CSS and causes rows to overlap in most browsers.
  // Backlog tables are small enough to render without virtualization.
  const useVirtual = false;

  function renderRow(issue: JiraIssue, style?: React.CSSProperties) {
    return (
      <BacklogRow
        key={issue.key}
        ref={(el: HTMLTableRowElement | null) => {
          if (el) {
            rowRefs.current.set(issue.key, el);
            if (style) {
              el.style.position = style.position as string;
              el.style.top = style.top as string;
              el.style.left = style.left as string;
              el.style.width = style.width as string;
              el.style.height = style.height as string;
              el.style.transform = style.transform as string;
            }
          } else {
            rowRefs.current.delete(issue.key);
          }
        }}
        issue={issue}
        onIssueClick={onIssueClick}
        storyPointsFieldKey={storyPointsFieldKey}
        epicLinkFieldKey={epicLinkFieldKey}
        epicNameFieldKey={epicNameFieldKey}
        epicNames={epicNames}
        epicColors={epicColors}
        epicsLoading={epicsLoading}
        isFocused={visibleIssueKeys[focusIndex] === issue.key}
        sprints={sprints}
        onMoveToSprint={onMoveToSprint}
        onMoveToBacklog={onMoveToBacklog}
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/10">
        <tr>
          <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            Key
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            Epic
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">Summary</th>
          <th className="w-14 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
            Points
          </th>
          <th className="w-10 px-2 py-2 text-xs font-medium text-muted-foreground">Assignee</th>
        </tr>
      </thead>
      <tbody
        style={
          useVirtual
            ? { height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }
            : undefined
        }
      >
        {useVirtual
          ? virtualItems.map((virtualRow) => {
              const issue = filteredIssues[virtualRow.index];
              return renderRow(issue, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              });
            })
          : filteredIssues.map((issue) => renderRow(issue))}
      </tbody>
    </table>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const { onIssueClick, openCreateStory } = useOutletContext<{
    onIssueClick: (key: string) => void;
    openCreateStory: () => void;
  }>();

  // ── Query client ────────────────────────────────────────────────────────────
  const queryClient = useQueryClient();

  // ── Auth / settings ─────────────────────────────────────────────────────────
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, epicColorFieldKey } =
    useSettingsStore();

  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat')
      .then(setJiraToken)
      .catch(() => setJiraToken(null));
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────

  // -- Per-section queries (progressive loading) ---
  const { boardId, isLoading: boardIdLoading } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);

  // Query 1: Sprint list (canonical board ordering, includes empty sprints) — loads first for headers.
  const {
    data: sprintList,
  } = useQuery({
    queryKey: ['jira-sprint-list', boardId, jiraBaseUrl],
    queryFn: () => fetchSprintList(jiraBaseUrl!, jiraToken!, boardId!),
    staleTime: STALE_TIME_MS,
    enabled: !!boardId && !!jiraBaseUrl && !!jiraToken,
  });

  // Derive sprint IDs from the loaded sprint list (active + future only)
  const sprintIds = useMemo(
    () => (sprintList ?? []).filter((s) => s.state === 'active' || s.state === 'future').map((s) => s.id),
    [sprintList],
  );

  // Query 2: Sprint stories — fetched per-sprint using fast standard search API.
  // Depends on sprintList (for sprint IDs), not boardId directly.
  const {
    data: sprintStories,
    isLoading: storiesLoading,
    isError: storiesError,
    error: storiesErrorObj,
    refetch: refetchStories,
  } = useQuery<JiraIssue[]>({
    queryKey: ['jira-backlog-sprint-stories', activeJiraProject, jiraBaseUrl, sprintIds, storyPointsFieldKey, epicLinkFieldKey],
    queryFn: () => fetchBacklogSprintStories(jiraBaseUrl!, jiraToken!, activeJiraProject!, sprintIds, storyPointsFieldKey, epicLinkFieldKey),
    staleTime: STALE_TIME_MS,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken && sprintIds.length > 0,
  });

  // Query 3: Backlog issues (unassigned to any sprint)
  const {
    data: backlogIssues,
    isLoading: backlogLoading,
    isError: backlogError,
    error: backlogErrorObj,
    refetch: refetchBacklog,
  } = useQuery<JiraIssue[]>({
    queryKey: ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
    queryFn: () => fetchBacklogIssues(jiraBaseUrl!, jiraToken!, activeJiraProject!, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey),
    staleTime: STALE_TIME_MS,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // All project statuses (for filter dropdown — shows all that exist, not just visible)
  const { data: projectStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchProjectStatuses(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // All project epics (shared cache with EpicsPage and SprintBoardTab)
  const { data: allEpics } = useQuery({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 5 * 60_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Show global skeleton until sprint list AND backlog have both loaded.
  // Before jiraToken resolves (async readSecret), all queries are disabled — treat as loading.
  // After boardId resolves, wait for sprint list so headers render together with backlog.
  const authBootstrapping = !jiraToken;
  const waitingForSprintList = boardIdLoading || (boardId != null && !sprintList);
  const isAnyLoading = authBootstrapping || waitingForSprintList || backlogLoading;
  const showSkeleton = useDelayedLoading(isAnyLoading);

  // Per-query loading for epics (LOAD-04)
  const isEpicsLoading = !allEpics && !!activeJiraProject;

  // Combined error state
  const isError = storiesError || backlogError;
  const error = storiesErrorObj ?? backlogErrorObj;
  const refetch = () => { refetchStories(); refetchBacklog(); };

  // Map parentKey → Set of subtask status names (from sprint stories data)
  const subtaskStatusMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const issue of sprintStories ?? []) {
      if (issue.fields.issuetype.subtask && issue.fields.parent?.key) {
        const parentKey = issue.fields.parent.key;
        if (!map.has(parentKey)) map.set(parentKey, new Set());
        map.get(parentKey)?.add(issue.fields.status.name);
      }
    }
    return map;
  }, [sprintStories]);

  // ── Pending sprint move confirmation state ────────────────────────────────────
  const [pendingSprintMove, setPendingSprintMove] = useState<{
    issueKey: string;
    sprintId: number;
    sprintName: string;
    fromSprintName: string | null;
  } | null>(null);

  const [pendingBacklogMove, setPendingBacklogMove] = useState<{
    issueKey: string;
    fromSprintName: string;
  } | null>(null);

  // ── Stale data banner state ───────────────────────────────────────────────────
  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  // ── Collapse state (all sections open by default) ────────────────────────────

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  // ── Filter state (shared across views) ──────────────────────────────────────

  const { activeEpics, activeLabels, activeAssignees, activeStatuses } = useFilterStore();

  // ── Build sprint sections from sprint list + sprint stories ──────────────────

  const mergedSprints = useMemo(() => {
    // Build sprint sections from sprintList alone so headers render immediately.
    // Stories fill in once sprintStories resolves; sections show a loading state in the interim.
    if (!sprintList) return [];
    // Group stories by sprint ID (empty map when sprintStories not yet loaded)
    const storiesBySprint = new Map<number, JiraIssue[]>();
    for (const story of sprintStories ?? []) {
      const sprintField = story.fields.sprint as { id: number } | null;
      if (sprintField?.id) {
        const existing = storiesBySprint.get(sprintField.id) ?? [];
        existing.push(story);
        storiesBySprint.set(sprintField.id, existing);
      }
    }
    // Map sprint list to sections, filling in issues
    return sprintList
      .filter((s) => s.state === 'active' || s.state === 'future')
      .map((sprint) => ({
        sprint,
        issues: storiesBySprint.get(sprint.id) ?? [],
      }));
  }, [sprintList, sprintStories]);

  // Available sprints for context menu (active + future only)
  const availableSprints = useMemo(
    () => mergedSprints.map((s) => s.sprint).filter((s) => s.state !== 'closed'),
    [mergedSprints],
  );

  const allIssues = useMemo<JiraIssue[]>(() => {
    const sprintIssuesList = mergedSprints.flatMap((s) => s.issues);
    const backlogList = backlogIssues ?? [];
    return [...sprintIssuesList, ...backlogList];
  }, [mergedSprints, backlogIssues]);

  // ── Epic name and color maps derived from allEpics query ──────────────────────

  const epicNameMap = useMemo(() => {
    if (!allEpics) return undefined;
    const m = new Map<string, string>();
    for (const e of allEpics) m.set(e.key, e.epicName);
    return m;
  }, [allEpics]);

  const epicColorMap = useMemo(() => {
    if (!allEpics) return undefined;
    const m = new Map<string, string>();
    for (const e of allEpics) if (e.color) m.set(e.key, e.color);
    return m;
  }, [allEpics]);

  // ── Filter options (derived from all issues across all sections) ──────────────

  const filterOptions = useMemo(() => {
    // Epics: all project epics (not just those on current backlog issues)
    const epics = new Map<string, string>();
    for (const e of allEpics ?? []) epics.set(e.key, e.epicName);
    // Also include any epic on current issues not yet in allEpics
    for (const issue of allIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      if (epicKey && !epics.has(epicKey)) {
        const nameFromField = issue.fields[epicNameFieldKey] as string | null;
        epics.set(epicKey, nameFromField ?? epicKey);
      }
    }
    const labels = new Set<string>();
    const assignees = new Set<string>();
    for (const issue of allIssues) {
      for (const label of (issue.fields.labels as string[] | undefined) ?? []) {
        labels.add(label);
      }
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
    }
    // Statuses: all project workflow statuses (not just those on current issues)
    const statuses = new Set<string>();
    for (const s of projectStatuses ?? []) statuses.add(s.name);
    for (const issue of allIssues) {
      if (issue.fields.status?.name) statuses.add(issue.fields.status.name);
    }
    // Also include subtask statuses from sprint stories data
    for (const statusSet of subtaskStatusMap.values()) {
      for (const s of statusSet) statuses.add(s);
    }
    return {
      epics,
      labels: Array.from(labels),
      assignees: Array.from(assignees),
      statuses: Array.from(statuses).sort(),
    };
  }, [
    allIssues,
    epicLinkFieldKey,
    epicNameFieldKey,
    allEpics,
    projectStatuses,
    subtaskStatusMap,
  ]);

  // ── Filter application helper ─────────────────────────────────────────────────

  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch = (() => {
        if (activeEpics.size === 0) return true;
        const epicKey = issue.fields[epicLinkFieldKey] as string | null;
        return epicKey != null && activeEpics.has(epicKey);
      })();
      const labelMatch =
        activeLabels.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch = (() => {
        if (activeAssignees.size === 0) return true;
        const name = issue.fields.assignee?.displayName ?? '';
        return Array.from(activeAssignees).some((q) =>
          name.toLowerCase().includes(q.toLowerCase()),
        );
      })();
      const statusMatch = (() => {
        if (activeStatuses.size === 0) return true;
        const activeLC = new Set(Array.from(activeStatuses).map((s) => s.toLowerCase()));
        // Match on the story's own status (case-insensitive)
        const storyStatus = (issue.fields.status?.name ?? '').toLowerCase();
        if (storyStatus && activeLC.has(storyStatus)) return true;
        // Match on subtask statuses from sprint stories data
        const subStatuses = subtaskStatusMap.get(issue.key);
        if (subStatuses) {
          for (const s of subStatuses) {
            if (activeLC.has(s.toLowerCase())) return true;
          }
        }
        return false;
      })();
      const result = epicMatch && labelMatch && assigneeMatch && statusMatch;
      return result;
    });
  }

  // ── J/K navigation ──────────────────────────────────────────────────────────

  const visibleIssueKeys = useMemo(() => {
    if (!sprintStories && !backlogIssues) return [];
    const keys: string[] = [];
    for (const { sprint, issues } of mergedSprints) {
      const sectionId = `sprint-${sprint.id}`;
      if (collapsedSections.has(sectionId)) continue;
      const filtered = applyFilters(issues);
      for (const issue of filtered) {
        keys.push(issue.key);
      }
    }
    if (!collapsedSections.has('backlog')) {
      const filtered = applyFilters(backlogIssues ?? []);
      for (const issue of filtered) {
        keys.push(issue.key);
      }
    }
    return keys;
  }, [sprintStories, backlogIssues, collapsedSections, applyFilters, mergedSprints]);

  const { focusIndex } = useListNavigation({
    itemCount: visibleIssueKeys.length,
    onSelect: (index) => onIssueClick(visibleIssueKeys[index]),
    enabled: !isAnyLoading && visibleIssueKeys.length > 0,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

  useEffect(() => {
    if (focusIndex >= 0 && focusIndex < visibleIssueKeys.length) {
      const key = visibleIssueKeys[focusIndex];
      const el = rowRefs.current.get(key);
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusIndex, visibleIssueKeys]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  // Request handlers: set pending state for confirmation dialog
  function requestMoveToSprint(issueKey: string, sprintId: number, sprintName: string) {
    const allIssuesList = [...(sprintStories ?? []), ...(backlogIssues ?? [])];
    const issue = allIssuesList.find((i) => i.key === issueKey);
    const currentSprintName = issue?.fields.sprint
      ? ((issue.fields.sprint as { name?: string }).name ?? null)
      : null;
    setPendingSprintMove({ issueKey, sprintId, sprintName, fromSprintName: currentSprintName });
  }

  function requestMoveToBacklog(issueKey: string) {
    const allIssuesList = [...(sprintStories ?? []), ...(backlogIssues ?? [])];
    const issue = allIssuesList.find((i) => i.key === issueKey);
    const currentSprintName = issue?.fields.sprint
      ? ((issue.fields.sprint as { name?: string }).name ?? 'Sprint')
      : 'Sprint';
    setPendingBacklogMove({ issueKey, fromSprintName: currentSprintName });
  }

  // Confirm handlers: execute the actual API calls (formerly handleMove*)
  async function confirmMoveToSprint(issueKey: string, sprintId: number, sprintName: string) {
    // Optimistic removal from backlog issues cache
    const previousBacklog = queryClient.getQueryData<JiraIssue[]>(
      ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
    );
    queryClient.setQueryData<JiraIssue[]>(
      ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
      (old) => old?.filter((i) => i.key !== issueKey),
    );
    // Also optimistically remove from backlog sprint stories cache (if moving between sprints)
    queryClient.setQueryData<JiraIssue[]>(
      ['jira-backlog-sprint-stories', activeJiraProject, jiraBaseUrl, sprintIds, storyPointsFieldKey, epicLinkFieldKey],
      (old) => old?.filter((i) => i.key !== issueKey),
    );
    try {
      await addIssuesToSprint(jiraBaseUrl!, jiraToken!, sprintId, [issueKey]);
      // Invalidate all relevant caches so they refetch with correct sprint assignments
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-list'] });
    } catch (_err) {
      // Rollback on failure
      queryClient.setQueryData(
        ['jira-backlog-issues', activeJiraProject, jiraBaseUrl, storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey],
        previousBacklog,
      );
      // Refetch sprint stories to restore correct state
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
    }
    void sprintName;
  }

  async function confirmMoveToBacklog(issueKey: string) {
    // Optimistic removal from sprint stories cache
    const previousStories = queryClient.getQueryData<JiraIssue[]>(
      ['jira-backlog-sprint-stories', activeJiraProject, jiraBaseUrl, sprintIds, storyPointsFieldKey, epicLinkFieldKey],
    );
    queryClient.setQueryData<JiraIssue[]>(
      ['jira-backlog-sprint-stories', activeJiraProject, jiraBaseUrl, sprintIds, storyPointsFieldKey, epicLinkFieldKey],
      (old) => old?.filter((i) => i.key !== issueKey),
    );
    try {
      await moveIssuesToBacklog(jiraBaseUrl!, jiraToken!, [issueKey]);
      // Invalidate all relevant caches so they refetch with correct sprint assignments
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-stories'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-issues'] });
      queryClient.invalidateQueries({ queryKey: ['jira-sprint-list'] });
    } catch (_err) {
      // Rollback on failure
      queryClient.setQueryData(
        ['jira-backlog-sprint-stories', activeJiraProject, jiraBaseUrl, sprintIds, storyPointsFieldKey, epicLinkFieldKey],
        previousStories,
      );
    }
  }

  // ── Section renderer ──────────────────────────────────────────────────────────

  function renderSection(
    sectionId: string,
    title: string,
    badge: string | null,
    issues: JiraIssue[],
    showCreateStory: boolean,
    isSticky: boolean = false,
    moveToBacklog?: (issueKey: string) => void,
    sectionStoriesLoading: boolean = false,
  ) {
    const isCollapsed = collapsedSections.has(sectionId);
    const filteredIssues = applyFilters(issues);

    return (
      <div key={sectionId} className="mb-2" data-testid={`sprint-section-${sectionId}`}>
        {/* Section header */}
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className={`flex items-center gap-2 w-full px-4 py-2 border-b border-border transition-colors text-left ${
            isSticky
              ? 'sticky top-0 z-[5] bg-muted shadow-[0_1px_3px_rgba(0,0,0,0.1)] hover:bg-muted'
              : 'bg-muted/40 hover:bg-muted/60'
          }`}
          data-testid={`section-header-${sectionId}`}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{title}</span>
          {badge && (
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${
                badge === 'Active'
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'bg-blue-100 text-blue-800 border-blue-300'
              }`}
            >
              {badge}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {sectionStoriesLoading ? (
              <span className="animate-pulse">Loading...</span>
            ) : (
              <>{issues.length} {issues.length === 1 ? 'issue' : 'issues'}</>
            )}
          </span>
        </button>

        {/* Section body */}
        {!isCollapsed && (
          <div>
            {sectionStoriesLoading ? (
              /* Stories still loading — show skeleton rows */
              <div className="px-4 py-2 space-y-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-9 w-full animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : filteredIssues.length > 0 ? (
              <VirtualizedBacklogTable
                filteredIssues={filteredIssues}
                scrollElement={scrollRef.current}
                onIssueClick={onIssueClick}
                storyPointsFieldKey={storyPointsFieldKey}
                epicLinkFieldKey={epicLinkFieldKey}
                epicNameFieldKey={epicNameFieldKey}
                epicNames={epicNameMap}
                epicColors={epicColorMap}
                epicsLoading={isEpicsLoading}
                visibleIssueKeys={visibleIssueKeys}
                focusIndex={focusIndex}
                rowRefs={rowRefs}
                sprints={availableSprints}
                onMoveToSprint={requestMoveToSprint}
                onMoveToBacklog={moveToBacklog}
              />
            ) : issues.length > 0 ? (
              /* All issues filtered out */
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No issues match the current filters
              </p>
            ) : (
              /* Sprint has no stories */
              <p className="px-4 py-3 text-sm text-muted-foreground italic">
                No issues in this sprint
              </p>
            )}

            {/* Create story button at the bottom of the section */}
            {showCreateStory && !sectionStoriesLoading && (
              <div className="px-4 py-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => openCreateStory()}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid={`create-story-${sectionId}`}
                >
                  + Create Story
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="backlog-page">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h1 className="text-lg font-semibold">Backlog</h1>
        <button
          type="button"
          onClick={() => openCreateStory()}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          + Create Story
        </button>
      </div>

      {/* Sprint move confirmation dialogs */}
      <ConfirmSprintMoveDialog
        open={!!pendingSprintMove}
        onOpenChange={(open) => {
          if (!open) setPendingSprintMove(null);
        }}
        issueKey={pendingSprintMove?.issueKey ?? ''}
        fromSprintName={pendingSprintMove?.fromSprintName ?? null}
        toSprintName={pendingSprintMove?.sprintName ?? ''}
        onConfirm={() => {
          if (pendingSprintMove) {
            void confirmMoveToSprint(
              pendingSprintMove.issueKey,
              pendingSprintMove.sprintId,
              pendingSprintMove.sprintName,
            );
            setPendingSprintMove(null);
          }
        }}
      />
      <ConfirmSprintMoveDialog
        open={!!pendingBacklogMove}
        onOpenChange={(open) => {
          if (!open) setPendingBacklogMove(null);
        }}
        issueKey={pendingBacklogMove?.issueKey ?? ''}
        fromSprintName={pendingBacklogMove?.fromSprintName ?? null}
        toSprintName="Backlog"
        onConfirm={() => {
          if (pendingBacklogMove) {
            void confirmMoveToBacklog(pendingBacklogMove.issueKey);
            setPendingBacklogMove(null);
          }
        }}
      />

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Filter bar — scrolls with content */}
        <UnifiedFilterBar filterOptions={filterOptions} />
        {/* Error state — no cached data */}
        {isError && !sprintStories && !backlogIssues && (
          <div className="p-4">
            <ErrorState error={error} onRetry={refetch} viewName="backlog" />
          </div>
        )}

        {/* Stale data banner — error with cached data */}
        {isError && (sprintStories || backlogIssues) && !bannerDismissed && (
          <div className="px-4 pt-4">
            <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
          </div>
        )}

        {showSkeleton ? (
          /* Skeleton loading state — only when neither backlog nor sprint list has loaded */
          <BacklogSkeleton />
        ) : !isError && !authBootstrapping && mergedSprints.length === 0 && (backlogIssues ?? []).length === 0 && !storiesLoading && !backlogLoading && !waitingForSprintList ? (
          /* Empty state — all queries settled with no data */
          <EmptyState
            icon={Inbox}
            title="Backlog is empty"
            subtitle="All issues are assigned to sprints"
            action={<Button onClick={() => openCreateStory()}>Create Issue</Button>}
          />
        ) : (mergedSprints.length > 0 || storiesLoading || (backlogIssues ?? []).length > 0 || backlogLoading) ? (
          /* Sprint sections + backlog section */
          <div>
            {/* Sprint sections (active first, then future) */}
            {mergedSprints.map(({ sprint, issues }) =>
              renderSection(
                `sprint-${sprint.id}`,
                sprint.name,
                sprint.state === 'active' ? 'Active' : 'Future',
                issues,
                false,
                true,
                requestMoveToBacklog,
                storiesLoading,
              ),
            )}

            {/* Backlog section — always last */}
            {renderSection('backlog', 'Backlog', null, backlogIssues ?? [], true, true)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
