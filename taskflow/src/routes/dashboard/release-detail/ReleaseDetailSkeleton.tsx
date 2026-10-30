import { Skeleton } from '@/components/ui/skeleton';
import { AioDonutSkeleton } from '../aio-cycle/AioDonut';
import {
  ASSIGNEE_ROW_HEIGHT,
  ASSIGNEE_SKELETON_ROWS,
  BURNUP_HEIGHT,
  DONUT_GRAPH_SIZE,
  WAFFLE_SKELETON_ROWS,
} from './graphs/GraphSlot';

/**
 * Full-width skeleton mirroring the release detail layout (no sidebar).
 *
 * 94-REVIEW WR-05: it renders in place of the page's `@container/page` scroll
 * wrapper, so it is that container itself — otherwise none of its /page
 * container queries could match. The graphs mirror the page: a 2x2 grid, one
 * 4-column band from 1180px (BAND_MIN_WIDTH in ReleaseDetailPage), and the
 * same narrow breakpoints. No side column; the header includes the property
 * strip line.
 */
export function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="@container/page flex-1 overflow-hidden">
      {/* Header: title + pill, meta line, property strip */}
      <div className="flex flex-col gap-1 px-6 pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton data-testid="skeleton-property-strip" className="mt-2 h-5 w-[28rem] max-w-full" />
      </div>
      {/* Done bar */}
      <div className="border-t px-6 pt-4">
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
      <div
        data-testid="skeleton-graphs"
        className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-8 gap-y-7 px-6 pt-5 @max-[640px]/page:grid-cols-2 @max-[640px]/page:gap-6 @max-[440px]/page:grid-cols-1 @min-[1180px]/page:grid-cols-[minmax(260px,1.5fr)_auto_minmax(210px,1.1fr)_minmax(230px,1fr)] @min-[1180px]/page:items-stretch @min-[1180px]/page:gap-x-6 @min-[1180px]/page:gap-y-0"
      >
        <Skeleton
          className="h-[196px] w-full @max-[640px]/page:col-span-full @max-[640px]/page:h-[160px] @min-[1180px]/page:h-auto @min-[1180px]/page:min-h-[110px]"
          style={{ maxHeight: BURNUP_HEIGHT }}
        />
        <div className="flex items-center gap-4">
          <AioDonutSkeleton size={DONUT_GRAPH_SIZE} testId="skeleton-donut" />
          <div className="flex flex-1 flex-col gap-2 @min-[1180px]/page:w-20">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        {/* Band order is burnup, MRs, type, assignee; 2x2 puts assignee third. */}
        <div className="flex flex-col gap-1 @max-[640px]/page:order-4 @max-[640px]/page:col-span-full @min-[1180px]/page:order-last">
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
      <div data-testid="skeleton-table" className="flex flex-col gap-2 px-6 pt-6">
        <Skeleton className="h-4 w-40" />
        {Array.from({ length: 6 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          <Skeleton key={i} data-testid="skeleton-table-row" className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
