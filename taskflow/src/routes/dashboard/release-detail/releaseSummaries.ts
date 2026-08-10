/**
 * Release summaries — pure derived computations for the release detail page.
 *
 * React-free: every function here takes explicit parameters and returns plain
 * data — no closures over component state, no hooks, no store reads. This
 * module exists so `ReleaseDetailPage.tsx` (and its future `useReleaseDetail`
 * hook) can call these as ordinary functions and so they are unit-testable in
 * isolation (see `releaseSummaries.test.ts`).
 *
 * Two non-obvious rules preserved verbatim from the original inline logic:
 * - `computeHasStoryPoints` requires `sp > 0`, not just `sp !== null` — a
 *   story-pointed issue with an explicit `0` does NOT count as "has story
 *   points" (it would render a misleading 0/0 progress line otherwise).
 * - `computeIssueStatusCounts` folds any `statusCategory.key` outside the
 *   known `'new' | 'indeterminate' | 'done'` union (including a missing
 *   `statusCategory`) into the `new` bucket, so an out-of-union runtime value
 *   never produces `NaN` or a silently dropped issue.
 */

import type { GitLabMilestone, GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { linkMRToTask } from '@/services/linkEngine';
import type { ReleaseMatch } from '@/services/releaseLinker';
import { matchGitLabToFixVersion } from '@/services/releaseLinker';

/** Leeway (in days) either side of a fix version's release date used to scope the GitLab milestone search window. */
export const MILESTONE_LEEWAY_DAYS = 7;

/**
 * Compute the `[from, to]` date window used to search for GitLab milestones
 * near a fix version's release date, padded by `MILESTONE_LEEWAY_DAYS` on
 * each side.
 *
 * @param releaseDate - Jira fix version releaseDate "YYYY-MM-DD", or null/undefined if unset
 * @returns `{ from, to }` ISO date strings, or `null` when `releaseDate` is absent
 */
export function computeMilestoneWindow(
  releaseDate: string | null | undefined,
): { from: string; to: string } | null {
  if (!releaseDate) return null;
  const addDays = (d: string, n: number) => {
    const dt = new Date(d);
    dt.setDate(dt.getDate() + n);
    return dt.toISOString().slice(0, 10);
  };
  return {
    from: addDays(releaseDate, -MILESTONE_LEEWAY_DAYS),
    to: addDays(releaseDate, MILESTONE_LEEWAY_DAYS),
  };
}

/**
 * Match a GitLab milestone to a fix version by date, tracking the chosen
 * milestone OBJECT (not just its title) so editing resolves by a stable id —
 * re-finding by title breaks the moment the user renames the milestone, and
 * an order-dependent fuzzy match could otherwise target the wrong milestone.
 *
 * @param releaseDate - Jira fix version releaseDate "YYYY-MM-DD", or null/undefined
 * @param milestones - Candidate GitLab milestones fetched for the release-date window
 * @returns the chosen `ReleaseMatch` (or a `'none'` sentinel) plus the matched milestone object
 */
export function resolveGitLabMatch(
  releaseDate: string | null | undefined,
  milestones: GitLabMilestone[] | undefined,
): { gitlabMatch: ReleaseMatch; matchedMilestone: GitLabMilestone | null } {
  const noMatch: ReleaseMatch = { type: 'none', candidateName: '', candidateUrl: '' };
  if (!releaseDate || !milestones) {
    return { gitlabMatch: noMatch, matchedMilestone: null };
  }

  const fixMs = new Date(`${releaseDate}T00:00:00Z`).getTime();
  let exact: { match: ReleaseMatch; milestone: GitLabMilestone } | null = null;
  let bestFuzzy: {
    match: ReleaseMatch;
    milestone: GitLabMilestone;
    diffMs: number;
  } | null = null;

  for (const m of milestones) {
    const match = matchGitLabToFixVersion(releaseDate, {
      date: m.due_date,
      name: m.title,
      url: m.web_url,
    });
    if (match.type === 'exact') {
      exact = { match, milestone: m };
      break;
    }
    if (match.type === 'fuzzy') {
      // Deterministic tie-break: prefer the milestone whose due_date is
      // closest to the release date when more than one falls in the window.
      const candMs = m.due_date ? new Date(`${m.due_date}T00:00:00Z`).getTime() : Number.NaN;
      const diffMs = Number.isNaN(candMs) ? Number.POSITIVE_INFINITY : Math.abs(fixMs - candMs);
      if (!bestFuzzy || diffMs < bestFuzzy.diffMs) {
        bestFuzzy = { match, milestone: m, diffMs };
      }
    }
  }

  const chosen = exact ?? bestFuzzy;
  return {
    gitlabMatch: chosen ? chosen.match : noMatch,
    matchedMilestone: chosen ? chosen.milestone : null,
  };
}

/**
 * Match release MRs to release issues by ticket key.
 *
 * @param releaseIssues - Jira issues in the fix version
 * @param releaseMrs - GitLab MRs carrying the matched milestone
 * @returns per-issue matched rows (`mr` null when unmatched) plus the MRs that matched no release issue
 */
export function matchIssuesToMRs(
  releaseIssues: JiraIssue[],
  releaseMrs: GitLabMR[],
): { matchedRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>; unmatchedMRs: GitLabMR[] } {
  const releaseIssueKeySet = new Set(releaseIssues.map((i) => i.key));
  const releaseMrByIssue = new Map<string, GitLabMR>();
  const releaseUnmatched: GitLabMR[] = [];
  for (const mr of releaseMrs) {
    const matchedKey = linkMRToTask(mr, releaseIssueKeySet);
    if (matchedKey) {
      releaseMrByIssue.set(matchedKey, mr);
    } else {
      releaseUnmatched.push(mr);
    }
  }
  const matchedRows = releaseIssues.map((issue) => ({
    issue,
    mr: releaseMrByIssue.get(issue.key) ?? null,
  }));
  const unmatchedMRs = releaseUnmatched;
  return { matchedRows, unmatchedMRs };
}

/**
 * Build the issueKey -> offending MR map (GGX-WARN-01: "wrong milestone").
 * For each missing row, scan the fetched recent-project MRs: confirm the MR
 * truly carries the key (title-or-branch via `linkMRToTask`), then pick the
 * FIRST whose milestone differs from (or is absent vs.) the release's matched
 * milestone. A null milestone is a warn case per the locked trigger; compare
 * by id.
 *
 * @param matchedMilestone - the release's matched GitLab milestone, or null
 * @param recentProjectMRs - the project's latest MRs fetched for local matching
 * @param missingRows - matched rows whose `mr` is null (no MR in the matched milestone)
 * @returns Map of issue key -> the offending MR (empty when there's no matched milestone or no recent MRs)
 */
export function buildWrongMilestoneMap(
  matchedMilestone: GitLabMilestone | null,
  recentProjectMRs: GitLabMR[] | undefined,
  missingRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>,
): Map<string, GitLabMR> {
  const wrongMilestoneByKey = new Map<string, GitLabMR>();
  if (matchedMilestone && recentProjectMRs) {
    for (const r of missingRows) {
      const keySet = new Set([r.issue.key]);
      const offending = recentProjectMRs.find(
        (mr) =>
          linkMRToTask(mr, keySet) !== null &&
          (mr.milestone == null || mr.milestone.id !== matchedMilestone.id),
      );
      if (offending) wrongMilestoneByKey.set(r.issue.key, offending);
    }
  }
  return wrongMilestoneByKey;
}

/**
 * Aggregate unique labels across all release MRs with counts, sorted by count
 * descending then alphabetically by label name to break ties.
 *
 * @param releaseMrs - GitLab MRs carrying the matched milestone
 * @returns label + count pairs, sorted count-desc then name-asc
 */
export function computeLabelSummary(
  releaseMrs: GitLabMR[],
): Array<{ label: { name: string; color: string; text_color: string }; count: number }> {
  const labelMap = new Map<
    string,
    { label: { name: string; color: string; text_color: string }; count: number }
  >();
  for (const mr of releaseMrs) {
    for (const label of mr.labels) {
      const existing = labelMap.get(label.name);
      if (existing) {
        existing.count += 1;
      } else {
        labelMap.set(label.name, { label, count: 1 });
      }
    }
  }
  return Array.from(labelMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.label.name.localeCompare(b.label.name);
  });
}

export interface LabelCoverage {
  total: number;
  labeled: number;
  unlabeled: GitLabMR[];
  allLabeled: boolean;
}

/**
 * Compute label coverage stats: how many MRs have at least one label.
 *
 * @param releaseMrs - GitLab MRs carrying the matched milestone
 * @returns coverage stats, or `null` when there are no release MRs
 */
export function computeLabelCoverage(releaseMrs: GitLabMR[]): LabelCoverage | null {
  if (releaseMrs.length === 0) return null;
  const unlabeled = releaseMrs.filter((mr) => mr.labels.length === 0);
  return {
    total: releaseMrs.length,
    labeled: releaseMrs.length - unlabeled.length,
    unlabeled,
    allLabeled: unlabeled.length === 0,
  };
}

/**
 * MR state distribution — count merged / opened, folding everything else
 * (closed, locked) into "closed" so the math stays exhaustive without a switch.
 *
 * @param releaseMrs - GitLab MRs carrying the matched milestone
 * @returns counts of merged / opened / closed
 */
export function computeMrStateCounts(releaseMrs: GitLabMR[]): {
  merged: number;
  opened: number;
  closed: number;
} {
  let merged = 0;
  let opened = 0;
  let closed = 0;
  for (const mr of releaseMrs) {
    if (mr.state === 'merged') merged += 1;
    else if (mr.state === 'opened') opened += 1;
    else closed += 1;
  }
  return { merged, opened, closed };
}

/**
 * Issue status distribution from statusCategory.key. Bucket exhaustively so an
 * out-of-union runtime key falls back to 'new' instead of producing NaN.
 *
 * @param releaseIssues - Jira issues in the fix version
 * @returns counts of new / indeterminate / done
 */
export function computeIssueStatusCounts(releaseIssues: JiraIssue[]): {
  new: number;
  indeterminate: number;
  done: number;
} {
  const counts = { new: 0, indeterminate: 0, done: 0 };
  for (const issue of releaseIssues) {
    const key = issue.fields.status.statusCategory?.key;
    if (key === 'done') counts.done += 1;
    else if (key === 'indeterminate') counts.indeterminate += 1;
    else counts.new += 1;
  }
  return counts;
}

/**
 * Read an issue's story-point value for the instance-resolved field key,
 * guarded against non-number values.
 *
 * @param issue - a Jira issue
 * @param storyPointsFieldKey - the instance-resolved story-point custom field key
 * @returns the numeric story-point value, or `null` if absent/non-numeric
 */
export function issueStoryPoints(issue: JiraIssue, storyPointsFieldKey: string): number | null {
  const sp = issue.fields[storyPointsFieldKey] as number | null | undefined;
  return typeof sp === 'number' ? sp : null;
}

/**
 * Story-point effort: sum the instance-resolved story-point field (guarded
 * against null) for total and for done-category issues.
 *
 * @param releaseIssues - Jira issues in the fix version
 * @param storyPointsFieldKey - the instance-resolved story-point custom field key
 * @returns total and completed story-point sums
 */
export function computeStoryPoints(
  releaseIssues: JiraIssue[],
  storyPointsFieldKey: string,
): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  for (const issue of releaseIssues) {
    const sp = issueStoryPoints(issue, storyPointsFieldKey);
    if (sp !== null) {
      total += sp;
      if (issue.fields.status.statusCategory?.key === 'done') completed += sp;
    }
  }
  return { total, completed };
}

/**
 * Gates graceful hiding of the effort line — true only when at least one
 * issue has a story-point value greater than zero (a `0` does NOT count).
 *
 * @param releaseIssues - Jira issues in the fix version
 * @param storyPointsFieldKey - the instance-resolved story-point custom field key
 * @returns whether the release has any positive story-point value
 */
export function computeHasStoryPoints(
  releaseIssues: JiraIssue[],
  storyPointsFieldKey: string,
): boolean {
  return releaseIssues.some((i) => {
    const sp = issueStoryPoints(i, storyPointsFieldKey);
    return sp !== null && sp > 0;
  });
}
