/**
 * LogsTab — API request log for the Developer Tools page.
 *
 * Network-panel style: toolbar (search and facets left; Pause, Copy all, Export, Clear right),
 * summary chips over the filtered set, one-line rows on a fixed column grid, and a resizable
 * inspector (see LogInspector).
 */
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { Bug, Check, Copy, Pause, Play } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { FilterPopover } from '../../components/ui/table-filter-sort';
import { entriesToJson } from '../../lib/dev-tools/copy-format';
import { entryStart, isPending } from '../../lib/dev-tools/log-entry';
import {
  facetOptions,
  filterLogs,
  type LogFilters,
  STATUS_FACETS,
} from '../../lib/dev-tools/log-filters';
import { computeLogStats, urlPath } from '../../lib/dev-tools/log-stats';
import { saveBytes } from '../../lib/save-attachment';
import { cn } from '../../lib/utils';
import { type ApiLogEntry, useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import {
  CopyButton,
  isTabStop,
  ListRow,
  ToolbarSearch,
  useCopyFeedback,
  useListKeyboard,
} from './dev-tools-ui';
import { facetSetter, LOG_FACETS, useDevToolsViewStore } from './dev-tools-view.store';
import ListInspectorLayout from './ListInspectorLayout';
import LogInspector from './LogInspector';
import { useNow } from './useNow';
import { sourceBadgeClass, statusText } from './utils';

/** Decoded path + query with the host stripped. */
export function displayPath(url: string): string {
  let out = url;
  try {
    const u = new URL(url);
    out = `${u.pathname}${u.search}`;
  } catch {
    // keep raw
  }
  try {
    return decodeURIComponent(out);
  } catch {
    return out;
  }
}

export default function LogsTab() {
  const liveEntries = useDebugLogStore((s) => s.entries);
  const devToolsEnabled = useSettingsStore((s) => s.devToolsEnabled);
  const requestLogging = useSettingsStore((s) => s.requestLogging);

  const pausedEntries = useDevToolsViewStore((s) => s.pausedEntries);
  const setPausedEntries = useDevToolsViewStore((s) => s.setPausedEntries);
  const pausedAt = useDevToolsViewStore((s) => s.pausedAt);
  const { selectedId, search } = useDevToolsViewStore((s) => s.tabs.logs);
  const setSelected = useDevToolsViewStore((s) => s.setSelected);
  const setSearch = useDevToolsViewStore((s) => s.setSearch);
  const sources = useDevToolsViewStore((s) => s.logSources);
  const statuses = useDevToolsViewStore((s) => s.logStatuses);
  const methods = useDevToolsViewStore((s) => s.logMethods);
  const operations = useDevToolsViewStore((s) => s.logOperations);

  const [exportState, setExportState] = useState<'idle' | 'done' | 'failed'>('idle');
  const exportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (exportTimer.current) clearTimeout(exportTimer.current);
    },
    [],
  );

  const entries = pausedEntries ?? liveEntries;
  const hasPending = useMemo(() => entries.some(isPending), [entries]);
  // Ticks only while something is in flight; frozen at the pause time when paused.
  const now = useNow(250, hasPending, pausedAt);
  const options = useMemo(() => facetOptions(entries), [entries]);
  const { filtered, stats, ids } = useMemo(() => {
    const filters: LogFilters = { search, sources, statuses, methods, operations };
    const list = filterLogs(entries, filters);
    return { filtered: list, stats: computeLogStats(list), ids: list.map((e) => e.id) };
  }, [entries, search, sources, statuses, methods, operations]);
  const selected = filtered.find((e) => e.id === selectedId) ?? null;
  const onKeyDown = useListKeyboard(ids, selectedId, (id) => setSelected('logs', id));

  if (!devToolsEnabled) {
    return (
      <EmptyState
        fill
        icon={Bug}
        title="Developer Tools are disabled"
        subtitle="Enable them in Settings → Advanced."
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        fill
        icon={Bug}
        title="No requests logged yet"
        subtitle={
          requestLogging
            ? 'Use the app to generate API traffic.'
            : 'Turn on Request logging in the settings popover.'
        }
      />
    );
  }

  const newWhilePaused = pausedEntries ? Math.max(0, liveEntries.length - pausedEntries.length) : 0;
  const hasFilters =
    search !== '' ||
    sources.size > 0 ||
    statuses.size > 0 ||
    methods.size > 0 ||
    operations.size > 0;

  const exportLogs = async () => {
    const settle = (next: 'done' | 'failed') => {
      setExportState(next);
      if (exportTimer.current) clearTimeout(exportTimer.current);
      exportTimer.current = setTimeout(() => setExportState('idle'), 1500);
    };
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = await saveBytes(
        new TextEncoder().encode(entriesToJson(filtered)),
        `taskflow-api-log-${stamp}.json`,
      );
      await revealItemInDir(path).catch(() => {});
      settle('done');
    } catch {
      settle('failed');
    }
  };

  const toolbar = (
    <>
      <ToolbarSearch
        value={search}
        onChange={(v) => setSearch('logs', v)}
        placeholder="Search URL or body"
      />
      <FilterPopover
        dimension="Source"
        testId="logs-filter-source"
        options={options.sources}
        selected={sources}
        setSelected={facetSetter('logSources', sources)}
      />
      <FilterPopover
        dimension="Status"
        testId="logs-filter-status"
        options={[...STATUS_FACETS]}
        selected={statuses}
        setSelected={facetSetter('logStatuses', statuses)}
      />
      <FilterPopover
        dimension="Method"
        testId="logs-filter-method"
        options={options.methods}
        selected={methods}
        setSelected={facetSetter('logMethods', methods)}
      />
      {options.operations.some((o) => o !== '(none)') && (
        <FilterPopover
          dimension="Operation"
          testId="logs-filter-operation"
          options={options.operations}
          selected={operations}
          setSelected={facetSetter('logOperations', operations)}
        />
      )}
      <div className="ml-auto flex items-center gap-2 border-l pl-2">
        {pausedEntries && (
          <span className="text-xs text-muted-foreground">Paused · {newWhilePaused} new</span>
        )}
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => setPausedEntries(pausedEntries ? null : [...liveEntries])}
        >
          {pausedEntries ? <Play /> : <Pause />}
          {pausedEntries ? 'Resume' : 'Pause'}
        </Button>
        <CopyButton
          label="Copy all"
          getText={() => entriesToJson(filtered)}
          disabled={filtered.length === 0}
        />
        <Button
          type="button"
          variant="outline"
          size="xs"
          disabled={filtered.length === 0}
          onClick={exportLogs}
        >
          {exportState === 'done'
            ? 'Exported'
            : exportState === 'failed'
              ? 'Export failed'
              : 'Export'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={() => {
            useDebugLogStore.getState().clear();
            setPausedEntries(null);
            setSelected('logs', null);
            useDevToolsViewStore.getState().resetFacets(LOG_FACETS);
          }}
        >
          Clear
        </Button>
      </div>
    </>
  );

  const summary = (
    <div data-testid="logs-summary" className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
      <Chip label="Requests" value={String(stats.total)} />
      {stats.inFlight > 0 && (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <span
            aria-hidden="true"
            className="size-1.5 animate-pulse rounded-full bg-muted-foreground"
          />
          <span className="tabular-nums">{`${stats.inFlight} in flight`}</span>
        </span>
      )}
      <Chip
        label="Errors"
        value={String(stats.errors)}
        className={cn(stats.errors > 0 && 'text-red-600 dark:text-red-400')}
      />
      {stats.median !== null && <Chip label="Median" value={`${stats.median} ms`} />}
      {stats.p95 !== null && <Chip label="p95" value={`${stats.p95} ms`} />}
      {stats.slowest && (
        <Chip
          label="Slowest"
          value={`${stats.slowest.ms} ms`}
          title={`${stats.slowest.method} ${stats.slowest.path}`}
        />
      )}
    </div>
  );

  const list =
    filtered.length === 0 ? (
      <EmptyState
        compact
        icon={Bug}
        title="No requests match the filters"
        subtitle={hasFilters ? undefined : 'Nothing to show.'}
      />
    ) : (
      <div>
        {filtered.map((e) => (
          <LogRow
            key={e.id}
            entry={e}
            now={now}
            selected={e.id === selectedId}
            tabStop={isTabStop(ids, selectedId, e.id)}
            onSelect={() => setSelected('logs', e.id)}
          />
        ))}
      </div>
    );

  return (
    <ListInspectorLayout
      toolbar={toolbar}
      summary={summary}
      list={list}
      onKeyDown={onKeyDown}
      emptyTitle="Select a request"
      inspector={
        selected ? <LogInspector key={selected.id} entry={selected} entries={filtered} /> : null
      }
    />
  );
}

function Chip({
  label,
  value,
  className,
  title,
}: {
  label: string;
  value: string;
  className?: string;
  title?: string;
}) {
  return (
    <span title={title} className="inline-flex items-baseline gap-1.5">
      <span>{label}</span>
      <span className={cn('tabular-nums text-foreground', className)}>{value}</span>
    </span>
  );
}

function RowCopyUrl({ url }: { url: string }) {
  const { state, copy } = useCopyFeedback();
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label="Copy URL"
      title="Copy URL"
      onClick={() => copy(url)}
    >
      {state === 'copied' ? <Check /> : <Copy />}
    </Button>
  );
}

/** Origin (dimmed) and decoded path + query; falls back to the raw text when the URL is invalid. */
function splitUrl(url: string): { origin: string; path: string } {
  try {
    return { origin: new URL(url).origin, path: displayPath(url) };
  } catch {
    return { origin: '', path: url };
  }
}

function displayUrl(url: string): string {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function LogRow({
  entry,
  now,
  selected,
  tabStop,
  onSelect,
}: {
  entry: ApiLogEntry;
  now: number;
  selected: boolean;
  tabStop: boolean;
  onSelect: () => void;
}) {
  const { origin, path } = splitUrl(entry.url);
  const pending = isPending(entry);
  const elapsed = pending ? Math.max(0, Math.round(now - entryStart(entry))) : entry.durationMs;
  return (
    <ListRow
      selected={selected}
      onSelect={onSelect}
      tabStop={tabStop}
      label={`${entry.method} ${urlPath(entry.url)}`}
      title={displayUrl(entry.url)}
      actions={<RowCopyUrl url={entry.url} />}
    >
      <span className={cn(sourceBadgeClass(entry.source), 'w-14 flex-none text-center')}>
        {entry.source}
      </span>
      <span className="w-12 flex-none font-mono font-semibold">{entry.method}</span>
      <span
        className={cn('w-14 flex-none font-mono font-semibold', statusText(entry.status, pending))}
      >
        {pending ? 'pending' : (entry.status ?? 'ERR')}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono">
        <span className="text-muted-foreground/60">{origin}</span>
        <span>{path}</span>
      </span>
      {entry.operation && (
        <span className="max-w-40 flex-none truncate text-muted-foreground">{entry.operation}</span>
      )}
      <span className="w-16 flex-none text-right tabular-nums text-muted-foreground">
        {elapsed} ms
      </span>
      <span className="w-20 flex-none text-right tabular-nums text-muted-foreground">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
    </ListRow>
  );
}
