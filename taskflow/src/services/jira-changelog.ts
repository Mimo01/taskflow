/**
 * Changelog timeline utilities — merge comments and changelog histories
 * into a unified, sorted timeline for the issue detail activity tab.
 */
import type { JiraComment } from './jira';

export interface ChangelogItem {
  field: string;
  fieldtype: string;
  from: string | null;
  fromString: string | null;
  to: string | null;
  toString: string | null;
}

export interface ChangelogHistory {
  id: string;
  created: string;
  author: {
    displayName: string;
    avatarUrls?: { '48x48'?: string };
  };
  items: ChangelogItem[];
}

export type TimelineEntryType = 'comment' | 'change';

export type TimelineEntry =
  | { type: 'comment'; timestamp: string; data: JiraComment }
  | { type: 'change'; timestamp: string; data: ChangelogHistory };

/**
 * Merge comments and changelog histories into a single timeline,
 * sorted newest-first by timestamp.
 */
export function mergeTimeline(
  comments: JiraComment[],
  histories: ChangelogHistory[],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...comments.map((c) => ({ type: 'comment' as const, timestamp: c.created, data: c })),
    ...histories.map((h) => ({ type: 'change' as const, timestamp: h.created, data: h })),
  ];
  // Sort newest-first (descending by timestamp)
  return entries.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}

export type TimelineFilter = 'all' | 'comment' | 'change';

/**
 * Filter timeline entries by type. Returns all entries when filter is 'all'.
 */
export function filterTimeline(
  entries: TimelineEntry[],
  filter: TimelineFilter,
): TimelineEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((e) => e.type === filter);
}

/**
 * Count timeline entries by type.
 */
export function countByType(
  entries: TimelineEntry[],
): { all: number; comment: number; change: number } {
  let comment = 0;
  let change = 0;
  for (const e of entries) {
    if (e.type === 'comment') comment++;
    else change++;
  }
  return { all: entries.length, comment, change };
}
