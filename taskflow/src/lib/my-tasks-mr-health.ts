/**
 * My Tasks MR-health selection + aggregation helpers (260827-gji).
 *
 * Pure functions used by MyTasksPage to bound GitLab MR-review-health
 * enrichment requests and combine per-MR results into an issue-key → health
 * map. No fetch, no React, no store access — callers own all I/O.
 */

import type { Discussion, GitLabMR, MRApprovals } from '@/services/gitlab';
import { deriveReviewHealth, extractTicketKeys, type ReviewHealth } from '@/services/linkEngine';

/** Maximum number of authored MRs enriched with per-MR approvals/discussions. */
export const MR_HEALTH_ENRICHMENT_CAP = 20;

/**
 * Select which authored MRs are worth enriching with approvals/discussions.
 *
 * Keeps only MRs that match at least one currently-visible issue key (title
 * keys checked first, then source-branch keys, deduped with order preserved),
 * sorts the survivors by `updated_at` descending, then caps the result at
 * `MR_HEALTH_ENRICHMENT_CAP` to bound outbound GitLab requests.
 *
 * @param mrs              - Authored MRs (already server-filtered to state=opened)
 * @param visibleIssueKeys - Issue keys currently rendered in the active scope
 * @returns Up to `MR_HEALTH_ENRICHMENT_CAP` entries, most recently updated first
 */
export function selectMrsForHealth(
  mrs: GitLabMR[],
  visibleIssueKeys: Set<string>,
): Array<{ mr: GitLabMR; keys: string[] }> {
  if (visibleIssueKeys.size === 0) return [];

  const matched: Array<{ mr: GitLabMR; keys: string[] }> = [];
  for (const mr of mrs) {
    const titleKeys = extractTicketKeys(mr.title ?? '');
    const branchKeys = extractTicketKeys(mr.source_branch ?? '');
    const keys = [...new Set([...titleKeys, ...branchKeys])];
    if (keys.some((k) => visibleIssueKeys.has(k))) {
      matched.push({ mr, keys });
    }
  }

  matched.sort((a, b) => new Date(b.mr.updated_at).getTime() - new Date(a.mr.updated_at).getTime());

  return matched.slice(0, MR_HEALTH_ENRICHMENT_CAP);
}

/**
 * Resolve the review health of a single MR from its (possibly still-loading)
 * approvals and discussions query results.
 *
 * Graceful degradation: when `approvals` is `undefined` (loading or errored),
 * returns `'waiting_for_review'` — preserving today's default badge rather
 * than showing an incorrect state. `discussions` defaults to `[]` when absent.
 *
 * @param approvals   - Result of fetchMRApprovals, or undefined while pending
 * @param discussions - Result of fetchMRDiscussions, or undefined while pending/not-yet-fetched
 * @returns Review health for this MR
 */
export function resolveMrHealth(
  approvals: MRApprovals | undefined,
  discussions: Discussion[] | undefined,
): ReviewHealth {
  if (approvals === undefined) {
    return 'waiting_for_review';
  }
  return deriveReviewHealth(approvals, discussions ?? []);
}

/** Precedence rank for aggregating multiple MRs mapped to the same issue key. */
const HEALTH_RANK: Record<ReviewHealth, number> = {
  changes_requested: 0,
  waiting_for_review: 1,
  approved: 2,
};

/**
 * Combine per-MR health entries into an issue-key → ReviewHealth map.
 *
 * When multiple MRs map to the same issue key, the most actionable state
 * wins regardless of processing order: `changes_requested` > `waiting_for_review`
 * > `approved`.
 *
 * @param entries - Per-MR key sets paired with their resolved health
 * @returns Map of issue key to the most actionable ReviewHealth seen
 */
export function buildMrHealthByKey(
  entries: Array<{ keys: string[]; health: ReviewHealth }>,
): Map<string, ReviewHealth> {
  const result = new Map<string, ReviewHealth>();
  for (const { keys, health } of entries) {
    for (const key of keys) {
      const existing = result.get(key);
      if (existing === undefined || HEALTH_RANK[health] < HEALTH_RANK[existing]) {
        result.set(key, health);
      }
    }
  }
  return result;
}
