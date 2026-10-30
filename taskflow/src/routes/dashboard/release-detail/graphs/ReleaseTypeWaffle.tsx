import { Shapes } from 'lucide-react';
import { useEffect, useState } from 'react';
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
import {
  type ReleaseTypeRow,
  WAFFLE_LAYOUT,
  waffleCapacity,
  waffleCells,
  waffleUnit,
} from '../releaseBuckets';
import { GraphSlot, NEW_TONE_CLASS, WAFFLE_SKELETON_ROWS } from './GraphSlot';

const FALLBACK_WIDTH = 640;
const { block: BLOCK, gap: GAP, nameCol: NAME_COL, rowGap: ROW_GAP } = WAFFLE_LAYOUT;

/**
 * By type: one row per issue type, one fixed 14px block per issue (done, in
 * progress, to do). Blocks never wrap or shrink: when the widest row would not
 * fit the cell, every row switches to the same scale of N issues per block and a
 * muted "1 block = N issues" note says so. The count sits right after the blocks.
 */
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
  // Callback ref: the cell only mounts once the slot is ready, so an effect on a
  // useRef would never see it and fall back to a wide default width.
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(0);
  useEffect(() => {
    if (!el) return;
    setMeasured(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  const capacity = waffleCapacity(measured > 0 ? measured : FALLBACK_WIDTH);
  const maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 0);
  const unit = waffleUnit(maxTotal, capacity);
  const cells = rows.map((r) => waffleCells(r.breakdown, unit));
  const maxBlocks = cells.reduce((m, c) => Math.max(m, c.done + c.indeterminate + c.new), 1);
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
      <div ref={setEl} className="flex min-w-0 flex-col gap-2">
        {rows.map((row, ri) => (
          <Tooltip key={row.typeName}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`type-row-${row.typeName}`}
              className="relative z-10 grid items-center"
              style={{
                columnGap: ROW_GAP,
                gridTemplateColumns: `${NAME_COL}px ${maxBlocks * (BLOCK + GAP) - GAP}px auto`,
                maxWidth: '100%',
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5">
                <IssueTypeIcon typeName={row.typeName} muted className="size-3.5 shrink-0" />
                <span className="truncate text-xs">{row.typeName}</span>
              </div>
              <div className="flex flex-nowrap overflow-hidden" style={{ gap: GAP }}>
                {RELEASE_SEGMENT_ORDER.flatMap((cat) =>
                  Array.from({ length: cells[ri][cat] }, (_, i) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: cells are identical, order is fixed
                      key={`${cat}-${i}`}
                      data-testid="waffle-cell"
                      data-cat={cat}
                      className={cn(
                        'flex-none rounded-[3px]',
                        cat === 'new' ? NEW_TONE_CLASS : RELEASE_SEGMENT_CLASS[cat],
                      )}
                      style={{ width: BLOCK, height: BLOCK }}
                    />
                  )),
                )}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
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
        {unit > 1 ? (
          <div data-testid="waffle-scale" className="text-xs text-muted-foreground">
            1 block = {unit} issues
          </div>
        ) : null}
      </div>
    </GraphSlot>
  );
}
