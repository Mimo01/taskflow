import { RefreshCw } from 'lucide-react';
import { AmbientCurves } from '@/components/ambient-curves';
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
    // Full-bleed like the dashboard hero; the bottom border separates it from the
    // content the way the other pages' header bars do.
    <header className="relative shrink-0 overflow-hidden border-b border-border px-8 pt-12 pb-10 text-center">
      <AmbientCurves />
      <div className="relative">
        <h1 className="text-5xl font-semibold tracking-tight text-foreground">Releases</h1>
        {summary && (
          <p data-testid="releases-summary" className="mt-2 text-sm text-muted-foreground">
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
      <div className="absolute top-4 right-6 flex items-center gap-3 text-xs text-muted-foreground">
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
