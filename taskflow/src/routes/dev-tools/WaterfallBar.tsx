/**
 * WaterfallBar -- Self-scoped operation row in the waterfall timeline.
 *
 * Each operation fills its full lane (0% to 100% of its own wallClockMs).
 * Expanded view shows individual fetch bars with parallel-lane layout,
 * gridlines, tooltips, and smart duration labels.
 */
import { useRef, useState } from 'react';
import type { FetchRecord, Operation } from '../../stores/operation-profiler.store';
import { formatBytes, statusColor } from './utils';

// Stronger colors for fetch bars
function fetchBarColor(source: 'jira' | 'gitlab' | 'updater', hasError: boolean): string {
  if (hasError) return 'bg-red-400 dark:bg-red-600';
  if (source === 'jira') return 'bg-orange-400 dark:bg-orange-600';
  if (source === 'updater') return 'bg-sky-400 dark:bg-sky-600';
  return 'bg-purple-400 dark:bg-purple-600';
}

// Lighter colors for the operation summary bar
function opBarColor(fetches: FetchRecord[]): string {
  const sources = fetches.map((f) => f.source);
  const jiraCount = sources.filter((s) => s === 'jira').length;
  const gitlabCount = sources.filter((s) => s === 'gitlab').length;
  const updaterCount = sources.filter((s) => s === 'updater').length;
  const mixed = (jiraCount > 0 ? 1 : 0) + (gitlabCount > 0 ? 1 : 0) + (updaterCount > 0 ? 1 : 0);
  if (mixed > 1) return 'bg-blue-500/20 dark:bg-blue-500/30';
  if (jiraCount > 0) return 'bg-orange-500/20 dark:bg-orange-500/30';
  if (updaterCount > 0) return 'bg-sky-500/20 dark:bg-sky-500/30';
  return 'bg-purple-500/20 dark:bg-purple-500/30';
}

// Truncate URL to last path segment
function shortPath(url: string): string {
  try {
    const path = new URL(url).pathname;
    const segments = path.split('/').filter(Boolean);
    return `/${segments.slice(-2).join('/')}`;
  } catch {
    const segments = url.split('/').filter(Boolean);
    return `/${segments.slice(-2).join('/')}`;
  }
}

/**
 * Assign each fetch to a "lane" (row) so overlapping fetches render on
 * separate rows, visualizing parallelism.  Simple greedy algorithm:
 * sort by startTime, place each on the first lane where it doesn't overlap.
 */
function assignLanes(fetches: FetchRecord[], opStart: number, wallClockMs: number) {
  const sorted = [...fetches].sort((a, b) => a.startTime - b.startTime);
  // Each lane tracks end-percentage of the last bar placed in it
  const laneEnds: number[] = [];
  return sorted.map((f) => {
    const leftPct = wallClockMs > 0 ? ((f.startTime - opStart) / wallClockMs) * 100 : 0;
    const widthPct = wallClockMs > 0 ? Math.max((f.durationMs / wallClockMs) * 100, 2) : 100;
    const rightPct = leftPct + widthPct;

    let lane = laneEnds.findIndex((end) => leftPct >= end);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = rightPct;

    return { fetch: f, lane, leftPct, widthPct };
  });
}

function FetchTooltip({
  fetch,
  visible,
  anchorRect,
}: {
  fetch: FetchRecord;
  visible: boolean;
  anchorRect: DOMRect | null;
}) {
  if (!visible || !anchorRect) return null;

  const startDate = new Date(fetch.startTime);
  const timeStr =
    startDate.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    } as Intl.DateTimeFormatOptions) + `.${String(startDate.getMilliseconds()).padStart(3, '0')}`;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{ left: anchorRect.left, top: anchorRect.top - 8 }}
    >
      <div className="relative -translate-y-full rounded-lg border border-border bg-popover text-popover-foreground shadow-lg px-3 py-2.5 text-xs w-[340px]">
        {/* Header: method + source badge */}
        <div className="flex items-center gap-2 mb-2">
          <span className="font-semibold">{fetch.method}</span>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
              fetch.source === 'jira'
                ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                : fetch.source === 'updater'
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  : 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
            }`}
          >
            {fetch.source}
          </span>
        </div>

        {/* URL */}
        <pre className="text-[11px] bg-muted rounded p-1.5 overflow-auto whitespace-pre-wrap break-all mb-2 font-mono text-muted-foreground leading-relaxed">
          {decodeURIComponent(fetch.url)}
        </pre>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
          <span className="text-muted-foreground">Status</span>
          <span className={`font-mono font-medium ${statusColor(fetch.status)}`}>
            {fetch.status ?? 'Error'}
          </span>

          <span className="text-muted-foreground">Duration</span>
          <span className="font-mono font-medium">{fetch.durationMs}ms</span>

          <span className="text-muted-foreground">Size</span>
          <span className="font-mono font-medium">{formatBytes(fetch.responseSize)}</span>

          <span className="text-muted-foreground">Started</span>
          <span className="font-mono">{timeStr}</span>
        </div>

        {/* Error message if present */}
        {fetch.error && (
          <p className="mt-2 text-[11px] text-red-500 dark:text-red-400 font-mono break-all border-t border-border pt-2">
            {fetch.error}
          </p>
        )}

        {/* Arrow */}
        <div className="absolute left-4 -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r border-b border-border bg-popover" />
      </div>
    </div>
  );
}

export default function WaterfallBar({ operation }: { operation: Operation }) {
  const [open, setOpen] = useState(false);
  const [hoveredFetch, setHoveredFetch] = useState<string | null>(null);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const barRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const laneData = assignLanes(operation.fetches, operation.startTime, operation.wallClockMs);
  const laneCount = laneData.length > 0 ? Math.max(...laneData.map((d) => d.lane)) + 1 : 0;

  // Gridline positions at 0%, 25%, 50%, 75%, 100%
  const gridPositions = [0, 25, 50, 75, 100];
  const gridLabels = gridPositions.map(
    (pct) => `${Math.round((operation.wallClockMs * pct) / 100)}ms`,
  );

  return (
    <div className="flex flex-col">
      {/* Operation summary row */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left hover:bg-accent/50 transition-colors rounded py-1 px-1"
      >
        {/* Label */}
        <span className="w-[200px] shrink-0 truncate text-sm font-medium">{operation.label}</span>

        {/* Summary bar -- fills full width */}
        <div className="flex-1 relative h-6">
          <div className={`absolute inset-0 rounded-sm ${opBarColor(operation.fetches)}`}>
            <span className="relative text-xs font-mono ml-2 leading-6 whitespace-nowrap">
              {operation.wallClockMs}ms wall
              <span className="mx-1 text-muted-foreground">|</span>
              {operation.serverTimeMs}ms server
              <span className="mx-1 text-muted-foreground">|</span>
              {operation.fetches.length} fetch{operation.fetches.length !== 1 ? 'es' : ''}
              {operation.fetches.length >= 2 && operation.wallClockMs > 0 && (
                <span className="ml-1.5 text-muted-foreground/70">
                  ({Math.round((operation.serverTimeMs / operation.wallClockMs) * 100)}% overlap)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <span className="shrink-0 text-xs text-muted-foreground w-4 text-center">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {/* Expanded fetch detail */}
      {open && (
        <div className="ml-[200px] mr-6 relative border-l border-border pl-2 py-1 overflow-hidden">
          {/* Gridlines */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {gridPositions.map((pct) => (
              <div key={pct} className="absolute top-0 bottom-0" style={{ left: `${pct}%` }}>
                <div className="h-full border-l border-dashed border-muted-foreground/25" />
              </div>
            ))}
          </div>

          {/* Gridline labels row */}
          <div
            className="relative flex justify-between mb-1 pointer-events-none"
            aria-hidden="true"
          >
            {gridLabels.map((label, i) => (
              <span key={gridPositions[i]} className="text-[10px] text-muted-foreground font-mono">
                {label}
              </span>
            ))}
          </div>

          {/* Fetch lanes */}
          <div className="relative" style={{ minHeight: `${laneCount * 44 + 4}px` }}>
            {laneData.map(({ fetch, lane, leftPct, widthPct }) => {
              const isWide = widthPct >= 8;
              const barStatusColor =
                fetch.status === null || fetch.status >= 400
                  ? 'text-red-300'
                  : fetch.status >= 300
                    ? 'text-yellow-300'
                    : 'text-white';

              return (
                <div
                  key={fetch.id}
                  className="absolute flex items-center"
                  style={{
                    top: `${lane * 44}px`,
                    left: `${leftPct}%`,
                    width: `${widthPct}%`,
                    height: '40px',
                  }}
                >
                  <div
                    ref={(el) => {
                      if (el) barRefs.current.set(fetch.id, el);
                      else barRefs.current.delete(fetch.id);
                    }}
                    className={`h-full w-full rounded-sm ${fetchBarColor(fetch.source, !!fetch.error)} relative overflow-hidden cursor-default`}
                    onMouseEnter={() => {
                      const el = barRefs.current.get(fetch.id);
                      if (el) setTooltipRect(el.getBoundingClientRect());
                      setHoveredFetch(fetch.id);
                    }}
                    onMouseLeave={() => setHoveredFetch(null)}
                  >
                    {isWide ? (
                      <div className="absolute inset-0 flex flex-col justify-center px-1.5">
                        <span className="text-[10px] font-mono text-white whitespace-nowrap truncate">
                          {fetch.method} {shortPath(fetch.url)}
                        </span>
                        <span className="text-[10px] font-mono text-white/80 whitespace-nowrap truncate">
                          <span className={barStatusColor}>{fetch.status ?? 'err'}</span>
                          {' | '}
                          {fetch.durationMs}ms{' | '}
                          {formatBytes(fetch.responseSize)}
                        </span>
                      </div>
                    ) : (
                      <span className="absolute inset-0 flex items-center px-1 text-[11px] font-mono text-white dark:text-white whitespace-nowrap">
                        {fetch.durationMs}ms
                      </span>
                    )}
                  </div>
                  {hoveredFetch === fetch.id && (
                    <FetchTooltip fetch={fetch} visible anchorRect={tooltipRect} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Total response size */}
          <span className="text-[10px] font-mono text-muted-foreground mt-1 block">
            Total:{' '}
            {formatBytes(
              operation.fetches.reduce((sum, f) => sum + (f.responseSize ?? 0), 0) || undefined,
            )}
          </span>
        </div>
      )}
    </div>
  );
}
