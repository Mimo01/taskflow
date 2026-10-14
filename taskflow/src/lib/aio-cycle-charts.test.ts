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
    expect(s[0].color).toBe('oklch(0.5 0.24 27)');
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
    ['1-Critical', 'oklch(0.6 0.25 27)'],
    ['2-Major', 'oklch(0.7 0.19 50)'],
    ['3-Minor', 'oklch(0.84 0.15 92)'],
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
    expect(s[0].color).toBe('oklch(0.6 0.25 27)');
    expect(s[1].color).toBe('oklch(0.7 0.19 50)');
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
    ['Blocker', 'oklch(0.5 0.24 27)'],
    ['Must', 'oklch(0.6 0.25 27)'],
    ['Critical', 'oklch(0.66 0.21 35)'],
    ['Highest', 'oklch(0.7 0.19 50)'],
    ['Should', 'oklch(0.75 0.17 62)'],
    ['High', 'oklch(0.79 0.16 75)'],
    ['Medium', 'oklch(0.84 0.15 92)'],
    ['Low', 'oklch(0.68 0.12 250)'],
    ['Lowest', 'oklch(0.75 0.08 245)'],
    ['Minor', 'oklch(0.81 0.05 240)'],
  ])('%s ignores a meaningless icon', (name, color) => {
    expect(priorityChartColor({ name, iconUrl: 'http://x/icon-123.svg' })).toBe(color);
  });

  it('keeps the icon fallback for names outside the scheme', () => {
    expect(priorityChartColor({ name: 'Urgent', iconUrl: 'http://x/major.svg' })).toBe(
      'oklch(0.6 0.25 27)',
    );
    expect(priorityChartColor({ name: 'Urgent' })).toBe('var(--color-gray-300)');
  });
});

describe('priorityChartColor', () => {
  it.each([
    ['http://x/MAJOR.svg', 'oklch(0.6 0.25 27)'],
    ['http://x/highest.svg', 'oklch(0.6 0.25 27)'],
    ['http://x/high.svg', 'oklch(0.79 0.16 75)'],
    ['http://x/medium.svg', 'oklch(0.84 0.15 92)'],
    ['http://x/trivial.svg', 'oklch(0.75 0.08 245)'],
    ['http://x/weird.svg', 'var(--color-gray-300)'],
    [undefined, 'var(--color-gray-300)'],
  ])('%s', (url, color) => {
    expect(priorityChartColor({ iconUrl: url })).toBe(color);
  });
});
