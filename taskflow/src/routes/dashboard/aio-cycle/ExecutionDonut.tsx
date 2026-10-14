import { executionSlices } from '@/lib/aio-cycle-charts';
import { AioDonut, AioDonutSkeleton } from './AioDonut';
import { VALUE_CLASS } from './AioTile';
import type { AioStatusCounts } from './useAioCycleData';

const SIZE = 160;

/** Execution Distribution donut: status colours, no legend, executed/total in the centre. */
export function ExecutionDonut({
  counts,
  total,
  loading,
}: {
  counts: AioStatusCounts;
  total: number;
  loading: boolean;
}) {
  if (loading) return <AioDonutSkeleton size={SIZE} testId="exec-donut-skeleton" />;
  if (total === 0) {
    return (
      <AioDonutSkeleton size={SIZE} testId="exec-donut-empty" pulse={false}>
        <span className="px-6 text-xs text-muted-foreground">No runs recorded</span>
      </AioDonutSkeleton>
    );
  }
  const executed = counts.pass + counts.fail + counts.blocked;
  const label = `Execution distribution: ${counts.pass} passed, ${counts.fail} failed, ${counts.blocked} blocked, ${counts.inProgress} in progress, ${counts.notRun} not run`;
  return (
    <AioDonut
      slices={executionSlices(counts)}
      size={SIZE}
      testId="exec-donut"
      ariaLabel={label}
      center={
        <>
          <span className={VALUE_CLASS}>
            {executed}/{total}
          </span>
          <span className="text-xs text-muted-foreground">executed</span>
        </>
      }
    />
  );
}
