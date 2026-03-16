/**
 * RecentItemsPopover -- clock icon trigger with a popover listing the last 10
 * recently opened issues/MRs. Reads from useRecentItemsStore and resolves
 * display titles from the react-query cache when available.
 */
import { Clock } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { useRecentItemsStore } from '@/stores/recent-items.store';
import type { RecentItem } from '@/stores/recent-items.store';
import type { JiraIssue } from '@/services/jira';
import type { GitLabMR } from '@/services/gitlab';

interface RecentItemsPopoverProps {
  onIssueClick?: (issueKey: string) => void;
}

/**
 * Search all react-query cache entries whose key starts with the given prefix
 * and return the first matching item from the data.
 */
function findJiraIssueInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  issueKey: string,
): JiraIssue | undefined {
  const queries = queryClient.getQueriesData<{ issues: JiraIssue[] }>({
    queryKey: ['jira-issues'],
  });
  for (const [, data] of queries) {
    const match = data?.issues?.find((issue) => issue.key === issueKey);
    if (match) return match;
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

function RecentItemRow({
  item,
  queryClient,
  onIssueClick,
}: {
  item: RecentItem;
  queryClient: ReturnType<typeof useQueryClient>;
  onIssueClick?: (issueKey: string) => void;
}) {
  let label: string;
  let title: string | undefined;

  if (item.type === 'jira') {
    const cached = findJiraIssueInCache(queryClient, item.id);
    label = item.id;
    title = cached?.fields.summary ?? item.title;
  } else {
    const cached = findGitLabMRInCache(queryClient, item.id);
    label = `!${item.id}`;
    title = cached?.title ?? item.title;
  }

  function handleClick() {
    if (item.type === 'jira') {
      onIssueClick?.(item.id);
    } else if (item.url) {
      openUrl(item.url);
    }
  }

  return (
    <button
      type="button"
      className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex gap-2 items-center"
      onClick={handleClick}
    >
      <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="font-mono text-muted-foreground flex-shrink-0">{label}</span>
      <span className="truncate">{title ?? ''}</span>
    </button>
  );
}

export default function RecentItemsPopover({ onIssueClick }: RecentItemsPopoverProps) {
  const { items } = useRecentItemsStore();
  const queryClient = useQueryClient();

  return (
    <Popover>
      <PopoverTrigger
        className="relative flex items-center justify-center w-8 h-8 rounded hover:bg-muted transition-colors"
        aria-label="Recent Items"
      >
        <Clock className="w-5 h-5" />
      </PopoverTrigger>
      <PopoverContent className="p-0 w-80">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-semibold text-sm">Recent Items</span>
          </div>

          {/* List */}
          <div className="overflow-y-auto max-h-[400px]">
            {items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No recent items yet
              </div>
            ) : (
              items.map((item) => (
                <RecentItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
                  queryClient={queryClient}
                  onIssueClick={onIssueClick}
                />
              ))
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
