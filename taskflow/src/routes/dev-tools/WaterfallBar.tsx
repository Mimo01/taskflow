/**
 * WaterfallBar -- Self-scoped operation row in the waterfall timeline.
 *
 * Each operation fills its full lane (0% to 100% of its own wallClockMs).
 * Expanded view shows individual fetch bars with parallel-lane layout,
 * gridlines, tooltips, and smart duration labels.
 */
import { useState } from 'react';
import type { FetchRecord, Operation } from '../../stores/operation-profiler.store';
import { formatBytes } from './utils';

// Stronger colors for fetch bars
function fetchBarColor(source: 'jira' | 'gitlab', hasError: boolean): string {
  if (hasError) return 'bg-red-400 dark:bg-red-600';
  if (source === 'jira') return 'bg-orange-400 dark:bg-orange-600';
  return 'bg-purple-400 dark:bg-purple-600';
}

// Lighter colors for the operation summary bar
function opBarColor(fetches: FetchRecord[]): string {
  const sources = fetches.map((f) => f.source);
  const jiraCount = sources.filter((s) => s === 'jira').length;
  const gitlabCount = sources.filter((s) => s === 'gitlab').length;
  if (jiraCount > 0 && gitlabCount > 0) return 'bg-blue-500/20 dark:bg-blue-500/30';
  if (jiraCount > 0) return 'bg-orange-500/20 dark:bg-orange-500/30';
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

export default function WaterfallBar({ operation }: { operation: Operation }) {
  const [open, setOpen] = useState(false);

  const laneData = assignLanes(operation.fetches, operation.startTime, operation.wallClockMs);
  const laneCount = laneData.length > 0 ? Math.max(...laneData.map((d) => d.lane)) + 1 : 0;

  // Gridline positions at 0%, 25%, 50%, 75%, 100%
  const gridPositions = [0, 25, 50, 75, 100];
  const gridLabels = gridPositions.map((pct) =>
    `${Math.round((operation.wallClockMs * pct) / 100)}ms`,
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
        <span className="w-[200px] shrink-0 truncate text-sm font-medium">
          {operation.label}
        </span>

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
        <div className="ml-[200px] mr-6 relative border-l border-border pl-2 py-1">
          {/* Gridlines */}
          <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
            {gridPositions.map((pct, i) => (
              <div
                key={pct}
                className="absolute top-0 bottom-0"
                style={{ left: `${pct}%` }}
              >
                <div className="h-full border-l border-dashed border-muted-foreground/25" />
                <span className="absolute -bottom-4 -translate-x-1/2 text-[10px] text-muted-foreground font-mono">
                  {gridLabels[i]}
                </span>
              </div>
            ))}
          </div>

          {/* Fetch lanes */}
          <div className="relative" style={{ minHeight: `${laneCount * 44 + 4}px` }}>
            {laneData.map(({ fetch, lane, leftPct, widthPct }) => {
              const isWide = widthPct >= 8;
              const statusColorClass =
                fetch.status === null || (fetch.status >= 400)
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
                    className={`h-full w-full rounded-sm ${fetchBarColor(fetch.source, !!fetch.error)} relative overflow-hidden`}
                    title={`${fetch.method} ${fetch.url}\nStatus: ${fetch.status ?? 'error'}\nDuration: ${fetch.durationMs}ms\nSize: ${formatBytes(fetch.responseSize)}`}
                  >
                    {isWide ? (
                      <div className="absolute inset-0 flex flex-col justify-center px-1.5">
                        <span className="text-[10px] font-mono text-white whitespace-nowrap truncate">
                          {fetch.method} {shortPath(fetch.url)}
                        </span>
                        <span className="text-[10px] font-mono text-white/80 whitespace-nowrap truncate">
                          <span className={statusColorClass}>{fetch.status ?? 'err'}</span>
                          {' | '}{fetch.durationMs}ms{' | '}{formatBytes(fetch.responseSize)}
                        </span>
                      </div>
                    ) : (
                      <span className="absolute inset-0 flex items-center px-1 text-[11px] font-mono text-white dark:text-white whitespace-nowrap">
                        {fetch.durationMs}ms
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total response size */}
          <span className="text-[10px] font-mono text-muted-foreground mt-1">
            Total: {formatBytes(
              operation.fetches.reduce((sum, f) => sum + (f.responseSize ?? 0), 0) || undefined
            )}
          </span>
        </div>
      )}
    </div>
  );
}
