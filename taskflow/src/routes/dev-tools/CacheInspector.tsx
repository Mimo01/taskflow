/**
 * CacheInspector — detail pane for one TanStack Query cache entry, with scoped actions.
 *
 * Every action is scoped `{ queryKey, exact: true }`; client.clear() is never called.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { Button } from '../../components/ui/button';
import { byteSize, safeStringify } from '../../lib/dev-tools/json-preview';
import type { CacheRow } from '../../lib/dev-tools/query-cache-snapshot';
import { relativeTime } from '../../lib/relative-time';
import { CopyMenu, InspectorSection, KeyValueTable } from './dev-tools-ui';
import JsonTree from './JsonTree';
import { InspectorMaximizeButton } from './ListInspectorLayout';
import { formatBytes } from './utils';

/** `now` is the row's snapshot time, so the relative part keeps ticking with the 1 s snapshot. */
function ts(ms: number, now: number): string {
  return ms === 0
    ? 'never'
    : `${new Date(ms).toLocaleTimeString()} (${relativeTime(new Date(ms).toISOString(), now)})`;
}

export default function CacheInspector({ row }: { row: CacheRow }) {
  const client = useQueryClient();
  const query = client.getQueryCache().get(row.hash);
  const filters = { queryKey: row.key, exact: true } as const;
  // Only the selected query is stringified (for the size label); rebuilt when its data changes.
  // Keyed on the snapshot row's dataUpdatedAt, never on the mutable Query.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on hash + dataUpdatedAt on purpose
  const dataText = useMemo(() => safeStringify(query?.state.data), [row.hash, row.dataUpdatedAt]);

  if (!query) {
    return <p className="px-4 py-6 text-center text-xs text-muted-foreground">Query removed.</p>;
  }

  const { state } = query;
  const stateRows: [string, string][] = [
    ['Status', row.status],
    ['Fetch status', row.fetchStatus],
    ['Freshness', row.stale ? 'stale' : 'fresh'],
    ['Invalidated', row.invalidated ? 'yes' : 'no'],
    ['Observers', String(row.observers)],
    [
      'Active / disabled',
      `${query.isActive() ? 'active' : 'inactive'} / ${query.isDisabled() ? 'disabled' : 'enabled'}`,
    ],
    ['Data updates', String(state.dataUpdateCount)],
    ['Fetch failures', String(state.fetchFailureCount)],
    ['gcTime', String(query.options.gcTime ?? 'default')],
    ['Data updated', ts(row.dataUpdatedAt, row.snapshotAt)],
    ['Error updated', ts(row.errorUpdatedAt, row.snapshotAt)],
  ];

  return (
    <div data-testid="cache-inspector">
      <div className="border-b px-4 py-3">
        <pre className="overflow-auto font-mono text-xs whitespace-pre-wrap break-all">
          {safeStringify(row.key)}
        </pre>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void client.refetchQueries(filters)}
          >
            Refetch
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void client.invalidateQueries(filters)}
          >
            Invalidate
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => void client.resetQueries(filters)}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            disabled={row.observers > 0}
            title={
              row.observers > 0 ? 'Mounted observers would keep the orphaned query' : undefined
            }
            onClick={() => client.removeQueries(filters)}
          >
            Remove
          </Button>
          <div className="ml-auto flex items-center gap-1">
            <CopyMenu
              items={[
                { label: 'Copy key', getText: () => safeStringify(row.key) },
                { label: 'Copy data', getText: () => dataText },
              ]}
            />
            <InspectorMaximizeButton />
          </div>
        </div>
      </div>
      <InspectorSection title="State">
        <KeyValueTable rows={stateRows} />
      </InspectorSection>
      {row.error && (
        <InspectorSection title="Error">
          <p className="font-mono text-xs break-all text-red-600 dark:text-red-400">{row.error}</p>
        </InspectorSection>
      )}
      <InspectorSection title={`Data · ${formatBytes(byteSize(dataText))}`}>
        <JsonTree value={query.state.data} />
      </InspectorSection>
    </div>
  );
}
