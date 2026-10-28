/**
 * Shared story-points filter primitives used by both the Backlog and Sprint
 * Board views (quick-261028-mgp). Both views must call
 * `matchesStoryPointsFilter`, the single source of truth.
 *
 * A reserved sentinel (`NO_ESTIMATE_FILTER`) represents "no story points". It
 * matches strictly issues whose story points are null/missing (never 0), is
 * pinned first in the option list, and is offered only when at least one
 * visible issue is unestimated.
 */
import type { JiraIssue } from '@/services/jira';

export const NO_ESTIMATE_FILTER = '__no_estimate__';
export const NO_ESTIMATE_LABEL = 'No estimate';

/**
 * Read story points using the same fallback chain as BacklogRow/MyTaskRow:
 * configured field, then customfield_10016 (synthesised by the GreenHopper
 * adapter), then null. Non-finite / non-number values become null.
 */
export function readStoryPoints(issue: JiraIssue, storyPointsFieldKey: string): number | null {
  const v =
    (issue.fields[storyPointsFieldKey] as number | null | undefined) ??
    (issue.fields.customfield_10016 as number | null | undefined) ??
    null;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Distinct values, numeric ascending; sentinel first when any issue has none. */
export function buildStoryPointOptions(issues: JiraIssue[], storyPointsFieldKey: string): string[] {
  const values = new Set<number>();
  let hasNone = false;
  for (const issue of issues) {
    const sp = readStoryPoints(issue, storyPointsFieldKey);
    if (sp === null) hasNone = true;
    else values.add(sp);
  }
  const sorted = Array.from(values)
    .sort((a, b) => a - b)
    .map(String);
  return hasNone ? [NO_ESTIMATE_FILTER, ...sorted] : sorted;
}

/** OR semantics; empty Set matches everything; exact numeric equality. */
export function matchesStoryPointsFilter(
  issue: JiraIssue,
  active: Set<string>,
  storyPointsFieldKey: string,
): boolean {
  if (active.size === 0) return true;
  const sp = readStoryPoints(issue, storyPointsFieldKey);
  if (sp === null) return active.has(NO_ESTIMATE_FILTER);
  for (const v of active) {
    if (v === NO_ESTIMATE_FILTER) continue;
    if (Number(v) === sp) return true;
  }
  return false;
}
