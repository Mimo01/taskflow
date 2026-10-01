import type { ReactNode } from 'react';

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

/**
 * Marker shapes. Colour is for STATUSES only ('status'); every other marker is monochrome
 * (foreground / muted-foreground) so a coloured glyph always means a status.
 */
export type TooltipMarker = 'status' | 'line' | 'dashed' | 'band' | 'icon';
export type MarkerTone = 'strong' | 'muted';

const TONE_COLOR: Record<MarkerTone, string> = {
  strong: 'var(--color-foreground)',
  muted: 'var(--color-muted-foreground)',
};

/** The leading glyph shared by TooltipRow and the chart legends. */
export function MarkerGlyph({
  marker,
  color,
  tone = 'muted',
  icon,
}: {
  marker: TooltipMarker;
  /** CSS colour; used ONLY by 'status'. */
  color?: string;
  tone?: MarkerTone;
  icon?: ReactNode;
}) {
  if (marker === 'status') {
    return (
      <span
        aria-hidden="true"
        data-marker="status"
        className="size-2 shrink-0 rounded-[2px]"
        style={{ background: color }}
      />
    );
  }
  if (marker === 'icon') {
    return (
      <span
        aria-hidden="true"
        data-marker="icon"
        className="flex size-3 shrink-0 items-center justify-center text-muted-foreground"
      >
        {icon}
      </span>
    );
  }
  const c = TONE_COLOR[tone];
  if (marker === 'dashed') {
    return (
      <span
        aria-hidden="true"
        data-marker="dashed"
        data-tone={tone}
        className="h-0 w-2.5 shrink-0 border-t-2 border-dashed"
        style={{ borderColor: c }}
      />
    );
  }
  if (marker === 'band') {
    return (
      <span
        aria-hidden="true"
        data-marker="band"
        data-tone={tone}
        className="h-2 w-2.5 shrink-0 rounded-[2px] border opacity-30"
        style={{ background: c, borderColor: c }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-marker="line"
      data-tone={tone}
      className="h-0.5 w-2.5 shrink-0 rounded-full"
      style={{ background: c }}
    />
  );
}

/** One tooltip row: marker · label · value (· sub). */
export function TooltipRow({
  color,
  label,
  value,
  sub,
  marker,
  tone,
  icon,
}: {
  /** Status colour (marker 'status' only; neutral markers ignore it). */
  color?: string;
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Defaults to 'icon' when `icon` is set, 'status' when `color` is set, else a muted 'line'. */
  marker?: TooltipMarker;
  tone?: MarkerTone;
  icon?: ReactNode;
}) {
  const shape = marker ?? (icon ? 'icon' : color ? 'status' : 'line');
  return (
    <div data-slot="tooltip-row" className="flex items-center gap-2">
      <MarkerGlyph marker={shape} color={color} tone={tone} icon={icon} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto pl-3 font-mono font-medium tabular-nums">{value}</span>
      {sub ? <span className="text-muted-foreground tabular-nums">{sub}</span> : null}
    </div>
  );
}
