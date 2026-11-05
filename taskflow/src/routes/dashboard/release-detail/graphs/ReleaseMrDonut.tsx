import { GitMerge, TriangleAlert } from 'lucide-react';
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
/** Release tasks with a live (non-closed) MR, and live MRs no release task covers. */
export type MrTaskCoverage = { tasksWithMr: number; tasks: number; uncoveredMrs: number };
const ORDER = ['merged', 'open', 'draft', 'closed'] as const;
export const MR_ERROR_TEXT = "Couldn't load merge requests. Refresh to try again.";

export function ReleaseMrDonut({
  counts,
  state,
  compact = false,
  coverage,
  className,
}: {
  counts: Counts;
  /** Shown under the ring: is every release task coded, is anything extra in. */
  coverage?: MrTaskCoverage;
  state: GraphSlotState;
  compact?: boolean;
  className?: string;
}) {
  const slices = mrDonutSlices(counts);
  const total = ORDER.reduce((n, k) => n + counts[k], 0);
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
        {coverage && coverage.tasks > 0 ? (
          <div className="flex flex-col items-center gap-0.5 text-center text-xs tabular-nums">
            <p data-testid="release-mr-coverage" className="text-muted-foreground">
              <span className="font-medium text-foreground">{coverage.tasksWithMr}</span> of{' '}
              {coverage.tasks} {coverage.tasks === 1 ? 'task has' : 'tasks have'} an MR
            </p>
            {coverage.uncoveredMrs > 0 ? (
              <p
                data-testid="release-mr-uncovered"
                className="flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400"
              >
                <TriangleAlert className="size-3 flex-none" aria-hidden="true" />
                {coverage.uncoveredMrs} {coverage.uncoveredMrs === 1 ? 'MR' : 'MRs'} not on a task
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </GraphSlot>
  );
}
