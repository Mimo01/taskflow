import { ListChecks } from 'lucide-react';
import { AioDonut, AioDonutSkeleton } from '../../aio-cycle/AioDonut';
import { type ReleaseStatusRow, statusDonutSlices } from '../releaseBuckets';
import {
  COMPACT_DONUT_SIZE,
  DONUT_GRAPH_SIZE,
  DonutCentre,
  GraphSlot,
  type GraphSlotState,
} from './GraphSlot';

const PHRASE: Record<string, string> = { done: 'done', indeterminate: 'in progress', new: 'to do' };

/**
 * By status: ring donut with three slices (done, in progress, to do). Twin of
 * ReleaseMrDonut: same size, ring, centre typography and heading. Exact Jira
 * status names live in the hover tooltip, there is no legend.
 */
export function ReleaseStatusDonut({
  rows,
  state,
  compact = false,
  className,
}: {
  rows: ReleaseStatusRow[];
  state: GraphSlotState;
  compact?: boolean;
  className?: string;
}) {
  const slices = statusDonutSlices(rows);
  const total = slices.reduce((n, s) => n + s.value, 0);
  const label = `Issues by status: ${slices.map((s) => `${s.value} ${PHRASE[s.key]}`).join(', ')}`;
  return (
    <GraphSlot
      title="By status"
      icon={ListChecks}
      state={state}
      height={DONUT_GRAPH_SIZE}
      emptyLabel="No issues"
      testId="release-graph-status"
      className={className}
      skeleton={
        <div className="flex justify-center">
          <AioDonutSkeleton size={DONUT_GRAPH_SIZE} testId="release-status-donut-skeleton" />
        </div>
      }
    >
      <div className="my-auto flex justify-center">
        <AioDonut
          slices={slices}
          size={compact ? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE}
          testId="release-status-donut"
          ariaLabel={label}
          center={<DonutCentre total={total} caption="issues" />}
        />
      </div>
    </GraphSlot>
  );
}
