import { describe, expect, it } from 'vitest';
import { DEFAULT_CALENDAR } from '@/lib/epic-progress';
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
  // Local-time fixtures (never UTC ISO strings) so results do not depend on the timezone.
  const day = (n: number, h = 0) => new Date(2026, 9, 1 + n, h).getTime();
  const s = day(0);
  const t1 = day(2);
  const t2 = day(4);
  const e = day(10);
  const allDays = () => true;
  const keep = (r: ReturnType<typeof cycleBurndownSeries>, ...extra: number[]) =>
    (r?.points ?? []).filter(
      (p) => p.executed > 0 || p.t === r?.from || p.t === r?.to || extra.includes(p.t),
    );
  const run = (status: string, ms?: number) => ({
    status,
    executedDate: ms === undefined ? undefined : new Date(ms).toISOString(),
  });

  it('returns null with no runs or no executions', () => {
    expect(cycleBurndownSeries([], undefined, e, allDays)).toBeNull();
    expect(cycleBurndownSeries([run('NOT_EXECUTED')], undefined, e, allDays)).toBeNull();
    expect(
      cycleBurndownSeries([run('IN_PROGRESS', t1)], { startDate: s, endDate: e }, e, allDays),
    ).toBeNull();
  });

  it('builds start, execution and end points', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('PASS', t1), run('FAIL', t2), run('NOT_EXECUTED')],
      { startDate: s, endDate: e },
      e + D,
      allDays,
    );
    expect(r?.total).toBe(4);
    expect(r?.from).toBe(s);
    expect(r?.to).toBe(e);
    expect(keep(r).map((p) => [p.t, p.remaining, p.marker])).toEqual([
      [s, 4, null],
      [t1, 2, 'pass'],
      [t2, 1, 'fail'],
      [e, 1, null],
    ]);
    expect(keep(r)[0].ideal).toBe(4);
    expect(keep(r)[3].ideal).toBe(0);
    expect(keep(r)[1].executed).toBe(2);
  });

  it('merges executions within one hour into a single point at the last execution', () => {
    const m = (n: number) => day(2, 9) + n * 60_000;
    const r = cycleBurndownSeries(
      [run('PASS', m(0)), run('FAIL', m(20)), run('PASS', m(59)), run('PASS', m(61))],
      { startDate: s, endDate: e },
      e,
      allDays,
    );
    expect(keep(r).map((p) => [p.t, p.remaining, p.executed, p.marker])).toEqual([
      [s, 4, 0, null],
      [m(59), 1, 3, 'fail'],
      [m(61), 0, 1, 'pass'],
      [e, 0, 0, null],
    ]);
  });

  it('uses the worst status for a shared timestamp', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('FAIL', t1), run('BLOCKED', t1)],
      { startDate: s, endDate: e },
      e,
      allDays,
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
      allDays,
    );
    const pts = keep(r, now);
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
    const r = cycleBurndownSeries([run('PASS', t1), run('PASS', t2)], undefined, t2, allDays);
    expect(r?.from).toBe(t1);
    expect(r?.to).toBe(t2);
    expect(keep(r).map((p) => [p.t, p.remaining])).toEqual([
      [t1, 2],
      [t1, 1],
      [t2, 0],
    ]);
    expect(keep(r)[0].ideal).toBe(2);
    expect(keep(r)[2].ideal).toBe(0);
  });

  it('widens the span for executions outside the cycle dates', () => {
    const r = cycleBurndownSeries(
      [run('PASS', s - D), run('PASS', e + D)],
      { startDate: s, endDate: e },
      e + 2 * D,
      allDays,
    );
    expect(r?.from).toBe(s - D);
    expect(r?.to).toBe(e + D);
  });

  it('computes a linear one-decimal ideal', () => {
    const r = cycleBurndownSeries(
      [run('PASS', t1), run('NOT_EXECUTED'), run('NOT_EXECUTED')],
      { startDate: s, endDate: e },
      e,
      allDays,
    );
    expect(r?.points.find((p) => p.t === t1)?.ideal).toBe(2.4);
  });

  it('has null ideal everywhere when the span is empty', () => {
    const r = cycleBurndownSeries([run('PASS', t1), run('PASS', t1)], undefined, t1, allDays);
    expect(r?.points.every((p) => p.ideal === null)).toBe(true);
  });

  describe('working-day ideal', () => {
    const fri = new Date(2026, 9, 9).getTime(); // Fri
    const sat = new Date(2026, 9, 10).getTime();
    const sun = new Date(2026, 9, 11).getTime();
    const mon = new Date(2026, 9, 12).getTime();
    const tue = new Date(2026, 9, 13).getTime();
    const cal = DEFAULT_CALENDAR.isWorkingDay;
    const fixture = (isWorking: (k: string) => boolean, now = tue) =>
      cycleBurndownSeries(
        [run('PASS', fri + 3_600_000), ...Array.from({ length: 9 }, () => run('NOT_EXECUTED'))],
        { startDate: fri, endDate: tue },
        now,
        isWorking,
      );
    const idealAt = (r: ReturnType<typeof cycleBurndownSeries>, t: number) =>
      r?.points.find((p) => p.t === t)?.ideal;

    it('matches the straight line when every day works', () => {
      const r = fixture(allDays);
      expect(idealAt(r, sat)).toBe(7.5);
      expect(idealAt(r, mon)).toBe(2.5);
    });

    it('stays flat across the weekend', () => {
      const r = fixture(cal);
      expect([fri, sat, sun, mon, tue].map((t) => idealAt(r, t))).toEqual([10, 5, 5, 5, 0]);
    });

    it('adds midnight boundary points once, sorted, merged with executions', () => {
      const r = cycleBurndownSeries(
        [run('PASS', sat), run('NOT_EXECUTED')],
        { startDate: fri, endDate: tue },
        tue,
        cal,
      );
      const ts = (r?.points ?? []).map((p) => p.t);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
      expect(new Set(ts).size).toBe(ts.length);
      expect(ts).toEqual([fri, sat, sun, mon, tue]);
      // execution on a non-working day is plotted at its real timestamp with its marker
      expect(r?.points.find((p) => p.t === sat)).toMatchObject({ marker: 'pass', executed: 1 });
    });

    it('carries the step value up to the tail and null after it', () => {
      const r = fixture(cal, sun + 3_600_000);
      const at = (t: number) => r?.points.find((p) => p.t === t);
      expect(at(sat)).toMatchObject({ remaining: 9, executed: 0, marker: null });
      expect(at(sun)).toMatchObject({ remaining: 9 });
      expect(at(mon)?.remaining).toBeNull();
      expect(at(tue)?.remaining).toBeNull();
    });

    it('merges consecutive non-working days into one clipped band', () => {
      const isWorking = (k: string) => cal(k) && k !== '2026-10-12';
      const r = fixture(isWorking);
      expect(r?.nonWorking).toEqual([{ from: sat, to: tue }]);
      expect(fixture(allDays)?.nonWorking).toEqual([]);
    });

    it('clips bands to the cycle range', () => {
      const r = cycleBurndownSeries(
        [run('PASS', sat + 3_600_000), run('NOT_EXECUTED')],
        { startDate: sat + 6 * 3_600_000, endDate: mon + 6 * 3_600_000 },
        mon,
        cal,
      );
      expect(r?.nonWorking).toEqual([{ from: r?.from, to: mon }]);
    });

    it('falls back to the linear ideal when the whole span is non-working', () => {
      const r = cycleBurndownSeries(
        [run('PASS', sat + 3_600_000), run('NOT_EXECUTED')],
        { startDate: sat, endDate: mon },
        mon,
        cal,
      );
      expect(idealAt(r, sat)).toBe(2);
      expect(idealAt(r, sun)).toBe(1);
      expect(idealAt(r, mon)).toBe(0);
      expect(r?.nonWorking).toEqual([{ from: sat, to: mon }]);
    });

    it('skips the day walk for absurdly long spans', () => {
      const r = cycleBurndownSeries(
        [run('PASS', fri), run('NOT_EXECUTED')],
        { startDate: fri, endDate: fri + 800 * D },
        fri,
        cal,
      );
      expect(r?.nonWorking).toEqual([]);
      expect(r?.points.length).toBeLessThanOrEqual(3);
      expect(r?.points[0].ideal).toBe(2);
    });
  });
});
