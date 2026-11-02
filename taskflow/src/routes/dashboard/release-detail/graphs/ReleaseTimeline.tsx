import { dateKeyMs, formatDateKey } from '@/lib/epic-progress';
import type { BurnupAxis } from '../releaseBurnup';
import type { TimelineSummary } from './ReleaseProgressHeader';

export type { TimelineSummary };

function frac(day: string, start: string, end: string): number {
  const span = dateKeyMs(end) - dateKeyMs(start);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (dateKeyMs(day) - dateKeyMs(start)) / span));
}

/** Left/centre/right anchoring so edge labels stay inside the track. */
function anchor(f: number): { left: string; transform: string } {
  const transform =
    f < 0.12 ? 'translateX(-6px)' : f > 0.88 ? 'translateX(calc(-100% + 6px))' : 'translateX(-50%)';
  return { left: `${f * 100}%`, transform };
}

/**
 * Stands in for the burnup while the release has fewer than two days of
 * history: a start -> today -> release track (the countdown header is shared).
 */
export function ReleaseTimeline({
  axis,
  summary,
  className,
}: {
  axis: BurnupAxis | null;
  summary: TimelineSummary;
  className?: string;
}) {
  const end = axis ? axis.end : summary.today;
  const start = axis ? axis.start : summary.today;
  const todayF = frac(summary.today, start, end);
  const releaseF =
    summary.releaseDate && axis?.showRelease ? frac(summary.releaseDate, start, end) : null;
  return (
    <div data-testid="release-graph-burnup-thin" className={className}>
      <div className="px-2 pb-1" aria-hidden="true">
        <div className="relative h-12">
          <div className="absolute inset-x-0 top-[23px] h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute left-0 top-[23px] h-1.5 -translate-y-1/2 rounded-full bg-foreground/20"
            style={{ width: `${todayF * 100}%` }}
          />
          {/* Start dot only when it is not the same spot as TODAY. */}
          {todayF > 0 ? (
            <div className="absolute left-0 top-[23px] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60" />
          ) : null}
          <div
            className="absolute top-[23px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${todayF * 100}%` }}
          />
          <div
            className="absolute top-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-foreground"
            style={anchor(todayF)}
          >
            Today
          </div>
          {releaseF !== null ? (
            <>
              <div
                className="absolute top-[23px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-background"
                style={{ left: `${releaseF * 100}%` }}
              />
              <div
                className="absolute top-0 whitespace-nowrap text-[10px] uppercase tracking-wide text-muted-foreground"
                style={anchor(releaseF)}
              >
                Release
              </div>
            </>
          ) : null}
          <div className="absolute bottom-0 left-0 max-w-[60%] truncate text-xs text-muted-foreground">
            {axis?.previousName ? `${axis.previousName} · ` : 'Started '}
            {formatDateKey(start)}
          </div>
        </div>
      </div>
    </div>
  );
}
