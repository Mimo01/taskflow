import { dateKeyMs, formatDateKey } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';
import type { BurnupAxis } from '../releaseBurnup';

export interface TimelineSummary {
  done: number;
  total: number;
  today: string;
  releaseDate: string | null;
  released: boolean;
}

const DAY = 86_400_000;

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

function countdown(s: TimelineSummary): { big: string; small: string; tone: string } {
  if (!s.releaseDate)
    return {
      big: 'No release date',
      small: 'Set one to see a countdown',
      tone: 'text-amber-600 dark:text-amber-400',
    };
  const days = Math.round((dateKeyMs(s.releaseDate) - dateKeyMs(s.today)) / DAY);
  const when = formatDateKey(s.releaseDate);
  if (s.released)
    return { big: 'Released', small: `on ${when}`, tone: 'text-green-600 dark:text-green-400' };
  if (days > 0)
    return {
      big: `${days} ${days === 1 ? 'day' : 'days'} left`,
      small: `until ${when}`,
      tone: 'text-foreground',
    };
  if (days === 0) return { big: 'Due today', small: when, tone: 'text-foreground' };
  const late = -days;
  return {
    big: `${late} ${late === 1 ? 'day' : 'days'} overdue`,
    small: `was due ${when}`,
    tone: 'text-red-600 dark:text-red-400',
  };
}

/**
 * Stands in for the burnup while the release has fewer than two days of
 * history: big done figure and countdown, then a start -> today -> release track.
 */
export function ReleaseTimeline({
  axis,
  summary,
  className,
  compact = false,
}: {
  axis: BurnupAxis | null;
  summary: TimelineSummary;
  className?: string;
  compact?: boolean;
}) {
  const cd = countdown(summary);
  const end = axis ? axis.end : summary.today;
  const start = axis ? axis.start : summary.today;
  const todayF = frac(summary.today, start, end);
  const releaseF =
    summary.releaseDate && axis?.showRelease ? frac(summary.releaseDate, start, end) : null;
  return (
    <div
      data-testid="release-graph-burnup-thin"
      className={cn('flex flex-col justify-evenly', className)}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <div
            className={cn(
              'font-semibold tabular-nums leading-none',
              compact ? 'text-xl' : 'text-2xl',
            )}
          >
            {summary.done}
            <span className="text-base font-normal text-muted-foreground"> / {summary.total}</span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">issues done</div>
        </div>
        <div className="text-right">
          <div
            className={cn('font-semibold leading-none', compact ? 'text-xl' : 'text-2xl', cd.tone)}
          >
            {cd.big}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{cd.small}</div>
        </div>
      </div>
      <div className="px-2 pb-1" aria-hidden="true">
        <div className="relative h-14">
          <div className="absolute inset-x-0 top-[27px] h-1.5 -translate-y-1/2 rounded-full bg-muted" />
          <div
            className="absolute left-0 top-[27px] h-1.5 -translate-y-1/2 rounded-full bg-foreground/20"
            style={{ width: `${todayF * 100}%` }}
          />
          {/* Start dot only when it is not the same spot as TODAY. */}
          {todayF > 0 ? (
            <div className="absolute left-0 top-[27px] size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/60" />
          ) : null}
          <div
            className="absolute top-[27px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${todayF * 100}%` }}
          />
          <div
            className="absolute top-0 whitespace-nowrap text-xs uppercase tracking-wide text-foreground"
            style={anchor(todayF)}
          >
            Today
          </div>
          {releaseF !== null ? (
            <>
              <div
                className="absolute top-[27px] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted-foreground bg-background"
                style={{ left: `${releaseF * 100}%` }}
              />
              <div
                className="absolute top-0 whitespace-nowrap text-xs uppercase tracking-wide text-muted-foreground"
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
