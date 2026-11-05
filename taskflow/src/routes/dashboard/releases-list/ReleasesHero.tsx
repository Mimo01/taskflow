import {
  CalendarDays,
  CalendarX,
  CircleAlert,
  type LucideIcon,
  RefreshCw,
  Repeat,
  Rocket,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { headerRefreshLabel, headerSecondaryText, PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from '@/lib/relative-time';
import { type ReleaseSummary, spanLabel } from '@/lib/release-agenda';
import { cn } from '@/lib/utils';

function lastShippedLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${spanLabel(days)} ago`;
}

/** One summary figure: icon + text; colour only for status (overdue red, undated amber). */
function Stat({
  icon: Icon,
  className,
  children,
}: {
  icon: LucideIcon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span data-testid="releases-stat" className={cn('inline-flex items-center gap-1.5', className)}>
      <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
      <span className="font-medium">{children}</span>
    </span>
  );
}

export function ReleasesHero({
  summary,
  updatedAt,
  refreshing,
  onRefresh,
  loading = false,
}: {
  summary: ReleaseSummary | null;
  updatedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
  /** Show a summary-line placeholder while the first load is pending. */
  loading?: boolean;
}) {
  return (
    // The shared PageHeader bar, with the summary under the title like My Tasks.
    <PageHeader
      title="Releases"
      titleSize="3xl"
      subtitle={
        summary || loading ? (
          <>
            {summary && (
              <p
                data-testid="releases-summary"
                className="flex items-center gap-x-4 whitespace-nowrap text-xs text-muted-foreground tabular-nums"
              >
                <Stat icon={CalendarDays} className="text-foreground">
                  {summary.planned === 0 ? 'No planned releases' : `${summary.planned} planned`}
                </Stat>
                {summary.overdue > 0 && (
                  <Stat icon={CircleAlert} className="text-red-600 dark:text-red-400">
                    {summary.overdue} overdue
                  </Stat>
                )}
                {summary.undated > 0 && (
                  <Stat icon={CalendarX} className="text-amber-600 dark:text-amber-400">
                    {summary.undated} without date
                  </Stat>
                )}
                {summary.cadenceDays !== null && summary.cadenceDays > 0 && (
                  <Stat icon={Repeat}>ships every ~{spanLabel(summary.cadenceDays)}</Stat>
                )}
                {summary.lastShippedDays !== null && (
                  <Stat icon={Rocket}>
                    last shipped {lastShippedLabel(summary.lastShippedDays)}
                  </Stat>
                )}
              </p>
            )}
            {!summary && loading && (
              <p
                data-testid="releases-summary-skeleton"
                aria-hidden="true"
                className="flex items-center gap-x-4 whitespace-nowrap text-xs"
              >
                {['w-16', 'w-20', 'w-28'].map((w) => (
                  <span key={w} className="inline-flex items-center gap-1.5">
                    <Skeleton className="size-3.5 rounded" />
                    <Skeleton className={cn('inline-block h-3 align-middle', w)} />
                  </span>
                ))}
              </p>
            )}
          </>
        ) : undefined
      }
      actions={
        <>
          {updatedAt !== undefined && (
            <span className={cn('text-xs text-muted-foreground', headerSecondaryText)}>
              Updated {relativeTime(new Date(updatedAt).toISOString())}
            </span>
          )}
          <button
            type="button"
            aria-label="Refresh releases"
            title="Refresh releases"
            disabled={refreshing}
            onClick={onRefresh}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-60"
          >
            <RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />
            <span className={headerRefreshLabel}>Refresh</span>
          </button>
        </>
      }
    />
  );
}
