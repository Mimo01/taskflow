import { GitMerge } from 'lucide-react';
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
const ORDER = ['merged', 'open', 'draft', 'closed'] as const;
export const MR_ERROR_TEXT = "Couldn't load merge requests. Refresh to try again.";

export function ReleaseMrDonut({
  counts,
  state,
  compact = false,
  className,
}: {
  counts: Counts;
  state: GraphSlotState;
  compact?: boolean;
  className?: string;
}) {
  const slices = mrDonutSlices(counts);
  const total = ORDER.reduce((n, k) => n + counts[k], 0);
  const live = total - counts.closed;
  const pending = counts.open + counts.draft;
  const label = `Merge requests: ${ORDER.filter((k) => counts[k] > 0)
    .map((k) => `${counts[k]} ${k}`)
    .join(', ')}`;
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
      <div className="my-auto flex flex-col items-center gap-2">
        {/* No legend: slice counts come from the hover tooltip and the aria-label. */}
        <AioDonut
          slices={slices}
          size={compact ? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE}
          testId="release-mr-donut"
          ariaLabel={label}
          center={<DonutCentre total={total} caption="MRs" />}
        />
        {/* One-line takeaway under the ring (closed MRs never ship, so they are not counted). */}
        <p
          data-testid="release-mr-summary"
          className="text-center text-xs tabular-nums text-muted-foreground"
        >
          <span className="font-medium text-foreground">{counts.merged}</span> of {live} merged
          {pending > 0 ? ` · ${pending} open` : ''}
        </p>
      </div>
    </GraphSlot>
  );
}
