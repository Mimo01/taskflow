import { Skeleton } from '@/components/ui/skeleton';
import { AioDonutSkeleton } from '../aio-cycle/AioDonut';
import {
  ASSIGNEE_SKELETON_ROWS,
  BURNUP_HEIGHT,
  COMPACT_DONUT_SIZE,
  WAFFLE_SKELETON_ROWS,
} from './graphs/GraphSlot';

/** Graph slot heading placeholder (icon + title line, then the slot's mt-2). */
function SlotTitle({ width = 'w-24' }: { width?: string }) {
  return <Skeleton className={`mb-2 h-4 ${width}`} />;
}

/** Compact list rows (By status / By type / By assignee share the ~20-24px rhythm). */
function Rows({ count, height }: { count: number; height: number }) {
  return (
    <div className="flex flex-col gap-1">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          key={i}
          className="w-full"
          style={{ height }}
        />
      ))}
    </div>
  );
}

/** Hairline between side-by-side graph cells, as in ReleaseGraphGrid. */
const DIVIDER = 'border-l pl-4';

/**
 * Full-width skeleton mirroring the release detail layout (no sidebar).
 *
 * 94-REVIEW WR-05: it renders in place of the page's `@container/page` scroll
 * wrapper, so it is that container itself — otherwise none of its /page
 * container queries could match. The graphs mirror ReleaseGraphGrid: one
 * 4-column band from 1180px (BAND_MIN_WIDTH in ReleaseDetailPage) with
 * [Progress][Status over Type][Assignee][MR ring], a 2x2 grid (Progress |
 * lists, Assignee | ring) below it, lists full width under 640 and one column
 * under 440. The header includes the property strip line.
 */
export function ReleaseDetailSkeleton() {
  return (
    <div data-testid="release-detail-skeleton" className="@container/page flex-1 overflow-hidden">
      {/* Header extras: meta line, property strip (the title bar is the real DetailHeader) */}
      <div className="flex flex-col gap-1 px-6 pt-3 pb-2">
        <Skeleton className="h-4 w-96 max-w-full" />
        <Skeleton data-testid="skeleton-property-strip" className="mt-1 h-5 w-[28rem] max-w-full" />
      </div>
      {/* Stats block mirrors release-stats: done bar + graphs */}
      <div className="flex flex-col gap-3 border-b px-6 pt-1 pb-4">
        <div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
        <div
          data-testid="skeleton-graphs"
          className="mt-1 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-x-4 gap-y-4 @max-[640px]/page:grid-cols-[minmax(0,1fr)_auto] @max-[440px]/page:grid-cols-1 @min-[1180px]/page:grid-cols-[minmax(200px,1fr)_minmax(300px,1.1fr)_minmax(270px,1.1fr)_minmax(190px,0.8fr)] @min-[1180px]/page:gap-y-0"
        >
          {/* Progress: fills the band row; fixed plot height in the 2x2 */}
          <div className="flex min-w-0 flex-col @max-[640px]/page:col-span-full">
            <SlotTitle />
            <Skeleton
              className="h-[196px] w-full @max-[640px]/page:h-[160px] @min-[1180px]/page:h-auto @min-[1180px]/page:flex-1"
              style={{ maxHeight: BURNUP_HEIGHT }}
            />
          </div>
          {/* By status (3 rows) over By type */}
          <div
            data-testid="skeleton-lists"
            className={`flex min-w-0 flex-col gap-4 ${DIVIDER} @max-[640px]/page:col-span-full @max-[640px]/page:border-l-0 @max-[640px]/page:pl-0`}
          >
            <div>
              <SlotTitle />
              <Rows count={3} height={16} />
            </div>
            <div>
              <SlotTitle width="w-20" />
              <Rows count={WAFFLE_SKELETON_ROWS} height={16} />
            </div>
          </div>
          {/* By assignee */}
          <div
            data-testid="skeleton-assignees"
            className="flex min-w-0 flex-col @min-[1180px]/page:border-l @min-[1180px]/page:pl-4"
          >
            <SlotTitle width="w-28" />
            <Rows count={ASSIGNEE_SKELETON_ROWS} height={20} />
          </div>
          {/* MR ring, always last */}
          <div
            className={`flex min-w-0 flex-col ${DIVIDER} @max-[440px]/page:border-l-0 @max-[440px]/page:pl-0`}
          >
            <SlotTitle width="w-32" />
            <div className="flex flex-1 items-center justify-center">
              <AioDonutSkeleton size={COMPACT_DONUT_SIZE} testId="skeleton-donut" />
            </div>
          </div>
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
