import { describe, expect, it } from 'vitest';
import { concurrencySeries, groupBursts, packLanes, queuedSeries } from './timeline-layout';

describe('packLanes', () => {
  it('reuses a lane when an end equals the next start', () => {
    const { lane, laneCount } = packLanes([
      { id: 'a', start: 0, end: 10 },
      { id: 'b', start: 5, end: 15 },
      { id: 'c', start: 10, end: 20 },
    ]);
    expect([lane.get('a'), lane.get('b'), lane.get('c')]).toEqual([0, 1, 0]);
    expect(laneCount).toBe(2);
  });

  it('orders identical starts deterministically by id', () => {
    const { lane } = packLanes([
      { id: 'b', start: 0, end: 10 },
      { id: 'a', start: 0, end: 10 },
    ]);
    expect(lane.get('a')).toBe(0);
    expect(lane.get('b')).toBe(1);
  });
});

describe('groupBursts', () => {
  const items = [
    { id: 'a', start: 0, end: 100, route: '/x' },
    { id: 'b', start: 200, end: 300 },
    { id: 'c', start: 2000, end: 2100 },
  ];

  it('splits on idle gaps and returns newest first', () => {
    const bursts = groupBursts(items);
    expect(bursts).toHaveLength(2);
    expect(bursts[0]).toMatchObject({ count: 1, start: 2000, totalMs: 100, route: '(unknown)' });
    expect(bursts[1]).toMatchObject({ count: 2, totalMs: 300, route: '/x', id: 'burst-a' });
  });

  it('keeps a long request in the burst when it starts within the gap of the max end', () => {
    const bursts = groupBursts([
      { id: 'a', start: 0, end: 10_000 },
      { id: 'b', start: 5000, end: 5010 },
      { id: 'c', start: 11_000, end: 11_100 },
    ]);
    expect(bursts).toHaveLength(1);
    expect(bursts[0].count).toBe(3);
  });
});

describe('concurrencySeries', () => {
  it('reports the peak for overlapping spans', () => {
    const r = concurrencySeries(
      [
        { start: 0, end: 100 },
        { start: 10, end: 90 },
        { start: 20, end: 50 },
      ],
      [0, 100],
    );
    expect(r.peak).toBe(3);
    expect(r.peakAt).toBe(20);
  });

  it('does not double count an end and a start at the same instant', () => {
    const r = concurrencySeries(
      [
        { start: 0, end: 50 },
        { start: 50, end: 100 },
      ],
      [0, 100],
    );
    expect(r.peak).toBe(1);
    expect(r.points.filter(([t]) => t === 50)).toEqual([[50, 1]]);
  });

  it('clips to the window', () => {
    const r = concurrencySeries(
      [
        { start: 0, end: 1000 },
        { start: 500, end: 600 },
      ],
      [100, 400],
    );
    expect(r.points[0]).toEqual([100, 1]);
    expect(r.points[r.points.length - 1]).toEqual([400, 1]);
    expect(r.peak).toBe(1);
  });
});

describe('queuedSeries', () => {
  it('counts requests waiting for a slot', () => {
    const r = queuedSeries(
      [
        { queuedAt: 0, start: 50 },
        { queuedAt: 10, start: 50 },
      ],
      [0, 100],
    );
    expect(r.peak).toBe(2);
  });

  it('ignores spans that never queued', () => {
    expect(queuedSeries([{ start: 50 }], [0, 100]).peak).toBe(0);
  });
});
