/**
 * Summary statistics over a (filtered) list of API log entries.
 */
import type { ApiLogEntry } from '../../stores/debug-log.store';

export interface LogStats {
  total: number;
  errors: number;
  median: number | null;
  p95: number | null;
  slowest: { path: string; method: string; ms: number } | null;
}

function nearestRank(sorted: number[], p: number): number {
  const rank = Math.max(1, Math.ceil(p * sorted.length));
  return sorted[Math.min(sorted.length, rank) - 1];
}

/** Path of a URL without host or query string; falls back to the raw text before `?`. */
export function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split('?')[0];
  }
}

export function computeLogStats(entries: ApiLogEntry[]): LogStats {
  if (entries.length === 0) {
    return { total: 0, errors: 0, median: null, p95: null, slowest: null };
  }
  const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
  let slowest = entries[0];
  let errors = 0;
  for (const e of entries) {
    if (e.status === null || e.status >= 400) errors++;
    if (e.durationMs > slowest.durationMs) slowest = e;
  }
  return {
    total: entries.length,
    errors,
    median: nearestRank(durations, 0.5),
    p95: nearestRank(durations, 0.95),
    slowest: { path: urlPath(slowest.url), method: slowest.method, ms: slowest.durationMs },
  };
}

export interface TimingScale {
  max: number;
  durationPct: number;
  medianPct: number | null;
  p95Pct: number | null;
}

/** Bar geometry for one duration against the median and p95; max is 1.1x the largest value. */
export function timingScale(
  durationMs: number,
  median: number | null,
  p95: number | null,
): TimingScale {
  const max = Math.max(1, 1.1 * Math.max(durationMs, median ?? 0, p95 ?? 0));
  const pct = (v: number) => Math.round((v / max) * 1000) / 10;
  return {
    max,
    durationPct: pct(durationMs),
    medianPct: median === null ? null : pct(median),
    p95Pct: p95 === null ? null : pct(p95),
  };
}
