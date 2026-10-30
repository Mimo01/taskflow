'use no memo';

import { TrendingUp } from 'lucide-react';
import { useRef } from 'react';
import { Area, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import { dateKeyMs, formatDateKey, timeTicks } from '@/lib/epic-progress';
import { PLOT_MARGIN, useElementWidth, Y_AXIS_WIDTH } from '../../issue-detail/EpicChartZoom';
import type { BurnupAxis, BurnupPoint } from '../releaseBurnup';
import { BURNUP_HEIGHT, GraphSlot } from './GraphSlot';
import { ReleaseTimeline, type TimelineSummary } from './ReleaseTimeline';

const TICK = { fontSize: 11, fill: 'var(--color-muted-foreground)' };
const CURSOR = { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' };
const TOOLTIP_WRAPPER = { zIndex: 50, pointerEvents: 'none' as const };
const GREEN = 'var(--color-green-500)';
const MUTED = 'var(--color-muted-foreground)';
const PLOT_CLASS = 'h-[196px] @max-[640px]/page:h-[160px]';

/** At most 4 integer ticks (0 plus up to three steps of 5/10/...). */
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

const PLOT_PX = 110;
const LABEL_GAP = 13;

/**
 * Plan for the two end labels. Equal scope and done collapse into one merged
 * label ("22 scope · done"). Otherwise scope sits above its own line and done
 * below its own (the scope line is always at or above the done line), so near
 * values cannot collide. When done is so close to the x-axis that a label below
 * would hit the tick row, done goes above the scope label, one label gap apart.
 */
export function burnupEndLabelDy(
  scope: number,
  done: number,
  top: number,
): { scopeDy: number; doneDy: number; merged: boolean } {
  const scopeDy = -5;
  if (scope === done) return { scopeDy, doneDy: scopeDy, merged: true };
  const doneRoom = (done / Math.max(1, top)) * PLOT_PX;
  if (doneRoom >= LABEL_GAP + 4) return { scopeDy, doneDy: LABEL_GAP, merged: false };
  const gapPx = ((scope - done) / Math.max(1, top)) * PLOT_PX;
  return { scopeDy, doneDy: scopeDy - gapPx - LABEL_GAP, merged: false };
}

const CHAR_W = 5.9;

/**
 * End label with a solid background rect behind the text (plus a stroke halo).
 * The rect does not depend on paint-order support, so a dashed or stepped line
 * can never show through the text in WebKit.
 */
function endLabel(
  last: number,
  text: string,
  color: string,
  flip: boolean,
  dy: number,
  hidden = false,
) {
  return (p: { x?: number | string; y?: number | string; index?: number }) => {
    const x = Number(p.x);
    const y = Number(p.y);
    if (hidden || p.index !== last || Number.isNaN(x) || Number.isNaN(y)) return <g />;
    const tw = text.length * CHAR_W;
    const tx = flip ? x - 6 : x + 6;
    const ty = y + dy;
    const rx = flip ? tx - tw - 3 : tx - 3;
    return (
      <g>
        <rect x={rx} y={ty - 11} width={tw + 6} height={14} rx={2} fill="var(--color-background)" />
        <text
          x={tx}
          y={ty}
          textAnchor={flip ? 'end' : 'start'}
          fontSize={11}
          fill={color}
          stroke="var(--color-background)"
          strokeWidth={3}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {text}
        </text>
      </g>
    );
  };
}

function markerLabel(text: string) {
  return {
    value: text,
    position: 'top' as const,
    fontSize: 12,
    className: 'uppercase tracking-wide',
    fill: MUTED,
  };
}

export function ReleaseBurnup({
  axis,
  points,
  state,
  showStoryPoints,
  summary,
  className,
}: {
  axis: BurnupAxis | null;
  points: BurnupPoint[];
  state: 'loading' | 'error' | 'empty' | 'ready';
  showStoryPoints: boolean;
  /** Drives the countdown timeline shown instead of the chart on a thin history. */
  summary: TimelineSummary;
  className?: string;
}) {
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(plotRef);
  const aside = axis
    ? axis.previousName
      ? `since ${axis.previousName} · ${formatDateKey(axis.start)}`
      : `since ${formatDateKey(axis.start)}`
    : undefined;
  const last = points[points.length - 1];
  const enough = state === 'ready' && !!axis && points.length >= 2 && !!last;
  const ticks = axis ? timeTicks(axis.start, axis.end, width) : [];
  const y = burnupYScale(points.reduce((m, p) => Math.max(m, p.scope), 0));
  const flip = !!axis && axis.seriesEnd === axis.end;
  const dy = burnupEndLabelDy(last?.scope ?? 0, last?.done ?? 0, y.top);

  return (
    <GraphSlot
      title="Progress"
      icon={TrendingUp}
      aside={aside}
      state={state}
      height={BURNUP_HEIGHT}
      emptyLabel="No issues"
      testId="release-graph-burnup"
      className={className}
    >
      {!enough || !axis ? (
        <ReleaseTimeline axis={axis} summary={summary} className={PLOT_CLASS} />
      ) : (
        <div
          ref={plotRef}
          className={PLOT_CLASS}
          role="img"
          aria-label={`Release burnup: ${last.scope} scope, ${last.done} done`}
        >
          <ChartContainer config={{}} className="aspect-auto h-full w-full">
            <ComposedChart data={points} responsive margin={{ ...PLOT_MARGIN, top: 20, right: 40 }}>
              <XAxis
                type="number"
                dataKey="t"
                scale="time"
                domain={[dateKeyMs(axis.start), dateKeyMs(axis.end)]}
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
              {axis.showToday ? (
                <ReferenceLine
                  x={dateKeyMs(axis.seriesEnd)}
                  stroke="var(--color-foreground)"
                  strokeOpacity={0.5}
                  label={markerLabel('TODAY')}
                />
              ) : null}
              {axis.showRelease && axis.releaseDate ? (
                <ReferenceLine
                  x={dateKeyMs(axis.releaseDate)}
                  stroke={MUTED}
                  strokeDasharray="4 3"
                  label={markerLabel('RELEASE')}
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
                dot={false}
                isAnimationActive={false}
                label={endLabel(
                  points.length - 1,
                  dy.merged ? `${last.scope} scope · done` : `${last.scope} scope`,
                  MUTED,
                  flip,
                  dy.scopeDy,
                )}
              />
              <Line
                dataKey="done"
                type="stepAfter"
                stroke={GREEN}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                label={endLabel(
                  points.length - 1,
                  `${last.done} done`,
                  GREEN,
                  flip,
                  dy.doneDy,
                  dy.merged,
                )}
              />
            </ComposedChart>
          </ChartContainer>
        </div>
      )}
    </GraphSlot>
  );
}
