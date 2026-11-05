/**
 * Shared maths for every time-tracking progress bar.
 *
 * Fill is ALWAYS spent vs the ORIGINAL estimate - never remaining estimate or
 * Jira's aggregateprogress (Jira zeroes remaining on close, which made closed
 * issues show a full bar).
 *
 * Colour matrix:
 *  - spent > 125% of estimate    -> red (any status), fill capped at 100
 *  - spent > estimate, <= 125%   -> amber (any status): over, but within tolerance
 *  - spent == estimate           -> green if done, amber if not done
 *  - under estimate, done        -> green
 *  - under estimate, not done    -> green below 75%, amber from 75%
 */
/** Spent above this multiple of the estimate turns the bar red; up to it stays amber. */
export const OVERRUN_RED_RATIO = 1.25;

export interface TimeProgress {
  fillPct: number;
  indicatorClass: string | undefined;
  overrun: boolean;
}

export function timeProgress({
  spentSeconds,
  estimateSeconds,
  isDone,
}: {
  spentSeconds: number;
  estimateSeconds: number | null | undefined;
  isDone: boolean;
}): TimeProgress {
  if (typeof estimateSeconds !== 'number' || !(estimateSeconds > 0)) {
    return { fillPct: 0, indicatorClass: undefined, overrun: false };
  }
  const spent = Math.max(0, spentSeconds);
  const fillPct = Math.min(100, Math.round((spent / estimateSeconds) * 100));
  const overrun = spent > estimateSeconds;
  let indicatorClass: string;
  if (spent > estimateSeconds * OVERRUN_RED_RATIO) indicatorClass = 'bg-red-500';
  else if (overrun) indicatorClass = 'bg-amber-500';
  else if (fillPct >= 100) indicatorClass = isDone ? 'bg-green-500' : 'bg-amber-500';
  else if (isDone) indicatorClass = 'bg-green-500';
  else indicatorClass = fillPct >= 75 ? 'bg-amber-500' : 'bg-green-500';
  return { fillPct, indicatorClass, overrun };
}

/** True iff a Jira status category key is the "done" category. */
export function isDoneStatus(statusCategoryKey: unknown): boolean {
  return statusCategoryKey === 'done';
}
