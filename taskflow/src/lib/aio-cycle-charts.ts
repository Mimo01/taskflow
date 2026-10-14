import { type StatusKey, statusLabel } from '@/lib/aio-cycle-list';
import { priorityRank } from '@/lib/aio-defect-sort';
import { statusCategoryColor } from '@/lib/statusStyles';

export interface ChartRow {
  label: string;
  value: number | string;
  color?: string;
}

export interface ChartSlice {
  key: string;
  label: string;
  value: number;
  /** Integer percent of the slice total. */
  share: number;
  color: string;
  /** Tooltip rows, at most 4. */
  rows: ChartRow[];
}

/** Structural subset of ResolvedDefect (kept local so lib does not import from routes). */
export interface DefectLike {
  issue: {
    fields: {
      status?: { name?: string; statusCategory?: { key?: string } } | null;
      priority?: { name?: string; iconUrl?: string } | null;
      /** Severity custom field (e.g. '2-Major'). */
      customfield_13415?: { value?: string; name?: string } | null;
    };
  } | null;
}

const MAX_ROWS = 4;

const EXECUTION_ORDER: StatusKey[] = ['pass', 'fail', 'blocked', 'inProgress', 'notRun'];

// Literal var() strings so Tailwind v4 JIT emits the theme variables.
const EXECUTION_COLOR: Record<StatusKey, string> = {
  pass: 'var(--color-green-500)',
  fail: 'var(--color-red-500)',
  blocked: 'var(--color-orange-400)',
  inProgress: 'var(--color-blue-500)',
  notRun: 'var(--color-gray-300)',
};

const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

export function executionSlices(counts: Record<StatusKey, number>): ChartSlice[] {
  const total = EXECUTION_ORDER.reduce((s, k) => s + counts[k], 0);
  return EXECUTION_ORDER.filter((k) => counts[k] > 0).map((k) => {
    const share = pct(counts[k], total);
    return {
      key: k,
      label: statusLabel(k),
      value: counts[k],
      share,
      color: EXECUTION_COLOR[k],
      rows: [
        { label: 'Runs', value: counts[k] },
        { label: 'Share', value: `${share}%` },
      ],
    };
  });
}

/** Rows for a slice tooltip (at most 4). */
export function executionSliceTooltipRows(slice: ChartSlice): ChartRow[] {
  return slice.rows.slice(0, MAX_ROWS);
}

const CATEGORY_ORDER: { key: string; label: string }[] = [
  { key: 'new', label: 'To Do' },
  { key: 'indeterminate', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

export function defectStatusSlices(defects: DefectLike[]): ChartSlice[] {
  const byCat = new Map<string, Map<string, number>>();
  let total = 0;
  for (const d of defects) {
    if (!d.issue) continue;
    const cat = d.issue.fields.status?.statusCategory?.key ?? 'new';
    const name = d.issue.fields.status?.name ?? 'Unknown';
    const names = byCat.get(cat) ?? new Map<string, number>();
    names.set(name, (names.get(name) ?? 0) + 1);
    byCat.set(cat, names);
    total++;
  }
  const slices: ChartSlice[] = [];
  for (const c of CATEGORY_ORDER) {
    const names = byCat.get(c.key);
    if (!names) continue;
    const value = [...names.values()].reduce((a, b) => a + b, 0);
    const sorted = [...names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    let rows: ChartRow[];
    if (sorted.length > MAX_ROWS) {
      const top = sorted.slice(0, MAX_ROWS - 1);
      const rest = sorted.slice(MAX_ROWS - 1).reduce((s, [, n]) => s + n, 0);
      rows = [...top.map(([label, v]) => ({ label, value: v })), { label: 'Other', value: rest }];
    } else {
      rows = sorted.map(([label, v]) => ({ label, value: v }));
    }
    slices.push({
      key: c.key,
      label: c.label,
      value,
      share: pct(value, total),
      color: statusCategoryColor(c.key),
      rows,
    });
  }
  return slices;
}

const PRIORITY_RED = ['blocker', 'critical', 'highest', 'major'];
const PRIORITY_GRAY = ['low', 'minor', 'lowest', 'trivial'];

/** Colour by the icon filename token (e.g. ".../major.svg"). Unknown -> gray-300. */
export function priorityChartColor(
  priority: { name?: string; iconUrl?: string } | null | undefined,
): string {
  const m = /([a-z]+)\.(?:svg|png|gif)(?:\?.*)?$/i.exec(priority?.iconUrl ?? '');
  const token = m?.[1].toLowerCase();
  if (!token) return 'var(--color-gray-300)';
  if (PRIORITY_RED.includes(token)) return 'var(--color-red-600)';
  if (token === 'high') return 'var(--color-orange-500)';
  if (token === 'medium') return 'var(--color-yellow-500)';
  if (PRIORITY_GRAY.includes(token)) return 'var(--color-gray-400)';
  return 'var(--color-gray-300)';
}

export function defectPrioritySlices(defects: DefectLike[]): ChartSlice[] {
  const groups = new Map<
    string,
    { value: number; priority: { name?: string; iconUrl?: string } | null }
  >();
  let total = 0;
  for (const d of defects) {
    if (!d.issue) continue;
    const p = d.issue.fields.priority ?? null;
    const name = p?.name ?? 'None';
    const g = groups.get(name) ?? { value: 0, priority: p };
    g.value++;
    groups.set(name, g);
    total++;
  }
  return [...groups.entries()]
    .sort(
      (a, b) =>
        priorityRank(a[1].priority) - priorityRank(b[1].priority) || a[0].localeCompare(b[0]),
    )
    .map(([name, g]) => {
      const share = pct(g.value, total);
      return {
        key: name,
        label: name,
        value: g.value,
        share,
        color: priorityChartColor(g.priority),
        rows: [
          { label: 'Defects', value: g.value },
          { label: 'Share', value: `${share}%` },
        ],
      };
    });
}

/** Severity labels start with their level ('1-Critical', '2-Major', ...): colour by that level. */
const SEVERITY_COLOR: Record<string, string> = {
  '1': 'var(--color-red-600)',
  '2': 'var(--color-orange-500)',
  '3': 'var(--color-yellow-500)',
  '4': 'var(--color-gray-400)',
};
const SEVERITY_NONE_COLOR = 'var(--color-gray-300)';

/**
 * Defects grouped by the severity custom field, ordered by level. Defects without a severity
 * fall into "None"; when no defect has a severity at all there is nothing to chart.
 */
export function defectSeveritySlices(defects: DefectLike[]): ChartSlice[] {
  const groups = new Map<string, number>();
  let total = 0;
  let withSeverity = 0;
  for (const d of defects) {
    if (!d.issue) continue;
    const f = d.issue.fields.customfield_13415;
    const name = f?.value ?? f?.name ?? 'None';
    if (name !== 'None') withSeverity++;
    groups.set(name, (groups.get(name) ?? 0) + 1);
    total++;
  }
  if (withSeverity === 0) return [];
  const rank = (name: string) => (name === 'None' ? 'z' : name);
  return [...groups.entries()]
    .sort((a, b) => rank(a[0]).localeCompare(rank(b[0])))
    .map(([name, value]) => {
      const share = pct(value, total);
      return {
        key: name,
        label: name,
        value,
        share,
        color: SEVERITY_COLOR[name.charAt(0)] ?? SEVERITY_NONE_COLOR,
        rows: [
          { label: 'Defects', value },
          { label: 'Share', value: `${share}%` },
        ],
      };
    });
}
