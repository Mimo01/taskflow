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
