import { Shapes } from 'lucide-react';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  RELEASE_SEGMENT_CLASS,
  RELEASE_SEGMENT_ORDER,
  releaseTooltipRows,
} from '@/lib/release-list';
import { cn } from '@/lib/utils';
import type { ReleaseTypeRow } from '../releaseBuckets';
import { GraphSlot, WAFFLE_SKELETON_ROWS } from './GraphSlot';

/** By type: one row per issue type, one block per issue (scales with the cell) ordered done, in progress, to do. */
export function ReleaseTypeWaffle({
  rows,
  state,
  showStoryPoints,
  className,
}: {
  rows: ReleaseTypeRow[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  showStoryPoints: boolean;
  className?: string;
}) {
  // Every row shares one column count so squares line up and scale with the cell.
  const cols = Math.min(24, Math.max(6, ...rows.map((r) => r.total)));
  return (
    <GraphSlot
      title="By type"
      icon={Shapes}
      state={state}
      height={WAFFLE_SKELETON_ROWS * 28}
      emptyLabel="No issues"
      testId="release-graph-types"
      className={className}
      skeleton={
        <div className="flex flex-col gap-2">
          {Array.from({ length: WAFFLE_SKELETON_ROWS }, (_, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
              key={i}
              data-testid="waffle-skeleton-row"
              className="h-5 w-full"
            />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <Tooltip key={row.typeName}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`type-row-${row.typeName}`}
              className="relative z-10 grid grid-cols-[minmax(80px,110px)_minmax(0,1fr)_auto] items-center gap-3"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <IssueTypeIcon typeName={row.typeName} muted className="size-3.5 shrink-0" />
                <span className="truncate text-xs">{row.typeName}</span>
              </div>
              <div
                className="grid gap-[3px] py-0.5"
                style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 36px))` }}
              >
                {RELEASE_SEGMENT_ORDER.flatMap((cat) =>
                  Array.from({ length: row.breakdown[cat] }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: cells are identical, order is fixed
                      key={`${cat}-${i}`}
                      data-testid="waffle-cell"
                      data-cat={cat}
                      className={cn('h-3.5 w-full rounded-[3px]', RELEASE_SEGMENT_CLASS[cat])}
                    />
                  )),
                )}
              </div>
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {row.done}/{row.total}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <TooltipBody title={row.typeName}>
                {releaseTooltipRows(row.breakdown).map((r) => (
                  <TooltipRow key={r.label} color={r.color} label={r.label} value={r.value} />
                ))}
                {showStoryPoints ? <TooltipRow label="Story points" value={row.sp} /> : null}
              </TooltipBody>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </GraphSlot>
  );
}
