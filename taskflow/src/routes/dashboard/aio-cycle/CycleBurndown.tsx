'use no memo';

/**
 * Compact AIO-style cycle burndown: neutral step line of remaining cases with a status-coloured
 * diamond per execution, plus a thin dashed straight ideal line. No legend; colour = status only.
 */
import { useRef } from 'react';
import { ComposedChart, Line, XAxis, YAxis } from 'recharts';
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
import { PLOT_MARGIN, useElementWidth, Y_AXIS_WIDTH } from '../issue-detail/EpicChartZoom';

const PLOT_H = 140;
const CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };
const TOOLTIP_WRAPPER = { zIndex: 50 };

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
  return <Diamond key={key} cx={cx} cy={cy} r={4} fill={burndownMarkerColor(payload.marker)} />;
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
      <Skeleton
        data-testid="cycle-burndown-skeleton"
        className="w-full"
        style={{ height: PLOT_H }}
      />
    );
  }
  if (!series) return null;

  const fromKey = toDateKey(series.from);
  const toKey = toDateKey(series.to);
  const ticks = fromKey && toKey ? timeTicks(fromKey, toKey, width) : [];

  return (
    <div data-testid="cycle-burndown" className="w-full min-w-0">
      <div ref={plotRef} style={{ height: PLOT_H }}>
        <ChartContainer
          config={{}}
          className="aspect-auto h-full w-full"
          aria-label="Cycle burndown chart"
        >
          <ComposedChart data={series.points} responsive margin={PLOT_MARGIN}>
            <XAxis
              type="number"
              dataKey="t"
              scale="time"
              domain={[series.from, series.to]}
              allowDataOverflow
              ticks={ticks.map((x) => x.t)}
              tickFormatter={(v) =>
                ticks.find((x) => x.t === Number(v))?.label ?? dayLabel(Number(v))
              }
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={[0, series.total]}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={Y_AXIS_WIDTH}
            />
            <ChartTooltip
              cursor={CURSOR}
              wrapperStyle={TOOLTIP_WRAPPER}
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
              strokeOpacity={0.6}
              strokeWidth={1}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              dataKey="remaining"
              type="stepAfter"
              stroke="var(--color-foreground)"
              strokeOpacity={0.7}
              strokeWidth={1.5}
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
