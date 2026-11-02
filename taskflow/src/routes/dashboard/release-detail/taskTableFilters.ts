/**
 * Release detail Issues table (UnifiedTaskTable): filter options, filter predicate
 * and column sort for the task rows (261102-h1i). Pure — no React.
 *
 * Assignee handling goes through the shared `lib/assignee-filter` helper so the
 * Unassigned sentinel behaves the same as on the Backlog and Sprint Board.
 */
import { buildAssigneeOptions, matchesAssigneeFilter } from '@/lib/assignee-filter';
import { compareNullsLast, type SortDir } from '@/lib/table-sort';
import type { JiraIssue } from '@/services/jira';

export type TaskSortKey = 'key' | 'summary' | 'assignee' | 'status';

export interface TaskFilters {
  query: string;
  statuses: Set<string>;
  types: Set<string>;
  assignees: Set<string>;
}

export interface TaskFilterOptions {
  statuses: string[];
  types: string[];
  assignees: string[];
}

/** Status category order: To Do → In Progress → Done. Unknown/missing counts as 'new'. */
function categoryRank(issue: JiraIssue): number {
  const key = issue.fields.status?.statusCategory?.key;
  if (key === 'indeterminate') return 1;
  if (key === 'done') return 2;
  return 0;
}

export function buildTaskFilterOptions<T extends { issue: JiraIssue }>(
  rows: T[],
): TaskFilterOptions {
  const statusRank = new Map<string, number>();
  const types = new Set<string>();
  for (const { issue } of rows) {
    const name = issue.fields.status?.name;
    if (name && !statusRank.has(name)) statusRank.set(name, categoryRank(issue));
    const type = issue.fields.issuetype?.name;
    if (type) types.add(type);
  }
  const statuses = [...statusRank.keys()].sort(
    (a, b) =>
      (statusRank.get(a) ?? 0) - (statusRank.get(b) ?? 0) ||
      a.localeCompare(b, undefined, { numeric: true }),
  );
  return {
    statuses,
    types: [...types].sort((a, b) => a.localeCompare(b)),
    assignees: buildAssigneeOptions(rows.map((r) => r.issue)),
  };
}

/** AND across dimensions, OR within one dimension. Empty dimension = no filter. */
export function matchesTaskFilters(issue: JiraIssue, filters: TaskFilters): boolean {
  const q = filters.query.trim().toLowerCase();
  if (q) {
    const key = issue.key.toLowerCase();
    const summary = (issue.fields.summary ?? '').toLowerCase();
    if (!key.includes(q) && !summary.includes(q)) return false;
  }
  if (filters.statuses.size > 0) {
    const name = issue.fields.status?.name;
    if (!name || !filters.statuses.has(name)) return false;
  }
  if (filters.types.size > 0) {
    const type = issue.fields.issuetype?.name;
    if (!type || !filters.types.has(type)) return false;
  }
  return matchesAssigneeFilter(issue, filters.assignees);
}

function sortValue(issue: JiraIssue, key: TaskSortKey): string | null {
  switch (key) {
    case 'key':
      return issue.key;
    case 'summary':
      return issue.fields.summary ?? null;
    case 'assignee':
      return issue.fields.assignee?.displayName ?? null;
    case 'status': {
      const name = issue.fields.status?.name;
      return name ? `${categoryRank(issue)}-${name.toLowerCase()}` : null;
    }
  }
}

/** Returns `rows` untouched when no column is active; otherwise a sorted copy. */
export function sortTaskRows<T extends { issue: JiraIssue }>(
  rows: T[],
  key: TaskSortKey | null,
  dir: SortDir,
): T[] {
  if (key === null) return rows;
  return [...rows].sort((a, b) =>
    compareNullsLast(sortValue(a.issue, key), sortValue(b.issue, key), dir),
  );
}
