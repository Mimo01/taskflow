import type { ReactNode } from 'react';
import { Pie, PieChart, type PieSectorShapeProps, Sector, Tooltip } from 'recharts';
import { TOOLTIP_SURFACE, TooltipBody, TooltipRow } from '@/components/ui/tooltip-body';
import type { ChartSlice } from '@/lib/aio-cycle-charts';
import { cn } from '@/lib/utils';

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
 * No legend, no click handlers; hover tooltip per slice (at most 4 rows).
 */
export function AioDonut({
  slices,
  size,
  testId,
  ariaLabel,
  center,
}: {
  slices: ChartSlice[];
  size: number;
  testId: string;
  ariaLabel: string;
  center?: ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      role="img"
      aria-label={ariaLabel}
      className="relative flex-none"
      style={{ width: size, height: size }}
    >
      <PieChart width={size} height={size}>
        <Pie
          data={slices}
          dataKey="value"
          nameKey="label"
          innerRadius={size * 0.33}
          outerRadius={size * 0.47}
          paddingAngle={slices.length > 1 ? 1 : 0}
          stroke="none"
          isAnimationActive={false}
          shape={SliceShape}
        />
        <Tooltip content={SliceTooltip} />
      </PieChart>
      {center ? (
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          {center}
        </div>
      ) : null}
    </div>
  );
}

/** Same-size muted ring so geometry is identical while data loads. */
export function AioDonutSkeleton({
  size,
  testId,
  children,
  pulse = true,
}: {
  size: number;
  testId: string;
  children?: ReactNode;
  pulse?: boolean;
}) {
  return (
    <div data-testid={testId} className="relative flex-none" style={{ width: size, height: size }}>
      <div
        className={cn('size-full rounded-full border-muted', pulse && 'animate-pulse')}
        style={{ borderWidth: size * 0.14 }}
      />
      {children ? (
        <div className="absolute inset-0 grid place-content-center text-center">{children}</div>
      ) : null}
    </div>
  );
}
