/**
 * EditorTab — wiki editor events for Developer Tools.
 *
 * One-line row per event, newest first; the inspector holds the detail. Routine events carry
 * metadata only; failure events (e.g. "Couldn't save safely") also carry the original / produced
 * markup, the diagnosis and the error.
 */
import { Bug, Pencil } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { FilterPopover } from '../../components/ui/table-filter-sort';
import { filterEditorEntries } from '../../lib/dev-tools/entry-filters';
import { cn } from '../../lib/utils';
import { useSettingsStore } from '../../stores/settings.store';
import {
  type SaveDiagnosisLog,
  useWikiEditorLogStore,
  type WikiEditorLogEntry,
  type WikiEditorLogLevel,
} from '../../stores/wiki-editor-log.store';
import { ListRow, ToolbarSearch, useListKeyboard } from './dev-tools-ui';
import { EDITOR_FACETS, facetSetter, useDevToolsViewStore } from './dev-tools-view.store';
import {
  type DiffCell,
  type DiffRow,
  lineRangeOf,
  outlineShape,
  sideBySide,
} from './editor-log-view';
import ListInspectorLayout from './ListInspectorLayout';

/** Status colour as text only: error red, warn amber, info muted. */
function levelClass(level: WikiEditorLogLevel): string {
  if (level === 'error') return 'text-red-600 dark:text-red-400';
  if (level === 'warn') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-muted-foreground';
}

const LEVELS: WikiEditorLogLevel[] = ['error', 'warn', 'info'];

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

function EditorInspector({ entry }: { entry: WikiEditorLogEntry }) {
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
    <div
      data-testid="editor-inspector"
      className="@container/editor-entry flex flex-col gap-3 px-4 py-3"
    >
      <p className="text-xs text-muted-foreground">
        <span className={cn('font-semibold', levelClass(entry.level))}>{entry.level}</span>
        {' · '}
        <span className="font-mono">{entry.event}</span>
        {entry.session !== null && ` · session #${entry.session}`}
        {` · ${new Date(entry.timestamp).toLocaleString()}`}
      </p>
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
  );
}

export default function EditorTab() {
  const entries = useWikiEditorLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);

  const { selectedId, search } = useDevToolsViewStore((s) => s.tabs.editor);
  const levels = useDevToolsViewStore((s) => s.editorLevels);
  const events = useDevToolsViewStore((s) => s.editorEvents);
  const setSelected = useDevToolsViewStore((s) => s.setSelected);
  const setSearch = useDevToolsViewStore((s) => s.setSearch);

  const filtered = filterEditorEntries(entries, { search, levels, events });
  const ids = filtered.map((e) => e.id);
  const selected = filtered.find((e) => e.id === selectedId) ?? null;
  const onKeyDown = useListKeyboard(ids, selectedId, (id) => setSelected('editor', id));

  if (!devToolsEnabled) {
    return (
      <EmptyState
        fill
        icon={Bug}
        title="Developer Tools are disabled"
        subtitle="Enable them in the settings popover above."
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        fill
        icon={Pencil}
        title="No editor events yet"
        subtitle="Entries appear here when a wiki editor opens, switches mode, or fails to save."
      />
    );
  }

  const eventOptions = [...new Set(entries.map((e) => e.event))].sort();

  return (
    <ListInspectorLayout
      toolbar={
        <>
          <ToolbarSearch
            value={search}
            onChange={(v) => setSearch('editor', v)}
            placeholder="Search editor events"
          />
          <FilterPopover
            dimension="Level"
            testId="editor-filter-level"
            options={LEVELS}
            selected={levels}
            setSelected={facetSetter('editorLevels', levels)}
          />
          <FilterPopover
            dimension="Event"
            testId="editor-filter-event"
            options={eventOptions}
            selected={events}
            setSelected={facetSetter('editorEvents', events)}
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            className="ml-auto"
            onClick={() => {
              useWikiEditorLogStore.getState().clear();
              setSelected('editor', null);
              useDevToolsViewStore.getState().resetFacets(EDITOR_FACETS);
            }}
          >
            Clear
          </Button>
        </>
      }
      onKeyDown={onKeyDown}
      list={
        filtered.length === 0 ? (
          <EmptyState compact icon={Pencil} title="No editor events match the filters" />
        ) : (
          <div>
            {filtered.map((entry) => (
              <ListRow
                key={entry.id}
                selected={entry.id === selectedId}
                onSelect={() => setSelected('editor', entry.id)}
                label={`${entry.level} ${entry.event}: ${entry.message}`}
              >
                <span className={cn('w-12 flex-none font-semibold', levelClass(entry.level))}>
                  {entry.level}
                </span>
                <span className="w-28 flex-none truncate font-mono text-muted-foreground">
                  {entry.event}
                </span>
                <span className="min-w-0 flex-[0_1_auto] truncate font-medium">
                  {entry.message}
                </span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {contextText(entry)}
                </span>
                <span className="w-20 flex-none text-right tabular-nums text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </ListRow>
            ))}
          </div>
        )
      }
      inspector={selected ? <EditorInspector entry={selected} /> : null}
    />
  );
}
