import { GitMerge } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AioDonut, AioDonutSkeleton } from '../../aio-cycle/AioDonut';
import { mrDonutSlices } from '../releaseBuckets';
import type { LabelCoverage } from '../releaseSummaries';
import { COMPACT_DONUT_SIZE, DONUT_GRAPH_SIZE, GraphSlot, type GraphSlotState } from './GraphSlot';
import { type MrLabelCount, MrLabels } from './MrLabels';

type Counts = { merged: number; open: number; draft: number; closed: number };
const ORDER = ['merged', 'open', 'draft', 'closed'] as const;
export const MR_ERROR_TEXT = "Couldn't load merge requests. Refresh to try again.";

export function ReleaseMrDonut({
  counts,
  state,
  labelCoverage = null,
  labelSummary = [],
  activeLabel = null,
  onToggleLabel,
  compact = false,
  className,
}: {
  counts: Counts;
  state: GraphSlotState;
  /** Footer line: MRs missing a label (omitted without coverage). */
  labelCoverage?: LabelCoverage | null;
  /** MR label chips for the footer line. */
  labelSummary?: MrLabelCount[];
  /** Label currently filtering the task table. */
  activeLabel?: string | null;
  /** Click a label pill to filter the task table by it. */
  onToggleLabel?: (name: string) => void;
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
      errorLabel={MR_ERROR_TEXT}
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
      <div className="my-auto flex flex-col gap-3">
        {/* Donut + state legend read as one unit: legend sits tight against the ring and
            is centred on it. Label pills get their own row below instead of competing for
            the same column. */}
        <div className={cn('flex items-center justify-center', compact ? 'gap-x-3' : 'gap-x-5')}>
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
          <div className="grid gap-1" data-testid="release-mr-legend">
            {slices.map((s) => (
              <div key={s.key} className="flex h-5 items-center gap-1.5 text-xs">
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
        <MrLabels
          className="max-w-none flex-row flex-wrap justify-center gap-1.5 border-l-0 pl-0"
          labelSummary={labelSummary}
          coverage={labelCoverage}
          activeLabel={activeLabel}
          onToggleLabel={onToggleLabel}
        />
      </div>
    </GraphSlot>
  );
}
