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

/** One tooltip row: swatch · label · value (· sub). */
export function TooltipRow({
  color,
  label,
  value,
  sub,
  dashed,
}: {
  /** CSS colour of the swatch. */
  color?: string;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  dashed?: boolean;
}) {
  return (
    <div data-slot="tooltip-row" className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cn('size-2 shrink-0 rounded-[2px]', dashed && 'border border-dashed')}
        style={
          dashed
            ? { background: 'transparent', borderColor: color }
            : { background: color ?? 'transparent' }
        }
      />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium tabular-nums">{value}</span>
      {sub ? <span className="text-muted-foreground tabular-nums">{sub}</span> : null}
    </div>
  );
}
