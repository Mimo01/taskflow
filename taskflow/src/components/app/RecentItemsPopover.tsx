/**
 * RecentItemsPopover -- clock icon trigger with a popover listing the last 10
 * recently opened issues/MRs. Reads from useRecentItemsStore and resolves
 * display titles from the react-query cache when available.
 */

import { useQueryClient } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import type { RecentItem } from '@/stores/recent-items.store';
import { useRecentItemsStore } from '@/stores/recent-items.store';

interface RecentItemsPopoverProps {
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
}

/**
 * Narrow shape returned for gh-backlog hits — only `key` + `fields.summary`
 * are guaranteed (WR-02: the rest of `JiraIssue` is NOT present on
 * gh-backlog cache entries; an `as JiraIssue` cast would silently mislead
 * any future caller that touches `.fields.status`, `.fields.issuetype`,
 * etc.). Callers must check the discriminator before accessing other
 * fields.
 */
type RecentIssueLike = JiraIssue | { key: string; fields: { summary: string }; isPartial: true };

/**
 * Search all react-query cache entries for a Jira issue by key.
 * Handles different cache shapes: sprint-board (flat JiraIssue[]),
 * subtasks panel ({ issues: JiraIssue[] }), and gh-backlog (narrow
 * { key, summary } — returned as a `isPartial` discriminated variant per
 * WR-02 so callers can't accidentally treat it as a full JiraIssue).
 */
function findJiraIssueInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  issueKey: string,
): RecentIssueLike | undefined {
  // 1. jira-issues caches (sprint-board = flat array, subtasks panel = { issues: [] })
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

  // 2. Backlog cache — flat JiraIssue[] arrays from Phase 48 refactor
  const sprintStoriesQueries = queryClient.getQueriesData<JiraIssue[]>({
    queryKey: ['jira-sprint-stories'],
  });
  for (const [, data] of sprintStoriesQueries) {
    if (!data) continue;
    const match = data.find((issue) => issue.key === issueKey);
    if (match) return match;
  }

  // Phase 74 GH-CUT-01: backlog data lives in ['gh-backlog', boardId] as a
  // raw GhBacklogResponse envelope. The recent-items popover only needs the
  // issue summary, so adapt the GH shape into a minimal JiraIssue-like object.
  const ghBacklogQueries = queryClient.getQueriesData<{
    issues?: Array<{ key: string; summary?: string }>;
  }>({ queryKey: ['gh-backlog'] });
  for (const [, data] of ghBacklogQueries) {
    if (!data?.issues) continue;
    const match = data.issues.find((issue) => issue.key === issueKey);
    if (match) {
      // WR-02: return a narrow `isPartial` variant rather than casting to
      // JiraIssue. The recents row only reads `.fields.summary`; any future
      // caller that touches `.fields.status` etc. will be forced by the
      // discriminated-union type to first check `'isPartial' in result`.
      return {
        key: match.key,
        fields: { summary: match.summary ?? '' },
        isPartial: true,
      };
    }
  }

  // 3. Issue detail cache (single issue)
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

function RecentItemRow({
  item,
  queryClient,
  onIssueClick,
  onMRClick,
}: {
  item: RecentItem;
  queryClient: ReturnType<typeof useQueryClient>;
  onIssueClick?: (issueKey: string) => void;
  onMRClick?: (projectIdAndIid: string) => void;
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
    } else {
      onMRClick?.(item.id);
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

export default function RecentItemsPopover({ onIssueClick, onMRClick }: RecentItemsPopoverProps) {
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
      <PopoverContent className="p-0 w-[28rem]">
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
                <RecentItemRow
                  key={`${item.type}-${item.id}`}
                  item={item}
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
