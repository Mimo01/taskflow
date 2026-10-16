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
import { buildSearchIndex, findIndexEntry, type SearchIndex } from '@/lib/global-search';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { RecentItem } from '@/stores/recent-items.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import { RecentItemRow, recentMrIid } from './RecentItemRow';

interface RecentItemsPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}

/**
 * Fallback for issues not in the global-search index: search the jira-issues
 * caches (sprint board = flat array, subtasks panel = { issues: [] }) and the
 * issue-detail cache for a full JiraIssue. Backlog (gh-backlog) hits are
 * covered by the index.
 */
function findJiraIssueInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  issueKey: string,
): JiraIssue | undefined {
  const queries = queryClient.getQueriesData<JiraIssue[] | { issues?: JiraIssue[] }>({
    queryKey: ['jira-issues'],
  });
  for (const [, data] of queries) {
    if (!data) continue;
    if ('issues' in data && Array.isArray(data.issues)) {
      const match = data.issues.find((issue) => issue.key === issueKey);
      if (match) return match;
    } else if (Array.isArray(data)) {
      const match = data.find((issue) => issue.key === issueKey);
      if (match) return match;
    }
  }

  const detailQueries = queryClient.getQueriesData<JiraIssue>({
    queryKey: ['jira-issue-detail', issueKey],
  });
  for (const [, data] of detailQueries) {
    if (data?.fields?.summary) return data;
  }

  return undefined;
}

function findGitLabMRInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  iid: string,
): GitLabMR | undefined {
  const queries = queryClient.getQueriesData<{
    assigned: GitLabMR[];
    reviewRequested: GitLabMR[];
  }>({ queryKey: ['gitlab-mrs'] });
  for (const [, data] of queries) {
    const match =
      data?.assigned?.find((mr) => String(mr.iid) === iid) ??
      data?.reviewRequested?.find((mr) => String(mr.iid) === iid);
    if (match) return match;
  }
  return undefined;
}

function PopoverRecentRow({
  item,
  index,
  queryClient,
  onIssueClick,
  onMRClick,
}: {
  item: RecentItem;
  index: SearchIndex;
  queryClient: ReturnType<typeof useQueryClient>;
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}) {
  const isJira = item.type === 'jira';
  const entry = isJira ? findIndexEntry(index, item.id) : null;
  const issue = isJira && !entry ? findJiraIssueInCache(queryClient, item.id) : undefined;
  const mrTitle = isJira
    ? undefined
    : findGitLabMRInCache(queryClient, recentMrIid(item.id))?.title;

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
      className="w-full text-left px-3 py-2 density-compact:py-1 density-comfortable:py-3 hover:bg-muted"
      onClick={handleClick}
    >
      <RecentItemRow item={item} entry={entry} issue={issue} mrTitle={mrTitle} />
    </button>
  );
}

export default function RecentItemsPopover({ onIssueClick, onMRClick }: RecentItemsPopoverProps) {
  const { items } = useRecentItemsStore();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { backlog, allData } = useGlobalSearchSources(open);
  const index = useMemo(() => buildSearchIndex(backlog, allData), [backlog, allData]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
        aria-label="Recent Items"
      >
        <Clock className="w-5 h-5" />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[36rem] max-w-[calc(100vw-2rem)]">
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
            ) : (
              items.map((item) => (
                <PopoverRecentRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  index={index}
                  queryClient={queryClient}
                  onIssueClick={onIssueClick}
                  onMRClick={onMRClick}
                />
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
