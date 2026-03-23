/**
 * SprintBoardTab — Jira-style sprint board: 3 category columns x story swimlanes.
 *
 * Columns: always exactly "To Do" | "In Progress" | "Done", driven by the
 * statusCategory field that Jira returns on every status. All statuses with
 * statusCategory.key === "new" land in To Do, "indeterminate" in In Progress,
 * "done" in Done — regardless of how many workflow statuses the project has.
 *
 * fetchProjectStatuses is used to build a statusId -> category map so that
 * drag-and-drop can find a valid transition to the target category.
 *
 * Layout: sticky column headers -> collapsible story swimlanes -> card cells.
 * Drag-and-drop: optimistic update + rollback on API failure.
 * Swimlane rows are virtualized via @tanstack/react-virtual for large boards.
 */

import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Columns3, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import type { JiraIssue, JiraTransition } from '@/services/jira';
import {
  fetchEpicsBasic,
  fetchProjectStatuses,
  fetchSprintIssues,
  fetchTransitions,
  postTransition,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { fetchActiveSprint } from '@/services/jira/sprints';
import { fetchBoardQuickFilters } from '@/services/jira/board-config';
import type { JiraBoardQuickFilter } from '@/services/jira/types';
import DraggableCard from './DraggableCard';
import { QuickFilterChipRow } from './QuickFilterChipRow';
import { SprintGoalBanner } from './SprintGoalBanner';
import { StoryHeaderRow } from './StoryHeaderRow';
import TaskCard from './TaskCard';

/** The three fixed columns — all Jira statuses map into one of these via statusCategory. */
const CATEGORY_COLUMNS = [
  { key: 'new', label: 'To Do' },
  { key: 'indeterminate', label: 'In Progress' },
  { key: 'done', label: 'Done' },
] as const;

type CategoryKey = (typeof CATEGORY_COLUMNS)[number]['key'];

function categoryOf(issue: JiraIssue): CategoryKey {
  return (issue.fields.status.statusCategory?.key as CategoryKey) ?? 'new';
}

/**
 * A droppable cell for one category column inside a story swimlane.
 * ID: "{storyKey}|{categoryKey}" so handleDragEnd can extract the category.
 */
function DroppableCell({
  storyKey,
  categoryKey,
  isDisabled,
  children,
}: {
  storyKey: string;
  categoryKey: string;
  isDisabled: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${storyKey}|${categoryKey}`,
    disabled: isDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        'flex-1 min-h-[80px] flex flex-col gap-1.5 p-2 border-l border-border/20 transition-colors',
        isOver && !isDisabled ? 'bg-primary/5 ring-inset ring-1 ring-primary/40' : '',
        isDisabled ? 'opacity-40 pointer-events-none bg-disabled-stripe' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  );
}

/** Virtualized swimlane list — renders swimlane rows with measureElement for variable heights. */
function VirtualizedSwimlanes({
  filteredSwimlanes,
  scrollElement,
  collapsedStories,
  toggleStory,
  setSelectedIssueKey,
  activeIssue,
  validTargetCategories,
  cardErrors,
}: {
  filteredSwimlanes: { story: JiraIssue; subtasks: JiraIssue[] }[];
  scrollElement: HTMLElement | null;
  collapsedStories: Set<string>;
  toggleStory: (key: string) => void;
  setSelectedIssueKey: (key: string) => void;
  activeIssue: JiraIssue | null;
  validTargetCategories: Set<CategoryKey>;
  cardErrors: Map<string, string>;
}) {
  const swimlaneVirtualizer = useVirtualizer({
    count: filteredSwimlanes.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 120,
    overscan: 5,
  });

  const virtualItems = swimlaneVirtualizer.getVirtualItems();
  const useVirtual = virtualItems.length > 0;

  function renderSwimlane(
    swimlane: { story: JiraIssue; subtasks: JiraIssue[] },
    measureRef?: (node: HTMLElement | null) => void,
    dataIndex?: number,
    style?: React.CSSProperties,
  ) {
    const { story, subtasks } = swimlane;
    const isExpanded = !collapsedStories.has(story.key);
    const cards = subtasks.length > 0 ? subtasks : [story];

    return (
      <div
        key={story.key}
        ref={measureRef}
        data-index={dataIndex}
        style={style}
        className="border-b border-border/40"
      >
        {/*
         * sticky top-10: sits directly below the 40px column header bar.
         * Sticks until this story section's bottom edge scrolls off-screen,
         * then the next story's header takes over at the same position.
         * z-[9] keeps story headers below the column header bar (z-20).
         */}
        <div className="sticky top-10 z-[9] bg-background">
          <StoryHeaderRow
            storyKey={story.key}
            summary={story.fields.summary}
            statusName={story.fields.status.name}
            statusCategoryKey={story.fields.status.statusCategory?.key ?? 'new'}
            subtaskCount={subtasks.length}
            isExpanded={isExpanded}
            onToggle={() => toggleStory(story.key)}
            onOpenDetail={setSelectedIssueKey}
          />
        </div>
        {isExpanded && (
          <div className="flex bg-muted/10">
            {CATEGORY_COLUMNS.map((col) => {
              const colCards = cards.filter((c) => categoryOf(c) === col.key);
              const isDisabled =
                activeIssue !== null &&
                validTargetCategories.size > 0 &&
                !validTargetCategories.has(col.key);
              return (
                <DroppableCell
                  key={col.key}
                  storyKey={story.key}
                  categoryKey={col.key}
                  isDisabled={isDisabled}
                >
                  {colCards.map((card) => (
                    <React.Fragment key={card.key}>
                      <DraggableCard
                        issue={card}
                        isSubtask={card.fields.issuetype.subtask}
                        showStatus
                        onOpenDetail={setSelectedIssueKey}
                      />
                      {cardErrors.get(card.key) && (
                        <p className="text-xs text-destructive px-1">
                          {cardErrors.get(card.key)}
                        </p>
                      )}
                    </React.Fragment>
                  ))}
                </DroppableCell>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (useVirtual) {
    return (
      <div
        style={{
          height: `${swimlaneVirtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualRow) => {
          const swimlane = filteredSwimlanes[virtualRow.index];
          return renderSwimlane(
            swimlane,
            swimlaneVirtualizer.measureElement,
            virtualRow.index,
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            },
          );
        })}
      </div>
    );
  }

  // Fallback: render all swimlanes without virtualization (jsdom, SSR, etc.)
  return (
    <div className="flex flex-col">
      {filteredSwimlanes.map((swimlane) => renderSwimlane(swimlane))}
    </div>
  );
}

export default function SprintBoardTab() {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey, epicColorFieldKey } =
    useSettingsStore();
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  const { onIssueClick: setSelectedIssueKey } = useOutletContext<{
    onIssueClick: (key: string) => void;
  }>();
  const queryClient = useQueryClient();

  const [collapsedStories, setCollapsedStories] = useState<Set<string>>(new Set());
  const toggleStory = (key: string) =>
    setCollapsedStories((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const [localIssues, setLocalIssues] = useState<JiraIssue[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [activeIssue, setActiveIssue] = useState<JiraIssue | null>(null);
  const [cardErrors, setCardErrors] = useState<Map<string, string>>(new Map());

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Resolve the scroll element (<main> in AppLayout)
  const boardRef = useRef<HTMLDivElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    // Find the closest scrollable ancestor (<main> with overflow-auto)
    const main = document.querySelector('main');
    setScrollElement(main);
  }, []);

  useEffect(() => {
    if (jiraBaseUrl) {
      readSecret('jira-pat')
        .then((t) => setJiraToken(t))
        .catch(() => setJiraToken(null));
    }
  }, [jiraBaseUrl]);

  const { data, isLoading, isError, error, dataUpdatedAt, refetch } = useQuery({
    queryKey: [
      'jira-issues',
      'sprint-board',
      activeJiraProject,
      storyPointsFieldKey,
      epicLinkFieldKey,
    ],
    queryFn: () =>
      fetchSprintIssues(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        false,
        storyPointsFieldKey,
        epicLinkFieldKey,
      ),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Fetch epic names for filter display (shared cache with EpicsPage)
  const { data: epicsBasic } = useQuery({
    queryKey: ['jira-epics-basic', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchEpicsBasic(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });
  const epicNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of epicsBasic ?? []) m.set(e.key, e.epicName);
    return m;
  }, [epicsBasic]);

  // Fetch active sprint (for goal text and board ID)
  const { data: activeSprint } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: 5 * 60 * 1000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Fetch board quick filters using the board ID from active sprint
  const boardId = activeSprint?.originBoardId;
  const { data: boardQuickFilters } = useQuery({
    queryKey: ['jira-board-quickfilters', boardId],
    queryFn: () => fetchBoardQuickFilters(jiraBaseUrl!, jiraToken!, boardId!),
    staleTime: 5 * 60 * 1000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!boardId,
  });

  const [bannerDismissed, setBannerDismissed] = useState(false);
  useEffect(() => {
    setBannerDismissed(false);
  }, []);

  /** Used to map transition target status IDs -> category keys for drag-and-drop */
  const { data: workflowStatuses } = useQuery({
    queryKey: ['project-statuses', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchProjectStatuses(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: Infinity,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  useEffect(() => {
    if (!isDragging) setLocalIssues(data ?? []);
  }, [data, isDragging]);

  // Pre-fetch transitions for all draggable cards
  useEffect(() => {
    if (!jiraBaseUrl || !jiraToken || !localIssues.length) return;
    const subtaskParentKeys = new Set(
      localIssues
        .filter((i) => i.fields.issuetype.subtask && i.fields.parent?.key)
        .map((i) => i.fields.parent?.key),
    );
    const draggable = localIssues.filter(
      (i) => i.fields.issuetype.subtask || !subtaskParentKeys.has(i.key),
    );
    void Promise.allSettled(
      draggable.map((issue) =>
        queryClient.fetchQuery({
          queryKey: ['transitions', issue.key],
          queryFn: () => fetchTransitions(jiraBaseUrl, jiraToken!, issue.key),
          staleTime: 5 * 60 * 1000,
        }),
      ),
    );
  }, [jiraBaseUrl, jiraToken, localIssues.length, localIssues.filter, queryClient.fetchQuery]);

  /**
   * Maps status ID -> category key.
   * Built from workflowStatuses (authoritative) + any categories already on local issues.
   */
  const statusCategoryMap = useMemo(() => {
    const map = new Map<string, CategoryKey>();
    for (const s of workflowStatuses ?? []) {
      map.set(s.id, s.statusCategory.key as CategoryKey);
    }
    for (const issue of localIssues) {
      if (issue.fields.status.statusCategory) {
        map.set(issue.fields.status.id, issue.fields.status.statusCategory.key as CategoryKey);
      }
    }
    return map;
  }, [workflowStatuses, localIssues]);

  function handleDragStart(event: DragStartEvent) {
    const issue = localIssues.find((i) => i.key === String(event.active.id));
    if (issue) {
      setActiveIssue(issue);
      setIsDragging(true);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setIsDragging(false);
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const issueKey = String(active.id);
    // Droppable ID: "{storyKey}|{categoryKey}"
    const targetCategory = String(over.id).split('|')[1] as CategoryKey;

    const originalIssue = localIssues.find((i) => i.key === issueKey);
    if (!originalIssue) return;
    if (categoryOf(originalIssue) === targetCategory) return;

    // Find a transition whose target status belongs to the dropped category
    const transitions = queryClient.getQueryData<JiraTransition[]>(['transitions', issueKey]);
    const transition = transitions?.find(
      (t) => (statusCategoryMap.get(t.to.id) ?? 'new') === targetCategory,
    );
    if (!transition) {
      setCardErrors((prev) => new Map(prev).set(issueKey, 'No valid transition'));
      return;
    }

    const targetStatusCategory = workflowStatuses?.find(
      (s) => s.id === transition.to.id,
    )?.statusCategory;

    // Optimistic update — move card into the target category column immediately
    setLocalIssues((prev) =>
      prev.map((i) =>
        i.key === issueKey
          ? {
              ...i,
              fields: {
                ...i.fields,
                status: {
                  id: transition.to.id,
                  name: transition.to.name,
                  statusCategory: (targetStatusCategory ?? { key: targetCategory }) as {
                    key: 'new' | 'indeterminate' | 'done';
                  },
                },
              },
            }
          : i,
      ),
    );
    setCardErrors((prev) => {
      const m = new Map(prev);
      m.delete(issueKey);
      return m;
    });

    try {
      await postTransition(jiraBaseUrl!, jiraToken!, issueKey, transition.id);
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
    } catch {
      // Rollback to original status
      setLocalIssues((prev) =>
        prev.map((i) =>
          i.key === issueKey
            ? { ...i, fields: { ...i.fields, status: originalIssue.fields.status } }
            : i,
        ),
      );
      setCardErrors((prev) => new Map(prev).set(issueKey, 'Transition failed'));
    }
  }

  /** Set of category keys reachable by the currently dragged card */
  const validTargetCategories = useMemo((): Set<CategoryKey> => {
    if (!activeIssue) return new Set();
    const transitions = queryClient.getQueryData<JiraTransition[]>([
      'transitions',
      activeIssue.key,
    ]);
    const cats = new Set<CategoryKey>();
    for (const t of transitions ?? []) {
      const cat = statusCategoryMap.get(t.to.id);
      if (cat) cats.add(cat);
    }
    return cats;
  }, [activeIssue, queryClient, statusCategoryMap]);

  const swimlanes = useMemo(() => {
    const stories = localIssues.filter((i) => !i.fields.issuetype.subtask);
    const subtasks = localIssues.filter((i) => i.fields.issuetype.subtask);
    const subtasksByParent = new Map<string, JiraIssue[]>();
    for (const sub of subtasks) {
      const pk = sub.fields.parent?.key;
      if (pk) subtasksByParent.set(pk, [...(subtasksByParent.get(pk) ?? []), sub]);
    }
    return stories.map((story) => ({
      story,
      subtasks: subtasksByParent.get(story.key) ?? [],
    }));
  }, [localIssues]);

  const { activeEpics, activeLabels, activeAssignees, activeStatuses, activeJiraQuickFilters, activeLabelFilters } = useFilterStore();

  const filterOptions = useMemo(() => {
    // Epics: all project epics (not just those on current sprint issues)
    const epics = new Map<string, string>();
    for (const e of epicsBasic ?? []) epics.set(e.key, e.epicName);
    // Also include any epic on current issues not yet in epicsBasic
    for (const issue of localIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      if (epicKey && !epics.has(epicKey)) epics.set(epicKey, epicNameMap.get(epicKey) ?? epicKey);
    }
    const labels = new Set<string>();
    const assignees = new Set<string>();
    for (const issue of localIssues) {
      for (const label of (issue.fields.labels as string[] | undefined) ?? []) labels.add(label);
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
    }
    // Statuses: all project workflow statuses (not just those on current issues)
    const statuses = new Set<string>();
    for (const s of workflowStatuses ?? []) statuses.add(s.name);
    // Also include any status on current issues not yet in workflowStatuses
    for (const issue of localIssues) {
      if (issue.fields.status?.name) statuses.add(issue.fields.status.name);
    }
    return {
      epics,
      labels: Array.from(labels),
      assignees: Array.from(assignees),
      statuses: Array.from(statuses).sort(),
    };
  }, [localIssues, epicLinkFieldKey, epicNameMap, epicsBasic, workflowStatuses]);

  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch =
        activeEpics.size === 0 ||
        (() => {
          const epicKey = issue.fields[epicLinkFieldKey] as string | null;
          return epicKey != null && activeEpics.has(epicKey);
        })();
      const labelMatch =
        activeLabels.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch =
        activeAssignees.size === 0 ||
        (() => {
          const name = issue.fields.assignee?.displayName ?? '';
          return Array.from(activeAssignees).some((q) =>
            name.toLowerCase().includes(q.toLowerCase()),
          );
        })();
      const statusMatch =
        activeStatuses.size === 0 ||
        (() => {
          const issueStatus = (issue.fields.status?.name ?? '').toLowerCase();
          return Array.from(activeStatuses).some((s) => s.toLowerCase() === issueStatus);
        })();
      // Jira board quick filter conditions (AND)
      const qfMatch =
        activeJiraQuickFilters.size === 0 ||
        (() => {
          for (const qfId of activeJiraQuickFilters) {
            const qf = (boardQuickFilters ?? []).find((q: JiraBoardQuickFilter) => q.id === qfId);
            if (qf) {
              const cond = parseSimpleJql(qf.jql);
              if (cond && !evaluateQfCondition(issue, cond)) return false;
            }
          }
          return true;
        })();

      // Label chip filters
      const labelChipMatch =
        activeLabelFilters.size === 0 ||
        ((issue.fields.labels as string[] | undefined) ?? []).some((l) =>
          activeLabelFilters.has(l),
        );

      return epicMatch && labelMatch && assigneeMatch && statusMatch && qfMatch && labelChipMatch;
    });
  }

  /** Parse simple JQL: "field = value" or "field != value" */
  function parseSimpleJql(jql: string): { field: string; op: string; value: string } | null {
    const match = jql.trim().match(/^(\w+)\s*(=|!=)\s*"?([^"]+)"?$/i);
    if (!match) return null;
    return { field: match[1].toLowerCase(), op: match[2], value: match[3] };
  }

  /** Evaluate a simple JQL condition against a Jira issue */
  function evaluateQfCondition(
    issue: JiraIssue,
    cond: { field: string; op: string; value: string },
  ): boolean {
    let fieldVal: string | undefined;
    switch (cond.field) {
      case 'issuetype':
        fieldVal = issue.fields.issuetype.name;
        break;
      case 'priority':
        fieldVal = (issue.fields as Record<string, unknown>).priority
          ? ((issue.fields as Record<string, unknown>).priority as { name?: string })?.name
          : undefined;
        break;
      case 'assignee':
        fieldVal = issue.fields.assignee?.displayName;
        break;
      case 'status':
        fieldVal = issue.fields.status.name;
        break;
      default:
        return true; // unknown field = pass through
    }
    if (!fieldVal) return cond.op === '!=';
    const isMatch = fieldVal.toLowerCase() === cond.value.toLowerCase();
    return cond.op === '=' ? isMatch : !isMatch;
  }

  const filteredSwimlanes = useMemo(() => {
    if (
      activeEpics.size === 0 &&
      activeLabels.size === 0 &&
      activeAssignees.size === 0 &&
      activeStatuses.size === 0 &&
      activeJiraQuickFilters.size === 0 &&
      activeLabelFilters.size === 0
    )
      return swimlanes;
    return swimlanes
      .map(({ story, subtasks }) => {
        // Filter both story and subtasks — keep swimlane if either matches
        const storyMatches = applyFilters([story]).length > 0;
        const filteredSubtasks = applyFilters(subtasks);
        if (!storyMatches && filteredSubtasks.length === 0) return null;
        return { story, subtasks: filteredSubtasks };
      })
      .filter((s): s is { story: JiraIssue; subtasks: JiraIssue[] } => s !== null);
  }, [swimlanes, activeEpics, activeLabels, activeAssignees, activeStatuses, activeJiraQuickFilters, activeLabelFilters, applyFilters]);

  const lastRefreshed = dataUpdatedAt
    ? `Refreshed: ${new Date(dataUpdatedAt).toLocaleTimeString()}`
    : 'Refreshed: Never';

  return (
    <>
      {/*
       * No overflow container here — <main className="flex-1 overflow-auto"> in AppLayout
       * is the scroll container. Sticky elements below reference that ancestor.
       */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => {
          setActiveIssue(null);
          setIsDragging(false);
        }}
      >
        <div ref={boardRef}>
          {/*
           * Sticky top bar: column headers + refresh button.
           * h-10 = 40px. Story headers use top-10 to sit directly below this.
           * Sticks relative to <main> — no inner overflow container.
           */}
          <div className="sticky top-0 z-20 bg-background border-b border-border relative h-10">
            <div className="flex h-full">
              {CATEGORY_COLUMNS.map((col) => {
                const count = localIssues.filter(
                  (i) => i.fields.issuetype.subtask && categoryOf(i) === col.key,
                ).length;
                return (
                  <div
                    key={col.key}
                    className="flex-1 px-3 flex items-center gap-1.5 border-l border-border/20 first:border-l-0"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {col.label}
                    </span>
                    <span className="text-xs text-muted-foreground/70">({count})</span>
                  </div>
                );
              })}
            </div>
            {/* Refresh positioned absolutely so it doesn't affect column width distribution */}
            <div className="absolute right-0 top-0 h-full px-3 flex items-center gap-2 bg-background border-l border-border/20">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {lastRefreshed}
              </span>
              <button
                type="button"
                onClick={() => refetch()}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Refresh"
              >
                <RefreshCw className="size-3" />
              </button>
            </div>
          </div>

          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-4 flex flex-col gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <div className="h-9 rounded bg-muted animate-pulse" />
                  <div className="flex">
                    {CATEGORY_COLUMNS.map((col) => (
                      <div key={col.key} className="flex-1 h-20 bg-muted/50 animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error state — no cached data */}
          {isError && !data && (
            <div className="m-4">
              <ErrorState error={error} onRetry={refetch} viewName="sprint board" />
            </div>
          )}

          {/* Stale data banner — error with cached data */}
          {isError && data && !bannerDismissed && (
            <div className="m-4">
              <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
            </div>
          )}

          {/* Sprint goal banner */}
          {!isLoading && !isError && data && activeSprint?.goal && (
            <SprintGoalBanner goal={activeSprint.goal} />
          )}

          {/* Quick filter chip row */}
          {!isLoading && !isError && data && (
            <QuickFilterChipRow
              quickFilters={boardQuickFilters ?? []}
              labels={filterOptions.labels}
              issues={localIssues}
            />
          )}

          {/* Unified filter bar */}
          {!isLoading && !isError && data && <UnifiedFilterBar filterOptions={filterOptions} />}

          {/* Empty */}
          {!isLoading && !isError && data && swimlanes.length === 0 && (
            <EmptyState
              icon={Columns3}
              title="No sprint issues"
              subtitle="This board will populate when issues are added to the active sprint"
            />
          )}

          {/* Virtualized swimlane rows */}
          {!isLoading && !isError && data && filteredSwimlanes.length > 0 && (
            <VirtualizedSwimlanes
              filteredSwimlanes={filteredSwimlanes}
              scrollElement={scrollElement}
              collapsedStories={collapsedStories}
              toggleStory={toggleStory}
              setSelectedIssueKey={setSelectedIssueKey}
              activeIssue={activeIssue}
              validTargetCategories={validTargetCategories}
              cardErrors={cardErrors}
            />
          )}
        </div>

        {/* DragOverlay renders OUTSIDE the virtualized container */}
        <DragOverlay>{activeIssue ? <TaskCard issue={activeIssue} /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}
