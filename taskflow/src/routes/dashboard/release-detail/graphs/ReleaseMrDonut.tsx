import { GitMerge } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AioDonut, AioDonutSkeleton } from '../../aio-cycle/AioDonut';
import { mrDonutSlices } from '../releaseBuckets';
import type { LabelCoverage } from '../releaseSummaries';
import { COMPACT_DONUT_SIZE, DONUT_GRAPH_SIZE, GraphSlot } from './GraphSlot';
import { MrLabelsLine } from './MrLabelsLine';

type Counts = { merged: number; open: number; draft: number; closed: number };
const ORDER = ['merged', 'open', 'draft', 'closed'] as const;

export function ReleaseMrDonut({
  counts,
  state,
  labelCoverage = null,
  compact = false,
  className,
}: {
  counts: Counts;
  state: 'loading' | 'empty' | 'ready';
  /** Footer line: MRs missing a label (omitted without coverage). */
  labelCoverage?: LabelCoverage | null;
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
      emptyLabel="No MRs in this milestone"
      testId="release-graph-mrs"
      className={className}
      skeleton={
        <div className="flex flex-wrap items-center gap-4">
          <AioDonutSkeleton size={DONUT_GRAPH_SIZE} testId="release-mr-donut-skeleton" />
          <div className="grid gap-1.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        </div>
      }
    >
      <div className={cn('my-auto flex flex-col items-center', compact ? 'gap-1.5' : 'gap-3')}>
        <div
          className={cn(
            'flex flex-wrap items-center justify-center gap-y-3',
            compact ? 'gap-x-4' : 'gap-x-8',
          )}
        >
          <AioDonut
            slices={slices}
            size={compact ? COMPACT_DONUT_SIZE : DONUT_GRAPH_SIZE}
            testId="release-mr-donut"
            ariaLabel={label}
            center={
              <>
                <span className="text-lg font-semibold tabular-nums">{total}</span>
                <span className="text-xs text-muted-foreground">MRs</span>
              </>
            }
          />
          <div className={cn('grid gap-1.5', !compact && 'min-w-28')}>
            {slices.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: s.color }}
                  aria-hidden="true"
                />
                <span className="tabular-nums text-foreground">{s.value}</span>
                <span className="text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
        <MrLabelsLine coverage={labelCoverage} />
      </div>
    </GraphSlot>
  );
}
