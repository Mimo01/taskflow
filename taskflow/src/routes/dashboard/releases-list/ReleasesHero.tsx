import { RefreshCw } from 'lucide-react';
import { relativeTime } from '@/lib/relative-time';
import { type ReleaseSummary, spanLabel } from '@/lib/release-agenda';
import { cn } from '@/lib/utils';

function lastShippedLabel(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${spanLabel(days)} ago`;
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
          <p data-testid="releases-summary" className="mt-1 text-xs text-muted-foreground">
            {summary.planned === 0 ? (
              'No planned releases'
            ) : (
              <>
                <span className="font-semibold text-foreground">{summary.planned}</span> planned
              </>
            )}
            {summary.overdue > 0 && (
              <>
                {' · '}
                <span className="font-medium text-red-600 dark:text-red-400">
                  {summary.overdue} overdue
                </span>
              </>
            )}
            {summary.undated > 0 && ` · ${summary.undated} without date`}
            {summary.cadenceDays !== null &&
              summary.cadenceDays > 0 &&
              ` · ships every ~${spanLabel(summary.cadenceDays)}`}
            {summary.lastShippedDays !== null &&
              ` · last shipped ${lastShippedLabel(summary.lastShippedDays)}`}
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
