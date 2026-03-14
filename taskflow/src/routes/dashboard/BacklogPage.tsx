/**
 * BacklogPage — Full-page backlog route component.
 *
 * Fetches all backlog issues via fetchBacklogIssues and active sprint via fetchActiveSprint.
 * Manages client-side filter state (epic, label, assignee) with AND logic.
 * Manages checkbox selection state for bulk "Move to sprint" action.
 * Renders BacklogFilterBar and a table of BacklogRow components.
 *
 * IssueDetailSheet is NOT nested here — row clicks call onIssueClick from outlet context.
 * openCreateStory from outlet context opens the CreateEditIssueModal (added in Plan 03).
 */
import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import type { JiraIssue, JiraActiveSprint } from '@/services/jira';
import { fetchBacklogIssues, fetchActiveSprint, addIssuesToSprint } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { BacklogRow } from './BacklogRow';
import { BacklogFilterBar } from './BacklogFilterBar';

// ── Component ─────────────────────────────────────────────────────────────────

export default function BacklogPage() {
  const { onIssueClick, openCreateStory } = useOutletContext<{
    onIssueClick: (key: string) => void;
    openCreateStory?: () => void;
  }>();

  // ── Auth / settings ─────────────────────────────────────────────────────────
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { storyPointsFieldKey, epicLinkFieldKey, epicNameFieldKey } = useSettingsStore();

  const [jiraToken, setJiraToken] = useState<string | null>(null);

  useEffect(() => {
    readSecret('jira-pat').then(setJiraToken).catch(() => setJiraToken(null));
  }, []);

  // ── Queries ─────────────────────────────────────────────────────────────────

  const {
    data: issues,
    isLoading,
  } = useQuery<JiraIssue[]>({
    queryKey: ['jira-backlog', activeJiraProject, jiraBaseUrl],
    queryFn: () =>
      fetchBacklogIssues(
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

  // ── Filter state ─────────────────────────────────────────────────────────────

  const [activeEpic, setActiveEpic] = useState<string | null>(null);
  const [activeLabels, setActiveLabels] = useState<Set<string>>(new Set());
  const [activeAssignee, setActiveAssignee] = useState<string | null>(null);

  // ── Selection state ──────────────────────────────────────────────────────────

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // ── Move-to-sprint state ─────────────────────────────────────────────────────

  const [moveError, setMoveError] = useState<string | null>(null);
  // Optimistic removal: track which keys have been moved (hidden from list)
  const [movedKeys, setMovedKeys] = useState<Set<string>>(new Set());

  // ── Filter options (derived from raw issues) ─────────────────────────────────

  const filterOptions = useMemo(() => {
    const epics = new Map<string, string>(); // epicKey → epicName
    const labels = new Set<string>();
    const assignees = new Set<string>();
    for (const issue of issues ?? []) {
      const epicKey = issue.fields[epicLinkFieldKey] as string | null;
      const epicName = issue.fields[epicNameFieldKey] as string | null;
      if (epicKey) epics.set(epicKey, epicName ?? epicKey); // fall back to key if no name
      for (const label of (issue.fields.labels as string[] | undefined) ?? []) {
        labels.add(label);
      }
      if (issue.fields.assignee?.displayName) assignees.add(issue.fields.assignee.displayName);
    }
    return { epics, labels: Array.from(labels), assignees: Array.from(assignees) };
  }, [issues, epicLinkFieldKey, epicNameFieldKey]);

  // ── Visible issues (client-side filtering) ───────────────────────────────────

  const visibleIssues = useMemo(() => {
    if (!issues) return [];
    return issues.filter((issue) => {
      // Hide optimistically moved issues
      if (movedKeys.has(issue.key)) return false;

      const epicMatch =
        !activeEpic ||
        (issue.fields[epicLinkFieldKey] as string | null) === activeEpic;
      const labelMatch =
        activeLabels.size === 0 ||
        (issue.fields.labels as string[] | undefined ?? []).some((l) => activeLabels.has(l));
      const assigneeMatch =
        !activeAssignee || issue.fields.assignee?.displayName === activeAssignee;
      return epicMatch && labelMatch && assigneeMatch;
    });
  }, [issues, activeEpic, activeLabels, activeAssignee, epicLinkFieldKey, movedKeys]);

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
    if (!activeSprint) return;
    const keysToMove = Array.from(selectedKeys);
    // Optimistic removal
    setMovedKeys((prev) => {
      const next = new Set(prev);
      for (const k of keysToMove) next.add(k);
      return next;
    });
    setSelectedKeys(new Set());
    setMoveError(null);
    try {
      await addIssuesToSprint(jiraBaseUrl!, jiraToken!, activeSprint.id, keysToMove);
    } catch (err) {
      // Rollback on failure
      setMovedKeys((prev) => {
        const next = new Set(prev);
        for (const k of keysToMove) next.delete(k);
        return next;
      });
      setMoveError(err instanceof Error ? err.message : 'Failed to add issues to sprint');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-auto" data-testid="backlog-page">
      {/* Page header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0">
        <h1 className="text-lg font-semibold">Backlog</h1>
        <button
          type="button"
          onClick={() => openCreateStory?.()}
          className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
        >
          + Create Story
        </button>
      </div>

      {/* Error message */}
      {moveError && (
        <div className="px-4 py-2 text-sm text-destructive bg-destructive/10 border-b border-destructive/20">
          {moveError}
        </div>
      )}

      {/* Filter bar */}
      <BacklogFilterBar
        filterOptions={filterOptions}
        activeEpic={activeEpic}
        activeLabels={activeLabels}
        activeAssignee={activeAssignee}
        onEpicChange={setActiveEpic}
        onLabelsChange={setActiveLabels}
        onAssigneeChange={setActiveAssignee}
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
        ) : visibleIssues.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-base font-medium text-foreground">No backlog issues</p>
            <p className="mt-1 text-sm text-muted-foreground">
              All stories are assigned to a sprint
            </p>
          </div>
        ) : (
          /* Issue table */
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/20">
              <tr>
                <th className="w-8 px-3 py-2" />
                <th className="w-24 px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  Key
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
                <th className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  Epic
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleIssues.map((issue) => (
                <BacklogRow
                  key={issue.key}
                  issue={issue}
                  selected={selectedKeys.has(issue.key)}
                  onSelect={handleSelect}
                  onIssueClick={onIssueClick}
                  storyPointsFieldKey={storyPointsFieldKey}
                  epicLinkFieldKey={epicLinkFieldKey}
                  epicNameFieldKey={epicNameFieldKey}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk action bar — only shown when issues are selected */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-background border-t p-3 flex items-center gap-4">
          <span>
            {selectedKeys.size} issue{selectedKeys.size !== 1 ? 's' : ''} selected
          </span>
          <button
            type="button"
            onClick={handleMoveToSprint}
            disabled={!activeSprint}
            title={!activeSprint ? 'No active sprint in this project' : undefined}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Move {selectedKeys.size} issue{selectedKeys.size !== 1 ? 's' : ''} to active sprint
          </button>
          <button
            type="button"
            onClick={() => setSelectedKeys(new Set())}
            className="rounded border border-border bg-background px-3 py-1.5 text-sm hover:bg-accent transition-colors"
          >
            Deselect all
          </button>
        </div>
      )}
    </div>
  );
}
