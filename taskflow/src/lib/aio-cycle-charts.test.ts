import { describe, expect, it } from 'vitest';
import {
  aioDateMs,
  type DefectLike,
  cycleBurndownSeries,
  defectPrioritySlices,
  defectSeveritySlices,
  defectStatusSlices,
  executionSliceTooltipRows,
  executionSlices,
  priorityChartColor,
  severityChartColor,
  severityLabel,
} from './aio-cycle-charts';

const def = (status: string, cat: string, priority?: string, iconUrl?: string): DefectLike => ({
  issue: {
    fields: {
      status: { name: status, statusCategory: { key: cat } },
      priority: priority ? { name: priority, iconUrl } : null,
    },
  },
});

describe('executionSlices', () => {
  it('returns non-zero slices in order with shares', () => {
    const s = executionSlices({ pass: 1, fail: 1, blocked: 0, inProgress: 0, notRun: 1 });
    expect(s.map((x) => x.key)).toEqual(['pass', 'fail', 'notRun']);
    expect(s.map((x) => x.share)).toEqual([33, 33, 33]);
  });
  it('returns [] for all zeros', () => {
    expect(executionSlices({ pass: 0, fail: 0, blocked: 0, inProgress: 0, notRun: 0 })).toEqual([]);
  });
  it('tooltip rows are Runs and Share', () => {
    const [s] = executionSlices({ pass: 2, fail: 0, blocked: 0, inProgress: 0, notRun: 2 });
    expect(executionSliceTooltipRows(s)).toEqual([
      { label: 'Runs', value: 2 },
      { label: 'Share', value: '50%' },
    ]);
  });
});

describe('defectStatusSlices', () => {
  it('groups by category in order, skipping null issues', () => {
    const s = defectStatusSlices([
      def('Done', 'done'),
      def('Open', 'new'),
      { issue: null },
      def('Open', 'new'),
    ]);
    expect(s.map((x) => [x.label, x.value])).toEqual([
      ['To Do', 2],
      ['Done', 1],
    ]);
  });
  it('caps rows at 4 with Other', () => {
    const s = defectStatusSlices(
      ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => def(n, 'indeterminate')),
    );
    expect(s[0].rows).toHaveLength(4);
    expect(s[0].rows[3]).toEqual({ label: 'Other', value: 3 });
  });
});

describe('defectPrioritySlices', () => {
  it('orders by rank and groups missing as None', () => {
    const s = defectPrioritySlices([
      def('x', 'new', 'Low', 'http://x/low.svg'),
      def('x', 'new', 'Blocker', 'http://x/blocker.svg'),
      def('x', 'new'),
    ]);
    expect(s.map((x) => x.label)).toEqual(['Blocker', 'Low', 'None']);
    expect(s[0].color).toBe('oklch(0.46 0.23 25)');
    expect(s[1].color).toBe('oklch(0.68 0.12 250)');
    expect(s[2].color).toBe('var(--color-gray-300)');
  });
});

const sev = (value?: string): DefectLike => ({
  issue: {
    fields: { customfield_13415: value ? { value } : null },
  },
});

describe('severityChartColor', () => {
  it.each([
    ['1-Critical', 'oklch(0.58 0.25 27)'],
    ['2-Major', 'oklch(0.72 0.2 52)'],
    ['3-Minor', 'oklch(0.86 0.16 100)'],
    ['4-Cosmetic', 'oklch(0.68 0.12 250)'],
    ['Cosmetic', 'oklch(0.68 0.12 250)'],
    ['9-Odd', 'var(--color-gray-300)'],
  ])('%s', (raw, color) => {
    expect(severityChartColor(raw)).toBe(color);
  });
});

describe('defectSeveritySlices', () => {
  it('orders by level, colours by level and groups missing as None last', () => {
    const s = defectSeveritySlices([
      sev('4-Cosmetic'),
      sev('1-Critical'),
      sev('2-Major'),
      sev('2-Major'),
      sev(),
    ]);
    // ordered by the raw level number, shown without it
    expect(s.map((x) => x.label)).toEqual(['Critical', 'Major', 'Cosmetic', 'None']);
    expect(s.map((x) => x.key)).toEqual(['1-Critical', '2-Major', '4-Cosmetic', 'None']);
    expect(s.map((x) => x.value)).toEqual([1, 2, 1, 1]);
    expect(s[0].color).toBe('oklch(0.58 0.25 27)');
    expect(s[1].color).toBe('oklch(0.72 0.2 52)');
    expect(s[2].color).toBe('oklch(0.68 0.12 250)');
    expect(s[3].color).toBe('var(--color-gray-300)');
    expect(s[1].share).toBe(40);
  });

  it('returns nothing when no defect has a severity', () => {
    expect(defectSeveritySlices([sev(), sev()])).toEqual([]);
    expect(defectSeveritySlices([])).toEqual([]);
  });
});

describe('severityLabel', () => {
  it.each([
    ['2-Major', 'Major'],
    ['4-Cosmetic', 'Cosmetic'],
    ['10 - Blocker', 'Blocker'],
    ['Major', 'Major'],
    ['None', 'None'],
  ])('%s -> %s', (raw, label) => {
    expect(severityLabel(raw)).toBe(label);
  });
});

describe('defectStatusSlices unknown categories', () => {
  it('counts an unrecognised category as To Do so the shares sum to the total', () => {
    const s = defectStatusSlices([
      def('Open', 'new'),
      def('Weird', 'undefined'),
      def('Done', 'done'),
      def('NoCat', ''),
    ]);
    expect(s.map((x) => [x.label, x.value])).toEqual([
      ['To Do', 3],
      ['Done', 1],
    ]);
    expect(s.reduce((n, x) => n + x.share, 0)).toBe(100);
  });

  it('charts a lone unknown-category defect instead of dropping it', () => {
    expect(defectStatusSlices([def('Weird', 'undefined')])).toHaveLength(1);
  });
});

describe('priorityChartColor by scheme level', () => {
  it.each([
    ['Blocker', 'oklch(0.46 0.23 25)'],
    ['Must', 'oklch(0.58 0.25 27)'],
    ['Critical', 'oklch(0.66 0.23 38)'],
    ['Highest', 'oklch(0.72 0.2 52)'],
    ['Should', 'oklch(0.78 0.18 68)'],
    ['High', 'oklch(0.83 0.17 82)'],
    ['Medium', 'oklch(0.86 0.16 100)'],
    ['Low', 'oklch(0.68 0.12 250)'],
    ['Lowest', 'oklch(0.76 0.08 245)'],
    ['Minor', 'oklch(0.83 0.04 240)'],
  ])('%s ignores a meaningless icon', (name, color) => {
    expect(priorityChartColor({ name, iconUrl: 'http://x/icon-123.svg' })).toBe(color);
  });

  it('keeps the icon fallback for names outside the scheme', () => {
    expect(priorityChartColor({ name: 'Urgent', iconUrl: 'http://x/major.svg' })).toBe(
      'oklch(0.58 0.25 27)',
    );
    expect(priorityChartColor({ name: 'Urgent' })).toBe('var(--color-gray-300)');
  });
});

describe('priorityChartColor', () => {
  it.each([
    ['http://x/MAJOR.svg', 'oklch(0.58 0.25 27)'],
    ['http://x/highest.svg', 'oklch(0.58 0.25 27)'],
    ['http://x/high.svg', 'oklch(0.83 0.17 82)'],
    ['http://x/medium.svg', 'oklch(0.86 0.16 100)'],
    ['http://x/trivial.svg', 'oklch(0.76 0.08 245)'],
    ['http://x/weird.svg', 'var(--color-gray-300)'],
    [undefined, 'var(--color-gray-300)'],
  ])('%s', (url, color) => {
    expect(priorityChartColor({ iconUrl: url })).toBe(color);
  });
});

describe('aioDateMs', () => {
  it('parses numbers, digit strings and ISO strings', () => {
    expect(aioDateMs(1759312800000)).toBe(1759312800000);
    expect(aioDateMs('1759312800000')).toBe(1759312800000);
    expect(aioDateMs('2026-10-01T10:00:00Z')).toBe(Date.parse('2026-10-01T10:00:00Z'));
  });
  it('returns null for junk', () => {
    expect(aioDateMs(null)).toBeNull();
    expect(aioDateMs(undefined)).toBeNull();
    expect(aioDateMs('garbage')).toBeNull();
    expect(aioDateMs(Number.NaN)).toBeNull();
  });
});

describe('cycleBurndownSeries', () => {
  const D = 86_400_000;
  const s = 1_000 * D;
  const t1 = s + 2 * D;
  const t2 = s + 4 * D;
  const e = s + 10 * D;
  const run = (status: string, ms?: number) => ({
    status,
    executedDate: ms === undefined ? undefined : new Date(ms).toISOString(),
  });

  it('returns null with no runs or no executions', () => {
    expect(cycleBurndownSeries([], undefined, e)).toBeNull();
    expect(cycleBurndownSeries([run('NOT_EXECUTED')], undefined, e)).toBeNull();
    expect(
      cycleBurndownSeries([run('IN_PROGRESS', t1)], { startDate: s, endDate: e }, e),
    ).toBeNull();
  });

  it('builds start, execution and end points', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('PASS', t1), run('FAIL', t2), run('NOT_EXECUTED')],
      { startDate: s, endDate: e },
      e + D,
    );
    expect(r?.total).toBe(4);
    expect(r?.from).toBe(s);
    expect(r?.to).toBe(e);
    expect(r?.points.map((p) => [p.t, p.remaining, p.marker])).toEqual([
      [s, 4, null],
      [t1, 2, 'pass'],
      [t2, 1, 'fail'],
      [e, 1, null],
    ]);
    expect(r?.points[0].ideal).toBe(4);
    expect(r?.points[3].ideal).toBe(0);
    expect(r?.points[1].executed).toBe(2);
  });

  it('uses the worst status for a shared timestamp', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('FAIL', t1), run('BLOCKED', t1)],
      { startDate: s, endDate: e },
      e,
    );
    const p = r?.points.find((x) => x.t === t1);
    expect(p?.executed).toBe(3);
    expect(p?.marker).toBe('fail');
  });

  it('adds a trailing point at now and a null-remaining end for an active cycle', () => {
    const now = s + 6 * D;
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('FAIL', t2), run('NOT_EXECUTED')],
      { startDate: s, endDate: e },
      now,
    );
    const pts = r?.points ?? [];
    expect(pts.map((p) => [p.t, p.remaining])).toEqual([
      [s, 3],
      [t1, 2],
      [t2, 1],
      [now, 1],
      [e, null],
    ]);
    expect(pts[4].ideal).toBe(0);
  });

  it('falls back to first/last execution when start and end are missing', () => {
    const r = cycleBurndownSeries([run('PASS', t1), run('PASS', t2)], undefined, t2);
    expect(r?.from).toBe(t1);
    expect(r?.to).toBe(t2);
    expect(r?.points.map((p) => [p.t, p.remaining])).toEqual([
      [t1, 2],
      [t1, 1],
      [t2, 0],
    ]);
    expect(r?.points[0].ideal).toBe(2);
    expect(r?.points[2].ideal).toBe(0);
  });

  it('widens the span for executions outside the cycle dates', () => {
    const r = cycleBurndownSeries(
      [run('PASS', s - D), run('PASS', e + D)],
      { startDate: s, endDate: e },
      e + 2 * D,
    );
    expect(r?.from).toBe(s - D);
    expect(r?.to).toBe(e + D);
  });

  it('computes a linear one-decimal ideal', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('NOT_EXECUTED'), run('NOT_EXECUTED')],
      { startDate: s, endDate: e },
      e,
    );
    expect(r?.points.find((p) => p.t === t1)?.ideal).toBe(2.4);
  });

  it('has null ideal everywhere when the span is empty', () => {
    const r = cycleBurndownSeries([run('PASS', t1), run('PASS', t1)], undefined, t1);
    expect(r?.points.every((p) => p.ideal === null)).toBe(true);
  });
});
