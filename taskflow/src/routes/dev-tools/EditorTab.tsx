/**
 * EditorTab — wiki editor events for Developer Tools.
 *
 * One expandable card per event, newest first. Routine events carry metadata only; failure
 * events (e.g. "Couldn't save safely") also carry the original / produced markup and error.
 */
import { useState } from 'react';
import { useSettingsStore } from '../../stores/settings.store';
import {
  type SaveDiagnosisLog,
  useWikiEditorLogStore,
  type WikiEditorLogEntry,
  type WikiEditorLogLevel,
} from '../../stores/wiki-editor-log.store';
import {
  type DiffCell,
  type DiffRow,
  lineRangeOf,
  outlineShape,
  sideBySide,
} from './editor-log-view';

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

const CELL_TINT: Record<DiffCell['kind'], string> = {
  same: '',
  removed: 'bg-red-500/12',
  added: 'bg-green-500/12',
};

function Pane({
  title,
  rows,
  side,
  mark,
}: {
  title: string;
  rows: DiffRow[];
  side: 'left' | 'right';
  /** 1-based line range to outline (the failing block). */
  mark?: [number, number] | null;
}) {
  return (
    <div className="min-w-0">
      <p className={SECTION}>{title}</p>
      <div className="rounded bg-muted overflow-x-auto py-1">
        <div className="min-w-max font-mono text-xs leading-5">
          {rows.map((row, i) => {
            const cell = row[side];
            if (!cell) {
              // Gap row keeps both panes aligned side by side; meaningless when stacked.
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                <div key={i} className="hidden @3xl/editor-entry:block h-5 bg-foreground/[0.04]" />
              );
            }
            const marked = mark != null && cell.n >= mark[0] && cell.n <= mark[1];
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                key={i}
                className={`flex border-l-2 ${marked ? 'border-amber-500 bg-amber-500/15' : `border-transparent ${CELL_TINT[cell.kind]}`}`}
              >
                <span className="w-9 shrink-0 select-none pr-2 text-right text-muted-foreground/70">
                  {cell.n}
                </span>
                <span className="whitespace-pre pr-3">{cell.text || ' '}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Two texts as an aligned line diff: side by side when the card is wide, stacked otherwise. */
function DiffPair({
  leftTitle,
  rightTitle,
  left,
  right,
  rightMark,
}: {
  leftTitle: string;
  rightTitle: string;
  left: string;
  right: string;
  rightMark?: [number, number] | null;
}) {
  const rows = sideBySide(left, right);
  return (
    <div className="grid grid-cols-1 gap-3 @3xl/editor-entry:grid-cols-2 max-h-[32rem] overflow-y-auto">
      <Pane title={leftTitle} rows={rows} side="left" />
      <Pane title={rightTitle} rows={rows} side="right" mark={rightMark} />
    </div>
  );
}

function Diagnosis({
  diagnosis,
  producedShown,
}: {
  diagnosis: SaveDiagnosisLog;
  /** The produced markup is shown below with the failing block outlined. */
  producedShown: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className={SECTION}>What failed</p>
        <p className="text-sm">{diagnosis.reason}</p>
        <p className="text-xs text-muted-foreground mt-1">
          The editor writes the edit as wiki text, reads it back and compares structures. Blocks are
          top-level and counted from 0, skipping empty paragraphs.
          {producedShown && diagnosis.savedSlice
            ? ' The failing block is outlined in the produced markup.'
            : ''}
        </p>
      </div>
      {!producedShown && diagnosis.savedSlice !== null && (
        <div>
          <p className={SECTION}>Saved text of this block</p>
          <pre className={PRE}>{diagnosis.savedSlice}</pre>
        </div>
      )}
      {(diagnosis.expected !== null || diagnosis.readBack !== null) && (
        <DiffPair
          leftTitle="The edit (expected)"
          rightTitle="Saved text reads back as"
          left={outlineShape(diagnosis.expected)}
          right={outlineShape(diagnosis.readBack)}
        />
      )}
    </div>
  );
}

function Markup({ entry }: { entry: WikiEditorLogEntry }) {
  const original = entry.markup?.original;
  const produced = entry.markup?.produced;
  if (original !== undefined && produced !== undefined) {
    return (
      <DiffPair
        leftTitle="Original markup"
        rightTitle={
          entry.diagnosis?.savedSlice
            ? 'Produced markup (failing block outlined)'
            : 'Produced markup'
        }
        left={original}
        right={produced}
        rightMark={lineRangeOf(produced, entry.diagnosis?.savedSlice ?? null)}
      />
    );
  }
  const only = original ?? produced;
  if (only === undefined) return null;
  return (
    <div>
      <p className={SECTION}>{original !== undefined ? 'Original markup' : 'Produced markup'}</p>
      <pre className={PRE}>{only}</pre>
    </div>
  );
}

function EditorCard({ entry }: { entry: WikiEditorLogEntry }) {
  const [open, setOpen] = useState(false);
  const context = contextText(entry);
  const details = entry.details ? Object.entries(entry.details) : [];
  // The diagnosis already states the reason; only show the error box when it adds something.
  const error =
    entry.error &&
    (entry.error.stack ||
      entry.error.componentStack ||
      entry.error.message !== entry.diagnosis?.reason)
      ? entry.error
      : undefined;
  return (
    <div className="@container/editor-entry border border-border rounded-lg overflow-hidden">
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
          {entry.diagnosis && (
            <Diagnosis
              diagnosis={entry.diagnosis}
              producedShown={entry.markup?.produced !== undefined}
            />
          )}
          <Markup entry={entry} />
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
