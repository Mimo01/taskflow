import { Skeleton } from '@/components/ui/skeleton';
import { AioDonutSkeleton } from '../aio-cycle/AioDonut';
import {
  ASSIGNEE_ROW_HEIGHT,
  ASSIGNEE_SKELETON_ROWS,
  BURNUP_HEIGHT,
  DONUT_GRAPH_SIZE,
  WAFFLE_SKELETON_ROWS,
} from './graphs/GraphSlot';

/** Full-width skeleton mirroring the redesigned release detail layout (no sidebar). */
export function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="flex-1 overflow-hidden">
      {/* Header: title + pill, meta line */}
      <div className="flex flex-col gap-1 px-6 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      {/* Done bar */}
      <div className="border-t px-6 pt-4">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div className="grid grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] gap-8 px-6 pt-6 @max-[980px]/page:grid-cols-1">
        <div
          data-testid="skeleton-quad"
          className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-8 gap-y-7"
        >
          <Skeleton className="w-full" style={{ height: BURNUP_HEIGHT }} />
          <div className="flex items-center gap-4">
            <AioDonutSkeleton size={DONUT_GRAPH_SIZE} testId="skeleton-donut" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {Array.from({ length: ASSIGNEE_SKELETON_ROWS }, (_, i) => (
              <Skeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
                key={i}
                className="w-full"
                style={{ height: ASSIGNEE_ROW_HEIGHT - 4 }}
              />
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: WAFFLE_SKELETON_ROWS }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </div>
        <div
          data-testid="skeleton-side"
          className="flex flex-col gap-3 border-l pl-8 @max-[980px]/page:border-l-0 @max-[980px]/page:border-t @max-[980px]/page:pl-0 @max-[980px]/page:pt-6"
        >
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-3/4" />
        </div>
      </div>
      <div data-testid="skeleton-table" className="flex flex-col gap-2 px-6 pt-8">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          <Skeleton key={i} data-testid="skeleton-table-row" className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
