/**
 * SubtasksPanel — DASH-01
 *
 * Shows up to 5 subtasks assigned to the current user in the current sprint.
 * Orphan subtasks (whose parent is not in the sprint board) are hidden.
 * Clicking a row opens the Jira issue in the system browser.
 *
 * Shares the 'jira-issues' cache with MyTasksTab (same query keys) so the
 * panel benefits from background polling without issuing redundant requests.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useSettingsStore } from '@/stores/settings.store';
import { fetchMyTasksHierarchy, fetchSprintIssues } from '@/services/jira';
import { Badge } from '@/components/ui/badge';

interface SubtasksPanelProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
}

export default function SubtasksPanel({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
}: SubtasksPanelProps) {
  const { storyPointsFieldKey } = useSettingsStore();

  const enabled = !!jiraBaseUrl && !!activeJiraProject && !!jiraToken;

  // Shared cache with MyTasksTab — same query key, same queryFn
  const { data: taskData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchMyTasksHierarchy(jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey),
    staleTime: 30_000,
    enabled,
  });

  // Sprint board data — used to build the set of sprint issue keys for orphan detection
  const { data: sprintData, isLoading: isLoadingSprint } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () => fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled,
  });

  const isLoading = isLoadingTasks || isLoadingSprint;

  // Build sprint issue key set for orphan detection
  const sprintKeySet = new Set((sprintData ?? []).map((i: { key: string }) => i.key));

  // Filter to: my subtasks whose parent is in the current sprint
  const mySubtasks = (taskData?.issues ?? []).filter(
    (i) =>
      i.fields.issuetype.subtask === true &&
      taskData!.myIssueKeys.has(i.key) &&
      i.fields.parent?.key &&
      sprintKeySet.has(i.fields.parent.key),
  );

  const displayed = mySubtasks.slice(0, 5);
  const hasMore = mySubtasks.length > 5;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        My Subtasks
      </h2>

      {/* Loading skeleton */}
      {isLoading && (
        <div className="flex flex-col gap-2 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-7 rounded bg-muted" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && displayed.length === 0 && (
        <p className="text-sm text-muted-foreground">No open subtasks in the current sprint</p>
      )}

      {/* Subtask rows */}
      {!isLoading && displayed.length > 0 && (
        <div className="flex flex-col">
          {displayed.map((issue) => (
            <button
              key={issue.key}
              type="button"
              onClick={() => window.open(jiraBaseUrl + '/browse/' + issue.key, '_blank')}
              className="w-full text-left flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-1"
            >
              <span className="font-mono text-xs text-muted-foreground w-20 flex-shrink-0">
                {issue.key}
              </span>
              <span className="flex-1 truncate text-sm">{issue.fields.summary}</span>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {issue.fields.status.name}
              </Badge>
              <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                ‹ {issue.fields.parent?.fields.summary}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* View all link */}
      {hasMore && (
        <Link to="/my-tasks" className="text-xs text-muted-foreground hover:underline mt-1">
          View all in My Tasks
        </Link>
      )}
    </div>
  );
}
