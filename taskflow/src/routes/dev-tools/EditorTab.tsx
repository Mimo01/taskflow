/**
 * EditorTab — wiki editor events for Developer Tools.
 *
 * One expandable card per event, newest first. Routine events carry metadata only; failure
 * events (e.g. "Couldn't save safely") also carry the original / produced markup and error.
 */
import { useState } from 'react';
import { useSettingsStore } from '../../stores/settings.store';
import {
  useWikiEditorLogStore,
  type WikiEditorLogEntry,
  type WikiEditorLogLevel,
} from '../../stores/wiki-editor-log.store';

const BADGE = 'shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold';

function levelClass(level: WikiEditorLogLevel): string {
  if (level === 'error') return `${BADGE} bg-red-500/15 text-red-600 dark:text-red-400`;
  if (level === 'warn') return `${BADGE} bg-yellow-500/15 text-yellow-600 dark:text-yellow-400`;
  return `${BADGE} bg-muted text-muted-foreground`;
}

const PRE = 'text-xs bg-muted rounded p-2 overflow-auto max-h-64 whitespace-pre-wrap break-all';
const SECTION = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1';

function contextText(entry: WikiEditorLogEntry): string {
  return [entry.context?.label, entry.context?.issueKey].filter(Boolean).join(' · ');
}

function EditorCard({ entry }: { entry: WikiEditorLogEntry }) {
  const [open, setOpen] = useState(false);
  const context = contextText(entry);
  const details = entry.details ? Object.entries(entry.details) : [];
  const error = entry.error;
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 density-compact:py-1.5 density-comfortable:py-4 text-left hover:bg-accent transition-colors text-sm"
      >
        <span className={levelClass(entry.level)}>{entry.level}</span>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold bg-muted text-muted-foreground">
          {entry.event}
        </span>
        <span className="font-medium truncate min-w-0 flex-[0_1_auto]">{entry.message}</span>
        <span className="text-xs truncate flex-1 min-w-0 text-muted-foreground">{context}</span>
        {entry.session !== null && (
          <span className="shrink-0 text-xs text-muted-foreground">#{entry.session}</span>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {new Date(entry.timestamp).toLocaleTimeString()}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-border px-4 py-3 density-compact:py-1.5 density-comfortable:py-4 flex flex-col gap-3">
          {details.length > 0 && (
            <div>
              <p className={SECTION}>Details</p>
              <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-0.5 text-xs">
                {details.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-all">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {error && (
            <div>
              <p className={SECTION}>Error</p>
              <pre className={PRE}>
                {[error.message, error.stack, error.componentStack].filter(Boolean).join('\n\n')}
              </pre>
            </div>
          )}
          {entry.markup?.original !== undefined && (
            <div>
              <p className={SECTION}>Original markup</p>
              <pre className={PRE}>{entry.markup.original}</pre>
            </div>
          )}
          {entry.markup?.produced !== undefined && (
            <div>
              <p className={SECTION}>Produced markup</p>
              <pre className={PRE}>{entry.markup.produced}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EditorTab() {
  const entries = useWikiEditorLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);

  if (!devToolsEnabled) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Developer Tools are disabled. Toggle the master switch in Settings to start capturing data.
      </p>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm font-medium">No editor events yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Entries appear here when a wiki editor opens, switches mode, or fails to save.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <EditorCard key={entry.id} entry={entry} />
      ))}
    </div>
  );
}
