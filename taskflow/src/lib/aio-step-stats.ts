import { normalizeStatus } from '@/lib/aioUtils';
import type { AioTestRunStep } from '@/services/aio';

export interface StepStatsTotals {
  passed: number;
  failed: number;
  blocked: number;
  notRun: number;
  /** passed + failed + blocked */
  executed: number;
  /** All steps across loaded cases. */
  total: number;
  /** Cases with a loaded run detail (denominator for steps per case). */
  cases: number;
  minPerCase: number;
  maxPerCase: number;
  /** Queried runs that errored or returned null. */
  unavailable: number;
}

/** Structural subset of a TanStack UseQueryResult so `combine` can pass results straight in. */
export interface StepQueryResult {
  data?: { steps: AioTestRunStep[] } | null;
  isPending: boolean;
  isError: boolean;
}

/**
 * Aggregates step counts over per-run detail query results. Pending results are
 * neither counted nor flagged unavailable; errored-without-data / null results are
 * excluded from all counts and increment `unavailable`.
 */
export function aggregateStepStats(results: readonly StepQueryResult[]): StepStatsTotals {
  const t: StepStatsTotals = {
    passed: 0,
    failed: 0,
    blocked: 0,
    notRun: 0,
    executed: 0,
    total: 0,
    cases: 0,
    minPerCase: 0,
    maxPerCase: 0,
    unavailable: 0,
  };
  for (const r of results) {
    // A failed background refetch keeps the last good data (isError + data): still count it.
    if (r.data === null || (r.isError && !r.data)) {
      t.unavailable++;
      continue;
    }
    if (!r.data) continue; // still pending
    const steps = r.data.steps;
    for (const s of steps) {
      const k = normalizeStatus(s.status);
      if (k === 'pass') t.passed++;
      else if (k === 'fail') t.failed++;
      else if (k === 'blocked') t.blocked++;
      else t.notRun++;
    }
    const n = steps.length;
    t.minPerCase = t.cases === 0 ? n : Math.min(t.minPerCase, n);
    t.maxPerCase = Math.max(t.maxPerCase, n);
    t.cases++;
    t.total += n;
  }
  t.executed = t.passed + t.failed + t.blocked;
  return t;
}
