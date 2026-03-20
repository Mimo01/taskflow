/**
 * LogsTab — API call log viewer for Developer Tools page.
 *
 * Adapted from DebugLogs.tsx with operation badge support and
 * empty/disabled state messages.
 */
import { useState } from 'react';
import { type ApiLogEntry, useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import { formatBody, statusColor, sourceBadgeClass } from './utils';

function LogCard({ entry }: { entry: ApiLogEntry }) {
  const [open, setOpen] = useState(false);
  const isError = entry.status === null || (entry.status !== null && entry.status >= 400);

  return (
    <div className={`border rounded-lg overflow-hidden ${isError ? 'border-red-500/40 bg-red-500/[0.04]' : 'border-border'}`}>
      {/* Summary row */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
      >
        <span className={sourceBadgeClass(entry.source)}>{entry.source}</span>
        {entry.operation && (
          <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium bg-muted text-muted-foreground">
            {entry.operation}
          </span>
        )}
        <span className="font-mono font-semibold shrink-0">{entry.method}</span>
        <span className={`shrink-0 font-mono font-semibold ${statusColor(entry.status)}`}>
          {entry.status ?? 'ERR'}
        </span>
        <span className="font-mono text-xs truncate flex-1 text-muted-foreground">{entry.url}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{entry.durationMs}ms</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? '\u25B2' : '\u25BC'}</span>
      </button>

      {/* Detail panel */}
      {open && (
        <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              URL
            </p>
            <pre className="text-xs bg-muted rounded p-2 overflow-auto whitespace-pre-wrap break-all">
              {decodeURIComponent(entry.url)}
            </pre>
          </div>
          {entry.error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              <span className="font-semibold">Network error:</span> {entry.error}
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Request Headers
            </p>
            <pre className="text-xs bg-muted rounded p-2 overflow-auto whitespace-pre-wrap break-all">
              {JSON.stringify(entry.requestHeaders, null, 2)}
            </pre>
          </div>
          {entry.responseBody && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Response Body
              </p>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {formatBody(entry.responseBody)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function LogsTab() {
  const entries = useDebugLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const requestLogging = useSettingsStore((s) => s.requestLogging);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  if (!requestLogging || entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium">No logs captured</p>
        <p className="text-sm text-muted-foreground mt-1">
          Enable request logging in Settings above, then use the app to generate API traffic.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <LogCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
