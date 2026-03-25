/**
 * Jira changelog timeline — merges comments, changelog histories, and worklogs
 * into a unified sorted timeline for issue detail views.
 *
 * Each entry is tagged with a type discriminator for rendering and filtering.
 */

import type { JiraComment } from './jira';
import type { JiraWorklog } from './jira/types';

/**
 * A single changelog history entry from Jira's expand=changelog response.
 */
export interface ChangelogHistory {
  id: string;
  created: string;
  author: {
    displayName: string;
    name?: string;
    avatarUrls?: { '48x48'?: string };
  };
  items: Array<{
    field: string;
    fieldtype?: string;
    fromString: string | null;
    toString: string | null;
  }>;
}

/**
 * Discriminated union for timeline entries.
 */
export type TimelineEntry =
  | { type: 'comment'; timestamp: string; data: JiraComment }
  | { type: 'change'; timestamp: string; data: ChangelogHistory }
  | { type: 'worklog'; timestamp: string; data: JiraWorklog };

/**
 * Filter values for timeline display.
 */
export type TimelineFilter = 'all' | 'comment' | 'change' | 'worklog';

/**
 * Merge comments, changelog histories, and worklogs into a single
 * reverse-chronological timeline.
 *
 * @param comments - Jira issue comments
 * @param histories - Changelog histories from expand=changelog
 * @param worklogs - Worklog entries (optional, defaults to [])
 * @returns Sorted timeline entries (newest first)
 */
export function mergeTimeline(
  comments: JiraComment[],
  histories: ChangelogHistory[],
  worklogs: JiraWorklog[] = [],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...comments.map((c) => ({ type: 'comment' as const, timestamp: c.created, data: c })),
    ...histories.map((h) => ({ type: 'change' as const, timestamp: h.created, data: h })),
    ...worklogs.map((w) => ({ type: 'worklog' as const, timestamp: w.started, data: w })),
  ];
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Filter timeline entries by type.
 *
 * @param entries - Full timeline
 * @param filter - Which entry types to include ('all' returns everything)
 * @returns Filtered entries
 */
export function filterTimeline(entries: TimelineEntry[], filter: TimelineFilter): TimelineEntry[] {
  if (filter === 'all') return entries;
  return entries.filter((e) => e.type === filter);
}

/**
 * Count entries by type for filter tab badges.
 *
 * @param entries - Full timeline
 * @returns Counts per type plus total
 */
export function countByType(entries: TimelineEntry[]): {
  all: number;
  comment: number;
  change: number;
  worklog: number;
} {
  let comment = 0;
  let change = 0;
  let worklog = 0;
  for (const e of entries) {
    if (e.type === 'comment') comment++;
    else if (e.type === 'change') change++;
    else worklog++;
  }
  return { all: entries.length, comment, change, worklog };
}
