/**
 * WaterfallBar — Single operation row in the waterfall timeline.
 *
 * Shows a CSS bar positioned by percentage within the timeline.
 * Expandable to reveal nested fetch bars colored by source.
 */
import { useState } from 'react';
import type { Operation } from '../../stores/operation-profiler.store';

function fetchBarColor(source: 'jira' | 'gitlab', hasError: boolean): string {
  if (hasError) return 'bg-red-200 dark:bg-red-800';
  if (source === 'jira') return 'bg-blue-200 dark:bg-blue-800';
  return 'bg-orange-200 dark:bg-orange-800';
}

export default function WaterfallBar({
  operation,
  timelineStart,
  totalDuration,
}: {
  operation: Operation;
  timelineStart: number;
  totalDuration: number;
}) {
  const [open, setOpen] = useState(false);

  const leftPct = totalDuration > 0 ? ((operation.startTime - timelineStart) / totalDuration) * 100 : 0;
  const widthPct = totalDuration > 0 ? (operation.wallClockMs / totalDuration) * 100 : 100;

  return (
    <div className="flex flex-col gap-1">
      {/* Operation row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full text-left hover:bg-accent/50 transition-colors rounded py-0.5"
      >
        <span className="w-[200px] shrink-0 truncate text-sm">{operation.label}</span>
        <div className="flex-1 relative h-5">
          <div
            className="absolute h-5 rounded-sm bg-muted"
            style={{
              left: `${leftPct}%`,
              width: `${Math.max(widthPct, 1)}%`,
            }}
          >
            <span className="relative text-xs font-mono ml-1 leading-5">
              {operation.wallClockMs}ms
            </span>
          </div>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {/* Expanded fetch bars */}
      {open && (
        <div className="ml-6 flex flex-col gap-1">
          {operation.fetches.map((fetch) => {
            const fLeftPct =
              totalDuration > 0
                ? ((fetch.startTime - timelineStart) / totalDuration) * 100
                : 0;
            const fWidthPct =
              totalDuration > 0 ? (fetch.durationMs / totalDuration) * 100 : 100;

            return (
              <div key={fetch.id} className="flex items-center gap-2">
                <span className="w-[176px] shrink-0 truncate text-xs font-mono text-muted-foreground">
                  {fetch.method} {fetch.source}
                </span>
                <div className="flex-1 relative h-4">
                  <div
                    className={`absolute h-4 rounded-sm ${fetchBarColor(fetch.source, !!fetch.error)}`}
                    style={{
                      left: `${fLeftPct}%`,
                      width: `${Math.max(fWidthPct, 0.5)}%`,
                    }}
                  >
                    <span className="relative text-xs font-mono ml-1 leading-4">
                      {fetch.durationMs}ms
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
