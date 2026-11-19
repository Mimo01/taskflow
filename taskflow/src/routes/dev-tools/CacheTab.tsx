/**
 * CacheTab — live TanStack Query cache inspector.
 *
 * Works regardless of the Developer Tools capture toggle: it reads the live QueryClient.
 */
import { useQueryClient } from '@tanstack/react-query';
import { Database } from 'lucide-react';
import { EmptyState } from '../../components/ui/empty-state';
import {
  CACHE_STATE_OPTIONS,
  type CacheRow,
  filterCacheRows,
} from '../../lib/dev-tools/query-cache-snapshot';
import { relativeTime } from '../../lib/relative-time';
import { cn } from '../../lib/utils';
import { SectionSegmented } from '../dashboard/issue-detail/SectionHeader';
import CacheInspector from './CacheInspector';
import { ListRow, ToolbarSearch, useListKeyboard } from './dev-tools-ui';
import { useDevToolsViewStore } from './dev-tools-view.store';
import ListInspectorLayout from './ListInspectorLayout';
import { useQueryCacheRows } from './useQueryCacheRows';

function dotClass(r: CacheRow): string {
  if (r.fetchStatus === 'fetching') return 'bg-primary animate-pulse';
  if (r.status === 'error') return 'bg-red-500';
  if (r.observers === 0) return 'bg-muted-foreground/40';
  if (r.stale) return 'bg-amber-500';
  return 'bg-green-500';
}

function updatedAgo(ms: number): string {
  return ms === 0 ? 'never' : relativeTime(new Date(ms).toISOString());
}

export default function CacheTab() {
  const client = useQueryClient();
  const rows = useQueryCacheRows(client);
  const { selectedId, search } = useDevToolsViewStore((s) => s.tabs.cache);
  const state = useDevToolsViewStore((s) => s.cacheState);
  const setSelected = useDevToolsViewStore((s) => s.setSelected);
  const setSearch = useDevToolsViewStore((s) => s.setSearch);
  const setCacheState = useDevToolsViewStore((s) => s.setCacheState);

  const filtered = filterCacheRows(rows, { search, state }).sort(
    (a, b) => b.dataUpdatedAt - a.dataUpdatedAt,
  );
  const ids = filtered.map((r) => r.hash);
  const onKeyDown = useListKeyboard(ids, selectedId, (id) => setSelected('cache', id));
  const selected = filtered.find((r) => r.hash === selectedId) ?? null;

  if (rows.length === 0) {
    return <EmptyState fill icon={Database} title="Query cache is empty" />;
  }

  const fetching = rows.filter((r) => r.fetchStatus === 'fetching').length;
  const stale = rows.filter((r) => r.stale).length;
  const errors = rows.filter((r) => r.status === 'error').length;
  const observed = rows.filter((r) => r.observers > 0).length;

  return (
    <ListInspectorLayout
      toolbar={
        <>
          <ToolbarSearch
            value={search}
            onChange={(v) => setSearch('cache', v)}
            placeholder="Search keys"
          />
          <SectionSegmented
            label="Query state"
            options={CACHE_STATE_OPTIONS}
            value={state as (typeof CACHE_STATE_OPTIONS)[number]['value']}
            onChange={setCacheState}
          />
        </>
      }
      summary={
        <span data-testid="cache-summary">
          {rows.length} queries · {fetching} fetching · {stale} stale · {errors} errors · {observed}{' '}
          observed
        </span>
      }
      onKeyDown={onKeyDown}
      list={
        filtered.length === 0 ? (
          <EmptyState compact icon={Database} title="No queries match the filters" />
        ) : (
          <div>
            {filtered.map((r) => (
              <ListRow
                key={r.hash}
                selected={r.hash === selectedId}
                onSelect={() => setSelected('cache', r.hash)}
                label={r.keyLabel}
              >
                <span className={cn('size-2 flex-none rounded-full', dotClass(r))} />
                <span className="min-w-0 flex-1 truncate font-mono">{r.keyLabel}</span>
                {r.fetchStatus !== 'idle' && (
                  <span className="flex-none text-muted-foreground">{r.fetchStatus}</span>
                )}
                <span
                  className="w-8 flex-none text-right tabular-nums text-muted-foreground"
                  title="Observers"
                >
                  {r.observers}
                </span>
                <span className="w-24 flex-none text-right text-muted-foreground">
                  {updatedAgo(r.dataUpdatedAt)}
                </span>
              </ListRow>
            ))}
          </div>
        )
      }
      inspector={selected ? <CacheInspector row={selected} /> : null}
    />
  );
}
