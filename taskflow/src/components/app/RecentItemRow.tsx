/**
 * Shared one-line row for a recently opened issue/MR, used by both the
 * command palette's Recent Items group and the top-bar Recent Items popover
 * so the two lists render identically (Phase 92 polish).
 *
 * Resolution order for Jira items: global-search index entry (backlog +
 * sprint caches: status, assignee, epic) -> any cached full JiraIssue ->
 * the persisted title/issueType from the recent-items store.
 *
 * Subtasks are shown with their parent story (same treatment as search
 * results, D-07): a dimmed parent row above the indented subtask. Consecutive
 * subtasks of one parent share a single parent row; a subtask directly after
 * its own (recent) parent nests under it without a duplicate dimmed row.
 */
import type { QueryClient } from '@tanstack/react-query';
import { GitMerge } from 'lucide-react';
import type React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { RecentIssuesData } from '@/hooks/useRecentIssues';
import {
  entryFromJiraIssue,
  findIndexEntry,
  type SearchEntry,
  type SearchIndex,
} from '@/lib/global-search';
import { cn } from '@/lib/utils';
import type { JiraIssue } from '@/services/jira';
import type { RecentItem } from '@/stores/recent-items.store';
import { SearchResultRow } from './SearchResultRow';

export interface RecentItemRowProps {
  item: RecentItem;
  /** Index entry for a Jira item, when the backlog/sprint caches contain it. */
  entry?: SearchEntry | null;
  /** Fallback full issue from another react-query cache (detail, sprint board). */
  issue?: JiraIssue | null;
  /** Cached MR title for GitLab items. */
  mrTitle?: string;
  dimmed?: boolean;
  indent?: boolean;
  onKeyClick?: (e: React.MouseEvent, issueKey: string) => void;
}

export interface RecentIssueSources {
  entry: SearchEntry | null;
  issue?: JiraIssue | null;
}

export interface RecentRowModel {
  /** Unique per row (a parent can head several groups). */
  rowKey: string;
  /** The recent item, or a synthesized jira item for a parent row. */
  item: RecentItem;
  entry: SearchEntry | null;
  issue?: JiraIssue | null;
  isParent: boolean;
  dimmed: boolean;
  indent: boolean;
}

function subtaskParent(
  item: RecentItem,
  src: RecentIssueSources,
): { key: string; summary?: string; typeName?: string } | null {
  if (src.entry) {
    return src.entry.isSubtask && src.entry.parentKey ? { key: src.entry.parentKey } : null;
  }
  const f = src.issue?.fields;
  if (f) {
    return f.issuetype?.subtask && f.parent?.key
      ? { key: f.parent.key, summary: f.parent.fields?.summary }
      : null;
  }
  // Cold cache: fall back to the parent persisted when the subtask was opened.
  return item.parentKey
    ? { key: item.parentKey, summary: item.parentTitle, typeName: item.parentIssueType }
    : null;
}

/** Flatten recent items into display rows, inserting a dimmed parent row above subtasks. */
export function buildRecentRows(
  items: RecentItem[],
  resolve: (issueKey: string) => RecentIssueSources,
): RecentRowModel[] {
  const rows: RecentRowModel[] = [];
  // Key of the row that a following subtask may nest under.
  let headerKey: string | null = null;
  for (const item of items) {
    if (item.type !== 'jira') {
      rows.push({
        rowKey: `${item.type}-${item.id}`,
        item,
        entry: null,
        isParent: false,
        dimmed: false,
        indent: false,
      });
      headerKey = null;
      continue;
    }
    const src = resolve(item.id);
    const parent = subtaskParent(item, src);
    if (parent && headerKey !== parent.key) {
      const p = resolve(parent.key);
      rows.push({
        rowKey: `parent-${parent.key}-${item.id}`,
        item: {
          type: 'jira',
          id: parent.key,
          title: parent.summary,
          issueType: parent.typeName,
          timestamp: item.timestamp,
        },
        entry: p.entry,
        issue: p.issue,
        isParent: true,
        dimmed: true,
        indent: false,
      });
      headerKey = parent.key;
    } else if (!parent) {
      headerKey = item.id;
    }
    rows.push({
      rowKey: `jira-${item.id}`,
      item,
      entry: src.entry,
      issue: src.issue,
      isParent: false,
      dimmed: false,
      indent: !!parent,
    });
  }
  return rows;
}

/**
 * Fallback for issues not in the global-search index: search the jira-issues
 * caches (sprint board = flat array, subtasks panel = { issues: [] }) and the
 * issue-detail cache for a full JiraIssue. Backlog (gh-backlog) hits are
 * covered by the index.
 */
export function findJiraIssueInCache(
  queryClient: QueryClient,
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

/**
 * Resolve one recent key: index entry first; otherwise a batch-fetched issue converted to
 * a full entry (status, assignee, epic) the same way body-search hits are; otherwise any
 * cached issue. Shared by the palette's Recent Items and the top-bar popover.
 */
export function resolveRecentIssue(
  key: string,
  index: SearchIndex,
  fetched: RecentIssuesData,
  cached: (key: string) => JiraIssue | undefined,
): RecentIssueSources {
  const indexed = findIndexEntry(index, key);
  if (indexed) return { entry: indexed };
  const issue = fetched.issues.get(key);
  if (issue) {
    const entry = entryFromJiraIssue(issue, index, fetched.epicLinkFieldKey, 'open');
    if (!entry.epic) {
      const epicKey = (issue.fields as unknown as Record<string, unknown>)[
        fetched.epicLinkFieldKey
      ];
      const name = typeof epicKey === 'string' ? fetched.epicNames.get(epicKey) : undefined;
      // Epic not in the board caches: summary as name, colour hashed from the key.
      if (typeof epicKey === 'string' && name) entry.epic = { key: epicKey, name, color: '' };
    }
    return { entry };
  }
  return { entry: null, issue: cached(key) ?? null };
}

/**
 * Every recent Jira key plus persisted subtask parents, fetched in one batch. Deliberately
 * independent of the search index: a key set that changed when the index loaded would
 * restart the query and make rows blink back to their persisted titles.
 */
export function recentKeysToFetch(items: RecentItem[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    if (item.type !== 'jira') continue;
    keys.add(item.id);
    if (item.parentKey) keys.add(item.parentKey);
  }
  return [...keys];
}

/** Placeholder rows at the final row height, shown until recents data is ready (no flash). */
export function RecentItemsSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div aria-hidden="true" data-testid="recent-items-skeleton">
      {Array.from({ length: Math.max(1, count) }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
        <div key={i} className={cn('flex h-8 items-center gap-2', className)}>
          <Skeleton className="size-3.5 shrink-0 rounded-sm" />
          <Skeleton className="h-3 w-[4.5rem] shrink-0" />
          <Skeleton className="h-3 max-w-64 flex-1" />
          <span className="flex-1" />
          <Skeleton className="h-5 w-[4.5rem] shrink-0 rounded" />
          <Skeleton className="size-5 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** "project_id/iid" (composite) or bare iid -> bare iid. */
export function recentMrIid(id: string): string {
  return id.includes('/') ? (id.split('/').pop() ?? id) : id;
}

export function RecentItemRow({
  item,
  entry,
  issue,
  mrTitle,
  dimmed,
  indent,
  onKeyClick,
}: RecentItemRowProps) {
  if (item.type === 'gitlab') {
    const iid = recentMrIid(item.id);
    return (
      <SearchResultRow
        issueKey={item.id}
        keyLabel={`!${iid}`}
        title={mrTitle ?? item.title ?? ''}
        icon={<GitMerge className="size-3.5 shrink-0 text-muted-foreground" />}
        showEpic={false}
      />
    );
  }

  if (entry) {
    return (
      <SearchResultRow
        issueKey={entry.key}
        title={entry.summary}
        typeName={entry.typeName}
        statusName={entry.statusName}
        statusCategoryKey={entry.statusCategoryKey}
        epic={entry.epic}
        showEpic={!entry.isSubtask && !entry.isEpic}
        assigneeName={entry.assigneeName}
        avatarUrl={entry.avatarUrl}
        dimmed={dimmed}
        indent={indent}
        onKeyClick={onKeyClick}
      />
    );
  }

  const f = issue?.fields;
  return (
    <SearchResultRow
      issueKey={item.id}
      title={f?.summary ?? item.title ?? ''}
      typeName={f?.issuetype?.name ?? item.issueType}
      statusName={f?.status?.name}
      statusCategoryKey={f?.status?.statusCategory?.key}
      showEpic={false}
      assigneeName={f ? (f.assignee?.displayName ?? null) : undefined}
      avatarUrl={f?.assignee?.avatarUrls?.['48x48'] ?? null}
      dimmed={dimmed}
      indent={indent}
      onKeyClick={onKeyClick}
    />
  );
}
