/**
 * DashboardSprintCard — DASH-02
 *
 * Static dashboard card showing sprint health at a glance:
 * - Sprint name
 * - Days remaining (computed from activeSprint.endDate)
 * - % complete progress bar (done story points / total story points)
 * - Empty state when no active sprint
 *
 * Receives all auth values as props — no direct Stronghold or store reads (D-16).
 * Shares TanStack Query cache keys with SprintBoardTab.
 */
import { useQuery } from '@tanstack/react-query';
import { Zap } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraIssue } from '@/services/jira';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';

export interface DashboardSprintCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
}

function getDaysRemaining(endDateIso: string | undefined): number | null {
  if (!endDateIso) return null;
  const ms = new Date(endDateIso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

export default function DashboardSprintCard({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  storyPointsFieldKey,
}: DashboardSprintCardProps) {
  const { data: sprintIssuesRaw, isLoading: issuesLoading } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        false,
        storyPointsFieldKey,
      ),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const { data: activeSprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject],
    queryFn: () => fetchActiveSprint(jiraBaseUrl ?? '', jiraToken ?? '', activeJiraProject ?? ''),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const isLoading = issuesLoading || sprintLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  // Normalise: fetchSprintIssues returns JiraIssue[] directly
  const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];

  const stories = sprintIssues.filter((i) => !i.fields.issuetype.subtask);

  const donePoints = stories
    .filter((i) => i.fields.status.statusCategory?.key === 'done')
    .reduce(
      (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
      0,
    );

  const totalPoints = stories.reduce(
    (sum, i) => sum + ((i.fields[storyPointsFieldKey] as number | null | undefined) ?? 0),
    0,
  );

  // Division-by-zero guard (D-06, T-60-03)
  const donePct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;

  const daysLeft = getDaysRemaining(activeSprint?.endDate);

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="size-4 text-amber-500" aria-hidden />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Sprint Health</span>
      </div>

      {/* Skeleton */}
      {showSkeleton && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state: no active sprint */}
      {!showSkeleton && !activeSprint && (
        <p className="text-sm text-muted-foreground">No active sprint</p>
      )}

      {/* Data: active sprint body */}
      {!showSkeleton && activeSprint && (
        <div className="flex flex-col gap-2">
          {/* Sprint name */}
          <p className="text-sm font-medium">{activeSprint.name}</p>

          {/* Days remaining */}
          {daysLeft !== null && (
            <p className="text-sm text-muted-foreground">
              {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining
            </p>
          )}

          {/* Progress bar */}
          <Progress value={donePct} />

          {/* Caption */}
          <p className="text-xs text-muted-foreground">
            {donePct}% complete
            {totalPoints > 0 && ` · ${donePoints} / ${totalPoints} pts`}
          </p>
        </div>
      )}
    </div>
  );
}
