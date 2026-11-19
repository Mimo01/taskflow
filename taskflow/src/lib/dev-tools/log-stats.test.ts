import { describe, expect, it } from 'vitest';
import type { ApiLogEntry } from '../../stores/debug-log.store';
import { computeLogStats, timingScale } from './log-stats';

const e = (p: Partial<ApiLogEntry>): ApiLogEntry => ({
  id: 'x',
  timestamp: '2026-11-19T10:00:00.000Z',
  source: 'jira',
  method: 'GET',
  url: 'https://j/rest/api/2/search?jql=a',
  requestHeaders: {},
  status: 200,
  durationMs: 10,
  responseBody: '',
  ...p,
});

describe('computeLogStats', () => {
  it('handles empty input', () => {
    expect(computeLogStats([])).toEqual({
      total: 0,
      inFlight: 0,
      errors: 0,
      median: null,
      p95: null,
      slowest: null,
    });
  });

  it('nearest-rank median and p95', () => {
    const entries = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((d) => e({ durationMs: d }));
    const s = computeLogStats(entries);
    expect(s.median).toBe(50);
    expect(s.p95).toBe(100);
    expect(s.total).toBe(10);
  });

  it('counts errors (null or >= 400)', () => {
    const s = computeLogStats([e({ status: null }), e({ status: 404 }), e({ status: 200 })]);
    expect(s.errors).toBe(2);
  });

  it('slowest strips the query string', () => {
    const s = computeLogStats([
      e({ durationMs: 5 }),
      e({ durationMs: 900, method: 'POST', url: 'https://j/rest/api/2/issue/ABC-1?expand=x' }),
    ]);
    expect(s.slowest).toEqual({ path: '/rest/api/2/issue/ABC-1', method: 'POST', ms: 900 });
  });
});

describe('timingScale', () => {
  it('scales against 1.1x the largest value', () => {
    const t = timingScale(100, 50, 200);
    expect(t.max).toBeCloseTo(220);
    expect(t.durationPct).toBeCloseTo(45.5, 1);
    expect(t.medianPct).toBeCloseTo(22.7, 1);
    expect(t.p95Pct).toBeCloseTo(90.9, 1);
  });

  it('returns null percentages for null median or p95', () => {
    const t = timingScale(10, null, null);
    expect(t.medianPct).toBeNull();
    expect(t.p95Pct).toBeNull();
  });

  it('keeps max at least 1 for all zeros', () => {
    expect(timingScale(0, 0, 0).max).toBe(1);
  });
});

describe('computeLogStats pending', () => {
  it('excludes pending entries from errors, percentiles and slowest, and counts inFlight', () => {
    const s = computeLogStats([
      e({ id: 'a', durationMs: 10 }),
      e({ id: 'b', durationMs: 5000, status: null, state: 'pending' }),
      e({ id: 'c', durationMs: 30, status: 500 }),
    ]);
    expect(s.total).toBe(3);
    expect(s.inFlight).toBe(1);
    expect(s.errors).toBe(1);
    expect(s.p95).toBe(30);
    expect(s.slowest?.ms).toBe(30);
  });
});
