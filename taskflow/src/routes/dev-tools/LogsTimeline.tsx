/**
 * LogsTimeline — the Timeline view of the Logs tab.
 *
 * One bar per request on a shared time axis, packed into lanes so overlapping requests stack and
 * sequential ones share a lane. Requests are grouped into bursts (idle gap), the win defaults
 * to the latest burst and follows it while Live is on. Colour is status only. Hand-rolled absolute
 * divs: layout is memoized and only spans intersecting the win are rendered.
 */
import { Bug } from 'lucide-react';
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { entryEnd, entryStart, isPending } from '../../lib/dev-tools/log-entry';
import { urlPath } from '../../lib/dev-tools/log-stats';
import { queueSplit } from '../../lib/dev-tools/queue-handoff';
import {
  createTimeScale,
  fitWindow,
  formatOffset,
  timeTicks,
  zoomWindow,
} from '../../lib/dev-tools/time-scale';
import { type Burst, groupBursts, packLanes } from '../../lib/dev-tools/timeline-layout';
import { cn } from '../../lib/utils';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { useDevToolsViewStore } from './dev-tools-view.store';
import { statusText, timelineBarClass } from './utils';

const LANE_STEP = 20;
const BAR_HEIGHT = 18;
const LABEL_MIN_WIDTH = 60;
const TOOLTIP_WIDTH = 240;
const BURST_PICKER_LIMIT = 20;

const PENDING_BAR_CLASS =
  'bg-[repeating-linear-gradient(135deg,color-mix(in_oklab,var(--muted-foreground)_45%,transparent)_0_4px,transparent_4px_8px)] ring-1 ring-inset ring-muted-foreground/40';

interface TimelineProps {
  entries: ApiLogEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  now: number;
  /** Plot width in px; measured with a ResizeObserver when omitted. */
  width?: number;
}

interface TooltipState {
  x: number;
  y: number;
  id: string;
}

/** Last two path segments, e.g. '/rest/api/2/issue/ABC-1' becomes 'issue/ABC-1'. */
function shortPath(url: string): string {
  const parts = urlPath(url).split('/').filter(Boolean);
  return parts.slice(-2).join('/') || '/';
}

function burstLabel(b: Burst): string {
  return `${b.route} · ${b.count} ${b.count === 1 ? 'request' : 'requests'} · ${Math.round(b.totalMs)} ms`;
}

/**
 * Keyboard handler for the timeline: ArrowRight / ArrowLeft move to the next / previous request
 * by start time, Escape clears the selection.
 */
export function timelineKeyDown(
  orderedIds: string[],
  selectedId: string | null,
  setSelected: (id: string | null) => void,
) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setSelected(null);
      return;
    }
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    if (orderedIds.length === 0) return;
    e.preventDefault();
    const idx = selectedId === null ? -1 : orderedIds.indexOf(selectedId);
    const next =
      e.key === 'ArrowRight'
        ? Math.min(orderedIds.length - 1, idx + 1)
        : Math.max(0, idx === -1 ? 0 : idx - 1);
    const nextId = orderedIds[next];
    setSelected(nextId);
    const bar = [
      ...e.currentTarget.querySelectorAll<HTMLElement>('[data-testid="timeline-bar"]'),
    ].find((el) => el.dataset.id === nextId);
    bar?.focus?.();
    bar?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };
}

export default function LogsTimeline({
  entries,
  selectedId,
  onSelect,
  now,
  width: widthProp,
}: TimelineProps) {
  const burstId = useDevToolsViewStore((s) => s.timelineBurstId);
  const timelineWindow = useDevToolsViewStore((s) => s.timelineWindow);
  const live = useDevToolsViewStore((s) => s.timelineLive);
  const setBurstId = useDevToolsViewStore((s) => s.setTimelineBurstId);
  const setTimelineWindow = useDevToolsViewStore((s) => s.setTimelineWindow);
  const setLive = useDevToolsViewStore((s) => s.setTimelineLive);

  const rootRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(800);
  const width = widthProp ?? measured;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  // Set by the cache lane (see below) to dim requests that are not correlated with a marker.
  const [highlight] = useState<Set<string> | null>(null);

  useEffect(() => {
    const el = plotRef.current;
    if (!el || widthProp !== undefined || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width);
      if (w > 0) setMeasured(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthProp]);

  const entryById = useMemo(() => new Map(entries.map((e) => [e.id, e])), [entries]);

  // Packing and bursts use `queuedAt ?? start` so a queued lead-in never overlaps a neighbour.
  const spans = useMemo(
    () =>
      entries.map((e) => {
        const start = entryStart(e);
        return {
          id: e.id,
          start: e.queuedAt ?? start,
          end: entryEnd(e, now),
          route: e.route,
        };
      }),
    [entries, now],
  );
  const bursts = useMemo(() => groupBursts(spans), [spans]);

  const baseWindow = useMemo<[number, number] | null>(() => {
    if (burstId === 'all') return fitWindow(spans);
    const target = (burstId ? bursts.find((b) => b.id === burstId) : undefined) ?? bursts[0];
    return target ? fitWindow([target]) : null;
  }, [burstId, bursts, spans]);
  const win = timelineWindow ?? baseWindow;
  const allBounds = useMemo(() => fitWindow(spans, 0.5), [spans]);

  const scale = useMemo(() => (win ? createTimeScale(win, width) : null), [win, width]);

  const { visible, lane, laneCount } = useMemo(() => {
    if (!win) return { visible: [], lane: new Map<string, number>(), laneCount: 0 };
    const [w0, w1] = win;
    const inWindow = spans.filter((s) => s.start < w1 && s.end > w0);
    const packed = packLanes(inWindow);
    return { visible: inWindow, lane: packed.lane, laneCount: packed.laneCount };
  }, [spans, win]);

  const ticks = useMemo(
    () => (win ? timeTicks(win, Math.max(2, Math.floor(width / 110))) : []),
    [win, width],
  );
  const visibleBursts = useMemo(
    () => (win ? bursts.filter((b) => b.start < win[1] && b.end > win[0]) : []),
    [bursts, win],
  );

  // Latest-ref so the native wheel listener never re-subscribes.
  const wheelCtx = useRef({ win, scale, allBounds });
  wheelCtx.current = { win, scale, allBounds };
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const { win: w, scale: sc, allBounds: bounds } = wheelCtx.current;
      if (!w || !sc) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const anchor = sc.invert(e.clientX - rect.left);
      setTimelineWindow(zoomWindow(w, anchor, e.deltaY < 0 ? 0.8 : 1.25, bounds ?? undefined));
      setLive(false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setTimelineWindow, setLive]);

  const selectedBurstId = burstId ?? bursts[0]?.id ?? 'all';
  const pickerItems = useMemo(
    () => [
      { value: 'all', label: 'All' },
      ...bursts.slice(0, BURST_PICKER_LIMIT).map((b) => ({ value: b.id, label: burstLabel(b) })),
    ],
    [bursts],
  );

  const choose = (value: string | null) => {
    if (value === null) return;
    setLive(false);
    setBurstId(value);
    if (value === 'all') {
      setTimelineWindow(fitWindow(spans));
      return;
    }
    const b = bursts.find((x) => x.id === value);
    setTimelineWindow(b ? fitWindow([b]) : null);
  };
  const fit = () => {
    setTimelineWindow(live ? null : baseWindow);
  };
  const toggleLive = () => {
    if (live) {
      setTimelineWindow(win);
      setLive(false);
    } else {
      setLive(true);
      setBurstId(null);
      setTimelineWindow(null);
    }
  };

  const tabStopId = useMemo(() => {
    if (selectedId !== null && visible.some((s) => s.id === selectedId)) return selectedId;
    return visible.length > 0 ? [...visible].sort((a, b) => a.start - b.start)[0].id : null;
  }, [visible, selectedId]);

  const showTooltip = (e: ReactPointerEvent<HTMLElement>) => {
    const bar = (e.target as HTMLElement).closest<HTMLElement>('[data-testid="timeline-bar"]');
    const root = rootRef.current;
    if (!bar || !root || !bar.dataset.id) {
      setTooltip(null);
      return;
    }
    const rect = root.getBoundingClientRect();
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, id: bar.dataset.id });
  };

  const tipEntry = tooltip ? entryById.get(tooltip.id) : undefined;

  return (
    <div
      ref={rootRef}
      data-testid="logs-timeline"
      className="relative flex min-w-0 flex-col gap-2 p-2"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select items={pickerItems} value={selectedBurstId} onValueChange={choose}>
          <SelectTrigger size="sm" aria-label="Burst" className="max-w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className="w-auto min-w-64">
            {pickerItems.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="xs"
          aria-pressed={live}
          className="aria-pressed:bg-muted aria-pressed:text-foreground"
          onClick={toggleLive}
        >
          Live
        </Button>
        <Button type="button" variant="outline" size="xs" onClick={fit}>
          Fit
        </Button>
        <span className="text-xs text-muted-foreground">⌘ + scroll to zoom</span>
      </div>

      <div
        ref={plotRef}
        data-testid="timeline-plot"
        className="relative overflow-hidden rounded-md border bg-background"
        style={{ width: widthProp ?? undefined }}
        onPointerOver={showTooltip}
        onPointerMove={showTooltip}
        onPointerLeave={() => setTooltip(null)}
      >
        {!win || visible.length === 0 || !scale ? (
          <EmptyState compact icon={Bug} title="No requests in this window" />
        ) : (
          <>
            {/* Axis and gridlines */}
            <div className="relative h-5 border-b text-[10px] text-muted-foreground">
              {ticks.map((t) => (
                <span
                  key={t.t}
                  className="absolute top-1 whitespace-nowrap pl-1 tabular-nums"
                  style={{ left: scale.x(t.t) }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 top-5">
              {ticks.map((t) => (
                <div
                  key={t.t}
                  className="absolute inset-y-0 border-l border-border/60"
                  style={{ left: scale.x(t.t) }}
                />
              ))}
              {visibleBursts.length > 1 &&
                visibleBursts.map((b) => (
                  <div
                    key={b.id}
                    className="absolute inset-y-0 border-l border-muted-foreground/50"
                    style={{ left: scale.x(b.start) }}
                  />
                ))}
            </div>
            {visibleBursts.length > 1 && (
              <div className="relative h-4 text-[10px] text-muted-foreground">
                {visibleBursts.map((b) => (
                  <span
                    key={b.id}
                    className="absolute top-0 truncate pl-1"
                    style={{
                      left: Math.max(0, scale.x(b.start)),
                      maxWidth: Math.max(0, scale.x(b.end) - Math.max(0, scale.x(b.start))) || 80,
                    }}
                  >
                    {burstLabel(b)}
                  </span>
                ))}
              </div>
            )}

            {/* Request lanes */}
            <div className="relative my-1" style={{ height: laneCount * LANE_STEP }}>
              {visible.map((s) => {
                const e = entryById.get(s.id);
                if (!e) return null;
                const start = entryStart(e);
                const x0 = Math.max(-2, scale.x(start));
                const x1 = Math.min(width + 2, scale.x(s.end));
                const w = Math.max(2, x1 - x0);
                const top = (lane.get(s.id) ?? 0) * LANE_STEP;
                const pending = isPending(e);
                const dimmed = highlight !== null && !highlight.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    data-testid="timeline-bar"
                    data-id={s.id}
                    data-highlighted={highlight?.has(s.id) ? 'true' : undefined}
                    data-dimmed={dimmed ? 'true' : undefined}
                    aria-label={`${e.method} ${urlPath(e.url)}`}
                    aria-pressed={s.id === selectedId}
                    tabIndex={s.id === tabStopId ? 0 : -1}
                    onClick={() => onSelect(s.id)}
                    className={cn(
                      'absolute flex items-center overflow-hidden rounded-sm px-1 text-left font-mono text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring data-[dimmed=true]:opacity-30',
                      pending ? PENDING_BAR_CLASS : timelineBarClass(e),
                      s.id === selectedId && 'ring-2 ring-primary',
                    )}
                    style={{ left: x0, width: w, top, height: BAR_HEIGHT }}
                  >
                    {w >= LABEL_MIN_WIDTH && (
                      <span className="truncate text-foreground">
                        {e.method} {shortPath(e.url)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {tooltip && tipEntry && scale && win && (
        <div
          role="tooltip"
          data-testid="timeline-tooltip"
          className="pointer-events-none absolute z-30 flex flex-col gap-0.5 rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
          style={{
            width: TOOLTIP_WIDTH,
            left: Math.max(
              0,
              Math.min(tooltip.x + 12, (rootRef.current?.clientWidth ?? width) - TOOLTIP_WIDTH),
            ),
            top: tooltip.y + 14,
          }}
        >
          <TooltipRows entry={tipEntry} now={now} windowStart={win[0]} />
        </div>
      )}
    </div>
  );
}

/** Exactly four rows: path, status, duration (queue folded in) and start offset. */
function TooltipRows({
  entry,
  now,
  windowStart,
}: {
  entry: ApiLogEntry;
  now: number;
  windowStart: number;
}) {
  const pending = isPending(entry);
  const start = entryStart(entry);
  const { queuedMs, networkMs } = queueSplit(entry);
  const ms = pending ? Math.max(0, Math.round(now - start)) : Math.round(networkMs);
  const duration = queuedMs === null || pending ? `${ms} ms` : `${ms} ms (queued ${queuedMs})`;
  return (
    <>
      <div className="truncate font-mono">{urlPath(entry.url)}</div>
      <div className={cn('font-mono font-semibold', statusText(entry.status, pending))}>
        {pending ? 'pending' : (entry.status ?? 'ERR')}
      </div>
      <div className="tabular-nums text-muted-foreground">{duration}</div>
      <div className="tabular-nums text-muted-foreground">
        {`starts +${formatOffset(start - windowStart)}`}
      </div>
    </>
  );
}
