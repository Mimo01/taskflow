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
 * Bulk "Move to sprint" action bar and handleMoveToSprint remain unchanged.
 * Create story entry point via Outlet context remains unchanged.
 */

import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Inbox } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { UnifiedFilterBar } from '@/components/UnifiedFilterBar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { StaleDataBanner } from '@/components/ui/stale-data-banner';
import { useListNavigation } from '@/hooks/useListNavigation';
import type { BacklogViewData, JiraActiveSprint, JiraIssue } from '@/services/jira';
import {
  addIssuesToSprint,
  fetchActiveSprint,
  fetchBacklogView,
  fetchEpicsBasic,
  fetchProjectStatuses,
  fetchSprintIssues,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useFilterStore } from '@/stores/filter.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BacklogRow } from './BacklogRow';

// ── Virtualized table body ────────────────────────────────────────────────────

function VirtualizedBacklogTable({
  filteredIssues,
  scrollElement,
  selectedKeys,
  onSelect,
  onIssueClick,
  storyPointsFieldKey,
  epicLinkFieldKey,
  epicNameFieldKey,
  epicNames,
  epicColors,
  visibleIssueKeys,
  focusIndex,
  rowRefs,
}: {
  filteredIssues: JiraIssue[];
  scrollElement: HTMLDivElement | null;
  selectedKeys: Set<string>;
  onSelect: (key: string, selected: boolean) => void;
  onIssueClick: (key: string) => void;
  storyPointsFieldKey: string;
  epicLinkFieldKey: string;
  epicNameFieldKey: string;
  epicNames?: Map<string, string>;
  epicColors?: Map<string, string>;
  visibleIssueKeys: string[];
  focusIndex: number;
  rowRefs: React.MutableRefObject<Map<string, HTMLTableRowElement>>;
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
        selected={selectedKeys.has(issue.key)}
        onSelect={onSelect}
        onIssueClick={onIssueClick}
        storyPointsFieldKey={storyPointsFieldKey}
        epicLinkFieldKey={epicLinkFieldKey}
        epicNameFieldKey={epicNameFieldKey}
        epicNames={epicNames}
        epicColors={epicColors}
        isFocused={visibleIssueKeys[focusIndex] === issue.key}
      />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead className="border-b bg-muted/10">
        <tr>
          <th className="w-8 px-3 py-2" />
          <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            Key
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">
            Epic
          </th>
          <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
            Summary
          </th>
          <th className="w-14 px-2 py-2 text-right text-xs font-medium text-muted-foreground">
            Points
          </th>
          <th className="w-10 px-2 py-2 text-xs font-medium text-muted-foreground">
            Assignee
          </th>
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

  const {
    data: backlogView,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<BacklogViewData>({
    queryKey: ['jira-backlog-view', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchBacklogView(
        jiraBaseUrl!,
        jiraToken!,
        activeJiraProject!,
        storyPointsFieldKey,
        epicLinkFieldKey,
        epicNameFieldKey,
        epicColorFieldKey,
      ),
    staleTime: 60_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  const { data: activeSprint } = useQuery<JiraActiveSprint | null>({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl],
    queryFn: () => fetchActiveSprint(jiraBaseUrl!, jiraToken!, activeJiraProject!),
    staleTime: 5 * 60_000,
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

  // Sprint issues (shared cache with SprintBoardTab) — includes subtasks as
  // separate issues with their own status. Used to build parentKey → subtask
  // statuses map for status filtering.
  const { data: sprintIssues } = useQuery({
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
    staleTime: 30_000,
    enabled: !!activeJiraProject && !!jiraBaseUrl && !!jiraToken,
  });

  // Map parentKey → Set of subtask status names (from sprint board data)
  const subtaskStatusMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const issue of sprintIssues ?? []) {
      if (issue.fields.issuetype.subtask && issue.fields.parent?.key) {
        const parentKey = issue.fields.parent.key;
        if (!map.has(parentKey)) map.set(parentKey, new Set());
        map.get(parentKey)?.add(issue.fields.status.name);
      }
    }
    return map;
  }, [sprintIssues]);

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

  // ── Selection state ──────────────────────────────────────────────────────────

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── Move-to-sprint state ─────────────────────────────────────────────────────

  const [bulkError, setBulkError] = useState<string | null>(null);

  // ── All issues combined (for filter options) ─────────────────────────────────
  // Merge backlog view issues with sprint board parent stories.
  // The Agile board API may exclude some stories (board-level JQL filter),
  // but fetchSprintIssues (REST API) returns all. Merge to ensure all sprint
  // stories are available for filtering.

  // Merge sprint board stories into backlog sprint sections.
  // The Agile board API may exclude stories (board-level filter), but
  // fetchSprintIssues (REST API) returns all. Merge missing stories into
  // the active sprint section so they're visible and filterable.
  const mergedSprints = useMemo(() => {
    if (!backlogView) return [];
    const existingKeys = new Set(backlogView.sprints.flatMap((s) => s.issues.map((i) => i.key)));
    const extraStories = (sprintIssues ?? []).filter(
      (i) => !i.fields.issuetype.subtask && !existingKeys.has(i.key),
    );
    if (extraStories.length === 0) return backlogView.sprints;
    // Add extra stories to the active sprint (or first sprint if none active)
    return backlogView.sprints.map(({ sprint, issues }) => {
      if (sprint.state === 'active') {
        return { sprint, issues: [...issues, ...extraStories] };
      }
      return { sprint, issues };
    });
  }, [backlogView, sprintIssues]);

  const allIssues = useMemo<JiraIssue[]>(() => {
    const sprintIssuesList = mergedSprints.flatMap((s) => s.issues);
    const backlogList = backlogView?.backlog ?? [];
    return [...sprintIssuesList, ...backlogList];
  }, [mergedSprints, backlogView?.backlog]);

  // ── Filter options (derived from all issues across all sections) ──────────────

  const filterOptions = useMemo(() => {
    const epicNames = backlogView?.epicNames ?? new Map<string, string>();
    // Epics: all project epics (not just those on current backlog issues)
    const epics = new Map<string, string>();
    for (const e of allEpics ?? []) epics.set(e.key, e.epicName);
    // Also include any epic on current issues not yet in allEpics
    for (const issue of allIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      if (epicKey && !epics.has(epicKey)) epics.set(epicKey, epicNames.get(epicKey) ?? epicKey);
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
    // Also include subtask statuses from sprint board data
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
    backlogView?.epicNames,
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
        // Match on subtask statuses from sprint board data
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
    if (!backlogView) return [];
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
      const filtered = applyFilters(backlogView.backlog);
      for (const issue of filtered) {
        keys.push(issue.key);
      }
    }
    return keys;
  }, [backlogView, collapsedSections, applyFilters, mergedSprints]);

  const { focusIndex } = useListNavigation({
    itemCount: visibleIssueKeys.length,
    onSelect: (index) => onIssueClick(visibleIssueKeys[index]),
    enabled: !isLoading && visibleIssueKeys.length > 0,
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

  function handleSelect(key: string, isSelected: boolean) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (isSelected) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  async function handleMoveToSprint() {
    if (!activeSprint || selectedKeys.size === 0) return;
    const keysToMove = Array.from(selectedKeys);
    // Optimistic removal from cache
    const previousView = queryClient.getQueryData<BacklogViewData>([
      'jira-backlog-view',
      activeJiraProject,
      jiraBaseUrl,
    ]);
    queryClient.setQueryData<BacklogViewData>(
      ['jira-backlog-view', activeJiraProject, jiraBaseUrl],
      (old) => {
        if (!old) return old;
        return {
          ...old,
          sprints: old.sprints.map((s) => ({
            ...s,
            issues: s.issues.filter((i) => !selectedKeys.has(i.key)),
          })),
          backlog: old.backlog.filter((i) => !selectedKeys.has(i.key)),
        };
      },
    );
    setSelectedKeys(new Set());
    setBulkError(null);
    try {
      await addIssuesToSprint(jiraBaseUrl!, jiraToken!, activeSprint.id, keysToMove);
      queryClient.invalidateQueries({ queryKey: ['jira-issues', 'sprint-board'] });
      queryClient.invalidateQueries({ queryKey: ['jira-backlog-view'] });
    } catch (err) {
      // Rollback on failure
      queryClient.setQueryData(['jira-backlog-view', activeJiraProject, jiraBaseUrl], previousView);
      setSelectedKeys(new Set(keysToMove));
      setBulkError(err instanceof Error ? err.message : 'Failed to add issues to sprint');
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
            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
          </span>
        </button>

        {/* Section body */}
        {!isCollapsed && (
          <div>
            {filteredIssues.length > 0 ? (
              <VirtualizedBacklogTable
                filteredIssues={filteredIssues}
                scrollElement={scrollRef.current}
                selectedKeys={selectedKeys}
                onSelect={handleSelect}
                onIssueClick={onIssueClick}
                storyPointsFieldKey={storyPointsFieldKey}
                epicLinkFieldKey={epicLinkFieldKey}
                epicNameFieldKey={epicNameFieldKey}
                epicNames={backlogView?.epicNames}
                epicColors={backlogView?.epicColors}
                visibleIssueKeys={visibleIssueKeys}
                focusIndex={focusIndex}
                rowRefs={rowRefs}
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
            {showCreateStory && (
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

      {/* Main content */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {/* Filter bar — scrolls with content */}
        <UnifiedFilterBar filterOptions={filterOptions} />
        {/* Error state — no cached data */}
        {isError && !backlogView && (
          <div className="p-4">
            <ErrorState error={error} onRetry={refetch} viewName="backlog" />
          </div>
        )}

        {/* Stale data banner — error with cached data */}
        {isError && backlogView && !bannerDismissed && (
          <div className="px-4 pt-4">
            <StaleDataBanner onRetry={refetch} onDismiss={() => setBannerDismissed(true)} />
          </div>
        )}

        {isLoading ? (
          /* Skeleton loading state */
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !isError &&
          (!backlogView ||
            (backlogView.sprints.length === 0 && backlogView.backlog.length === 0)) ? (
          /* Empty state */
          <EmptyState
            icon={Inbox}
            title="Backlog is empty"
            subtitle="All issues are assigned to sprints"
            action={<Button onClick={() => openCreateStory()}>Create Issue</Button>}
          />
        ) : backlogView ? (
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
              ),
            )}

            {/* Backlog section — always last */}
            {renderSection('backlog', 'Backlog', null, backlogView.backlog, true)}
          </div>
        ) : null}
      </div>

      {/* Bulk action bar — only shown when issues are selected */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t shadow-lg p-3 flex items-center gap-4">
          <span className="text-sm font-medium">
            {selectedKeys.size} issue{selectedKeys.size !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!activeSprint || selectedKeys.size === 0}
            title={!activeSprint ? 'No active sprint in this project' : undefined}
            onClick={handleMoveToSprint}
          >
            Move to sprint
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedKeys(new Set())}
          >
            Deselect all
          </button>
          {bulkError && <span className="text-sm text-destructive ml-auto">{bulkError}</span>}
        </div>
      )}
    </div>
  );
}
