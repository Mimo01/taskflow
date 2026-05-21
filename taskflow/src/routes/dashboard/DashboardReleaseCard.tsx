/**
 * DashboardReleaseCard — DASH-04
 *
 * Fetches Jira fix versions (sharing the ['jira-fix-versions', activeJiraProject]
 * cache key with ReleasesTab) and renders the soonest upcoming unreleased version
 * with timing copy (today / X days overdue / X days away).
 *
 * Props only — no readSecret, no useAuthStore (D-16).
 */

import { useQuery } from '@tanstack/react-query';
import { Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useDelayedLoading } from '@/hooks/useDelayedLoading';
import type { JiraFixVersion } from '@/services/jira';
import { fetchFixVersions, fetchReleaseIssues } from '@/services/jira';

export interface DashboardReleaseCardProps {
  jiraBaseUrl: string;
  jiraToken: string;
  activeJiraProject: string;
}

type TimingLabel = 'overdue' | 'due-today' | { daysUntil: number } | null;

// Verbatim copy from ReleasesTab.tsx — timezone-safe YYYY-MM-DD comparison (T-60-10)
function getReleaseTimingLabel(releaseDate: string | undefined, released: boolean): TimingLabel {
  if (released || !releaseDate) return null;
  const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD" — timezone-safe
  if (releaseDate < today) return 'overdue';
  if (releaseDate === today) return 'due-today';
  const msPerDay = 86_400_000;
  const days = Math.round((new Date(releaseDate).getTime() - new Date(today).getTime()) / msPerDay);
  return { daysUntil: days };
}

export default function DashboardReleaseCard({
  jiraBaseUrl,
  jiraToken,
  activeJiraProject,
}: DashboardReleaseCardProps) {
  // Cache key MUST match ReleasesTab.tsx line 139 exactly — shared cache entry
  const { data: fixVersions, isLoading } = useQuery({
    queryKey: ['jira-fix-versions', activeJiraProject],
    queryFn: () => fetchFixVersions(jiraBaseUrl, jiraToken, activeJiraProject),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject,
  });

  const showSkeleton = useDelayedLoading(isLoading);

  // ASCENDING sort — dashboard needs SOONEST first; ReleasesTab sorts descending (RESEARCH Pitfall 6)
  const soonest: JiraFixVersion | null =
    (fixVersions ?? [])
      .filter((v) => !v.released && !!v.releaseDate)
      .sort((a, b) => (a.releaseDate ?? '').localeCompare(b.releaseDate ?? ''))[0] ?? null;

  const timing = soonest ? getReleaseTimingLabel(soonest.releaseDate, soonest.released) : null;

  const { data: releaseIssues } = useQuery({
    queryKey: ['jira-release-issues', activeJiraProject, soonest?.name],
    queryFn: () => fetchReleaseIssues(jiraBaseUrl, jiraToken, activeJiraProject, soonest!.name),
    staleTime: 5 * 60_000,
    enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject && !!soonest,
  });

  const issueList = releaseIssues ?? [];
  const totalCount = issueList.length;
  const doneCount = issueList.filter(
    (i) => i.fields.status.statusCategory?.key === 'done',
  ).length;
  const donePct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-3 min-h-[160px]">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="size-4 text-blue-500" aria-hidden />
        <span className="text-xs text-muted-foreground uppercase tracking-wide">Next Release</span>
      </div>

      {/* Skeleton */}
      {showSkeleton && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 rounded bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {/* Content */}
      {!showSkeleton && soonest && (
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">{soonest.name}</span>
          <div className="flex items-center gap-2">
            {timing === 'due-today' && <Badge tone="blue">Today</Badge>}
            {timing === 'overdue' && (
              <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {Math.round(
                  (new Date(new Date().toISOString().slice(0, 10)).getTime() -
                    new Date(soonest.releaseDate!).getTime()) /
                    86_400_000,
                )}{' '}
                days overdue
              </span>
            )}
            {timing && typeof timing === 'object' && 'daysUntil' in timing && (
              <span className="text-sm text-muted-foreground">{timing.daysUntil} days away</span>
            )}
            {soonest.releaseDate && (
              <span className="text-xs text-muted-foreground">{soonest.releaseDate}</span>
            )}
          </div>
          <Progress value={donePct} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {donePct}% complete · {doneCount} / {totalCount} issues
          </p>
        </div>
      )}

      {/* Empty state */}
      {!showSkeleton && !soonest && (
        <p className="text-sm text-muted-foreground">No upcoming releases</p>
      )}
    </div>
  );
}
