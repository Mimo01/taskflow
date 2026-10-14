import { executionSlices } from '@/lib/aio-cycle-charts';
import { AioDonut, AioDonutSkeleton, HERO_DONUT_SIZE } from './AioDonut';
import { VALUE_CLASS } from './AioTile';
import type { AioStatusCounts } from './useAioCycleData';

/**
 * Execution Distribution donut: status colours, executed/total in the centre, counts per
 * slice on hover. No key: the Executions tab's status chips right below already carry every
 * per-status count.
 */
export function ExecutionDonut({
  counts,
  total,
  loading,
}: {
  counts: AioStatusCounts;
  total: number;
  loading: boolean;
}) {
  if (loading) return <AioDonutSkeleton size={HERO_DONUT_SIZE} testId="exec-donut-skeleton" />;
  if (total === 0) {
    return (
      <AioDonutSkeleton size={HERO_DONUT_SIZE} testId="exec-donut-empty" pulse={false}>
        No runs recorded
      </AioDonutSkeleton>
    );
  }
  const executed = counts.pass + counts.fail + counts.blocked;
  const label = `Execution distribution: ${counts.pass} passed, ${counts.fail} failed, ${counts.blocked} blocked, ${counts.inProgress} in progress, ${counts.notRun} not run`;
  return (
    <AioDonut
      slices={executionSlices(counts)}
      size={HERO_DONUT_SIZE}
      testId="exec-donut"
      ariaLabel={label}
      center={
        <>
          <span className={VALUE_CLASS}>
            {executed}/{total}
          </span>
          <span className="text-xs leading-4 text-muted-foreground">executed</span>
        </>
      }
    />
  );
}
