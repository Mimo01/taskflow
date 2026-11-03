'use no memo';

import { CalendarClock, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Area, ComposedChart, Line, ReferenceArea, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { EmptyState } from '@/components/ui/empty-state';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { dateKeyMs, formatDateKey, timeTicks } from '@/lib/epic-progress';
import { Y_AXIS_WIDTH } from '../../issue-detail/EpicChartZoom';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import {
  burnupMargin,
  burnupPlotBox,
  DOT_R,
  DOT_RING,
  layoutBurnupLabels,
  type MarkerLabel,
  X_AXIS_HEIGHT,
} from './burnupLabelLayout';
import { BURNUP_HEIGHT, COMPACT_DONUT_SIZE, GraphSlot } from './GraphSlot';

export interface TimelineSummary {
  done: number;
  total: number;
  today: string;
  releaseDate: string | null;
  released: boolean;
  /** This release's version name. */
  versionName?: string | null;
}

const TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' };
const CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };
const TOOLTIP_WRAPPER = { zIndex: 50, pointerEvents: 'none' as const };
/** Marker lines paint above the done area (100) but under the series lines and end dots (400). */
const MARKER_Z = 150;
const GREEN = 'var(--color-green-500)';
const MUTED = 'var(--color-muted-foreground)';
const PLOT_CLASS = 'h-[196px] @max-[640px]/page:h-[160px]';
const DAY_MS = 86_400_000;
const FALLBACK_WIDTH = 640;
/**
 * Compact (band) body height: the plot (or track), equal to the compact MR donut
 * (120px) so the Progress slot is never taller than its band siblings. Fixed at
 * every width so it neither drives nor stretches with the row.
 */
export const COMPACT_BODY_H = COMPACT_DONUT_SIZE;
/** Denser date axis than the epic charts (72px): a short "Oct 15" label needs ~40px. */
export const BURNUP_TICK_PX = 52;

const yearOf = (key: string) => Number(key.slice(0, 4));
const withYearLabel = (key: string) => {
  const y = yearOf(key);
  return y === new Date().getFullYear() ? formatDateKey(key) : `${formatDateKey(key)}, ${y}`;
};

/**
 * Burnup-local tick labels: the year shows on the first tick when the axis is not
 * entirely within the current year, and on the first tick of each new year.
 */
export function yearAwareTicks(
  ticks: { t: number; label: string }[],
  start: string,
  end: string,
  currentYear = new Date().getFullYear(),
): { t: number; label: string }[] {
  const allCurrent = yearOf(start) === currentYear && yearOf(end) === currentYear;
  return ticks.map((tk, i) => {
    const base = tk.label.replace(/,? \d{4}$/, '');
    const y = new Date(tk.t).getUTCFullYear();
    const prev = i > 0 ? new Date(ticks[i - 1].t).getUTCFullYear() : y;
    const show = i === 0 ? !allCurrent : y !== prev;
    if (!show) return { t: tk.t, label: base };
    return { t: tk.t, label: /\d/.test(base) ? `${base}, ${y}` : `${base} ${y}` };
  });
}

/** End-point dot with a background ring so it reads on the area fill. */
function endDot(last: number, color: string) {
  return (p: { index?: number; cx?: number; cy?: number }) => {
    if (p.index !== last || p.cx === undefined || p.cy === undefined) return <g />;
    return (
      <circle
        data-testid="burnup-end-dot"
        cx={p.cx}
        cy={p.cy}
        r={DOT_R}
        fill={color}
        stroke="var(--color-background)"
        strokeWidth={DOT_RING}
      />
    );
  };
}

/** At most 4 integer ticks (0 plus up to three steps of 5/10/...). */
/**
 * Series as plotted: every day is a day-wide step, so a closing point one day
 * after the last one gives the final day (release day / today) its width.
 */
export function closeLastDay(points: BurnupPoint[]): BurnupPoint[] {
  const last = points[points.length - 1];
  return last ? [...points, { ...last, t: last.t + DAY_MS }] : points;
}

export function burnupYScale(max: number): { top: number; ticks: number[] } {
  const step = Math.max(5, Math.ceil(Math.max(max, 1) / 3 / 5) * 5);
  const n = Math.max(1, Math.ceil(max / step));
  const ticks = Array.from({ length: n + 1 }, (_, i) => i * step);
  return { top: ticks[ticks.length - 1], ticks };
}

export function BurnupTooltip({
  active,
  payload,
  showStoryPoints,
}: {
  active?: boolean;
  payload?: readonly { payload?: BurnupPoint }[];
  showStoryPoints: boolean;
}) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className={TOOLTIP_SURFACE}>
      <TooltipBody title={formatDateKey(p.day)}>
        <TooltipRow label="Scope" value={p.scope} marker="line" />
        <TooltipRow label="Done" value={p.done} color={GREEN} marker="status-line" />
        {showStoryPoints ? <TooltipRow label="Story points done" value={p.doneSp} /> : null}
      </TooltipBody>
    </div>
  );
}

function markerLabel(label: MarkerLabel | undefined) {
  if (!label) return undefined;
  return {
    content: () => (
      <text
        x={label.x}
        y={label.y}
        textAnchor={label.anchor}
        fontSize={10}
        className="uppercase tracking-wide"
        fill={label.kind === 'release' ? MUTED : 'var(--color-foreground)'}
      >
        {label.text}
      </text>
    ),
  };
}

export function ReleaseBurnup({
  axis,
  points,
  state,
  showStoryPoints,
  summary,
  compact = false,
  className,
}: {
  axis: BurnupAxis | null;
  points: BurnupPoint[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  showStoryPoints: boolean;
  /** `today` decides the empty-state wording (window not open yet) and the header lead. */
  summary: TimelineSummary;
  /**
   * Band mode: a fixed COMPACT_BODY_H body (header + plot) at every width, so the
   * slot matches the band row instead of driving or following its height.
   */
  compact?: boolean;
  className?: string;
}) {
  // 94-REVIEW WR-01: callback ref (as in ReleaseTypeWaffle). The plot only mounts
  // once the slot is ready, so an effect on a useRef ran once with a null ref and
  // kept the fallback width — and the tick density chosen for it — for good.
  const [plotEl, setPlotEl] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState(0);
  const [measuredH, setMeasuredH] = useState(0);
  useEffect(() => {
    if (!plotEl) return;
    const r = plotEl.getBoundingClientRect();
    setMeasured(r.width);
    setMeasuredH(r.height);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect?.width) setMeasured(rect.width);
      if (rect?.height) setMeasuredH(rect.height);
    });
    ro.observe(plotEl);
    return () => ro.disconnect();
  }, [plotEl]);
  const width = measured > 0 ? Math.round(measured) : FALLBACK_WIDTH;
  const height = measuredH > 0 ? Math.round(measuredH) : compact ? COMPACT_BODY_H : BURNUP_HEIGHT;
  // One line, never wraps. With a previous release only its name shows (version
  // names usually carry the date already); the start date stays in the hover title.
  const sinceDate = axis ? withYearLabel(axis.start) : '';
  // Window not open yet (the previous release is still ahead): the release starts
  // "after" it, not "since" it.
  const notOpen = !!axis?.previousName && summary.today < axis.start;
  const lead = notOpen ? 'after' : 'since';
  const aside = axis ? (
    <span
      className="flex min-w-0 items-baseline whitespace-nowrap"
      title={
        axis.previousName ? `${lead} ${axis.previousName} · ${sinceDate}` : `since ${sinceDate}`
      }
    >
      {axis.previousName ? (
        <>
          <span className="shrink-0">{lead}&nbsp;</span>
          <span className="min-w-0 truncate text-foreground/80">{axis.previousName}</span>
        </>
      ) : (
        `since ${sinceDate}`
      )}
    </span>
  ) : undefined;
  const last = points[points.length - 1];
  const enough = state === 'ready' && !!axis && points.length >= 2 && !!last;
  // Each day is a day-wide step, so the last day needs a closing point one day on:
  // without it, issues done on release day (or today) were a zero-width sliver on
  // the marker line. Markers sit at the end of their day, where the series ends.
  const plotted = closeLastDay(points);
  const lastIdx = plotted.length - 1;
  const dayEnd = (key: string) => dateKeyMs(key) + DAY_MS;
  // Marker x positions depend only on the plot's left/right, so the label rows
  // (which move the plot top) are laid out on the one-row box first.
  const plotX = burnupPlotBox(width, height);
  const ticks = axis
    ? yearAwareTicks(
        timeTicks(axis.start, axis.end, plotX.right - plotX.left, BURNUP_TICK_PX),
        axis.start,
        axis.end,
      )
    : [];
  const maxScope = points.reduce((m, p) => Math.max(m, p.scope), 0);
  const y = burnupYScale(maxScope);
  const labels = (() => {
    if (!axis || !last) return null;
    const t0 = dateKeyMs(axis.start);
    const span = Math.max(1, dayEnd(axis.end) - t0);
    const xOf = (t: number) => plotX.left + ((t - t0) / span) * (plotX.right - plotX.left);
    // Only RELEASE is labelled; the TODAY line carries no label.
    const markers: { kind: 'today' | 'release'; x: number }[] = [];
    if (axis.showRelease && axis.releaseDate)
      markers.push({ kind: 'release', x: xOf(dayEnd(axis.releaseDate)) });
    return layoutBurnupLabels({
      chartWidth: width,
      chartHeight: height,
      plot: plotX,
      markers,
    });
  })();
  const margin = burnupMargin(labels?.rows ?? 1);
  const releaseLabel = labels?.markers.find((m) => m.kind === 'release');

  return (
    <GraphSlot
      title="Progress"
      icon={TrendingUp}
      aside={aside}
      state={state}
      height={compact ? COMPACT_BODY_H : BURNUP_HEIGHT}
      emptyLabel="No issues"
      testId="release-graph-burnup"
      className={className}
    >
      <div
        data-testid="release-burnup-body"
        className={compact ? 'flex flex-none flex-col' : 'flex min-h-0 flex-1 flex-col'}
        style={compact ? { height: COMPACT_BODY_H } : undefined}
      >
        {!enough || !axis ? (
          // Too little history for a chart (a future release, or one whose window
          // opened today): the app's standard empty state, tightened to fit the slot.
          <div data-testid="release-graph-burnup-thin" className="my-auto">
            <EmptyState
              compact
              className="py-0"
              icon={CalendarClock}
              title="No burnup yet"
              subtitle={
                notOpen && axis?.previousName
                  ? `It starts when ${axis.previousName} ships on ${formatDateKey(axis.start)}.`
                  : 'It appears after the first day of the release window.'
              }
            />
          </div>
        ) : (
          <div
            ref={setPlotEl}
            className={compact ? 'relative min-h-0 flex-1' : PLOT_CLASS}
            role="img"
            aria-label={`Release burnup: ${last.scope} scope, ${last.done} done`}
          >
            <ChartContainer
              config={{}}
              className={compact ? 'absolute inset-0 aspect-auto' : 'aspect-auto h-full w-full'}
            >
              <ComposedChart data={plotted} responsive margin={margin}>
                <XAxis
                  type="number"
                  dataKey="t"
                  scale="time"
                  domain={[dateKeyMs(axis.start), dayEnd(axis.end)]}
                  allowDataOverflow
                  ticks={ticks.map((x) => x.t)}
                  interval={0}
                  tick={TICK}
                  tickFormatter={(v) =>
                    ticks.find((x) => x.t === Number(v))?.label ??
                    formatDateKey(new Date(Number(v)).toISOString().slice(0, 10))
                  }
                  tickLine={false}
                  axisLine={false}
                  height={X_AXIS_HEIGHT}
                />
                <YAxis
                  domain={[0, y.top]}
                  ticks={y.ticks}
                  interval={0}
                  allowDecimals={false}
                  tick={TICK}
                  tickLine={false}
                  axisLine={false}
                  width={Y_AXIS_WIDTH}
                />
                <ChartTooltip
                  cursor={CURSOR}
                  wrapperStyle={TOOLTIP_WRAPPER}
                  content={(p) => (
                    <BurnupTooltip
                      active={p.active}
                      payload={p.payload as readonly { payload?: BurnupPoint }[] | undefined}
                      showStoryPoints={showStoryPoints}
                    />
                  )}
                />
                {axis.showToday &&
                axis.showRelease &&
                axis.releaseDate &&
                axis.releaseDate > axis.seriesEnd ? (
                  // Time left until release: a faint band so TODAY and RELEASE read as two
                  // lines even one day apart.
                  <ReferenceArea
                    x1={dayEnd(axis.seriesEnd)}
                    x2={dayEnd(axis.releaseDate)}
                    fill={MUTED}
                    fillOpacity={0.08}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ) : null}
                {axis.showToday ? (
                  <ReferenceLine
                    x={dayEnd(axis.seriesEnd)}
                    stroke="var(--color-foreground)"
                    strokeOpacity={0.5}
                    zIndex={MARKER_Z}
                  />
                ) : null}
                {axis.showRelease && axis.releaseDate ? (
                  <ReferenceLine
                    x={dayEnd(axis.releaseDate)}
                    stroke={MUTED}
                    strokeDasharray="4 3"
                    label={markerLabel(releaseLabel)}
                    zIndex={MARKER_Z}
                  />
                ) : null}
                <Area
                  dataKey="done"
                  type="stepAfter"
                  stroke="none"
                  fill={GREEN}
                  fillOpacity={0.12}
                  activeDot={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="scope"
                  type="stepAfter"
                  stroke={MUTED}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={last.scope === last.done ? false : endDot(lastIdx, MUTED)}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="done"
                  type="stepAfter"
                  stroke={GREEN}
                  strokeWidth={2}
                  dot={endDot(lastIdx, GREEN)}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        )}
      </div>
    </GraphSlot>
  );
}
