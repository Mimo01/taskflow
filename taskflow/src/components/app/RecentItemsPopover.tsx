/**
 * RecentItemsPopover -- clock icon trigger with a popover listing the last 10
 * recently opened issues/MRs. Rows render through the shared RecentItemRow
 * (same one-line layout as the command palette's Recent Items: type icon,
 * key, title, status pill, assignee), resolved from the global-search index
 * (backlog + sprint caches, loaded while the popover is open), then any
 * cached full issue, then the persisted title/issueType.
 */

import { useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useGlobalSearchSources } from '@/hooks/useGlobalSearchSources';
import { useRecentIssues } from '@/hooks/useRecentIssues';
import { buildSearchIndex } from '@/lib/global-search';
import { cn } from '@/lib/utils';
import type { GitLabMR } from '@/services/gitlab';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import {
  buildRecentRows,
  findJiraIssueInCache,
  RecentItemRow,
  RecentItemsSkeleton,
  type RecentRowModel,
  recentKeysToFetch,
  recentMrMatches,
  resolveRecentIssue,
} from './RecentItemRow';
import { GROUP_DIVIDER_CLASS, startsGroup } from './SearchResultRow';

interface RecentItemsPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}

function findGitLabMRInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): GitLabMR | undefined {
  const queries = queryClient.getQueriesData<{
    assigned: GitLabMR[];
    reviewRequested: GitLabMR[];
  }>({ queryKey: ['gitlab-mrs'] });
  for (const [, data] of queries) {
    const match =
      data?.assigned?.find((mr) => recentMrMatches(id, mr)) ??
      data?.reviewRequested?.find((mr) => recentMrMatches(id, mr));
    if (match) return match;
  }
  return undefined;
}

function PopoverRecentRow({
  row,
  divider,
  queryClient,
  onIssueClick,
  onMRClick,
}: {
  row: RecentRowModel;
  divider: boolean;
  queryClient: ReturnType<typeof useQueryClient>;
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}) {
  const { item } = row;
  const isJira = item.type === 'jira';
  const mrTitle = isJira ? undefined : findGitLabMRInCache(queryClient, item.id)?.title;

  function handleClick() {
    if (isJira) {
      onIssueClick?.(item.id);
    } else {
      onMRClick?.(item.id);
    }
  }

  return (
    <button
      type="button"
      className={cn(
        // Same 32px row as the palette (density adjusts height only); divider inset matches px-3.
        'flex h-8 density-compact:h-7 density-comfortable:h-10 w-full items-center px-3 text-left hover:bg-muted',
        divider && cn(GROUP_DIVIDER_CLASS, 'before:inset-x-3'),
      )}
      onClick={handleClick}
    >
      <RecentItemRow
        item={item}
        entry={row.entry}
        issue={row.issue}
        mrTitle={mrTitle}
        dimmed={row.dimmed}
        indent={row.indent}
      />
    </button>
  );
}

export default function RecentItemsPopover({ onIssueClick, onMRClick }: RecentItemsPopoverProps) {
  const { items } = useRecentItemsStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { backlog, allData, isIndexLoading } = useGlobalSearchSources(open);
  const index = useMemo(() => buildSearchIndex(backlog, allData), [backlog, allData]);
  const fetchKeys = useMemo(() => recentKeysToFetch(items), [items]);
  const fetched = useRecentIssues(open, fetchKeys);
  // Render the list once, complete: placeholders until index + enrichment settle.
  const loading = isIndexLoading || fetched.isLoading;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
        aria-label="Recent Items"
      >
        <Clock className="w-5 h-5" />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[40rem] max-w-[calc(100vw-2rem)]">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-semibold text-sm">Recent Items</span>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[420px]">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No recent items yet
              </div>
            ) : loading ? (
              <RecentItemsSkeleton count={items.length} className="px-3" />
            ) : (
              buildRecentRows(items, (key) =>
                resolveRecentIssue(key, index, fetched, (k) =>
                  findJiraIssueInCache(queryClient, k),
                ),
              ).map((row, i, rows) => (
                <PopoverRecentRow
                  key={row.rowKey}
                  row={row}
                  divider={startsGroup(rows, i)}
                  queryClient={queryClient}
                  // Close on select: navigating must not leave the popover over the new page.
                  onIssueClick={(key) => {
                    setOpen(false);
                    onIssueClick?.(key);
                  }}
                  onMRClick={(id) => {
                    setOpen(false);
                    onMRClick?.(id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
