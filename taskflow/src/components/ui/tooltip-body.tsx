import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The single tooltip surface for the epic-progress feature: base-ui TooltipContent
 * and the recharts custom tooltip both use it, so every tooltip looks identical.
 */
export const TOOLTIP_SURFACE =
  'rounded-lg bg-background px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-foreground/10';

/** Shared tooltip layout: optional title, rows, optional muted note. */
export function TooltipBody({
  title,
  children,
  note,
}: {
  title?: ReactNode;
  children?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="grid min-w-36 gap-1">
      {title ? <div className="font-medium">{title}</div> : null}
      {children}
      {note ? (
        <div className="mt-0.5 border-t border-border/50 pt-1 text-muted-foreground">{note}</div>
      ) : null}
    </div>
  );
}

export type TooltipMarker = 'swatch' | 'dot' | 'line';

/** One tooltip row: marker · label · value (· sub). */
export function TooltipRow({
  color,
  label,
  value,
  sub,
  dashed,
  marker,
  icon,
}: {
  /** CSS colour of the marker. */
  color?: string;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  dashed?: boolean;
  /**
   * Leading marker shape. Defaults to a square swatch when `color` is set, else a neutral
   * muted dot, so every row has something on the left. Use 'line' for line series.
   */
  marker?: TooltipMarker;
  /** Renders this icon (coloured via `color`) instead of a shape marker. */
  icon?: ReactNode;
}) {
  const shape = marker ?? (color ? 'swatch' : 'dot');
  return (
    <div data-slot="tooltip-row" className="flex items-center gap-2">
      {icon ? (
        <span
          aria-hidden="true"
          className="flex size-3 shrink-0 items-center justify-center"
          style={{ color }}
        >
          {icon}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            'shrink-0',
            dashed
              ? 'size-2 rounded-[2px] border border-dashed'
              : shape === 'swatch'
                ? 'size-2 rounded-[2px]'
                : shape === 'line'
                  ? 'h-0.5 w-2.5 rounded-full'
                  : 'size-2 rounded-full',
            !dashed && shape === 'dot' && !color && 'opacity-60',
          )}
          style={
            dashed
              ? { background: 'transparent', borderColor: color }
              : { background: color ?? 'var(--color-muted-foreground)' }
          }
        />
      )}
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium tabular-nums">{value}</span>
      {sub ? <span className="text-muted-foreground tabular-nums">{sub}</span> : null}
    </div>
  );
}
