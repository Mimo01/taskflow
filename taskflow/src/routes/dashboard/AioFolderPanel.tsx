import { ChevronRight, Folder, FolderOpen, Inbox, Layers, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { filterFolderTree } from '@/lib/aio-cycle-list';
import { cn } from '@/lib/utils';
import type { AioFolder } from '@/services/aio/types';

/** Selection sentinels: 0 = every project cycle, -1 = cycles without a folder. */
export const ALL_CYCLES_ID = 0;
export const UNGROUPED_ID = -1;

const ROW_PADDING = 'py-2 density-compact:py-1 density-comfortable:py-3';
const SELECTED_CLASS = 'bg-accent text-accent-foreground font-semibold';
const IDLE_CLASS = 'text-muted-foreground hover:bg-accent hover:text-accent-foreground';

function rowClass(selected: boolean): string {
  return cn(
    'flex w-full items-center gap-1.5 rounded-lg pr-2 text-left text-sm transition-colors',
    ROW_PADDING,
    selected ? SELECTED_CLASS : IDLE_CLASS,
  );
}

function CountLabel({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{count}</span>;
}

function FolderNode({
  node,
  depth,
  agg,
  expandedIDs,
  selectedFolderID,
  onToggle,
  onSelect,
}: {
  node: AioFolder;
  depth: number;
  agg: Record<number, number>;
  expandedIDs: Set<number>;
  selectedFolderID: number | null;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expandedIDs.has(node.ID);
  const isSelected = selectedFolderID === node.ID;
  const chevronLeft = 8 + depth * 14;
  const Icon = hasChildren && isExpanded ? FolderOpen : Folder;

  return (
    <>
      <div className="relative">
        {/* Select button holds the content; the chevron is a SIBLING positioned over its
            left padding, so no interactive element is nested in another. */}
        <button
          type="button"
          data-testid={`folder-node-${node.ID}`}
          aria-current={isSelected ? 'page' : undefined}
          className={rowClass(isSelected)}
          style={{ paddingLeft: chevronLeft + 16 + 6 }}
          onClick={() => onSelect(node.ID)}
        >
          <Icon className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate" title={node.name}>
            {node.name}
          </span>
          <CountLabel count={agg[node.ID] ?? 0} />
        </button>
        {hasChildren && (
          <button
            type="button"
            aria-label={isExpanded ? `Collapse ${node.name}` : `Expand ${node.name}`}
            aria-expanded={isExpanded}
            className="absolute top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center rounded"
            style={{ left: chevronLeft }}
            onClick={() => onToggle(node.ID)}
          >
            <ChevronRight
              className={cn('size-4 transition-transform', isExpanded && 'rotate-90')}
            />
          </button>
        )}
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <FolderNode
            key={child.ID}
            node={child}
            depth={depth + 1}
            agg={agg}
            expandedIDs={expandedIDs}
            selectedFolderID={selectedFolderID}
            onToggle={onToggle}
            onSelect={onSelect}
          />
        ))}
    </>
  );
}

export function AioFolderPanel({
  tree,
  agg,
  total,
  ungroupedCount,
  expandedIDs,
  selectedFolderID,
  onToggle,
  onSelect,
  isLoading,
  error,
  onRetry,
}: {
  tree: AioFolder[];
  agg: Record<number, number>;
  total: number;
  ungroupedCount: number;
  expandedIDs: Set<number>;
  selectedFolderID: number | null;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterFolderTree(tree, query), [tree, query]);
  const isFiltering = query.trim().length > 0;
  const effectiveExpanded = useMemo(
    () => (isFiltering ? new Set([...expandedIDs, ...filtered.expandIds]) : expandedIDs),
    [isFiltering, expandedIDs, filtered.expandIds],
  );

  return (
    <aside className="flex min-h-0 w-64 shrink-0 flex-col border-r border-border">
      <div className="px-2 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter folders…"
            aria-label="Filter folders"
            className="w-full rounded-md border bg-background py-1 pl-8 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear folder filter"
              onClick={() => setQuery('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
        {isLoading ? (
          [40, 36, 32, 28, 40, 36].map((w, i) => (
            <Skeleton
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list, no reorder
              key={i}
              className="h-7 rounded-lg"
              style={{ width: w * 4 }}
            />
          ))
        ) : error ? (
          <div className="p-2">
            <ErrorState error={error} onRetry={onRetry} viewName="folders" />
          </div>
        ) : (
          <>
            <button
              type="button"
              data-testid="folder-node-all"
              aria-current={selectedFolderID === ALL_CYCLES_ID ? 'page' : undefined}
              className={cn(rowClass(selectedFolderID === ALL_CYCLES_ID), 'pl-2')}
              onClick={() => onSelect(ALL_CYCLES_ID)}
            >
              <Layers className="size-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate">All cycles</span>
              <CountLabel count={total} />
            </button>
            <div className="my-1 border-t border-border/50" />
            {filtered.tree.map((node) => (
              <FolderNode
                key={node.ID}
                node={node}
                depth={0}
                agg={agg}
                expandedIDs={effectiveExpanded}
                selectedFolderID={selectedFolderID}
                onToggle={onToggle}
                onSelect={onSelect}
              />
            ))}
            {isFiltering && filtered.tree.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">No folders match</p>
            )}
            {ungroupedCount > 0 && !isFiltering && (
              <button
                type="button"
                data-testid="folder-node-ungrouped"
                aria-current={selectedFolderID === UNGROUPED_ID ? 'page' : undefined}
                className={cn(rowClass(selectedFolderID === UNGROUPED_ID), 'pl-2')}
                onClick={() => onSelect(UNGROUPED_ID)}
              >
                <Inbox className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">Ungrouped</span>
                <CountLabel count={ungroupedCount} />
              </button>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
