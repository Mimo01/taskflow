import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  breakdownTotal,
  RELEASE_SEGMENT_CLASS,
  RELEASE_SEGMENT_ORDER,
  releaseTooltipRows,
  type StatusBreakdown,
} from '@/lib/release-list';
import { cn } from '@/lib/utils';

/** Slim segmented Done / In Progress / To Do bar with a done/total figure. */
export function ReleaseIssueGraph({
  breakdown,
  loading,
  variant,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  /** Failed fetch: renders the same muted dash as idle (no data, not loading). */
  error: boolean;
  variant: 'list' | 'detail';
}) {
  const wrapper = cn('flex w-full items-center gap-2', variant === 'detail' && 'max-w-xl');

  if (!breakdown) {
    return (
      <div data-testid="release-graph" className={wrapper}>
        {loading ? (
          <>
            <Skeleton data-testid="release-graph-skeleton" className="h-2 flex-1 rounded-full" />
            {/* Reserve the figure slot so the bar does not shift when data arrives. */}
            {variant === 'list' && <span aria-hidden className="w-12 shrink-0" />}
          </>
        ) : (
          <span className="text-xs text-muted-foreground">–</span>
        )}
      </div>
    );
  }

  const total = breakdownTotal(breakdown);
  if (total === 0) {
    return (
      <div data-testid="release-graph" className={wrapper} role="img" aria-label="No issues">
        <div className="h-2 flex-1 rounded-full bg-muted" />
        <span className="text-xs text-muted-foreground">No issues</span>
      </div>
    );
  }

  const rows = releaseTooltipRows(breakdown);
  const figure =
    variant === 'list' ? `${breakdown.done}/${total}` : `${breakdown.done} / ${total} done`;

  return (
    <div data-testid="release-graph" className={wrapper}>
      <Tooltip>
        <TooltipTrigger
          delay={0}
          render={<div />}
          role="img"
          aria-label={`${breakdown.done} of ${total} issues done`}
          className="relative z-10 flex-1 py-1"
        >
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {RELEASE_SEGMENT_ORDER.filter((k) => breakdown[k] > 0).map((k) => (
              <div
                key={k}
                data-testid={`release-segment-${k}`}
                className={cn('h-full', RELEASE_SEGMENT_CLASS[k])}
                style={{ width: `${(breakdown[k] / total) * 100}%` }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <TooltipBody title={`${total} issues`}>
            {rows.map((r) => (
              <TooltipRow
                key={r.label}
                color={r.color}
                label={r.label}
                value={r.value}
                sub={`${Math.round((r.value / total) * 100)}%`}
              />
            ))}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
      <span
        className={cn(
          'text-xs tabular-nums text-muted-foreground',
          variant === 'list' ? 'w-12 shrink-0 text-right' : 'shrink-0',
        )}
      >
        {figure}
      </span>
    </div>
  );
}
