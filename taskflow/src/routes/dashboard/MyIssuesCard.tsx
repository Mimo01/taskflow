'use no memo';

/**
 * MyIssuesCard — Phase 86 D-02/D-03/D-04/D-05/D-16
 *
 * Displays personal sprint progress: done/total issue counts segmented by
 * statusCategory, rendered as a horizontal 3-segment bar with legend.
 *
 * Cache key MUST MATCH SprintHealthSection / SprintBoardTab exactly — shared cache entry.
 * Props only — no readSecret, no useAuthStore (D-16).
 * Auth values are loaded once in index.tsx and passed down as props.
 */
import { useQuery } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { clickableCard } from '@/lib/clickable-card';
import { fetchSprintIssues } from '@/services/jira';
import { filterNonSubtasks } from './dashboardMetrics';

interface MyIssuesCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
  jiraUserDisplayName: string;
  /** Optional: makes the whole card clickable (navigates to My Tasks). */
  onActivate?: () => void;
}

export default function MyIssuesCard({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  storyPointsFieldKey,
  jiraUserDisplayName,
  onActivate,
}: MyIssuesCardProps) {
  const click = clickableCard(onActivate);
  // CACHE KEY MUST MATCH SprintHealthSection / SprintBoardTab exactly
  const {
    data: sprintIssuesRaw,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Normalise: fetchSprintIssues returns JiraIssue[] directly
  const sprintIssues = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];

  // Derive personal issue counts per D-02/D-03/D-04 — issue counts, NOT story points
  const myNonSubtasks = filterNonSubtasks(sprintIssues).filter(
    (i) => i.fields.assignee?.displayName === jiraUserDisplayName,
  );

  const toDo = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'new').length;
  const inProgress = myNonSubtasks.filter(
    (i) => i.fields.status.statusCategory?.key === 'indeterminate',
  ).length;
  const done = myNonSubtasks.filter((i) => i.fields.status.statusCategory?.key === 'done').length;
  const total = myNonSubtasks.length;
  // D-03 invariant: toDo + inProgress + done === total (unknown keys fall through — T-86-03)

  return (
    <Card
      role="region"
      aria-label="My issues this sprint"
      className={`relative overflow-hidden ${click.className}`}
      {...click.props}
    >
      {/* Big ambient icon, top-right (matches My Tasks stat-tile pattern) */}
      <ListChecks
        className="pointer-events-none absolute -top-4 -right-3 size-22 text-green-500/10 dark:text-green-400/15"
        aria-hidden
      />
      <CardHeader>
        <CardTitle className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wide">
          MY ISSUES
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Loading skeleton — 200ms-gated via useDelayedLoading */}
        {showSkeleton && (
          <div aria-busy="true" className="flex flex-col gap-2">
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-2 w-full" />
          </div>
        )}

        {/* Error state */}
        {!showSkeleton && error && (
          <ErrorState error={error} onRetry={refetch} viewName="My Issues" />
        )}

        {/* Empty state — 0 issues is valid (D-05); never an error */}
        {!showSkeleton && !error && total === 0 && (
          <EmptyState
            icon={ListChecks}
            title="No issues assigned"
            subtitle="You have no issues assigned in the current sprint."
          />
        )}

        {/* Data view */}
        {!showSkeleton && !error && total > 0 && (
          <>
            {/* Big number row */}
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-semibold text-foreground">{done}</span>
              <span className="text-sm font-normal text-muted-foreground"> of {total} done</span>
            </div>

            {/* Segmented bar — three proportional flex segments inside rounded track */}
            <div
              role="img"
              aria-label={`Sprint progress: ${toDo} to do, ${inProgress} in progress, ${done} done`}
              className="h-3 rounded-full overflow-hidden bg-muted flex"
            >
              <div
                className="bg-slate-400 dark:bg-slate-500"
                style={{ width: `${(toDo / total) * 100}%` }}
              />
              <div className="bg-blue-500" style={{ width: `${(inProgress / total) * 100}%` }} />
              <div className="bg-green-500" style={{ width: `${(done / total) * 100}%` }} />
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4">
              {[
                { label: 'To Do', count: toDo, cls: 'bg-slate-400 dark:bg-slate-500' },
                { label: 'In Progress', count: inProgress, cls: 'bg-blue-500' },
                { label: 'Done', count: done, cls: 'bg-green-500' },
              ].map(({ label, count, cls }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-[2px] ${cls}`} />
                  <span className="text-sm font-semibold text-muted-foreground">
                    {label} {count}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
