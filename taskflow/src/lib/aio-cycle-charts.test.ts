import { describe, expect, it } from 'vitest';
import {
  type DefectLike,
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
    expect(s[0].color).toBe('var(--color-red-800)');
    expect(s[1].color).toBe('var(--color-sky-400)');
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
    ['1-Critical', 'var(--color-red-600)'],
    ['2-Major', 'var(--color-orange-500)'],
    ['3-Minor', 'var(--color-yellow-400)'],
    ['4-Cosmetic', 'var(--color-sky-500)'],
    ['Cosmetic', 'var(--color-sky-500)'],
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
    expect(s[0].color).toBe('var(--color-red-600)');
    expect(s[1].color).toBe('var(--color-orange-500)');
    expect(s[2].color).toBe('var(--color-sky-500)');
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
    ['Blocker', 'var(--color-red-800)'],
    ['Must', 'var(--color-red-600)'],
    ['Critical', 'var(--color-red-400)'],
    ['Highest', 'var(--color-orange-500)'],
    ['Should', 'var(--color-orange-400)'],
    ['High', 'var(--color-amber-500)'],
    ['Medium', 'var(--color-yellow-400)'],
    ['Low', 'var(--color-sky-400)'],
    ['Lowest', 'var(--color-indigo-400)'],
    ['Minor', 'var(--color-slate-400)'],
  ])('%s ignores a meaningless icon', (name, color) => {
    expect(priorityChartColor({ name, iconUrl: 'http://x/icon-123.svg' })).toBe(color);
  });

  it('keeps the icon fallback for names outside the scheme', () => {
    expect(priorityChartColor({ name: 'Urgent', iconUrl: 'http://x/major.svg' })).toBe(
      'var(--color-red-600)',
    );
    expect(priorityChartColor({ name: 'Urgent' })).toBe('var(--color-gray-300)');
  });
});

describe('priorityChartColor', () => {
  it.each([
    ['http://x/MAJOR.svg', 'var(--color-red-600)'],
    ['http://x/highest.svg', 'var(--color-red-600)'],
    ['http://x/high.svg', 'var(--color-orange-500)'],
    ['http://x/medium.svg', 'var(--color-yellow-500)'],
    ['http://x/trivial.svg', 'var(--color-slate-400)'],
    ['http://x/weird.svg', 'var(--color-gray-300)'],
    [undefined, 'var(--color-gray-300)'],
  ])('%s', (url, color) => {
    expect(priorityChartColor({ iconUrl: url })).toBe(color);
  });
});
