import { RefreshCw } from 'lucide-react';
import { AmbientCurves } from '@/components/ambient-curves';
import { relativeTime } from '@/lib/relative-time';
import { cn } from '@/lib/utils';

export function ReleasesHero({
  summary,
  updatedAt,
  refreshing,
  onRefresh,
}: {
  summary: { planned: number; overdue: number; undated: number } | null;
  updatedAt: number | undefined;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="relative overflow-hidden rounded-2xl px-7 pt-7 pb-[22px]">
      <AmbientCurves />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] leading-[1.1] font-semibold tracking-tight text-foreground">
            Releases
          </h1>
          {summary && (
            <p data-testid="releases-summary" className="mt-1.5 text-sm text-muted-foreground">
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
            </p>
          )}
        </div>
        <div className="relative flex items-center gap-3 text-xs text-muted-foreground">
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
      </div>
    </header>
  );
}
