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
import { GitMerge } from 'lucide-react';
import type React from 'react';
import type { SearchEntry } from '@/lib/global-search';
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

function subtaskParent(src: RecentIssueSources): { key: string; summary?: string } | null {
  if (src.entry) {
    return src.entry.isSubtask && src.entry.parentKey ? { key: src.entry.parentKey } : null;
  }
  const f = src.issue?.fields;
  if (f?.issuetype?.subtask && f.parent?.key) {
    return { key: f.parent.key, summary: f.parent.fields?.summary };
  }
  return null;
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
    const parent = subtaskParent(src);
    if (parent && headerKey !== parent.key) {
      const p = resolve(parent.key);
      rows.push({
        rowKey: `parent-${parent.key}-${item.id}`,
        item: {
          type: 'jira',
          id: parent.key,
          title: parent.summary,
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
