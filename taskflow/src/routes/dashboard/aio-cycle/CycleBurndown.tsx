'use no memo';

/**
 * AIO-style cycle burndown, flat on the page (no card surface): a 2px neutral step line of remaining cases
 * over a faint area fill, a status-coloured diamond per execution, and a dashed working-day ideal
 * line. Non-working days are shaded when each day is wide enough to read. No legend; the only
 * status colour is on the diamonds.
 *
 * The wrapper is absolutely positioned: its parent supplies the height, so the chart adds none.
 */
import { useRef } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import {
  type BurndownPoint,
  type BurndownSeries,
  burndownMarkerColor,
} from '@/lib/aio-cycle-charts';
import { toDateKey } from '@/lib/aio-cycle-list';
import { formatDateKey, timeTicks } from '@/lib/epic-progress';
import { useElementWidth } from '../issue-detail/EpicChartZoom';

/** Shade non-working days only when each day is at least this many px wide. */
const MIN_BAND_DAY_PX = 4;
const DAY_MS = 86_400_000;
const TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' };
/** Flush to the column edges so the axis labels line up with the tiles above. */
const PLOT_MARGIN = { top: 6, right: 0, left: 0, bottom: 0 };
/** Approximate width of one 11px digit, to size the y-axis to its widest label. */
const DIGIT_PX = 6.5;
/** Minimum distance between the last x tick and the one before it. */
const MIN_LABEL_GAP_PX = 48;
const CURSOR = {
  stroke: 'var(--color-muted-foreground)',
  strokeDasharray: '3 3',
  strokeOpacity: 0.6,
};
const TOOLTIP_WRAPPER = { zIndex: 50, pointerEvents: 'none' as const };

const dayLabel = (t: number): string => {
  const key = toDateKey(t);
  return key ? formatDateKey(key) : '';
};

function Diamond({ cx, cy, r, fill }: { cx: number; cy: number; r: number; fill: string }) {
  return (
    <path
      d={`M${cx},${cy - r} L${cx + r},${cy} L${cx},${cy + r} L${cx - r},${cy} Z`}
      fill={fill}
      stroke="var(--color-background)"
      strokeWidth={1}
    />
  );
}

interface DotProps {
  cx?: number;
  cy?: number;
  index?: number;
  payload?: BurndownPoint;
}

function renderDot(p: DotProps) {
  const { cx, cy, payload, index } = p;
  const key = `dot-${index ?? payload?.t}`;
  if (cx === undefined || cy === undefined || !payload?.marker) return <g key={key} />;
  return <Diamond key={key} cx={cx} cy={cy} r={3.5} fill={burndownMarkerColor(payload.marker)} />;
}

function renderActiveDot(p: DotProps) {
  const { cx, cy, payload, index } = p;
  const key = `active-${index ?? payload?.t}`;
  if (cx === undefined || cy === undefined) return <g key={key} />;
  if (!payload?.marker) {
    return <circle key={key} cx={cx} cy={cy} r={3} fill="var(--color-foreground)" />;
  }
  return <Diamond key={key} cx={cx} cy={cy} r={5} fill={burndownMarkerColor(payload.marker)} />;
}

function BurndownTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: BurndownPoint }[];
}) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const time =
    p.executed > 0
      ? ` ${new Date(p.t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
      : '';
  return (
    <div className={TOOLTIP_SURFACE}>
      <TooltipBody title={`${dayLabel(p.t)}${time}`}>
        {p.remaining !== null ? <TooltipRow label="Remaining" value={p.remaining} /> : null}
        {p.executed > 0 && p.marker ? (
          <TooltipRow label="Executed" value={p.executed} color={burndownMarkerColor(p.marker)} />
        ) : null}
        {p.ideal !== null ? (
          <TooltipRow label="Ideal" value={Math.round(p.ideal)} marker="dashed" />
        ) : null}
      </TooltipBody>
    </div>
  );
}

export function CycleBurndown({
  series,
  loading,
}: {
  series: BurndownSeries | null;
  loading: boolean;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(plotRef);

  if (loading) {
    return (
      <Skeleton data-testid="cycle-burndown-skeleton" className="absolute inset-0 rounded-md" />
    );
  }
  if (!series) return null;

  const fromKey = toDateKey(series.from);
  const toKey = toDateKey(series.to);
  const allTicks = fromKey && toKey ? timeTicks(fromKey, toKey, width) : [];
  const spanDays = (series.to - series.from) / DAY_MS;
  const showBands = spanDays > 0 && width / spanDays >= MIN_BAND_DAY_PX;
  const yTicks = [0, ...(series.total >= 4 ? [Math.round(series.total / 2)] : []), series.total];
  const yWidth = Math.ceil(String(series.total).length * DIGIT_PX) + 4;
  const now = Date.now();
  // The axis always ends on `to`; drop an earlier tick whose label would collide with that one.
  const pxPerMs = series.to > series.from ? (width - yWidth) / (series.to - series.from) : 0;
  const lastT = allTicks.length > 0 ? allTicks[allTicks.length - 1].t : null;
  const ticks = allTicks.filter(
    (x) => lastT === null || x.t === lastT || (lastT - x.t) * pxPerMs >= MIN_LABEL_GAP_PX,
  );
  const lastTick = ticks.length > 0 ? ticks[ticks.length - 1].t : null;

  return (
    <div data-testid="cycle-burndown" className="absolute inset-0 overflow-visible">
      <div ref={plotRef} className="h-full w-full min-w-0">
        <ChartContainer
          config={{}}
          className="aspect-auto h-full w-full"
          aria-label="Cycle burndown chart"
        >
          <ComposedChart data={series.points} responsive margin={PLOT_MARGIN}>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.7} />
            {showBands
              ? series.nonWorking.map((r) => (
                  <ReferenceArea
                    key={`nw-${r.from}`}
                    x1={r.from}
                    x2={r.to}
                    fill="var(--color-muted-foreground)"
                    fillOpacity={0.08}
                    stroke="none"
                    ifOverflow="hidden"
                  />
                ))
              : null}
            <XAxis
              type="number"
              dataKey="t"
              scale="time"
              domain={[series.from, series.to]}
              allowDataOverflow
              ticks={ticks.map((x) => x.t)}
              tick={(p) => (
                <text
                  x={p.x}
                  y={p.y}
                  dy={10}
                  fontSize={TICK.fontSize}
                  fill={TICK.fill}
                  textAnchor={p.payload?.value === lastTick ? 'end' : 'middle'}
                >
                  {p.payload?.value === undefined
                    ? ''
                    : (ticks.find((x) => x.t === Number(p.payload.value))?.label ??
                      dayLabel(Number(p.payload.value)))}
                </text>
              )}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, series.total]}
              allowDecimals={false}
              ticks={yTicks}
              tick={TICK}
              tickLine={false}
              axisLine={false}
              tickSize={0}
              tickMargin={4}
              width={yWidth}
            />
            {now > series.from && now < series.to ? (
              <ReferenceLine
                x={now}
                stroke="var(--color-muted-foreground)"
                strokeOpacity={0.35}
                strokeWidth={1}
              />
            ) : null}
            <ChartTooltip
              cursor={CURSOR}
              wrapperStyle={TOOLTIP_WRAPPER}
              offset={12}
              content={(p) => (
                <BurndownTooltip
                  active={p.active}
                  payload={p.payload as readonly { payload?: BurndownPoint }[] | undefined}
                />
              )}
            />
            <Line
              dataKey="ideal"
              type="linear"
              stroke="var(--color-muted-foreground)"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Area
              dataKey="remaining"
              type="stepAfter"
              stroke="var(--color-foreground)"
              strokeWidth={2}
              fill="var(--color-foreground)"
              fillOpacity={0.06}
              connectNulls={false}
              dot={renderDot}
              activeDot={renderActiveDot}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ChartContainer>
      </div>
    </div>
  );
}
