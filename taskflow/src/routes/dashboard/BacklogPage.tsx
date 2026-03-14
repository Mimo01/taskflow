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
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { JiraIssue, JiraActiveSprint, BacklogViewData } from '@/services/jira';
import { fetchBacklogView, fetchActiveSprint, addIssuesToSprint } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BacklogRow } from './BacklogRow';
import { BacklogFilterBar } from './BacklogFilterBar';

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
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey } = useSettingsStore();

  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const {
    data: backlogView,
    isLoading,
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

  // ── Filter state ─────────────────────────────────────────────────────────────

  const [activeEpics, setActiveEpics] = useState<Set<string>>(new Set());
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const [activeAssignees, setActiveAssignees] = useState<Set<string>>(new Set());

  // ── Selection state ──────────────────────────────────────────────────────────

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── Move-to-sprint state ─────────────────────────────────────────────────────

  const [bulkError, setBulkError] = useState<string | null>(null);

  // ── All issues combined (for filter options) ─────────────────────────────────

  const allIssues = useMemo<JiraIssue[]>(() => {
    if (!backlogView) return [];
    const sprintIssues = backlogView.sprints.flatMap((s) => s.issues);
    return [...sprintIssues, ...backlogView.backlog];
  }, [backlogView]);

  // ── Filter options (derived from all issues across all sections) ──────────────

  const filterOptions = useMemo(() => {
    // Epic names come from the batch-fetched epicNames map (actual epic summaries).
    // Fall back to epicKey only when the epic issue wasn't found.
    const epicNames = backlogView?.epicNames ?? new Map<string, string>();
    const epics = new Map<string, string>(); // epicKey → display name
    const labels = new Set<string>();
    const assignees = new Set<string>();
    for (const issue of allIssues) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      if (epicKey) epics.set(epicKey, epicNames.get(epicKey) ?? epicKey);
      for (const label of (issue.fields.labels as string[] | undefined) ?? []) {
        labels.add(label);
      }
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
    }
    return { epics, labels: Array.from(labels), assignees: Array.from(assignees) };
  }, [allIssues, epicLinkFieldKey, backlogView?.epicNames]);

  // ── Filter application helper ─────────────────────────────────────────────────

  function applyFilters(issues: JiraIssue[]): JiraIssue[] {
    return issues.filter((issue) => {
      const epicMatch = (() => {
        if (activeEpics.size === 0) return true;
        const epicKey = issue.fields[epicLinkFieldKey] as string | null;
        const epicName = filterOptions.epics.get(epicKey ?? '') ?? epicKey ?? '';
        return Array.from(activeEpics).some((q) =>
          epicName.toLowerCase().includes(q.toLowerCase()),
        );
      })();
      const labelMatch =
        activeLabels.size === 0 ||
        (issue.fields.labels as string[] | undefined ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch = (() => {
        if (activeAssignees.size === 0) return true;
        const name = issue.fields.assignee?.displayName ?? '';
        return Array.from(activeAssignees).some((q) =>
          name.toLowerCase().includes(q.toLowerCase()),
        );
      })();
      return epicMatch && labelMatch && assigneeMatch;
    });
  }

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
    const previousView = queryClient.getQueryData<BacklogViewData>(['jira-backlog-view', activeJiraProject, jiraBaseUrl]);
    queryClient.setQueryData<BacklogViewData>(
      ['jira-backlog-view', activeJiraProject, jiraBaseUrl],
      (old) => {
        if (!old) return old;
        return {
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
  ) {
    const isCollapsed = collapsedSections.has(sectionId);
    const filteredIssues = applyFilters(issues);

    return (
      <div key={sectionId} className="mb-2" data-testid={`sprint-section-${sectionId}`}>
        {/* Section header */}
        <button
          type="button"
          onClick={() => toggleSection(sectionId)}
          className="flex items-center gap-2 w-full px-4 py-2 bg-muted/40 hover:bg-muted/60 border-b border-border transition-colors text-left"
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
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/10">
                  <tr>
                    <th className="w-8 px-3 py-2" />
                    <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                      Key
                    </th>
                    <th className="w-32 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
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
                <tbody>
                  {filteredIssues.map((issue) => (
                    <BacklogRow
                      key={issue.key}
                      issue={issue}
                      selected={selectedKeys.has(issue.key)}
                      onSelect={handleSelect}
                      onIssueClick={onIssueClick}
                      storyPointsFieldKey={storyPointsFieldKey}
                      epicLinkFieldKey={epicLinkFieldKey}
                      epicNameFieldKey={epicNameFieldKey}
                      epicNames={backlogView?.epicNames}
                    />
                  ))}
                </tbody>
              </table>
            ) : issues.length > 0 ? (
              /* All issues filtered out */
              <p className="px-4 py-3 text-sm text-muted-foreground">
                No issues match the current filters
              </p>
            ) : null}

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

      {/* Filter bar */}
      <BacklogFilterBar
        filterOptions={filterOptions}
        activeEpics={activeEpics}
        activeLabels={activeLabels}
        activeAssignees={activeAssignees}
        onEpicsChange={setActiveEpics}
        onLabelsChange={setActiveLabels}
        onAssigneesChange={setActiveAssignees}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          /* Skeleton loading state */
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : !backlogView ||
          (backlogView.sprints.length === 0 && backlogView.backlog.length === 0) ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-base font-medium text-foreground">No backlog issues</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All stories are assigned to a sprint
            </p>
          </div>
        ) : (
          /* Sprint sections + backlog section */
          <div>
            {/* Sprint sections (active first, then future) */}
            {backlogView.sprints.map(({ sprint, issues }) =>
              renderSection(
                `sprint-${sprint.id}`,
                sprint.name,
                sprint.state === 'active' ? 'Active' : 'Future',
                issues,
                false,
              ),
            )}

            {/* Backlog section — always last */}
            {renderSection(
              'backlog',
              'Backlog',
              null,
              backlogView.backlog,
              true,
            )}
          </div>
        )}
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
