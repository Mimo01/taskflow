/**
 * Global concurrency limiter for Jira API calls.
 *
 * All Jira API calls (parallel queries, subtask chunks, etc.) go through
 * this semaphore to prevent overloading on-premise Jira DC with too many
 * simultaneous requests.
 *
 * Fixed concurrency: 6.
 */
import pLimit from 'p-limit';

const Limit = pLimit(6);

/**
 * Get the current p-limit instance for Jira API calls.
 * Wrap any Jira API call: `await getJiraLimit()(() => apiFetch(...))`
 */
export function getJiraLimit() {
  return Limit;
}

// getVelocityLimit removed in Phase 86 (D-01 clean slate).
// VelocityChart.tsx (its sole consumer) was deleted; no other consumers existed.
