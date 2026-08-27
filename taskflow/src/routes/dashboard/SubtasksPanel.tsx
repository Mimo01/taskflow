/**
 * SubtasksPanel — DASH-01
 *
 * Shows up to 5 subtasks assigned to the current user in the current sprint.
 * Orphan subtasks (whose parent is not in the sprint board) are hidden.
 * Clicking a row opens the Jira issue in the system browser.
 */
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { LinkContextMenu } from '@/components/ui/link-context-menu';
import { openExternal } from '@/lib/openExternal';
import { fetchMyTasksHierarchy, fetchSprintIssues } from '@/services/jira';
import { useSettingsStore } from '@/stores/settings.store';

async function openJiraIssue(jiraBaseUrl: string, issueKey: string) {
  const url = `${jiraBaseUrl.replace(/\/$/, '')}/browse/${issueKey}`;
  // openExternal already tries the selected browser then the OS default and
  // never rejects — this final `window.open` rung only fires when even the
  // default-browser attempt fails, via the onFallbackFailed callback.
  await openExternal(url, () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  });
}

interface SubtasksPanelProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  /** Called with issue key when a subtask row is clicked. When provided,
   *  opens the IssueDetailSheet instead of the browser. */
  onIssueClick?: (issueKey: string) => void;
}

export default function SubtasksPanel({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  onIssueClick,
}: SubtasksPanelProps) {
  const { storyPointsFieldKey } = useSettingsStore();

  const enabled = !!jiraBaseUrl && !!activeJiraProject && !!jiraToken;

  const { data: taskData, isLoading: isLoadingTasks } = useQuery({
    queryKey: ['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchMyTasksHierarchy(jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey),
    staleTime: 30_000,
    enabled,
  });

  // Sprint board data — used to build the set of sprint issue keys for orphan detection
  const { data: sprintData, isLoading: isLoadingSprint } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled,
  });

  const isLoading = isLoadingTasks || isLoadingSprint;

  // Build sprint issue key set for orphan detection.
  // fetchSprintIssues returns JiraIssue[] directly (not { issues: JiraIssue[] }).
  const sprintKeySet = new Set((Array.isArray(sprintData) ? sprintData : []).map((i) => i.key));

  // Filter to: my subtasks whose parent is in the current sprint
  const mySubtasks = (taskData?.issues ?? []).filter(
    (i) =>
      i.fields.issuetype.subtask === true &&
      taskData?.myIssueKeys.has(i.key) &&
      i.fields.parent?.key &&
      sprintKeySet.has(i.fields.parent.key),
  );

  const displayed = mySubtasks.slice(0, 5);

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px] density-compact:min-h-[120px] density-comfortable:min-h-[184px]">
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
            <LinkContextMenu
              key={issue.key}
              href={`${jiraBaseUrl.replace(/\/$/, '')}/browse/${issue.key}`}
            >
              <button
                type="button"
                onClick={() =>
                  onIssueClick ? onIssueClick(issue.key) : openJiraIssue(jiraBaseUrl, issue.key)
                }
                className="w-full text-left flex items-center gap-2 py-1.5 density-compact:py-1 density-comfortable:py-2.5 hover:bg-muted/50 rounded px-1 cursor-pointer"
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
            </LinkContextMenu>
          ))}
        </div>
      )}
    </div>
  );
}
