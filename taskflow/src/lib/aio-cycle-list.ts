import type {
  AioCycleDetailItem,
  AioCycleSummaryItem,
  AioFolder,
  AioTestRunStatusConfig,
} from '@/services/aio/types';
import { formatDateKey, formatDateRange } from './epic-progress';
import { toLocalDateString } from './local-date';

// ─── dates ───────────────────────────────────────────────────────────────────

/**
 * Normalise an unknown AIO date value (ISO string or epoch-ms number) to a local
 * YYYY-MM-DD key. Unknown shapes return null; never throws.
 */
export function toDateKey(raw: unknown): string | null {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : toLocalDateString(d);
  }
  if (typeof raw === 'string') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
    return m ? m[1] : null;
  }
  return null;
}

/** An open cycle whose end date is strictly before today. */
export function isOverdue(
  cycle: Pick<AioCycleDetailItem['detail'], 'isClosed' | 'endDate'>,
  today: string,
): boolean {
  if (cycle.isClosed) return false;
  const end = toDateKey(cycle.endDate);
  return end !== null && end < today;
}

/** "Oct 9 – 28", "From Oct 9", "Until Oct 28" or null when neither date is known. */
export function formatCycleDates(start: unknown, end: unknown, today: string): string | null {
  const s = toDateKey(start);
  const e = toDateKey(end);
  if (s && e) return s <= e ? formatDateRange(s, e, today) : formatDateRange(e, s, today);
  if (s) return `From ${formatDateKey(s)}`;
  if (e) return `Until ${formatDateKey(e)}`;
  return null;
}

// ─── effort ──────────────────────────────────────────────────────────────────

/** Effort in seconds -> "1h 23m" / "25m" / "1h" / "<1m"; null for 0 / missing. */
export function formatEffort(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return '<1m';
  const totalMin = Math.floor(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ─── progress ────────────────────────────────────────────────────────────────

export type StatusKey = 'pass' | 'fail' | 'blocked' | 'notRun' | 'inProgress';

const STATUS_TYPE_MAP: Record<string, StatusKey> = {
  PASSED: 'pass',
  FAILED: 'fail',
  BLOCKED: 'blocked',
  NOT_RUN: 'notRun',
  IN_PROGRESS: 'inProgress',
};

/** Tailwind classes for the segmented bar (in-progress unified to blue-500). */
export const PROGRESS_SEGMENT_CLASS: Record<StatusKey, string> = {
  pass: 'bg-green-500',
  fail: 'bg-red-500',
  blocked: 'bg-orange-400',
  inProgress: 'bg-blue-500',
  notRun: 'bg-muted',
};

export interface CycleProgress {
  counts: Record<StatusKey, number>;
  total: number;
  passPct: number | null;
}

export function cycleProgress(
  summary: Pick<AioCycleSummaryItem['summary'], 'totalTests' | 'testRunDistribution'>,
  statusConfig: AioTestRunStatusConfig[],
): CycleProgress {
  const byId = new Map<number, StatusKey>();
  const byName = new Map<string, StatusKey>();
  for (const s of statusConfig) {
    const key = STATUS_TYPE_MAP[s.statusType] ?? 'notRun';
    byId.set(s.ID, key);
    byName.set(s.name.toLowerCase(), key);
  }
  const counts: Record<StatusKey, number> = {
    pass: 0,
    fail: 0,
    blocked: 0,
    notRun: 0,
    inProgress: 0,
  };
  for (const [k, n] of Object.entries(summary.testRunDistribution ?? {})) {
    const id = Number(k);
    const key = (Number.isNaN(id) ? undefined : byId.get(id)) ?? byName.get(k.toLowerCase());
    counts[key ?? 'notRun'] += n;
  }
  // Guard against totalTests disagreeing with the distribution so segment widths
  // and percentages never exceed 100%.
  const distributed = Object.values(counts).reduce((a, b) => a + b, 0);
  const total = Math.max(summary.totalTests ?? 0, distributed);
  return {
    counts,
    total,
    passPct: total > 0 ? Math.round((counts.pass / total) * 100) : null,
  };
}

export interface TooltipRowData {
  label: string;
  value: number;
  color: string;
}

/** Non-zero tooltip rows (max 4): in-progress and not-run merge into "Remaining" when all 5 exist. */
export function progressTooltipRows(counts: Record<StatusKey, number>): TooltipRowData[] {
  const rows: TooltipRowData[] = [
    { label: 'Passed', value: counts.pass, color: 'var(--color-green-500)' },
    { label: 'Failed', value: counts.fail, color: 'var(--color-red-500)' },
    { label: 'Blocked', value: counts.blocked, color: 'var(--color-orange-400)' },
    { label: 'In progress', value: counts.inProgress, color: 'var(--color-blue-500)' },
    { label: 'Not run', value: counts.notRun, color: 'var(--color-muted-foreground)' },
  ].filter((r) => r.value > 0);
  if (rows.length === 5) {
    const ip = rows[3];
    const nr = rows[4];
    return [
      ...rows.slice(0, 3),
      { label: 'Remaining', value: ip.value + nr.value, color: 'var(--color-muted-foreground)' },
    ];
  }
  return rows;
}

// ─── folders ─────────────────────────────────────────────────────────────────

export interface FolderAggregate {
  /** Aggregate (own + descendants) count per folder ID. */
  agg: Record<number, number>;
  /** Sum of root aggregates plus the Ungrouped (-1) count. */
  total: number;
}

export function aggregateFolderCounts(
  tree: AioFolder[],
  counts: Record<string, number>,
): FolderAggregate {
  const agg: Record<number, number> = {};
  const walk = (node: AioFolder): number => {
    let sum = counts[String(node.ID)] ?? 0;
    for (const c of node.children) sum += walk(c);
    agg[node.ID] = sum;
    return sum;
  };
  let total = counts['-1'] ?? 0;
  for (const root of tree) total += walk(root);
  return { agg, total };
}

/**
 * Filter the tree by case-insensitive name match, keeping ancestors of matches.
 * `expandIds` lists the ancestors that must be force-expanded. An empty query
 * returns the tree unchanged.
 */
export function filterFolderTree(
  tree: AioFolder[],
  query: string,
): { tree: AioFolder[]; expandIds: Set<number> } {
  const q = query.trim().toLowerCase();
  const expandIds = new Set<number>();
  if (!q) return { tree, expandIds };
  const walk = (nodes: AioFolder[]): AioFolder[] => {
    const out: AioFolder[] = [];
    for (const n of nodes) {
      const kids = walk(n.children);
      if (n.name.toLowerCase().includes(q)) {
        // A matching folder keeps its whole subtree so it can still be expanded.
        if (kids.length > 0) expandIds.add(n.ID);
        out.push(n);
      } else if (kids.length > 0) {
        expandIds.add(n.ID);
        out.push({ ...n, children: kids });
      }
    }
    return out;
  };
  return { tree: walk(tree), expandIds };
}

// ─── sorting ─────────────────────────────────────────────────────────────────

function keyNumber(key: string): number {
  const m = /-CY-(\d+)$/.exec(key);
  return m ? Number(m[1]) : -1;
}

/** Open cycles first, then closed; each group by key number descending. */
export function sortCycles(items: AioCycleDetailItem[]): AioCycleDetailItem[] {
  return [...items].sort((a, b) => {
    if (a.detail.isClosed !== b.detail.isClosed) return a.detail.isClosed ? 1 : -1;
    return keyNumber(b.detail.key) - keyNumber(a.detail.key);
  });
}
