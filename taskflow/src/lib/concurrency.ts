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

// getVelocityLimit removed in Phase 86 (D-01 clean slate).
// VelocityChart.tsx (its sole consumer) was deleted; no other consumers existed.
