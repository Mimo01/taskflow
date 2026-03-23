/**
 * Link Engine — pure business logic for connecting GitLab MRs to Jira sprint issues.
 *
 * All functions are pure (no side effects, no fetch calls).
 * Callers are responsible for pre-fetching MR commits, approvals, and discussions.
 *
 * Key behaviors:
 * - Ticket key regex: case-insensitive match for Jira-style keys like PROJ-123, proj-123, Proj 123
 * - Stale detection: based on updated_at timestamp vs. configurable day threshold
 * - Review health: approved > changes_requested > waiting_for_review priority order
 */

import type { Discussion, GitLabMR, MRApprovals, MRCommit } from './gitlab';

/** Health state of a merge request based on approvals and unresolved discussions. */
export type ReviewHealth = 'approved' | 'changes_requested' | 'waiting_for_review';

/**
 * Regex matching Jira-style ticket keys (e.g. PROJ-123, abc-45, Proj-42).
 * Case-insensitive — all extracted keys are normalized to uppercase.
 * Uses negative lookbehind to ensure the key is not preceded by a letter, digit, or hyphen,
 * preventing false matches in compound identifiers like PREFIX-FEAT-1.
 */
const TICKET_KEY_RE = /(?<![A-Za-z0-9-])\b([A-Za-z][A-Za-z0-9]+-\d+)\b/gi;

/**
 * Regex matching space-separated ticket key patterns (e.g. "PROJ 123", "proj 123").
 * Captures the project prefix and numeric id separately for dash-joined normalization.
 */
const TICKET_KEY_SPACE_RE = /(?<![A-Za-z0-9-])\b([A-Za-z][A-Za-z0-9]+)\s+(\d+)\b/gi;

/**
 * Extract all Jira ticket keys from arbitrary text.
 * Case-insensitive: keys are normalized to uppercase (e.g. "proj-123" -> "PROJ-123").
 * Space-tolerant: "PROJ 123" is normalized to "PROJ-123".
 * Deduplicates keys to avoid double-matching the same key in a string.
 *
 * @param text - Any string (MR title, commit message, branch name, etc.)
 * @returns Unique uppercase ticket keys in order of first appearance
 */
export function extractTicketKeys(text: string): string[] {
  const indexed: Array<{ key: string; pos: number }> = [];

  // Match dash-separated keys (case-insensitive)
  for (const match of text.matchAll(TICKET_KEY_RE)) {
    indexed.push({ key: match[1].toUpperCase(), pos: match.index });
  }

  // Match space-separated keys (e.g. "PROJ 123" -> "PROJ-123")
  for (const match of text.matchAll(TICKET_KEY_SPACE_RE)) {
    indexed.push({ key: `${match[1].toUpperCase()}-${match[2]}`, pos: match.index });
  }

  // Sort by position in original text to preserve order of first appearance
  indexed.sort((a, b) => a.pos - b.pos);

  // Deduplicate while preserving order
  return [...new Set(indexed.map((m) => m.key))];
}

/**
 * Link a merge request to a sprint issue by scanning the MR title and source branch name.
 * Title is checked first; if no match is found there, the branch name is scanned as a fallback.
 * Returns the first key that exists in the sprint's issue set.
 *
 * Branch names often carry Jira keys even when MR titles do not
 * (e.g. "feature/PROJ-123-implement-something" vs a short title "Implement feature").
 *
 * @param mr              - The merge request to inspect
 * @param sprintIssueKeys - Set of Jira keys currently in the sprint
 * @returns Matched key or null
 */
export function linkMRToTask(mr: GitLabMR, sprintIssueKeys: Set<string>): string | null {
  const titleKeys = extractTicketKeys(mr.title);
  const titleMatch = titleKeys.find((k) => sprintIssueKeys.has(k));
  if (titleMatch !== undefined) return titleMatch;

  const branchKeys = extractTicketKeys(mr.source_branch);
  return branchKeys.find((k) => sprintIssueKeys.has(k)) ?? null;
}

/**
 * Link a merge request to a sprint issue by scanning commit titles.
 * Pure function — commits must be pre-fetched by the caller via fetchMRCommits.
 *
 * @param mr              - The merge request (for context, not scanned here)
 * @param sprintIssueKeys - Set of Jira keys currently in the sprint
 * @param commits         - Pre-fetched commits for this MR
 * @returns First matched key across commit titles, or null
 */
export function linkMRToTaskViaCommits(
  mr: GitLabMR,
  sprintIssueKeys: Set<string>,
  commits: MRCommit[],
): string | null {
  // Suppress unused variable warning — mr kept for API consistency
  void mr;

  for (const commit of commits) {
    const keys = extractTicketKeys(commit.title);
    const match = keys.find((k) => sprintIssueKeys.has(k));
    if (match) return match;
  }
  return null;
}

/**
 * Derive the review health of an MR based on approvals and discussion state.
 *
 * Priority:
 * 1. 'approved'           — at least one approver
 * 2. 'changes_requested'  — unresolved, resolvable discussion notes exist
 * 3. 'waiting_for_review' — no approvals, no unresolved threads
 *
 * @param approvals   - MR approval state from fetchMRApprovals
 * @param discussions - MR discussion threads from fetchMRDiscussions
 * @returns Review health status
 */
export function deriveReviewHealth(
  approvals: MRApprovals,
  discussions: Discussion[],
): ReviewHealth {
  if (approvals.approved_by.length > 0) {
    return 'approved';
  }

  const hasUnresolved = discussions.some((d) => d.notes.some((n) => n.resolvable && !n.resolved));

  if (hasUnresolved) {
    return 'changes_requested';
  }

  return 'waiting_for_review';
}

/**
 * Check whether a merge request is considered stale based on its last update time.
 *
 * @param mr            - The merge request to check
 * @param thresholdDays - Number of days without update before considered stale
 * @returns true if the MR has not been updated within thresholdDays
 */
export function isStale(mr: GitLabMR, thresholdDays: number): boolean {
  const ageMs = Date.now() - new Date(mr.updated_at).getTime();
  return ageMs > thresholdDays * 86_400_000;
}
