import { type StatusKey, statusLabel } from '@/lib/aio-cycle-list';
import { priorityRank } from '@/lib/aio-defect-sort';
import { toLocalDateString } from '@/lib/local-date';
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
    const rawCat = d.issue.fields.status?.statusCategory?.key;
    // Unknown / 'undefined' (No Category) fall back to To Do, as statusCategoryColor does app-wide.
    const cat = CATEGORY_ORDER.some((c) => c.key === rawCat) ? (rawCat as string) : 'new';
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
const PRIORITY_LOW = ['low', 'minor', 'lowest', 'trivial'];

/**
 * Each level has its own colour, in the hue of its Jira priority icon (red arrows, orange high,
 * amber medium, blue low). Chroma falls and lightness rises with every step down, so contrast
 * against the card shrinks with criticality: the more critical a level, the louder it is, and
 * the least critical fade towards neutral.
 */
const LEVEL_BLOCKER = 'oklch(0.46 0.23 25)';
const LEVEL_MUST = 'oklch(0.58 0.25 27)';
const LEVEL_CRITICAL = 'oklch(0.66 0.23 38)';
const LEVEL_HIGHEST = 'oklch(0.72 0.2 52)';
const LEVEL_SHOULD = 'oklch(0.78 0.18 68)';
const LEVEL_HIGH = 'oklch(0.83 0.17 82)';
const LEVEL_MEDIUM = 'oklch(0.86 0.16 100)';
const LEVEL_LOW = 'oklch(0.68 0.12 250)';
const LEVEL_LOWEST = 'oklch(0.76 0.08 245)';
const LEVEL_MINOR = 'oklch(0.83 0.04 240)';

const PRIORITY_LEVEL_COLOR: Record<string, string> = {
  blocker: LEVEL_BLOCKER,
  must: LEVEL_MUST,
  critical: LEVEL_CRITICAL,
  highest: LEVEL_HIGHEST,
  should: LEVEL_SHOULD,
  high: LEVEL_HIGH,
  medium: LEVEL_MEDIUM,
  low: LEVEL_LOW,
  lowest: LEVEL_LOWEST,
  minor: LEVEL_MINOR,
};

/**
 * Colour by the custom scheme's level first, so levels whose icon filename says nothing
 * ('Must', 'Should') still get their colour. Unknown names fall back to the icon filename token
 * (e.g. ".../major.svg"); no match -> gray-300.
 */
export function priorityChartColor(
  priority: { name?: string; iconUrl?: string } | null | undefined,
): string {
  const level = priority?.name ? PRIORITY_LEVEL_COLOR[priority.name.toLowerCase()] : undefined;
  if (level) return level;
  const m = /([a-z]+)\.(?:svg|png|gif)(?:\?.*)?$/i.exec(priority?.iconUrl ?? '');
  const token = m?.[1].toLowerCase();
  if (!token) return 'var(--color-gray-300)';
  if (PRIORITY_RED.includes(token)) return LEVEL_MUST;
  if (token === 'high') return LEVEL_HIGH;
  if (token === 'medium') return LEVEL_MEDIUM;
  if (PRIORITY_LOW.includes(token)) return LEVEL_LOWEST;
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

/** Severity values look like '2-Major': the number is only the sort order, show just the label. */
export const severityLabel = (raw: string): string => raw.replace(/^\s*\d+\s*-\s*/, '');

/**
 * Severity labels start with their level ('1-Critical', '2-Major', ...). Colour by the level
 * number, falling back to the label so '5-Cosmetic' and unnumbered values still get a colour.
 */
const SEVERITY_COLOR: Record<string, string> = {
  '1': LEVEL_MUST,
  '2': LEVEL_HIGHEST,
  '3': LEVEL_MEDIUM,
  '4': LEVEL_LOW,
  '5': LEVEL_MINOR,
};
const SEVERITY_LABEL_COLOR: Record<string, string> = {
  blocker: LEVEL_MUST,
  critical: LEVEL_MUST,
  major: LEVEL_HIGHEST,
  minor: LEVEL_MEDIUM,
  cosmetic: LEVEL_LOW,
  trivial: LEVEL_MINOR,
};
export function severityChartColor(raw: string): string {
  const num = /^\s*(\d+)\s*-/.exec(raw)?.[1];
  return (
    SEVERITY_LABEL_COLOR[severityLabel(raw).trim().toLowerCase()] ??
    (num && SEVERITY_COLOR[num]) ??
    SEVERITY_NONE_COLOR
  );
}
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
        label: severityLabel(name),
        value,
        share,
        color: name === 'None' ? SEVERITY_NONE_COLOR : severityChartColor(name),
        rows: [
          { label: 'Defects', value },
          { label: 'Share', value: `${share}%` },
        ],
      };
    });
}

/** Colour token for a burndown execution marker (same tokens as the execution donut). */
export function burndownMarkerColor(marker: StatusKey): string {
  return EXECUTION_COLOR[marker];
}

/** Epoch ms from an AIO date (epoch number, all-digit string or ISO string); null if unparseable. */
export function aioDateMs(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (s === '') return null;
  const ms = /^\d+$/.test(s) ? Number(s) : Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
}

export interface BurndownPoint {
  /** Epoch ms. */
  t: number;
  /** Cases not yet passed/failed/blocked; null after "now" so the step line stops there. */
  remaining: number | null;
  /** Working-day ideal: total at the start falling to 0 at the end, flat on non-working days; null when the span is empty. */
  ideal: number | null;
  /** Cases executed at exactly this timestamp. */
  executed: number;
  /** Worst status executed at this timestamp (fail > blocked > pass); null for non-execution points. */
  marker: StatusKey | null;
}

export interface BurndownSeries {
  points: BurndownPoint[];
  total: number;
  from: number;
  to: number;
  /** Merged ranges of consecutive non-working days, clipped to [from, to]. */
  nonWorking: { from: number; to: number }[];
}

// Mirrors normalizeStatus in aioUtils (not imported: that module pulls in services).
function burndownStatus(raw: string): StatusKey {
  switch (raw.toUpperCase()) {
    case 'PASS':
      return 'pass';
    case 'FAIL':
      return 'fail';
    case 'BLOCKED':
      return 'blocked';
    case 'IN_PROGRESS':
      return 'inProgress';
    default:
      return 'notRun';
  }
}

const MARKER_SEVERITY: Partial<Record<StatusKey, number>> = { pass: 0, blocked: 1, fail: 2 };

/**
 * Burndown of remaining cases (Not Run + In Progress) over time: one point per execution
 * timestamp, a start point at the total, and a trailing/end point. The ideal line is a
 * working-day ideal: it only falls on days `isWorkingDay` accepts, with ideal-only points at
 * every local midnight so weekends and holidays draw flat. Null when nothing was executed
 * (nothing to draw).
 */
const DAY_MS = 86_400_000;
/** Executions closer together than this merge into one burndown point. */
const MERGE_WINDOW_MS = 3_600_000;
/** Longer spans (corrupt dates) skip the day walk and use the linear ideal. */
const MAX_WALK_DAYS = 731;

interface CalendarDay {
  start: number;
  end: number;
  working: boolean;
}

/** Local days overlapping [from, to]; null when the span is too long to walk. */
function walkDays(
  from: number,
  to: number,
  isWorkingDay: (key: string) => boolean,
): CalendarDay[] | null {
  if (to - from > MAX_WALK_DAYS * DAY_MS) return null;
  const first = new Date(from);
  const days: CalendarDay[] = [];
  let d = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  while (d.getTime() < to) {
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    days.push({
      start: d.getTime(),
      end: next.getTime(),
      working: isWorkingDay(toLocalDateString(d)),
    });
    d = next;
  }
  return days;
}

export function cycleBurndownSeries(
  runs: { status: string; executedDate?: string }[],
  cycle: { startDate?: unknown; endDate?: unknown } | undefined,
  now: number,
  isWorkingDay: (key: string) => boolean,
): BurndownSeries | null {
  const total = runs.length;
  if (total === 0) return null;

  // Executions within MERGE_WINDOW_MS of the first one in a cluster collapse into a single point
  // (at the cluster's last execution), so bursts do not draw as overlapping diamonds.
  const execTimes = runs
    .filter((r) => ['pass', 'fail', 'blocked'].includes(burndownStatus(r.status)))
    .map((r) => aioDateMs(r.executedDate))
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const anchorOf = new Map<number, number>();
  for (let i = 0; i < execTimes.length; ) {
    let j = i;
    while (j + 1 < execTimes.length && execTimes[j + 1] - execTimes[i] < MERGE_WINDOW_MS) j++;
    for (let k = i; k <= j; k++) anchorOf.set(execTimes[k], execTimes[j]);
    i = j + 1;
  }
  const mergeAnchor = (t: number) => anchorOf.get(t) ?? t;

  const groups = new Map<number, { count: number; marker: StatusKey }>();
  for (const r of runs) {
    const status = burndownStatus(r.status);
    if (status !== 'pass' && status !== 'fail' && status !== 'blocked') continue;
    const t0 = aioDateMs(r.executedDate);
    if (t0 === null) continue;
    const t = mergeAnchor(t0);
    const g = groups.get(t);
    if (!g) groups.set(t, { count: 1, marker: status });
    else {
      g.count++;
      if ((MARKER_SEVERITY[status] ?? 0) > (MARKER_SEVERITY[g.marker] ?? 0)) g.marker = status;
    }
  }
  if (groups.size === 0) return null;

  const times = [...groups.keys()].sort((a, b) => a - b);
  const firstExec = times[0];
  const lastExec = times[times.length - 1];
  const from = Math.min(aioDateMs(cycle?.startDate) ?? firstExec, firstExec);
  const to = Math.max(aioDateMs(cycle?.endDate) ?? lastExec, lastExec);

  const blank = { executed: 0, marker: null } as const;
  const points: BurndownPoint[] = [{ t: from, remaining: total, ideal: null, ...blank }];
  let done = 0;
  for (const t of times) {
    const g = groups.get(t) as { count: number; marker: StatusKey };
    done += g.count;
    points.push({ t, remaining: total - done, ideal: null, executed: g.count, marker: g.marker });
  }
  const tail = Math.min(now, to);
  if (tail > lastExec) {
    points.push({ t: tail, remaining: total - done, ideal: null, ...blank });
  }
  if (!points.some((p) => p.t === to)) {
    points.push({ t: to, remaining: null, ideal: null, ...blank });
  }

  const span = to - from;
  const days = span > 0 ? walkDays(from, to, isWorkingDay) : null;

  // Working time elapsed in [from, t].
  const workedUntil = (t: number) => {
    let w = 0;
    for (const d of days ?? []) {
      if (!d.working) continue;
      const overlap = Math.min(d.end, t) - Math.max(d.start, from);
      if (overlap > 0) w += overlap;
    }
    return w;
  };
  const workTotal = days ? workedUntil(to) : 0;
  const nonWorking: { from: number; to: number }[] = [];

  if (days) {
    // Ideal-only points at every local midnight, so non-working days draw flat.
    const taken = new Set(points.map((p) => p.t));
    const stepLimit = Math.max(tail, lastExec);
    for (const d of days) {
      if (d.start <= from || d.start >= to || taken.has(d.start)) continue;
      let doneAt = 0;
      for (const t of times) {
        if (t > d.start) break;
        doneAt += (groups.get(t) as { count: number }).count;
      }
      points.push({
        t: d.start,
        remaining: d.start <= stepLimit ? total - doneAt : null,
        ideal: null,
        ...blank,
      });
    }
    for (const d of days) {
      if (d.working) continue;
      const a = Math.max(d.start, from);
      const b = Math.min(d.end, to);
      if (b <= a) continue;
      const last = nonWorking[nonWorking.length - 1];
      if (last && last.to === a) last.to = b;
      else nonWorking.push({ from: a, to: b });
    }
  }

  for (const p of points) {
    if (span <= 0) {
      p.ideal = null;
      continue;
    }
    const frac = workTotal > 0 ? workedUntil(p.t) / workTotal : (p.t - from) / span;
    p.ideal = Math.round(Math.min(total, Math.max(0, total * (1 - frac))) * 10) / 10;
  }
  points.sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;
  return { points, total, from, to, nonWorking };
}
