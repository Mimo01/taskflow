/**
 * LogsTab — API request log for the Developer Tools page.
 *
 * Network-panel style: toolbar (search + facets + pause/clear), summary strip over the filtered
 * set, one-line rows, and a resizable inspector (see LogInspector).
 */
import { Bug, Pause, Play } from 'lucide-react';
import { useMemo } from 'react';
import { Button } from '../../components/ui/button';
import { EmptyState } from '../../components/ui/empty-state';
import { FilterPopover } from '../../components/ui/table-filter-sort';
import {
  facetOptions,
  filterLogs,
  type LogFilters,
  STATUS_FACETS,
} from '../../lib/dev-tools/log-filters';
import { computeLogStats, urlPath } from '../../lib/dev-tools/log-stats';
import { cn } from '../../lib/utils';
import { type ApiLogEntry, useDebugLogStore } from '../../stores/debug-log.store';
import { useSettingsStore } from '../../stores/settings.store';
import { ListRow, ToolbarSearch, useListKeyboard } from './dev-tools-ui';
import { facetSetter, LOG_FACETS, useDevToolsViewStore } from './dev-tools-view.store';
import ListInspectorLayout from './ListInspectorLayout';
import LogInspector from './LogInspector';
import { sourceBadgeClass } from './utils';

function statusText(status: number | null): string {
  if (status === null) return 'text-red-600 dark:text-red-400';
  if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

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
  const { selectedId, search } = useDevToolsViewStore((s) => s.tabs.logs);
  const setSelected = useDevToolsViewStore((s) => s.setSelected);
  const setSearch = useDevToolsViewStore((s) => s.setSearch);
  const sources = useDevToolsViewStore((s) => s.logSources);
  const statuses = useDevToolsViewStore((s) => s.logStatuses);
  const methods = useDevToolsViewStore((s) => s.logMethods);
  const operations = useDevToolsViewStore((s) => s.logOperations);

  const entries = pausedEntries ?? liveEntries;
  const filters: LogFilters = { search, sources, statuses, methods, operations };
  const filtered = filterLogs(entries, filters);
  const options = useMemo(() => facetOptions(entries), [entries]);
  const stats = computeLogStats(filtered);
  const ids = filtered.map((e) => e.id);
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
      <div className="ml-auto flex items-center gap-2">
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
    <div data-testid="logs-summary" className="flex flex-wrap items-center gap-x-1.5">
      <span>{stats.total} requests</span>
      <span>·</span>
      <span className={cn(stats.errors > 0 && 'text-red-600 dark:text-red-400')}>
        {stats.errors} errors
      </span>
      {stats.median !== null && stats.p95 !== null && (
        <>
          <span>·</span>
          <span>median {stats.median} ms</span>
          <span>·</span>
          <span>p95 {stats.p95} ms</span>
        </>
      )}
      {stats.slowest && (
        <>
          <span>·</span>
          <span className="truncate">
            slowest {stats.slowest.method} {stats.slowest.path} ({stats.slowest.ms} ms)
          </span>
        </>
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
            selected={e.id === selectedId}
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
      inspector={selected ? <LogInspector entry={selected} entries={filtered} /> : null}
    />
  );
}

function LogRow({
  entry,
  selected,
  onSelect,
}: {
  entry: ApiLogEntry;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <ListRow
      selected={selected}
      onSelect={onSelect}
      label={`${entry.method} ${urlPath(entry.url)}`}
    >
      <span className={cn(sourceBadgeClass(entry.source), 'w-14 flex-none text-center')}>
        {entry.source}
      </span>
      <span className="w-12 flex-none font-mono font-semibold">{entry.method}</span>
      <span className={cn('w-10 flex-none font-mono font-semibold', statusText(entry.status))}>
        {entry.status ?? 'ERR'}
      </span>
      <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
        {displayPath(entry.url)}
      </span>
      {entry.operation && (
        <span className="max-w-48 flex-none truncate text-muted-foreground">{entry.operation}</span>
      )}
      <span className="w-16 flex-none text-right tabular-nums text-muted-foreground">
        {entry.durationMs} ms
      </span>
      <span className="w-20 flex-none text-right tabular-nums text-muted-foreground">
        {new Date(entry.timestamp).toLocaleTimeString()}
      </span>
    </ListRow>
  );
}
