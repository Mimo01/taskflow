'use no memo';

/**
 * UpcomingReleasesTimeline — Phase 86 D-06/D-07/D-08/D-16
 *
 * Renders up to 3 upcoming unreleased fix versions (with a releaseDate) as a
 * horizontal timeline with per-release readiness bars and relative-due labels.
 *
 * Cache keys MUST MATCH ReleasesTab / DashboardReleaseCard exactly — shared cache entries.
 * Props only — no readSecret, no useAuthStore (D-16).
 * Auth values are loaded once in index.tsx and passed down as props.
 */
import { useQueries, useQuery } from '@tanstack/react-query';
import { Rocket } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraFixVersion } from '@/services/jira';
import { fetchFixVersions, fetchReleaseIssues } from '@/services/jira';

interface UpcomingReleasesTimelineProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
}

type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

// Lift VERBATIM from DashboardReleaseCard.tsx (T-60-10 timezone-safe)
function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}

// Render layer for timing labels — maps getReleaseTimingLabel() output to display text + class
function formatTimingLabel(timing: TimingLabel): { text: string; className: string } {
  if (timing === 'due-today') return { text: 'Today', className: 'text-muted-foreground' };
  if (timing === 'overdue')
    return { text: 'overdue', className: 'text-amber-600 dark:text-amber-400' };
  if (timing && typeof timing === 'object') {
    if (timing.daysUntil === 1) return { text: 'Tomorrow', className: 'text-muted-foreground' };
    return { text: `in ${timing.daysUntil} days`, className: 'text-muted-foreground' };
  }
  return { text: '', className: '' };
}

export default function UpcomingReleasesTimeline({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
}: UpcomingReleasesTimelineProps) {
  // Cache key MUST MATCH ReleasesTab.tsx / DashboardReleaseCard.tsx exactly
  const {
    data: fixVersions,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl, jiraToken, activeJiraProject),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // Compute upcoming versions per D-06: unreleased, has releaseDate, ascending sort (soonest first), max 3
  const upcomingVersions: JiraFixVersion[] = (fixVersions ?? [])
    .filter((v) => !v.released && !!v.releaseDate)
    .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))
    .slice(0, 3);

  // Fetch per-release issues via useQueries — one query per upcoming version
  const releaseIssueResults = useQueries({
    queries: upcomingVersions.map((v) => ({
      queryKey: ['jira-release-issues', activeJiraProject, v.name],
      queryFn: () => fetchReleaseIssues(jiraBaseUrl, jiraToken, activeJiraProject, v.name),
      staleTime: 5 * 60_000,
      enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
    })),
  });

  return (
    <Card role="region" aria-label="Upcoming releases" className="relative overflow-hidden">
      {/* Big ambient icon, top-right (matches My Tasks stat-tile pattern) */}
      <Rocket
        className="pointer-events-none absolute -top-4 -right-3 size-20 text-amber-500/10 dark:text-amber-400/15"
        aria-hidden
      />
      <CardHeader>
        <CardTitle className="text-sm font-bold text-muted-foreground/70 uppercase tracking-wide">
          UPCOMING RELEASES
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* Skeleton */}
        {showSkeleton && (
          <div className="flex flex-col gap-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-2 w-full" />
            ))}
          </div>
        )}

        {/* Error */}
        {!showSkeleton && error && (
          <ErrorState error={error} onRetry={refetch} viewName="Upcoming Releases" />
        )}

        {/* Empty state — 0 upcoming releases with due dates (D-06/D-08) */}
        {!showSkeleton && !error && upcomingVersions.length === 0 && (
          <EmptyState
            icon={Rocket}
            title="No upcoming releases"
            subtitle="No unreleased versions with a due date were found."
          />
        )}

        {/* Horizontal timeline — up to 3 dots on a track, left-aligned (D-08: only what exists) */}
        {!showSkeleton && !error && upcomingVersions.length > 0 && (
          <div className="relative flex justify-start gap-8 pt-1">
            {upcomingVersions.map((v, idx) => {
              const issueList = releaseIssueResults[idx]?.data ?? [];
              const totalCount = issueList.length;
              const doneCount = issueList.filter(
                (i) => i.fields.status.statusCategory?.key === 'done',
              ).length;
              // D-07: clamp to 0–100 (T-86-02 STRIDE mitigation)
              const donePct =
                totalCount > 0 ? Math.min(100, Math.round((doneCount / totalCount) * 100)) : 0;

              const timing = getReleaseTimingLabel(v.releaseDate, v.released);
              const { text: timingText, className: timingClass } = formatTimingLabel(timing);

              return (
                <div
                  key={v.id ?? v.name}
                  className="flex flex-col items-start gap-1.5"
                  data-testid="release-dot"
                >
                  {/* Dot + name on one line */}
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-3 shrink-0 rounded-full ring-2 ring-card ${donePct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    />
                    <span className="text-sm font-medium text-foreground truncate max-w-[180px]">
                      {v.name}
                    </span>
                  </div>

                  {/* Relative due label */}
                  {timingText && (
                    <span className={`text-xs font-normal ${timingClass}`}>{timingText}</span>
                  )}

                  {/* Readiness bar */}
                  <div className="mt-0.5 h-1.5 w-28 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${donePct >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${donePct}%` }}
                    />
                  </div>

                  {/* Readiness percentage */}
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">
                    {donePct}% ready
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
