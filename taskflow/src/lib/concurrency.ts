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
import { nowMs } from './dev-tools/log-entry';
import { runWithQueuedAt } from './dev-tools/queue-handoff';

export const JIRA_CONCURRENCY = 6;

const Limit = pLimit(JIRA_CONCURRENCY);

/**
 * Get the limiter for Jira API calls.
 * Wrap any Jira API call: `await getJiraLimit()(() => apiFetch(...))`
 *
 * Records the enqueue time and hands it to apiFetch (best effort, see queue-handoff) so Developer
 * Tools can show how long a request waited for a slot separately from network time.
 */
export function getJiraLimit() {
  return <T>(fn: () => Promise<T> | T): Promise<T> => {
    const queuedAt = nowMs();
    return Limit(() => runWithQueuedAt(queuedAt, fn));
  };
}

// getVelocityLimit removed in Phase 86 (D-01 clean slate).
// VelocityChart.tsx (its sole consumer) was deleted; no other consumers existed.
