import { describe, expect, it } from 'vitest';
import { burndownXTicks, niceYScale } from './aio-burndown-axis';

const D = 86_400_000;
const at = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h).getTime();

describe('niceYScale', () => {
  it.each([
    [3, [0, 1, 2, 3, 4]],
    [12, [0, 5, 10, 15]],
    [60, [0, 20, 40, 60, 80]],
    [100, [0, 25, 50, 75, 100, 125]],
    [300, [0, 100, 200, 300, 400]],
  ])('total %i gets round ticks with headroom', (total, ticks) => {
    const s = niceYScale(total);
    expect(s.ticks).toEqual(ticks);
    expect(s.max).toBe(ticks[ticks.length - 1]);
    expect(s.max).toBeGreaterThan(total);
  });

  it('never exceeds 6 gridlines and handles tiny totals', () => {
    for (const t of [0, 1, 2, 7, 45, 999, 12345]) {
      const s = niceYScale(t);
      expect(s.ticks.length).toBeGreaterThanOrEqual(3);
      expect(s.ticks.length).toBeLessThanOrEqual(6);
      expect(s.max).toBeGreaterThanOrEqual(t);
      expect(s.ticks.every(Number.isInteger)).toBe(true);
    }
  });
});

describe('burndownXTicks', () => {
  const now = at(2026, 10, 14);

  it('anchors start and end and spaces everything between them evenly', () => {
    const from = at(2026, 10, 5, 9);
    const to = at(2026, 10, 26, 9);
    const ticks = burndownXTicks(from, to, 800, now);
    expect(ticks[0]).toMatchObject({ t: from, label: 'Oct 5', anchor: 'start' });
    expect(ticks[ticks.length - 1]).toMatchObject({ t: to, label: 'Oct 26', anchor: 'end' });
    expect(ticks.length).toBeGreaterThan(2);
    const gaps = ticks.slice(1).map((x, i) => x.t - ticks[i].t);
    for (const g of gaps) expect(Math.abs(g - gaps[0])).toBeLessThan(1);
    for (const x of ticks.slice(1, -1)) expect(x.anchor).toBe('middle');
  });

  it('keeps labels apart on a narrow plot', () => {
    const ticks = burndownXTicks(at(2026, 10, 5), at(2026, 10, 10), 120, now);
    expect(ticks.map((x) => x.label)).toEqual(['Oct 5', 'Oct 10']);
  });

  it('adds the year to every label only when crossing years or not the current year', () => {
    const crossing = burndownXTicks(at(2026, 12, 20), at(2027, 1, 10), 800, now);
    expect(crossing.every((x) => /'2[67]$/.test(x.label))).toBe(true);
    const past = burndownXTicks(at(2025, 3, 1), at(2025, 3, 20), 800, now);
    expect(past.every((x) => x.label.endsWith("'25"))).toBe(true);
    const current = burndownXTicks(at(2026, 10, 1), at(2026, 10, 3) + D, 800, now);
    expect(current.every((x) => !x.label.includes("'"))).toBe(true);
  });

  it('returns nothing for an empty span', () => {
    expect(burndownXTicks(5, 5, 800, now)).toEqual([]);
  });
});
