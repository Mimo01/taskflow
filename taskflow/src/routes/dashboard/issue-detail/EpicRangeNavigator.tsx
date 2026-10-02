/**
 * EpicRangeNavigator — the two-thumb date navigator under both epic charts (quick 261002-0xf,
 * replaces the index-based recharts Brush). A base-ui Slider over whole days from the domain
 * start, linear in time, drawn over a neutral sparkline of the series. The selection doubles as
 * the pan handle. Dragging reports live ranges (onLive, chart-local) and commits once on release
 * (onCommit); keyboard moves commit immediately.
 */
import { Slider } from '@base-ui/react/slider';
import { type PointerEvent, useRef } from 'react';
import {
  addCalendarDays,
  type ChartRange,
  dateKeyMs,
  formatDateRange,
  formatMonthYear,
  offsetsToRange,
  panDeltaDays,
  panRange,
  rangeToOffsets,
  spanDays,
  ZOOM_MIN_SPAN_DAYS,
} from '@/lib/epic-progress';
import { PLOT_MARGIN, Y_AXIS_WIDTH } from './EpicChartZoom';

export interface OverviewPoint {
  t: number;
  remaining: number | null;
  forecast: number | null;
}

interface EpicRangeNavigatorProps {
  domain: ChartRange;
  range: ChartRange;
  today: string;
  overview: OverviewPoint[];
  onLive(r: ChartRange): void;
  onCommit(r: ChartRange): void;
  onReset(): void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Aug 14, 2026" for a key. */
function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/**
 * SVG path of one series on a linear time scale (x proportional to t within the domain).
 * Null values are skipped (a gap starts a new sub-path). 'remaining' steps, 'forecast' is linear.
 * Both series share the y scale (the larger of the two maxima).
 */
export function sparklinePath(
  points: OverviewPoint[],
  domain: ChartRange,
  key: 'remaining' | 'forecast',
  width = 1000,
  height = 100,
): string {
  const t0 = dateKeyMs(domain.from);
  const span = Math.max(1, dateKeyMs(domain.to) - t0);
  let max = 0;
  for (const p of points) max = Math.max(max, p.remaining ?? 0, p.forecast ?? 0);
  if (max <= 0) max = 1;
  const x = (t: number) => Math.round(((t - t0) / span) * width * 100) / 100;
  const y = (v: number) => Math.round((height - (v / max) * height) * 100) / 100;
  let d = '';
  let prevY: number | null = null;
  for (const p of points) {
    const v = p[key];
    if (v === null || v === undefined) {
      prevY = null;
      continue;
    }
    const px = x(p.t);
    const py = y(v);
    if (prevY === null) d += `${d ? ' ' : ''}M${px} ${py}`;
    else if (key === 'remaining') d += ` L${px} ${prevY} L${px} ${py}`;
    else d += ` L${px} ${py}`;
    prevY = py;
  }
  return d;
}

export function EpicRangeNavigator({
  domain,
  range,
  today,
  overview,
  onLive,
  onCommit,
  onReset,
}: EpicRangeNavigatorProps) {
  const total = spanDays(domain);
  const controlRef = useRef<HTMLDivElement>(null);
  const pan = useRef<{ x: number; range: ChartRange; width: number; last: ChartRange } | null>(
    null,
  );
  const toRange = (v: number | readonly number[]) => {
    const a = typeof v === 'number' ? [v, v] : v;
    return offsetsToRange([a[0], a[1]], domain);
  };

  const onPanDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const width = controlRef.current?.getBoundingClientRect().width ?? 0;
    pan.current = { x: e.clientX, range, width, last: range };
  };
  const onPanMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pan.current;
    if (!p) return;
    const delta = panDeltaDays(e.clientX, p.x, p.width, total);
    p.last = panRange(p.range, domain, delta);
    onLive(p.last);
  };
  const onPanEnd = () => {
    const p = pan.current;
    pan.current = null;
    // A click without movement (or the first half of a double-click) is not a zoom change:
    // committing it would clear the active preset.
    if (p && (p.last.from !== p.range.from || p.last.to !== p.range.to)) onCommit(p.last);
  };

  const remainingPath = sparklinePath(overview, domain, 'remaining');
  const forecastPath = sparklinePath(overview, domain, 'forecast');

  return (
    // biome-ignore lint/a11y/useSemanticElements: labelled wrapper for the slider pair; <fieldset> would add unwanted chrome
    <div
      role="group"
      aria-label="Visible dates"
      data-testid="epic-range-navigator"
      // Inset to the plot area (Y axis on the left, chart margin on the right) so the slider spans the same width.
      style={{ paddingLeft: Y_AXIS_WIDTH, paddingRight: PLOT_MARGIN.right }}
      className="mt-2 flex flex-col gap-1"
    >
      <div className="relative h-7">
        <svg
          viewBox="0 0 1000 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 size-full text-muted-foreground"
        >
          <path
            d={remainingPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={forecastPath}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <Slider.Root
          value={rangeToOffsets(range, domain)}
          min={0}
          max={total}
          step={1}
          largeStep={7}
          minStepsBetweenValues={ZOOM_MIN_SPAN_DAYS}
          thumbCollisionBehavior="none"
          onValueChange={(v) => onLive(toRange(v))}
          onValueCommitted={(v) => onCommit(toRange(v))}
          className="absolute inset-0"
        >
          <Slider.Control ref={controlRef} className="relative h-full w-full touch-none">
            <Slider.Track className="relative h-full w-full rounded-sm ring-1 ring-foreground/10">
              <Slider.Indicator
                onPointerDown={onPanDown}
                onPointerMove={onPanMove}
                onPointerUp={onPanEnd}
                onPointerCancel={onPanEnd}
                onDoubleClick={onReset}
                className="cursor-grab touch-none rounded-sm bg-foreground/10 ring-1 ring-foreground/20 active:cursor-grabbing"
              />
            </Slider.Track>
            {[0, 1].map((i) => (
              <Slider.Thumb
                key={i}
                index={i}
                getAriaLabel={(idx) => (idx === 0 ? 'Range start' : 'Range end')}
                getAriaValueText={(_f, value) => longDate(addCalendarDays(domain.from, value))}
                className="h-full w-3 cursor-ew-resize rounded-sm bg-foreground/60 before:absolute before:inset-y-0 before:left-1/2 before:w-6 before:-translate-x-1/2 before:content-[''] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
              />
            ))}
          </Slider.Control>
        </Slider.Root>
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatMonthYear(domain.from)}</span>
        <span data-testid="epic-range-caption">
          {`${formatDateRange(range.from, range.to, today)} (${spanDays(range)} d)`}
        </span>
        <span>{formatMonthYear(domain.to)}</span>
      </div>
    </div>
  );
}
