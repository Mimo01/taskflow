/**
 * Shared time-tracking constants/helpers. The per-issue time bar itself lives in
 * `components/jira/IssueTimeBar.tsx` (epic-style logged vs remaining).
 */

/** Logged+remaining above this multiple of the estimate turns the bar red; up to it stays amber. */
export const OVERRUN_RED_RATIO = 1.25;

/** True iff a Jira status category key is the "done" category. */
export function isDoneStatus(statusCategoryKey: unknown): boolean {
  return statusCategoryKey === 'done';
}

/**
 * Fill colour for the "health" time bars (My Tasks, standup, sidebar, Worklog): logged vs the
 * ORIGINAL estimate.
 *  - logged > 125% of estimate -> red; logged > estimate -> amber
 *  - logged == estimate        -> green if done, else amber
 *  - under estimate            -> green if done, else green below 75% and amber from 75%
 * No estimate -> undefined (caller keeps its neutral colour).
 */
export function healthClass(
  loggedSeconds: number,
  estimateSeconds: number,
  isDone: boolean,
): string | undefined {
  if (!(estimateSeconds > 0)) return undefined;
  const logged = Math.max(0, loggedSeconds);
  if (logged > estimateSeconds * OVERRUN_RED_RATIO) return 'bg-red-500';
  if (logged > estimateSeconds) return 'bg-amber-500';
  if (logged === estimateSeconds) return isDone ? 'bg-green-500' : 'bg-amber-500';
  if (isDone) return 'bg-green-500';
  return logged / estimateSeconds >= 0.75 ? 'bg-amber-500' : 'bg-green-500';
}
