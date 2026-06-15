/**
 * Global concurrency limiter for Jira API calls.
 *
 * All Jira API calls (parallel queries, subtask chunks, etc.) go through
 * this semaphore to prevent overloading on-premise Jira DC with too many
 * simultaneous requests.
 *
 * Default concurrency: 6 (configurable via dev tools toggle, per D-09).
 */
import pLimit from 'p-limit';

let Limit = pLimit(6);
let Current = 6;

/**
 * Get the current p-limit instance for Jira API calls.
 * Wrap any Jira API call: `await getJiraLimit()(() => apiFetch(...))`
 */
export function getJiraLimit() {
  return Limit;
}

/**
 * Update the concurrency limit.
 * No-op if the new limit equals the current limit (avoids creating a new instance).
 *
 * @param n - Maximum number of concurrent Jira API calls
 */
export function setJiraConcurrencyLimit(n: number) {
  if (n !== Current) {
    Limit = pLimit(n);
    Current = n;
  }
}

/**
 * Dedicated concurrency limiter for the velocity backfill fan-out (Phase 85 D-05 / criterion 1c).
 *
 * This is a SEPARATE pLimit(3) instance — intentionally tighter than the global pLimit(6)
 * so the per-sprint issue fan-out never monopolizes the Jira DC connection. It is NOT
 * affected by setJiraConcurrencyLimit, which only mutates the global `getJiraLimit()` instance.
 *
 * Usage: `getVelocityLimit()(() => fetchSprintIssuesBySprintId(...))`
 */
const velocityLimit = pLimit(3);

/**
 * Get the dedicated p-limit instance for velocity backfill fan-out.
 * Always returns the same pLimit(3) singleton — distinct from getJiraLimit()'s pLimit(6).
 */
export function getVelocityLimit() {
  return velocityLimit;
}
