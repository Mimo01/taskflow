import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  STAT_CARD_CLASS,
  STAT_CONTAINER_CLASS,
  STAT_GRID_CLASS,
} from './issue-detail/EpicStatCard';

/**
 * Cycle page body skeleton. The page header (title row + metadata line) stays mounted while
 * loading, so this draws only what sits below it: four KPI tiles on the same geometry as the
 * live tiles (no layout shift), the bar, the Executions toolbar and six rows.
 */
export function AioCycleDetailSkeleton() {
  return (
    <div className="flex flex-col">
      <div className={cn(STAT_CONTAINER_CLASS, 'border-b border-border px-6 py-4')}>
        <div className={STAT_GRID_CLASS}>
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} size="sm">
              <CardContent>
                <div className={cn(STAT_CARD_CLASS, 'items-center')}>
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-7 w-14 self-center" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
      </div>
      <div className="flex items-center gap-3 px-4 py-2">
        <Skeleton className="h-7 w-64" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          <Skeleton className="h-3.5 w-20 flex-none" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-5 w-24 flex-none" />
        </div>
      ))}
    </div>
  );
}

/**
 * Run detail skeleton: main column (summary + step cards) and a 280px sidebar, stacking to
 * one column below 900px container width (same breakpoint as the live page).
 */
export function AioRunDetailSkeleton() {
  return (
    <div className="@container p-4" data-testid="aio-run-detail-skeleton">
      <div className="grid gap-4 @[900px]:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-5 w-48" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-28" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
