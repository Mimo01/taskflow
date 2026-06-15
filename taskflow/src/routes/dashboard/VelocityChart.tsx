'use no memo';

/**
 * VelocityChart — Phase 85 INSIGHT-01
 *
 * Personal velocity chart: committed vs completed story points per closed sprint.
 * Props-only component — no useAuthStore, no readSecret (D-16 pattern).
 * Auth values loaded once in index.tsx and passed down as props.
 *
 * Probe A+B PASSED 2026-06-15: closed-sprint endpoint returns sprint objects with
 * startDate/endDate; SP field customfield_10106 confirmed on closed-sprint issues.
 * Build is unconditional; <3-guard and error state handle runtime absence.
 *
 * Concurrency: dedicated velocity limiter (pLimit(3) singleton from lib/concurrency.ts)
 * per D-05 — separate from the global pLimit(6). Keeps the backfill fan-out from
 * monopolizing the Jira DC connection.
 *
 * Token NEVER enters any queryKey (T-84-02 / T-85-03-INFO).
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';
import { Bar, BarChart, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartWrapper } from '@/components/chart-wrapper';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import { getVelocityLimit } from '@/lib/concurrency';
import { fetchClosedSprints, fetchSprintIssuesBySprintId } from '@/services/jira';
import { computePersonalVelocitySeries } from './dashboardMetrics';

// Props only — no readSecret, no useAuthStore inside the component.
// Auth values loaded once in index.tsx and passed down as props (D-16 pattern).
interface VelocityChartProps {
  jiraBaseUrl: string;
  jiraToken: string;
  jiraUserDisplayName: string;
  boardId: number | null;
  storyPointsFieldKey: string;
  activeJiraProject: string;
}

const chartConfig = {
  committed: { label: 'Committed', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
} satisfies ChartConfig;

export default function VelocityChart({
  jiraBaseUrl,
  jiraToken,
  jiraUserDisplayName,
  boardId,
  storyPointsFieldKey,
  activeJiraProject: _activeJiraProject,
}: VelocityChartProps) {
  // Fetch the last 6 closed sprints.
  // Token lives in queryFn closure, NOT in queryKey (T-85-03-INFO / T-84-02).
  // staleTime: Infinity — closed-sprint data never changes (D-05 / criterion 2).
  const {
    data: closedSprints,
    isLoading: sprintsLoading,
    error: sprintsError,
    refetch: refetchSprints,
  } = useQuery({
    queryKey: ['jira-closed-sprints', boardId],
    queryFn: () => fetchClosedSprints(jiraBaseUrl, jiraToken, boardId!, 6),
    staleTime: Infinity,
    enabled: !!jiraToken && boardId != null,
  });

  // Fan out per-sprint issue fetches via useQueries.
  // Each sprint gets its own cache slot — closed data is never refetched (D-05).
  // Concurrency throttled through getVelocityLimit() (pLimit(3)) per D-05 / criterion 1c.
  const sprintIssueQueries = useQueries({
    queries: (closedSprints ?? []).map((sprint) => ({
      queryKey: ['jira-sprint-issues', sprint.id, storyPointsFieldKey],
      queryFn: () =>
        getVelocityLimit()(() =>
          fetchSprintIssuesBySprintId(jiraBaseUrl, jiraToken, sprint.id, storyPointsFieldKey),
        ),
      staleTime: Infinity,
      enabled: !!jiraToken && (closedSprints?.length ?? 0) > 0,
    })),
  });

  // Build issuesBySprint Map from fan-out results.
  const issuesBySprint = new Map(
    (closedSprints ?? []).map((sprint, i) => [sprint.id, sprintIssueQueries[i]?.data ?? []]),
  );

  // Compute velocity series only when all per-sprint queries have settled.
  const allQueriesSettled = sprintIssueQueries.every((q) => !q.isLoading);
  const velocitySeries = allQueriesSettled
    ? computePersonalVelocitySeries(
        closedSprints ?? [],
        issuesBySprint,
        jiraUserDisplayName,
        storyPointsFieldKey,
      )
    : [];

  // D-06: qualifying sprints = those where I have any SP (committed or completed).
  // Sprints with all-zero SP for my account are not plotted as meaningful data points.
  const qualifyingSprints = velocitySeries.filter((p) => p.committed > 0 || p.completed > 0);

  // 200ms flicker gate — skeleton only shows on genuinely slow loads.
  const showSkeleton = useDelayedLoading(sprintsLoading || !allQueriesSettled);

  return (
    <div role="region" aria-label="Personal velocity chart">
      {/* D-10, criterion 3: error={sprintsError} routes to ChartWrapper's ErrorState with retry.
          The section degrades independently — Dashboard never blanks on a failed fetch.
          ChartWrapper precedence: error > isLoading > isEmpty > children. */}
      <ChartWrapper
        title="Personal Velocity"
        description="Committed vs completed story points · last 6 closed sprints"
        height={240}
        isLoading={showSkeleton}
        error={sprintsError}
        isEmpty={false}
        onRetry={refetchSprints}
      >
        {/* Explicit-height guard div — WebKit 0×0 fix (Phase 81 D-03). */}
        <div style={{ height: 240 }} className="w-full">
          {qualifyingSprints.length < 3 ? (
            // D-06 sparse-data safety net: fewer than 3 qualifying sprints.
            // Rendered via children with isEmpty={false} — NOT the generic isEmpty path.
            <div className="h-full w-full flex items-center justify-center">
              <EmptyState
                icon={BarChart2}
                title="Not enough sprint data"
                subtitle="At least 3 closed sprints with assigned story points are needed to show your velocity trend."
              />
            </div>
          ) : (
            <ChartContainer
              config={chartConfig}
              className="h-full w-full"
              aria-label="Personal velocity bar chart — committed vs completed story points per sprint"
            >
              {/* responsive prop — Phase 81 D-11 / React Compiler #4590 compat. Never wrap in a ResizeObserver container. */}
              <BarChart data={velocitySeries} responsive>
                <XAxis dataKey="sprintName" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => String(v)} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {/* Series A — Committed: var(--chart-1) at 40% opacity, rendered behind Completed.
                    isAnimationActive={false}: Phase 81 D-06 — avoids WebKit rendering issues in Tauri. */}
                <Bar
                  dataKey="committed"
                  name="Committed"
                  fill="var(--chart-1)"
                  fillOpacity={0.4}
                  isAnimationActive={false}
                />
                {/* Series B — Completed: var(--chart-2) solid fill, rendered in front. */}
                <Bar
                  dataKey="completed"
                  name="Completed"
                  fill="var(--chart-2)"
                  isAnimationActive={false}
                />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </ChartWrapper>
    </div>
  );
}
