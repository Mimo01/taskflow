import { GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AioDonut, AioDonutSkeleton } from '../../aio-cycle/AioDonut';
import { mrDonutSlices } from '../releaseBuckets';
import {
  COMPACT_DONUT_SIZE,
  DONUT_GRAPH_SIZE,
  DonutCentre,
  GraphSlot,
  type GraphSlotState,
} from './GraphSlot';

type Counts = { merged: number; open: number; draft: number; closed: number };
/** Band: the ring grows with its column, within these bounds. */
const FILL_MIN = COMPACT_DONUT_SIZE;
const FILL_MAX = 160;
/** Breathing room kept between the grown ring and its box. */
const FILL_MARGIN = 12;
/** From this size the centre total uses the larger type. */
const LARGE_CENTRE = 150;
const ORDER = ['merged', 'open', 'draft', 'closed'] as const;
export const MR_ERROR_TEXT = "Couldn't load merge requests. Refresh to try again.";

export function ReleaseMrDonut({
  counts,
  state,
  compact = false,
  fill = false,
  className,
}: {
  counts: Counts;
  /**
   * Band only: the ring fills its (stretched) column, as large as the width and
   * the row height allow (FILL_MIN..FILL_MAX). The ring sits in an absolutely
   * positioned layer, so its size never feeds back into the row height.
   */
  fill?: boolean;
  state: GraphSlotState;
  compact?: boolean;
  className?: string;
}) {
  const [boxEl, setBoxEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!boxEl) return;
    const r = boxEl.getBoundingClientRect();
    setBox({ w: r.width, h: r.height });
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setBox({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(boxEl);
    return () => ro.disconnect();
  }, [boxEl]);
  const fillSize = Math.max(
    FILL_MIN,
    Math.min(FILL_MAX, Math.floor(Math.min(box.w, box.h)) - FILL_MARGIN),
  );
  const slices = mrDonutSlices(counts);
  const total = ORDER.reduce((n, k) => n + counts[k], 0);
  const label = `Merge requests: ${ORDER.filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${k}`)
    .join(', ')}`;
  // No legend: slice counts come from the hover tooltip and the aria-label.
  const ring = (size: number) => (
    <AioDonut
      slices={slices}
      size={size}
      testId="release-mr-donut"
      ariaLabel={label}
      center={<DonutCentre total={total} caption="MRs" large={size >= LARGE_CENTRE} />}
    />
  );
  return (
    <GraphSlot
      title="Merge requests"
      icon={GitMerge}
      state={state}
      height={DONUT_GRAPH_SIZE}
      emptyLabel="No merge requests yet"
      errorLabel={MR_ERROR_TEXT}
      testId="release-graph-mrs"
      className={className}
      skeleton={
        <div className="flex justify-center">
          <AioDonutSkeleton size={DONUT_GRAPH_SIZE} testId="release-mr-donut-skeleton" />
        </div>
      }
    >
      {fill ? (
        <div ref={setBoxEl} className="relative min-h-0 flex-1" style={{ minHeight: FILL_MIN }}>
          <div className="absolute inset-0 flex items-center justify-center">{ring(fillSize)}</div>
        </div>
      ) : (
        <div className="my-auto flex justify-center">
          {ring(compact ? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE)}
        </div>
      )}
    </GraphSlot>
  );
}
