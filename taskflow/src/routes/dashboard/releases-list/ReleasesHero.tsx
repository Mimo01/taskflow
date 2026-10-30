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
}: {
  summary: ReleaseSummary | null;
  updatedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    // The app's standard page header bar (Epics, Worklogs, Test cycles), with the
    // summary under the title like My Tasks.
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">Releases</h1>
        {summary && (
          <p
            data-testid="releases-summary"
            className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums"
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
              <Stat icon={Rocket}>last shipped {lastShippedLabel(summary.lastShippedDays)}</Stat>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-none items-center gap-3 text-xs text-muted-foreground">
        {updatedAt !== undefined && (
          <span>Updated {relativeTime(new Date(updatedAt).toISOString())}</span>
        )}
        <button
          type="button"
          aria-label="Refresh releases"
          disabled={refreshing}
          onClick={onRefresh}
          className="inline-flex items-center gap-1 hover:text-foreground disabled:opacity-60"
        >
          <RefreshCw className={cn('size-3', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>
    </header>
  );
}
