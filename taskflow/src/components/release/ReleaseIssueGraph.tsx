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

export const BREAKDOWN_ERROR_TEXT = "Couldn't load issue counts";

/**
 * Failed counts fetch: the same muted dash as idle (UI-SPEC: no chip), but with a
 * tooltip naming the failure. It sits above any row overlay button so the title shows.
 */
export function BreakdownErrorDash() {
  return (
    <span
      data-testid="release-issues-error"
      role="img"
      title={BREAKDOWN_ERROR_TEXT}
      aria-label={BREAKDOWN_ERROR_TEXT}
      className="pointer-events-auto relative z-10 cursor-help text-xs text-muted-foreground"
    >
      –
    </span>
  );
}

/**
 * Release detail header bar: slim segmented Done / In Progress / To Do bar with a
 * "done / total done" figure. (List rows use ReleaseIssuesSlot instead.)
 */
export function ReleaseIssueGraph({
  breakdown,
  loading,
  error,
  fullWidth = false,
  statusNames,
}: {
  breakdown: StatusBreakdown | undefined;
  loading: boolean;
  /** Failed fetch with no data: a muted dash whose tooltip names the failure. */
  error: boolean;
  /** Span the full available width (drops the max-w-xl cap). */
  fullWidth?: boolean;
  /** Exact status names, shown as a 4th tooltip row. */
  statusNames?: string | null;
}) {
  const wrapper = cn('flex w-full items-center gap-2', !fullWidth && 'max-w-xl');

  if (!breakdown) {
    return (
      <div data-testid="release-graph" className={wrapper}>
        {loading ? (
          <Skeleton data-testid="release-graph-skeleton" className="h-2 flex-1 rounded-full" />
        ) : error ? (
          <BreakdownErrorDash />
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
  const figure = `${breakdown.done} / ${total} done`;

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
            {statusNames ? <TooltipRow label="Statuses" value={statusNames} /> : null}
          </TooltipBody>
        </TooltipContent>
      </Tooltip>
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{figure}</span>
    </div>
  );
}
