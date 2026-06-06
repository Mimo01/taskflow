/**
 * Shared assignee-filter primitives used by both the Backlog and Sprint Board
 * views (quick-260606-s09).
 *
 * The assignee filter dropdown lists named people derived from the visible
 * issues. To let users triage unassigned work, a single reserved sentinel value
 * (`UNASSIGNED_FILTER`) represents "no assignee". It is:
 *   - matched STRICTLY against `issue.fields.assignee === null` (never substring),
 *   - rendered with the human label `UNASSIGNED_LABEL` ("Unassigned"),
 *   - pinned to the TOP of the option list,
 *   - shown ONLY when at least one visible issue is unassigned.
 *
 * Both view predicates must be behaviorally identical — they both call
 * `matchesAssigneeFilter`, the single source of truth.
 */
import type { JiraIssue } from '@/services/jira';

/**
 * Reserved sentinel value representing "Unassigned" inside the assignee filter
 * Set. Chosen to be unlikely to collide with a real displayName. Matched
 * strictly via `assignee === null`, never via substring (see threat T-s09-01).
 */
export const UNASSIGNED_FILTER = '__unassigned__';

/** Human-facing label rendered in the dropdown and the active-filter chip. */
export const UNASSIGNED_LABEL = 'Unassigned';

/**
 * Build the assignee dropdown options from the visible issues.
 *
 * Returns the distinct named displayNames (first-seen order, matching the prior
 * unsorted Set-based builders). When at least one issue has no assignee, the
 * `UNASSIGNED_FILTER` sentinel is prepended as the FIRST element. When every
 * issue is assigned, the sentinel is omitted entirely (no dead option).
 */
export function buildAssigneeOptions(issues: JiraIssue[]): string[] {
  const named = new Set<string>();
  let hasUnassigned = false;
  for (const issue of issues) {
    const assignee = issue.fields.assignee;
    if (assignee == null) {
      hasUnassigned = true;
    } else if (assignee.displayName) {
      named.add(assignee.displayName);
    }
  }
  const options = Array.from(named);
  return hasUnassigned ? [UNASSIGNED_FILTER, ...options] : options;
}

/**
 * Predicate: does `issue` pass the active assignee filter?
 *
 * - No active values → no filter, always true.
 * - OR semantics across selected values:
 *   - the sentinel matches iff `issue.fields.assignee == null`;
 *   - every other selected value is matched as a case-insensitive substring of
 *     the assignee's displayName (preserving the legacy named-filter behavior).
 *   - the sentinel is EXCLUDED from the substring pass so an unassigned issue
 *     (empty displayName) never matches a named query.
 */
export function matchesAssigneeFilter(issue: JiraIssue, activeAssignees: Set<string>): boolean {
  if (activeAssignees.size === 0) return true;

  const isUnassigned = issue.fields.assignee == null;
  if (activeAssignees.has(UNASSIGNED_FILTER) && isUnassigned) return true;

  const name = (issue.fields.assignee?.displayName ?? '').toLowerCase();
  for (const q of activeAssignees) {
    if (q === UNASSIGNED_FILTER) continue;
    if (name.includes(q.toLowerCase())) return true;
  }
  return false;
}
