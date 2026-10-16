/**
 * Shared one-line row for a recently opened issue/MR, used by both the
 * command palette's Recent Items group and the top-bar Recent Items popover
 * so the two lists render identically (Phase 92 polish).
 *
 * Resolution order for Jira items: global-search index entry (backlog +
 * sprint caches: status, assignee, epic) -> any cached full JiraIssue ->
 * the persisted title/issueType from the recent-items store.
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
  onKeyClick?: (e: React.MouseEvent, issueKey: string) => void;
}

/** "project_id/iid" (composite) or bare iid -> bare iid. */
export function recentMrIid(id: string): string {
  return id.includes('/') ? (id.split('/').pop() ?? id) : id;
}

export function RecentItemRow({ item, entry, issue, mrTitle, onKeyClick }: RecentItemRowProps) {
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
      onKeyClick={onKeyClick}
    />
  );
}
