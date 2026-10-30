// Release graph bucket derivations (P94 D-02, D-05, D-06).
// Rows count issues; story points are a separate tooltip-only field.
import type { ChartSlice } from '@/lib/aio-cycle-charts';
import { catOf, deriveAssigneeBuckets } from '@/lib/epic-progress';
import type { StatusBreakdown } from '@/lib/release-list';
import type { JiraIssue } from '@/services/jira';
import { issueStoryPoints } from './releaseSummaries';

export interface ReleaseAssigneeRow {
  id: string;
  name: string;
  avatarUrl: string | null;
  unassigned: boolean;
  breakdown: StatusBreakdown;
  total: number;
  done: number;
  sp: number;
}

export interface ReleaseTypeRow {
  typeName: string;
  breakdown: StatusBreakdown;
  total: number;
  done: number;
  sp: number;
}

export function deriveReleaseAssigneeRows(
  issues: JiraIssue[],
  spKey: string,
): ReleaseAssigneeRow[] {
  const spById = new Map(
    deriveAssigneeBuckets(issues, 'sp', spKey).map((b) => [b.id, b.done + b.remaining]),
  );
  const rows = deriveAssigneeBuckets(issues, 'count', spKey).map((b): ReleaseAssigneeRow => {
    const unassigned = b.id === 'unassigned';
    return {
      id: b.id,
      name: unassigned ? 'Unassigned' : b.name,
      avatarUrl: b.avatarUrl,
      unassigned,
      breakdown: { done: b.done, indeterminate: b.inProgress, new: b.todo },
      total: b.done + b.inProgress + b.todo,
      done: b.done,
      sp: spById.get(b.id) ?? 0,
    };
  });
  return rows.sort(
    (a, b) =>
      Number(a.unassigned) - Number(b.unassigned) ||
      b.total - a.total ||
      a.name.localeCompare(b.name),
  );
}

export function deriveReleaseTypeRows(issues: JiraIssue[], spKey: string): ReleaseTypeRow[] {
  const map = new Map<string, ReleaseTypeRow>();
  for (const issue of issues) {
    const typeName = issue.fields.issuetype?.name || 'Other';
    let row = map.get(typeName);
    if (!row) {
      row = {
        typeName,
        breakdown: { new: 0, indeterminate: 0, done: 0 },
        total: 0,
        done: 0,
        sp: 0,
      };
      map.set(typeName, row);
    }
    const c = catOf(issue);
    row.breakdown[c] += 1;
    row.total += 1;
    if (c === 'done') row.done += 1;
    row.sp += issueStoryPoints(issue, spKey) ?? 0;
  }
  return [...map.values()].sort(
    (a, b) => b.total - a.total || a.typeName.localeCompare(b.typeName),
  );
}

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

// Literal var() strings so Tailwind v4 JIT emits the theme variables.
const MR_SLICES: {
  key: 'merged' | 'open' | 'draft' | 'closed';
  color: string;
}[] = [
  { key: 'merged', color: 'var(--color-green-500)' },
  { key: 'open', color: 'var(--color-blue-500)' },
  { key: 'draft', color: 'color-mix(in oklab, var(--color-blue-500) 40%, transparent)' },
  { key: 'closed', color: 'var(--color-muted-foreground)' },
];

export function mrDonutSlices(counts: {
  merged: number;
  open: number;
  draft: number;
  closed: number;
}): ChartSlice[] {
  const total = counts.merged + counts.open + counts.draft + counts.closed;
  return MR_SLICES.filter((s) => counts[s.key] > 0).map((s) => {
    const share = pct(counts[s.key], total);
    return {
      key: s.key,
      label: s.key,
      value: counts[s.key],
      share,
      color: s.color,
      rows: [
        { label: 'MRs', value: counts[s.key] },
        { label: 'Share', value: `${share}%` },
      ],
    };
  });
}

/** Exact status names of not-done issues, e.g. "In Review 3 · QA 2 · +1 more". */
export function statusNameSummary(issues: JiraIssue[]): string | null {
  const counts = new Map<string, number>();
  for (const issue of issues) {
    if (catOf(issue) === 'done') continue;
    const name = issue.fields.status?.name || 'Unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const head = sorted.slice(0, 3).map(([n, c]) => `${n} ${c}`);
  const more = sorted.length - 3;
  if (more > 0) head.push(`+${more} more`);
  return head.join(' · ');
}

const CAT_ORDER = ['done', 'indeterminate', 'new'] as const;

/** Issues per block so the widest type row fits `capacity` blocks (1 = one block per issue). */
export function waffleUnit(maxTotal: number, capacity: number): number {
  return Math.max(1, Math.ceil(maxTotal / Math.max(1, capacity)));
}

/**
 * Blocks per status category for one waffle row at `unit` issues per block.
 * Total is ceil(total / unit); categories are split by largest remainder and
 * every non-empty category keeps at least one block, so a row never shrinks to
 * nothing and the status mix stays visible.
 */
export function waffleCells(breakdown: StatusBreakdown, unit: number): StatusBreakdown {
  if (unit <= 1) return { ...breakdown };
  const total = CAT_ORDER.reduce((n, k) => n + breakdown[k], 0);
  const out: StatusBreakdown = { done: 0, indeterminate: 0, new: 0 };
  if (total === 0) return out;
  const n = Math.ceil(total / unit);
  const quotas = CAT_ORDER.map((k) => ({ k, q: (breakdown[k] / total) * n }));
  for (const { k, q } of quotas) out[k] = Math.floor(q);
  let left = n - CAT_ORDER.reduce((s, k) => s + out[k], 0);
  for (const { k } of [...quotas].sort((a, b) => (b.q % 1) - (a.q % 1))) {
    if (left <= 0) break;
    out[k] += 1;
    left -= 1;
  }
  for (const k of CAT_ORDER) {
    if (breakdown[k] > 0 && out[k] === 0) {
      const donor = CAT_ORDER.reduce((a, b) => (out[b] > out[a] ? b : a));
      if (out[donor] > 1) {
        out[donor] -= 1;
        out[k] = 1;
      }
    }
  }
  return out;
}

export interface ReleaseStatusRow {
  name: string;
  cat: (typeof CAT_ORDER)[number];
  count: number;
}

/** Issues per exact Jira status name, grouped done, in progress, to do; larger counts first. */
export function deriveReleaseStatusRows(issues: JiraIssue[]): ReleaseStatusRow[] {
  const map = new Map<string, ReleaseStatusRow>();
  for (const issue of issues) {
    const name = issue.fields.status?.name || 'Unknown';
    const cat = catOf(issue);
    const key = `${cat}:${name}`;
    const row = map.get(key);
    if (row) row.count += 1;
    else map.set(key, { name, cat, count: 1 });
  }
  return [...map.values()].sort(
    (a, b) =>
      CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) ||
      b.count - a.count ||
      a.name.localeCompare(b.name),
  );
}

/** Layout constants of a By type row: name column, blocks, count column. */
export const WAFFLE_LAYOUT = { block: 14, gap: 3, nameCol: 96, countCol: 44, rowGap: 12 } as const;

/**
 * How many blocks fit one row of a cell `cellWidth` px wide: the cell minus the
 * name and count columns and the two column gaps, divided by the block pitch.
 * Always at least 1.
 */
export function waffleCapacity(cellWidth: number): number {
  const { block, gap, nameCol, countCol, rowGap } = WAFFLE_LAYOUT;
  return Math.max(
    1,
    Math.floor((cellWidth - nameCol - countCol - 2 * rowGap + gap) / (block + gap)),
  );
}
