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
  WAFFLE_LAYOUT_COMPACT,
  waffleColumns,
} from '../releaseBuckets';
import { GraphSlot, NEW_TONE_CLASS, WAFFLE_SKELETON_ROWS } from './GraphSlot';

const FALLBACK_WIDTH = 640;
const MAX_COMPACT_ROWS = 5;

/**
 * By type: one row per issue type, exactly one fixed 14px square per issue (done,
 * in progress, to do), never grouped. The squares area has the same column count
 * in every row (the widest row, capped by what the measured cell width allows);
 * longer rows wrap onto further lines, so lines form a clean grid. Label and
 * count stay on the first line.
 */
export function ReleaseTypeWaffle({
  rows,
  state,
  showStoryPoints,
  compact = false,
  className,
}: {
  rows: ReleaseTypeRow[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  showStoryPoints: boolean;
  /** Band mode: 12px squares, at most 5 type rows. */
  compact?: boolean;
  className?: string;
}) {
  const layout = compact ? WAFFLE_LAYOUT_COMPACT : WAFFLE_LAYOUT;
  const { block: BLOCK, gap: GAP, nameCol: NAME_COL, rowGap: ROW_GAP } = layout;
  const shownRows = compact ? rows.slice(0, MAX_COMPACT_ROWS) : rows;
  const hiddenRows = rows.length - shownRows.length;
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
  const maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 1);
  const cols = waffleColumns(maxTotal, measured > 0 ? measured : FALLBACK_WIDTH, layout);
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
        {shownRows.map((row) => (
          <Tooltip key={row.typeName}>
            <TooltipTrigger
              delay={0}
              render={<div />}
              data-testid={`type-row-${row.typeName}`}
              className="relative z-10 grid items-start"
              style={{
                columnGap: ROW_GAP,
                gridTemplateColumns: `${NAME_COL}px ${cols * (BLOCK + GAP) - GAP}px auto`,
                maxWidth: '100%',
              }}
            >
              <div className="flex min-w-0 items-center gap-1.5" style={{ height: BLOCK }}>
                <IssueTypeIcon typeName={row.typeName} muted className="size-3.5 shrink-0" />
                <span className="truncate text-xs">{row.typeName}</span>
              </div>
              <div
                className="grid"
                style={{ gap: GAP, gridTemplateColumns: `repeat(${cols}, ${BLOCK}px)` }}
              >
                {RELEASE_SEGMENT_ORDER.flatMap((cat) =>
                  Array.from({ length: row.breakdown[cat] }, (_, i) => (
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
              <span
                className="text-xs tabular-nums leading-none text-muted-foreground"
                style={{ lineHeight: `${BLOCK}px` }}
              >
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
        {hiddenRows > 0 ? (
          <div data-testid="waffle-more" className="text-xs text-muted-foreground">
            +{hiddenRows} more {hiddenRows === 1 ? 'type' : 'types'}
          </div>
        ) : null}
      </div>
    </GraphSlot>
  );
}
