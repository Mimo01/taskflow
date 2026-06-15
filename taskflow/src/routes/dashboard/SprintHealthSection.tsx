'use no memo';

/**
 * SprintHealthSection — Phase 83 DASH-03/07
 *
 * Displays sprint health: days remaining, % complete progress bar, and a
 * points-by-status donut chart. All data derived from the warm sprint-board
 * cache and the Sidebar-prefetched active-sprint cache.
 *
 * Cache key for sprint-board issues MUST MATCH DashboardSprintCard / SprintBoardTab exactly.
 * Active-sprint read uses enabled:false (Option B reactive read — Sidebar prefetches it
 * for /dashboard so we never fire a new network call). Per project memory
 * reactive-cache-read: never use queryClient.getQueryData in render — use a
 * fetch-disabled useQuery to re-render reactively on setQueryData.
 *
 * Props only — no readSecret, no useAuthStore (D-16).
 * Auth values are loaded once in index.tsx and passed down as props.
 */
import { useQuery } from '@tanstack/react-query';
import { Activity } from 'lucide-react';
import { Pie, PieChart } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { Progress } from '@/components/ui/progress';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraIssue } from '@/services/jira';
import { fetchActiveSprint, fetchSprintIssues } from '@/services/jira';
import {
  computeDonutData,
  computeSpDone,
  computeSpTotal,
  getDaysRemaining,
} from './dashboardMetrics';

interface SprintHealthSectionProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
  storyPointsFieldKey: string;
  /** Resolved Jira board id (user-chosen or first board), null while unresolved. */
  boardId: number | null;
}

const donutConfig = {
  todo: { label: 'To Do', color: 'var(--chart-1)' },
  inProgress: { label: 'In Progress', color: 'var(--chart-2)' },
  done: { label: 'Done', color: 'var(--chart-3)' },
} satisfies ChartConfig;

export default function SprintHealthSection({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
  storyPointsFieldKey,
  boardId,
}: SprintHealthSectionProps) {
  // CACHE KEY MUST MATCH DashboardSprintCard / SprintBoardTab exactly
  const {
    data: sprintIssuesRaw,
    isLoading: issuesLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey],
    queryFn: () =>
      fetchSprintIssues(jiraBaseUrl, jiraToken, activeJiraProject, false, storyPointsFieldKey),
    staleTime: 30_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  // Active-sprint read — same cache key + staleTime as the Sidebar prefetch (Phase 83 D-10
  // Option B). Enabling the query (rather than enabled:false) lets it self-fetch ONCE on a cold
  // load instead of falsely rendering "No active sprint" when the prefetch never ran or resolved
  // a different boardId. When the Sidebar already warmed this key, React Query dedups against the
  // fresh cache entry and fires ZERO new network calls (DASH-03 preserved). Guarded on a resolved
  // boardId so we never fetch with a null/placeholder key.
  const { data: activeSprint, isLoading: sprintLoading } = useQuery({
    queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId],
    queryFn: () =>
      fetchActiveSprint(
        jiraBaseUrl ?? '',
        jiraToken ?? '',
        activeJiraProject ?? '',
        boardId ?? undefined,
      ),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && boardId != null,
  });

  const isLoading = issuesLoading || sprintLoading;
  const showSkeleton = useDelayedLoading(isLoading);

  // Normalise: fetchSprintIssues returns JiraIssue[] directly
  const sprintIssues: JiraIssue[] = Array.isArray(sprintIssuesRaw) ? sprintIssuesRaw : [];

  // Derive all metrics via dashboardMetrics (single source of truth)
  const totalSP = computeSpTotal(sprintIssues, storyPointsFieldKey);
  const donePoints = computeSpDone(sprintIssues, storyPointsFieldKey);
  const donutData = computeDonutData(sprintIssues, storyPointsFieldKey);
  const daysLeft = getDaysRemaining(activeSprint?.endDate);

  // Division-by-zero guard (D-06, T-60-03) — copy this comment verbatim
  const donePct = totalSP > 0 ? Math.round((donePoints / totalSP) * 100) : 0;

  return (
    <Card role="region" aria-label="Sprint health" className="gap-4">
      <CardContent className="flex flex-col gap-4">
        {/* Empty state: no active sprint. Gate on raw isLoading (not the 200ms-delayed
          showSkeleton) so a cold load never flashes this before data resolves (WR-01). */}
        {!isLoading && !activeSprint && (
          <EmptyState
            icon={Activity}
            title="No active sprint"
            subtitle="Start a sprint in Jira to see health metrics here."
          />
        )}

        {/* Data: active sprint body */}
        {!showSkeleton && activeSprint && (
          <>
            {/* Days remaining */}
            <div>
              {daysLeft === 0 && (
                <span className="text-xs text-muted-foreground">Sprint ends today</span>
              )}
              {daysLeft !== null && daysLeft > 0 && (
                <span className="text-xs text-muted-foreground">
                  {daysLeft} {daysLeft === 1 ? 'day' : 'days'} remaining
                </span>
              )}
            </div>

            {/* Progress bar + caption */}
            <div className="flex flex-col gap-1">
              <Progress value={donePct} />
              <p className="text-xs text-muted-foreground">
                {donePct}% complete
                {totalSP > 0 && ` · ${donePoints} / ${totalSP} pts`}
              </p>
            </div>
          </>
        )}

        {/* Donut chart — always shown (ChartWrapper handles loading/error/empty states independently).
          bare: this ChartWrapper lives INSIDE the Card, so it renders without its own
          container chrome to avoid a double border/ring/padding. */}
        <ChartWrapper
          title="Sprint Health"
          description="Story points by status category"
          height={200}
          isLoading={showSkeleton}
          error={error}
          isEmpty={totalSP === 0}
          onRetry={refetch}
          bare
        >
          <div className="relative h-full">
            <ChartContainer
              config={donutConfig}
              className="h-full w-full"
              aria-label={`Points by status: To Do ${donutData.find((d) => d.name === 'todo')?.value ?? 0}, In Progress ${donutData.find((d) => d.name === 'inProgress')?.value ?? 0}, Done ${donutData.find((d) => d.name === 'done')?.value ?? 0}`}
            >
              <PieChart responsive>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="60%"
                  outerRadius="80%"
                  isAnimationActive={false}
                />
              </PieChart>
            </ChartContainer>
            {/* Donut center label — absolute overlay (RESEARCH.md Pattern 4) */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-2xl font-semibold" data-testid="donut-center-value">
                {totalSP}
              </p>
              <p className="text-xs text-muted-foreground">pts</p>
            </div>
          </div>
        </ChartWrapper>
      </CardContent>
    </Card>
  );
}
