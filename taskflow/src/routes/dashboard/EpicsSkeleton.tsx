import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * Column-width-matched skeleton for the redesigned /epics row (Phase 91.2).
 * Each row mirrors EpicRow's settled cell widths exactly so nothing reflows
 * when real data lands.
 */

const CELL_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';

export function EpicsSkeleton() {
  return (
    <div className="w-full">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex w-full items-center border-b border-border">
          {/* Key */}
          <div className={cn('flex-none w-24 pl-4 pr-2', CELL_PADDING)}>
            <Skeleton className="h-3 w-16" />
          </div>

          {/* Priority icon — between key and name, matching EpicRow/BacklogRow */}
          <div className={cn('flex-none px-0', CELL_PADDING)}>
            <Skeleton className="h-3.5 w-3.5" />
          </div>

          {/* Name badge */}
          <div className={cn('flex-1 min-w-0 px-2', CELL_PADDING)}>
            <Skeleton className="h-4 w-40" />
          </div>

          {/* Status pill */}
          <div className={cn('flex-none w-28 px-2', CELL_PADDING)}>
            <Skeleton className="h-4 w-20" />
          </div>

          {/* Progress bar */}
          <div className={cn('flex-none w-32 px-2', CELL_PADDING)}>
            <Skeleton className="h-1.5 w-16 rounded-full" />
          </div>

          {/* Points */}
          <div className={cn('flex-none w-20 px-2 text-right', CELL_PADDING)}>
            <Skeleton className="h-3 w-12" />
          </div>

          {/* Assignee avatar */}
          <div className={cn('flex-none w-10 pl-2 pr-4', CELL_PADDING)}>
            <Skeleton className="size-6 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
