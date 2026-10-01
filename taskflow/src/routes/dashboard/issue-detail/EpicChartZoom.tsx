/**
 * Shared zoom plumbing for the two epic charts (quick 261001-sqm): the lifted ChartZoom state
 * shape, the preset buttons, neutral Brush styling and the date-based range helpers. Zoom state
 * is date-keyed ({from,to}) because a recharts Brush is index-based on each chart's own data.
 */

import { type ChartRange, rangeIndexes, ZOOM_PRESETS, type ZoomPreset } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';

/** Plot height plus the Brush strip. */
export const CHART_HEIGHT = 252;

export interface ChartZoom {
  /** The full shared domain (axis start to latest forecast date). */
  domain: ChartRange;
  /** The visible range, clamped to the domain. */
  range: ChartRange;
  preset: ZoomPreset | null;
  forecastEnabled: boolean;
  /** Bumped by preset clicks only; with the domain, keys the Brush so it resyncs (never during a drag). */
  epoch: number;
  onPreset(p: ZoomPreset): void;
  onRange(r: ChartRange): void;
}

/** Neutral Brush strip props (no status colours; works in light and dark). */
export const BRUSH_STYLE = {
  height: 20,
  travellerWidth: 6,
  stroke: 'var(--color-muted-foreground)',
  fill: 'transparent',
} as const;

export const brushIndexes = rangeIndexes;

/**
 * The visible x range for a chart. Without shared zoom state (no valid axis start, e.g. a
 * worklog-only Time chart) it falls back to the data's own first/last date so the axis is
 * still numeric; zoom controls are then hidden.
 */
export function visibleRange(zoom: ChartZoom | null, data: { date: string }[]): ChartRange | null {
  if (zoom) return zoom.range;
  if (data.length === 0) return null;
  return { from: data[0].date, to: data[data.length - 1].date };
}

/** A brush needs 3+ points and a non-degenerate range. */
export function brushUsable(zoom: ChartZoom | null, data: unknown[]): zoom is ChartZoom {
  return zoom !== null && data.length >= 3 && zoom.domain.from < zoom.domain.to;
}

export function ZoomPresets({ zoom }: { zoom: ChartZoom }) {
  if (zoom.domain.from >= zoom.domain.to) return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: button toggle group; <fieldset> would add unwanted chrome
    <div
      role="group"
      aria-label="Chart range"
      data-testid="epic-zoom-presets"
      className="flex flex-none gap-1"
    >
      {ZOOM_PRESETS.map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={zoom.preset === p.key}
          disabled={p.key === 'forecast' && !zoom.forecastEnabled}
          onClick={() => zoom.onPreset(p.key)}
          className={cn(
            'cursor-pointer rounded-md px-2 py-0.5 text-xs ring-1 ring-foreground/10 disabled:cursor-default disabled:opacity-50',
            zoom.preset === p.key
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent disabled:hover:bg-transparent',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
