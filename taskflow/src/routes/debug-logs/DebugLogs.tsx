/**
 * DebugLogs — API call log viewer.
 *
 * Displays captured Jira and GitLab API calls when debug mode is enabled.
 * Entries are newest-first. Each entry shows: timestamp, source, method,
 * URL, HTTP status, duration, sanitized request headers, response body.
 *
 * Log store is in-memory — cleared on app restart or via the Clear button.
 */
import { useState } from 'react';
import { type ApiLogEntry, useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';

function formatBody(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function statusColor(status: number | null): string {
  if (status === null) return 'text-muted-foreground';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function sourceBadgeClass(source: ApiLogEntry['source']): string {
  switch (source) {
    case 'jira':
      return 'bg-orange-500/15 text-orange-600 dark:text-orange-400';
    case 'gitlab':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400';
    case 'tempo':
      return 'bg-green-500/15 text-green-600 dark:text-green-400';
    case 'updater':
      return 'bg-sky-500/15 text-sky-600 dark:text-sky-400';
    default:
      return 'bg-purple-500/15 text-purple-600 dark:text-purple-400';
  }
}

function LogCard({ entry }: { entry: ApiLogEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Summary row — always visible */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors text-sm"
      >
        {/* Source badge */}
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${sourceBadgeClass(entry.source)}`}
        >
          {entry.source}
        </span>
        <span className="font-mono font-semibold shrink-0">{entry.method}</span>
        <span className={`shrink-0 font-mono font-semibold ${statusColor(entry.status)}`}>
          {entry.status ?? 'ERR'}
        </span>
        <span className="font-mono text-xs truncate flex-1 text-muted-foreground">{entry.url}</span>
        <span className="shrink-0 text-xs text-muted-foreground">{entry.durationMs}ms</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
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
          {entry.requestBody && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Request Body
              </p>
              <pre className="text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                {entry.requestBody}
              </pre>
            </div>
          )}
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

export default function DebugLogs() {
  const { entries, clear } = useDebugLogStore();
  const { devToolsEnabled } = useSettingsStore();

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Debug Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Captured Jira, GitLab, and Tempo API calls. Logs are in-memory — cleared on restart.
          </p>
        </div>
        <button
          onClick={clear}
          disabled={entries.length === 0}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>

      {!devToolsEnabled && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-700 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-200">
          Debug mode is off. Enable it in{' '}
          <a href="#/settings" className="underline font-medium">
            Settings
          </a>{' '}
          to start capturing API calls.
        </div>
      )}

      {devToolsEnabled && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No logs yet. API calls will appear here once debug mode captures them.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {entries.map((entry) => (
          <LogCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
