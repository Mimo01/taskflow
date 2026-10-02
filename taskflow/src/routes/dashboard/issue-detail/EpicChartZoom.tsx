/**
 * Shared zoom plumbing for the two epic charts (quick 261001-sqm): the lifted ChartZoom state
 * shape, the preset buttons, neutral Brush styling and the date-based range helpers. Zoom state
 * is date-keyed ({from,to}) because a recharts Brush is index-based on each chart's own data.
 */

import { type ChartRange, ZOOM_PRESETS, type ZoomPreset } from '@/lib/epic-progress';
import { cn } from '@/lib/utils';

export interface ChartZoom {
  /** The full shared domain (axis start to latest forecast date). */
  domain: ChartRange;
  /** The visible range, clamped to the domain. */
  range: ChartRange;
  preset: ZoomPreset | null;
  /** Zoom chrome (Brush + presets) is shown only for long domains. */
  enabled: boolean;
  /** Presets worth showing (lib visiblePresets); empty when zoom is disabled. */
  presets: ZoomPreset[];
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

/** Plot height without the Brush strip (short domains). */
export const PLOT_HEIGHT = 232;
/** Plot height plus the Brush strip (zoomable domains). */
export const CHART_HEIGHT = PLOT_HEIGHT + BRUSH_STYLE.height;

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
  return zoom?.enabled === true && data.length >= 3 && zoom.domain.from < zoom.domain.to;
}

/**
 * The chart slot height from the shared zoom state alone (no data): used by the skeleton /
 * empty states so they reserve the same height as the final chart. Task 3 swaps in the
 * navigator height here; chartHeight() below adds the data-length guard.
 */
export function slotHeight(zoom: ChartZoom | null): number {
  return zoom?.enabled === true && zoom.domain.from < zoom.domain.to ? CHART_HEIGHT : PLOT_HEIGHT;
}

/** Chart container height: taller only when the Brush strip is rendered. */
export function chartHeight(zoom: ChartZoom | null, data: unknown[]): number {
  return brushUsable(zoom, data) ? CHART_HEIGHT : PLOT_HEIGHT;
}

export function ZoomPresets({ zoom }: { zoom: ChartZoom }) {
  if (!zoom.enabled || zoom.domain.from >= zoom.domain.to) return null;
  return (
    // biome-ignore lint/a11y/useSemanticElements: button toggle group; <fieldset> would add unwanted chrome
    <div
      role="group"
      aria-label="Chart range"
      data-testid="epic-zoom-presets"
      className="flex flex-none gap-1"
    >
      {ZOOM_PRESETS.filter((p) => zoom.presets.includes(p.key)).map((p) => (
        <button
          key={p.key}
          type="button"
          aria-pressed={zoom.preset === p.key}
          onClick={() => zoom.onPreset(p.key)}
          className={cn(
            'cursor-pointer rounded-md px-2 py-0.5 text-xs ring-1 ring-foreground/10',
            zoom.preset === p.key ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
