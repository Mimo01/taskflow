/**
 * Shared zoom plumbing for the two epic charts (quick 261001-sqm, reworked in 261002-0xf): the
 * lifted ChartZoom state shape, the preset buttons, the chart heights, the live-drag hook and the
 * date-based range helpers. Zoom state is date-keyed ({from,to}); the date navigator
 * (EpicRangeNavigator) replaces the old index-based recharts Brush.
 */

import { Info } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  type AveragedForecast,
  type ChartRange,
  VIEW_MAX_POINTS,
  viewSample,
  ZOOM_PRESETS,
  type ZoomPreset,
} from '@/lib/epic-progress';
import { cn } from '@/lib/utils';

export interface ChartZoom {
  /** The full shared domain (axis start to latest forecast date). */
  domain: ChartRange;
  /** The visible range, clamped to the domain. */
  range: ChartRange;
  preset: ZoomPreset | null;
  /** Zoom chrome (navigator + presets) is shown only for long domains. */
  enabled: boolean;
  /** Presets worth showing (lib visiblePresets); empty when zoom is disabled. */
  presets: ZoomPreset[];
  onPreset(p: ZoomPreset): void;
  onRange(r: ChartRange): void;
}

/** Plot height without the navigator (short domains). */
export const PLOT_HEIGHT = 232;
/** Navigator: 8px gap (mt-2) + 28px track + 4px inner gap + 16px label row. */
export const NAVIGATOR_HEIGHT = 56;
/** Fixed toolbar row above the chart (source flag + zoom presets). */
export const TOOLBAR_HEIGHT = 24;
/** Plot height plus the navigator (zoomable domains). */
export const CHART_HEIGHT = PLOT_HEIGHT + NAVIGATOR_HEIGHT;
/** Both charts use the same Y axis width so switching tabs never shifts the plot. */
export const Y_AXIS_WIDTH = 40;

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

/** The navigator is rendered only when zoom is enabled and the domain is non-degenerate. */
export function zoomUsable(zoom: ChartZoom | null): zoom is ChartZoom {
  return zoom?.enabled === true && zoom.domain.from < zoom.domain.to;
}

/**
 * The chart slot height from the shared zoom state alone. The charts, their skeleton / error
 * states and the empty-estimate block all use this one helper, so switching tab or state never
 * jumps (the section skeleton, drawn before the domain is known, is the accepted exception).
 */
export function chartHeight(zoom: ChartZoom | null): number {
  return zoomUsable(zoom) ? CHART_HEIGHT : PLOT_HEIGHT;
}

/** Element width via ResizeObserver (fallback until the first measurement). */
export function useElementWidth(ref: RefObject<HTMLElement | null>, fallback = 640): number {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(Math.round(w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * Drag-local range: onLive updates a local range (at most once per animation frame) so only the
 * chart re-renders while dragging; onCommit publishes to the section and clears the local state.
 */
export function useLiveRange(zoom: ChartZoom | null, fallback: ChartRange | null) {
  const [live, setLive] = useState<ChartRange | null>(null);
  const pending = useRef<ChartRange | null>(null);
  const frame = useRef<number | null>(null);
  const cancel = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    pending.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  // Drop any drag-local range once the shared range changes (preset, reset, rebase), so a drag that
  // ends without a commit (blur, Escape, cancelled pointer) can't leave the chart stuck on it.
  const sharedFrom = zoom?.range.from;
  const sharedTo = zoom?.range.to;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset keyed on the shared range only
  useEffect(() => {
    cancel();
    setLive(null);
  }, [sharedFrom, sharedTo, cancel]);
  const onLive = useCallback((r: ChartRange) => {
    pending.current = r;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (pending.current) setLive(pending.current);
    });
  }, []);
  const onCommit = useCallback(
    (r: ChartRange) => {
      cancel();
      zoom?.onRange(r);
      setLive(null);
    },
    [cancel, zoom],
  );
  // A stable object per (from, to): the section builds zoom.range afresh each render.
  const r = live ?? zoom?.range ?? fallback;
  const from = r?.from;
  const to = r?.to;
  const range = useMemo(() => (from && to ? { from, to } : null), [from, to]);
  return { range, onLive, onCommit };
}

export interface OverviewSample {
  t: number;
  remaining: number | null;
  forecast: number | null;
}

/**
 * The rendered rows for the visible window (viewSample'd, keeping today and the finish dates) and
 * the thinned whole-domain overview the navigator sparkline draws. Memoised on the window and
 * domain ends, so a live drag only re-thins the window.
 */
export function useChartView<T extends { date: string; t: number }>(
  data: T[] | undefined,
  zoom: ChartZoom | null,
  range: ChartRange | null,
  finish: AveragedForecast,
  today: string,
): { view: T[]; overview: OverviewSample[] } {
  const { optimistic, likely, pessimistic } = finish;
  const keep = useMemo(
    () => [today, optimistic, likely, pessimistic].filter((k): k is string => k !== null),
    [today, optimistic, likely, pessimistic],
  );
  const view = useMemo(
    () => (data && range ? viewSample(data, range, VIEW_MAX_POINTS, keep) : []),
    [data, range, keep],
  );
  const domain = useMemo(() => {
    const from = zoom?.domain.from;
    const to = zoom?.domain.to;
    return from && to ? { from, to } : null;
  }, [zoom?.domain.from, zoom?.domain.to]);
  const overview = useMemo(
    () =>
      data && domain
        ? viewSample(data, domain, 160).map((p) => {
            const row = p as unknown as { remaining?: unknown; forecast?: unknown };
            return {
              t: p.t,
              remaining: typeof row.remaining === 'number' ? row.remaining : null,
              forecast: typeof row.forecast === 'number' ? row.forecast : null,
            };
          })
        : [],
    [data, domain],
  );
  return { view, overview };
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
            zoom.preset === p.key ? 'bg-accent font-medium text-foreground' : 'hover:bg-accent',
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Neutral info icon in the toolbar when a data source is approximate or loading. */
export function SourceFlag({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    // A real (button) tooltip trigger: keyboard-focusable without tabIndex on a non-interactive element.
    <Tooltip>
      <TooltipTrigger
        delay={0}
        data-testid="epic-source-flag"
        aria-label={text}
        className="inline-flex cursor-default items-center rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <Info aria-hidden="true" className="size-3 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  );
}

/** One fixed-height row above the chart: source flag left of the zoom presets, right-aligned. */
export function ChartToolbar({
  zoom,
  sourceFlag,
}: {
  zoom: ChartZoom | null;
  sourceFlag?: string | null;
}) {
  return (
    <div
      data-testid="epic-chart-toolbar"
      className="mb-2 flex h-6 flex-none items-center justify-end gap-3"
    >
      <SourceFlag text={sourceFlag} />
      {zoom ? <ZoomPresets zoom={zoom} /> : null}
    </div>
  );
}
