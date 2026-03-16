/**
 * PinnedTabStrip -- renders a horizontal strip of pinned issue tabs below the
 * TopBar. Shows up to 7 visible tabs with an overflow "+N" popover for any
 * beyond that limit. Each tab displays the issue type icon, key, truncated
 * summary, and a close button.
 *
 * Issue metadata (summary, type) is resolved from the react-query cache --
 * no additional network requests are made.
 */
import { X, Bug, BookOpen, CheckSquare, CornerDownRight } from 'lucide-react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Skeleton } from '../ui/skeleton';
import { cn } from '@/lib/utils';

interface PinnedTabStripProps {
  pinnedKeys: string[];
  activeKey: string | null;
  onTabClick: (issueKey: string) => void;
  onTabClose: (issueKey: string) => void;
}

interface ResolvedIssue {
  summary: string;
  issueTypeName: string;
}

/**
 * Search all react-query cache entries for a Jira issue by key and return
 * its summary + issue type. Handles multiple cache shapes (flat array,
 * { issues: [] }, backlog view, and direct detail cache).
 */
function resolveIssueFromCache(
  queryClient: QueryClient,
  issueKey: string,
): ResolvedIssue | undefined {
  type CachedIssue = { key: string; fields: { summary: string; issuetype: { name: string } } };

  // 1. jira-issues caches (sprint-board = flat array, my-tasks = { issues: [] })
  const queries = queryClient.getQueriesData<CachedIssue[] | { issues?: CachedIssue[] }>({
    queryKey: ['jira-issues'],
  });
  for (const [, data] of queries) {
    if (!data) continue;
    if ('issues' in data && Array.isArray(data.issues)) {
      const match = data.issues.find((i) => i.key === issueKey);
      if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    } else if (Array.isArray(data)) {
      const match = data.find((i) => i.key === issueKey);
      if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    }
  }

  // 2. Backlog cache (sprints[].issues + backlog[])
  const backlogQueries = queryClient.getQueriesData<{
    sprints?: Array<{ issues: CachedIssue[] }>;
    backlog?: CachedIssue[];
  }>({
    queryKey: ['jira-backlog-view'],
  });
  for (const [, data] of backlogQueries) {
    if (!data) continue;
    const match = data.backlog?.find((i) => i.key === issueKey);
    if (match) return { summary: match.fields.summary, issueTypeName: match.fields.issuetype.name };
    if (data.sprints) {
      for (const s of data.sprints) {
        const m = s.issues.find((i) => i.key === issueKey);
        if (m) return { summary: m.fields.summary, issueTypeName: m.fields.issuetype.name };
      }
    }
  }

  // 3. Issue detail cache (single issue)
  const detailQueries = queryClient.getQueriesData<CachedIssue>({
    queryKey: ['jira-issue-detail', issueKey],
  });
  for (const [, data] of detailQueries) {
    if (data?.fields?.summary) {
      return { summary: data.fields.summary, issueTypeName: data.fields.issuetype?.name ?? '' };
    }
  }

  return undefined;
}

/** Map issue type name to a small colored lucide icon. */
function IssueTypeIcon({ typeName }: { typeName: string }) {
  switch (typeName) {
    case 'Bug':
      return <Bug className="size-3.5 text-red-500" />;
    case 'Story':
      return <BookOpen className="size-3.5 text-green-600" />;
    case 'Subtask':
    case 'Sub-task':
      return <CornerDownRight className="size-3.5 text-blue-500" />;
    case 'Epic':
      return <BookOpen className="size-3.5 text-purple-500" />;
    default:
      return <CheckSquare className="size-3.5 text-blue-500" />;
  }
}

export default function PinnedTabStrip({
  pinnedKeys,
  activeKey,
  onTabClick,
  onTabClose,
}: PinnedTabStripProps) {
  const queryClient = useQueryClient();
  const visibleKeys = pinnedKeys.slice(0, 7);
  const overflowKeys = pinnedKeys.slice(7);

  return (
    <div
      className="h-14 border-b border-border flex items-end gap-1 px-4 flex-shrink-0 bg-background"
      role="tablist"
      aria-label="Pinned issues"
    >
      {visibleKeys.map((key) => {
        const resolved = resolveIssueFromCache(queryClient, key);
        return (
          <button
            key={key}
            role="tab"
            aria-selected={key === activeKey}
            onClick={() => onTabClick(key)}
            className={cn(
              'flex items-center gap-1.5 px-2 h-12 min-w-[120px] max-w-[200px] rounded-t-md text-xs font-medium border-b-2 transition-colors group',
              key === activeKey
                ? 'border-primary text-foreground bg-muted/50'
                : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {resolved ? (
              <IssueTypeIcon typeName={resolved.issueTypeName} />
            ) : (
              <Skeleton className="size-3.5 rounded shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="font-mono text-[11px] leading-tight">{key}</span>
              {resolved ? (
                <span className="truncate text-[10px] leading-tight text-muted-foreground">{resolved.summary}</span>
              ) : (
                <Skeleton className="h-2.5 w-16" />
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(key);
              }}
              className="ml-auto self-start mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Close ${key} tab`}
            >
              <X className="size-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </button>
        );
      })}

      {overflowKeys.length > 0 && (
        <Popover>
          <PopoverTrigger
            className="text-xs font-semibold px-2 py-1 rounded bg-muted text-muted-foreground hover:bg-accent"
            aria-label={`Show ${overflowKeys.length} more pinned tabs`}
          >
            +{overflowKeys.length}
          </PopoverTrigger>
          <PopoverContent className="p-1 w-64 max-h-60 overflow-y-auto">
            {overflowKeys.map((key) => {
              const resolved = resolveIssueFromCache(queryClient, key);
              return (
                <button
                  key={key}
                  onClick={() => onTabClick(key)}
                  className="flex items-center gap-2 w-full px-2 py-1.5 text-xs hover:bg-muted rounded transition-colors"
                >
                  {resolved ? (
                    <IssueTypeIcon typeName={resolved.issueTypeName} />
                  ) : (
                    <Skeleton className="size-3.5 rounded shrink-0" />
                  )}
                  <span className="font-mono">{key}</span>
                  {resolved ? (
                    <span className="truncate text-muted-foreground">
                      {resolved.summary}
                    </span>
                  ) : (
                    <Skeleton className="h-2.5 w-16" />
                  )}
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
