/**
 * DashboardInProgressCard — DASH-03
 *
 * Shows the current user's in-progress sprint subtasks at a glance:
 * - Filters client-side for subtask + indeterminate status + assignee.displayName match
 * - Displays up to 3 rows with click-through to /issue/:key
 * - Shows "and N more" overflow caption (plain text, not a link)
 * - Shows "No subtasks in progress — nice work!" when no matches
 *
 * Shares the sprint-board TanStack Query cache key with SprintBoardTab,
 * DashboardSprintCard, and SprintHealthPanel — no extra API call when warm.
 *
 * D-16: receives all auth values as props; never calls readSecret or useAuthStore.
 * D-08: uses displayName comparison (Option B) — no type cast.
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import type { JiraIssue } from '@/services/jira';
import { fetchSprintIssues } from '@/services/jira';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';

export interface DashboardInProgressCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  jiraUserDisplayName: string;
  storyPointsFieldKey: string;
  onIssueClick: (key: string) => void;
}

export default function DashboardInProgressCard({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  jiraUserDisplayName,
  storyPointsFieldKey,
  onIssueClick,
}: DashboardInProgressCardProps) {
  // CACHE KEY MUST MATCH DashboardSprintCard / SprintHealthPanel / SprintBoardTab exactly
  const { data: sprintIssuesRaw, isLoading } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Normalise: fetchSprintIssues returns JiraIssue[] directly
  const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];

  // D-08 Option B — displayName comparison; no type cast needed
  const myInProgressSubtasks = sprintIssues.filter(
    (issue) =>
      issue.fields.issuetype.subtask &&
      issue.fields.status.statusCategory?.key === 'indeterminate' &&
      issue.fields.assignee?.displayName === jiraUserDisplayName,
  );

  // Cap at 3 displayed rows; track overflow count (D-12)
  const displayed = myInProgressSubtasks.slice(0, 3);
  const overflow = myInProgressSubtasks.length - displayed.length;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="size-4 text-green-500" aria-hidden />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">My In Progress</span>
      </div>

      {/* Loading skeleton — 3-block pattern matching DashboardSprintCard */}
      {showSkeleton && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Subtask rows */}
      {!showSkeleton && displayed.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {displayed.map((issue) => (
            <button
              type="button"
              key={issue.key}
              className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => onIssueClick(issue.key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onIssueClick(issue.key);
              }}
            >
              <span className="text-xs text-muted-foreground font-mono shrink-0">{issue.key}</span>
              <span className="text-sm truncate">{issue.fields.summary}</span>
            </button>
          ))}

          {/* Overflow caption — plain text, not a link or button (D-12) */}
          {overflow > 0 && (
            <p className="text-xs text-muted-foreground px-2">and {overflow} more</p>
          )}
        </div>
      )}

      {/* Empty state (D-11) */}
      {!showSkeleton && myInProgressSubtasks.length === 0 && (
        <p className="text-sm text-muted-foreground">No subtasks in progress — nice work!</p>
      )}
    </div>
  );
}
