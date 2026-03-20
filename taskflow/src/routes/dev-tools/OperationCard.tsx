/**
 * OperationCard — Expandable card showing a single profiled operation.
 *
 * Summary row displays label, fetch count, wall-clock time, server time, and timestamp.
 * Expanded detail shows per-fetch breakdown with source badges and status colors.
 */
import { useState } from 'react';
import type { Operation } from '../../stores/operation-profiler.store';
import { statusColor, sourceBadgeClass } from './utils';

export default function OperationCard({ operation }: { operation: Operation }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
      >
        <span className="font-semibold truncate flex-1">{operation.label}</span>
        <span className="text-xs text-muted-foreground">{operation.fetches.length} fetches</span>
        <span className="shrink-0 font-mono text-sm font-semibold">{operation.wallClockMs}ms</span>
        <span className="shrink-0 text-xs text-muted-foreground font-mono">
          Server {operation.serverTimeMs}ms
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(operation.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {open ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-2 flex flex-col gap-1">
          {operation.fetches.map((fetch) => (
            <div key={fetch.id} className="flex items-center gap-3 text-xs font-mono py-1">
              <span className={sourceBadgeClass(fetch.source)}>{fetch.source}</span>
              <span className="font-semibold shrink-0">{fetch.method}</span>
              <span className={`shrink-0 ${statusColor(fetch.status)}`}>
                {fetch.status ?? 'ERR'}
              </span>
              <span className="truncate flex-1 text-muted-foreground">{fetch.url}</span>
              <span className="shrink-0">{fetch.durationMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
