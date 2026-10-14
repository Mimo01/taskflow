import type { ReactNode } from 'react';
import { Pie, PieChart, type PieSectorShapeProps, Sector, Tooltip } from 'recharts';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import type { ChartSlice } from '@/lib/aio-cycle-charts';
import { cn } from '@/lib/utils';

/** Every donut in the cycle stats block shares one diameter and one ring thickness. */
export const DONUT_SIZE = 100;
/** Hero donut (Execution Distribution). */
export const HERO_DONUT_SIZE = 192;
const INNER = 0.36;
const OUTER = 0.48;

function SliceShape(p: PieSectorShapeProps) {
  const { color } = p.payload as ChartSlice;
  return <Sector {...p} fill={color} />;
}

function SliceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: readonly { payload?: ChartSlice }[];
}) {
  const slice = active ? payload?.[0]?.payload : undefined;
  if (!slice) return null;
  return (
    <div className={TOOLTIP_SURFACE}>
      <TooltipBody title={slice.label}>
        {slice.rows.slice(0, 4).map((r) => (
          <TooltipRow key={r.label} label={r.label} value={r.value} color={r.color} />
        ))}
      </TooltipBody>
    </div>
  );
}

/**
 * Fixed-size recharts donut (no ResponsiveContainer: avoids 0-size measurement in WebKit/Tauri).
 * No legend, no click handlers; hover tooltip per slice (at most 4 rows). The hovered donut
 * stacks above its neighbours and the tooltip above the centre overlay.
 */
export function AioDonut({
  slices,
  size = DONUT_SIZE,
  testId,
  ariaLabel,
  center,
}: {
  slices: ChartSlice[];
  size?: number;
  testId: string;
  ariaLabel: string;
  center?: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      role="img"
      aria-label={ariaLabel}
      className="relative flex-none hover:z-50"
      style={{ width: size, height: size }}
    >
      <PieChart width={size} height={size}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          innerRadius={size * INNER}
          outerRadius={size * OUTER}
          paddingAngle={slices.length > 1 ? 1 : 0}
          stroke="none"
          isAnimationActive={false}
          shape={SliceShape}
        />
        <Tooltip content={SliceTooltip} wrapperStyle={{ zIndex: 50 }} />
      </PieChart>
      {center ? (
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {center}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Same-geometry muted ring: pulsing while data loads, still (with a short centred note) for
 * an empty state, so the block keeps its shape in every state.
 */
export function AioDonutSkeleton({
  size = DONUT_SIZE,
  testId,
  children,
  pulse = true,
}: {
  size?: number;
  testId: string;
  children?: ReactNode;
  pulse?: boolean;
}) {
  return (
    <div data-testid={testId} className="relative flex-none" style={{ width: size, height: size }}>
      <div
        className={cn('size-full rounded-full border-muted', pulse && 'animate-pulse')}
        style={{ borderWidth: size * (OUTER - INNER) }}
      />
      {children ? (
        <div className="absolute inset-0 grid place-content-center text-center">
          <span className="max-w-20 text-xs leading-4 text-muted-foreground">{children}</span>
        </div>
      ) : null}
    </div>
  );
}
