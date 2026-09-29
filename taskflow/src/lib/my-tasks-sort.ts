/**
 * my-tasks-sort — Pure sort/classify functions for the My Tasks page My Day view.
 *
 * All functions are side-effect-free and accept `today: Date` for testability.
 * No imports from react, react-query, or any store — pure data transforms.
 *
 * Implements:
 *   MYTASK-04 — My Day smart-sort: a parent floats to the rank of its most-urgent child (D-04)
 *   MYTASK-02 — Summary strip count derivation from the loaded dataset
 */

import type { JiraIssue } from '@/services/jira';
import { isIssueFlagged } from '@/services/jira';

/**
 * My Day band enumeration, in CLASSIFICATION PRECEDENCE order (lowest index wins
 * in the subtree-min). This is NOT the display order; see MY_DAY_BAND_DISPLAY_ORDER.
 *
 * Precedence: flagged/blocked → overdue → in-review-with-my-MR → in-review-my-subtasks
 * → testing → in-progress → to-do → done
 */
export const MY_DAY_BANDS = [
  'flagged-blocked', // 0 — flagged OR status name contains "block" (case-insensitive)
  'overdue', // 1 — duedate < today AND statusCategory !== 'done'
  'in-review-my-mr', // 2 — status name contains "review" AND issue has my linked open MR
  'in-review-my-subtasks', // 3 — parent in review, not mine, with >=1 of my subtasks (computed in groupByMyDay, never by classifyBand)
  'testing', // 4 — status name contains "test" (case-insensitive)
  'in-progress', // 5 — statusCategory === 'indeterminate' (not review/testing)
  'to-do', // 6 — statusCategory === 'new'
  'done', // 7 — statusCategory === 'done'
] as const;

export type MyDayBand = (typeof MY_DAY_BANDS)[number];

/**
 * Order bands are rendered in (real workflow order). Decoupled from the
 * precedence order of MY_DAY_BANDS. Must be a permutation of MY_DAY_BANDS.
 */
export const MY_DAY_BAND_DISPLAY_ORDER: readonly MyDayBand[] = [
  'flagged-blocked',
  'overdue',
  'in-progress',
  'in-review-my-mr',
  'in-review-my-subtasks',
  'testing',
  'to-do',
  'done',
];

const DISPLAY_RANK = new Map<MyDayBand, number>(
  MY_DAY_BAND_DISPLAY_ORDER.map((band, i) => [band, i]),
);

const FLAGGED_BAND = MY_DAY_BANDS.indexOf('flagged-blocked');
const OVERDUE_BAND = MY_DAY_BANDS.indexOf('overdue');
const IN_REVIEW_MY_MR_BAND = MY_DAY_BANDS.indexOf('in-review-my-mr');
export const IN_REVIEW_MY_SUBTASKS_BAND = MY_DAY_BANDS.indexOf('in-review-my-subtasks');
const TESTING_BAND = MY_DAY_BANDS.indexOf('testing');
const IN_PROGRESS_BAND = MY_DAY_BANDS.indexOf('in-progress');
const TO_DO_BAND = MY_DAY_BANDS.indexOf('to-do');
export const DONE_BAND = MY_DAY_BANDS.indexOf('done');

/**
 * Classify a single issue into a band index (0–7, index into MY_DAY_BANDS).
 *
 * Lower index = higher precedence. The check order is intentional:
 * flagged/blocked → done → overdue → in-review-my-mr → testing → in-progress → to-do
 * (band 3, in-review-my-subtasks, is never returned here; only via the groupByMyDay lift).
 * Testing: any status name containing "test" (not gated on statusCategory).
 */
export function classifyBand(
  issue: JiraIssue,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number {
  const category = issue.fields.status.statusCategory?.key;
  const statusName = issue.fields.status.name.toLowerCase();

  // flagged or blocked (checked before done — flagged always wins per D-04 must_haves)
  const flagged = isIssueFlagged(issue, flaggedFieldKey);
  if (flagged || statusName.includes('block')) return FLAGGED_BAND;

  if (category === 'done') return DONE_BAND;

  // overdue (duedate in past, not done)
  const duedate = issue.fields.duedate as string | null | undefined;
  if (duedate) {
    const due = new Date(duedate);
    due.setHours(23, 59, 59, 999);
    if (due < today) return OVERDUE_BAND;
  }

  // in-review with my open MR
  if (statusName.includes('review') && myOpenMRIssueKeys.has(issue.key)) {
    return IN_REVIEW_MY_MR_BAND;
  }

  // testing (status name contains "test")
  if (statusName.includes('test')) return TESTING_BAND;

  // in-progress (indeterminate but not caught above)
  if (category === 'indeterminate') return IN_PROGRESS_BAND;

  // to-do (statusCategory 'new', or anything unmatched)
  return TO_DO_BAND;
}

/**
 * Compute the subtree sort band for a parent and all its subtasks.
 *
 * D-04: a parent floats to the rank of its most-urgent child.
 * The sort key is min(bandIndex of parent, min(bandIndex of each subtask)).
 */
export function subtreeBand(
  parent: JiraIssue,
  subtasks: JiraIssue[],
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number {
  const parentBand = classifyBand(parent, flaggedFieldKey, myOpenMRIssueKeys, today);
  const subtaskBands = subtasks.map((s) =>
    classifyBand(s, flaggedFieldKey, myOpenMRIssueKeys, today),
  );
  // Math.min with spread on empty array returns Infinity; cap at done
  return Math.min(parentBand, ...subtaskBands, DONE_BAND);
}

/**
 * True when the parent is a non-subtask story in review that is NOT mine but has
 * at least one subtask of mine. Ownership/status only; band precedence is handled
 * by the caller (groupByMyDay).
 */
export function isForeignReviewWithMySubtask(
  parent: JiraIssue,
  subtasks: JiraIssue[],
  myIssueKeys: Set<string>,
): boolean {
  if (parent.fields.issuetype?.subtask) return false;
  if (myIssueKeys.has(parent.key)) return false;
  if (!parent.fields.status.name.toLowerCase().includes('review')) return false;
  return subtasks.some((s) => myIssueKeys.has(s.key));
}

/**
 * Group issues into My Day bands, sorted by MY_DAY_BAND_DISPLAY_ORDER (display order),
 * which is decoupled from classification precedence.
 *
 * Only parents that belong to the current user (or whose subtasks belong to the user)
 * are included. Subtasks are attached to their parent entry. Consecutive parents in
 * the same band are merged into a single group entry.
 */
export function groupByMyDay(
  issues: JiraIssue[],
  myIssueKeys: Set<string>,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): Array<{ band: MyDayBand; parents: Array<{ parent: JiraIssue; subtasks: JiraIssue[] }> }> {
  // Pass 1: separate subtasks from parents, group subtasks by parent key
  const subtasksByParent = new Map<string, JiraIssue[]>();
  const parentIssues: JiraIssue[] = [];

  for (const issue of issues) {
    if (issue.fields.issuetype?.subtask) {
      const parentKey = issue.fields.parent?.key;
      if (parentKey) {
        const arr = subtasksByParent.get(parentKey) ?? [];
        arr.push(issue);
        subtasksByParent.set(parentKey, arr);
      }
    } else {
      parentIssues.push(issue);
    }
  }

  // Pass 2: filter to parents that belong to me or have my subtasks
  const eligibleParents: JiraIssue[] = [];
  for (const parent of parentIssues) {
    const mySubtasks = (subtasksByParent.get(parent.key) ?? []).filter((s) =>
      myIssueKeys.has(s.key),
    );
    if (myIssueKeys.has(parent.key) || mySubtasks.length > 0) {
      eligibleParents.push(parent);
    }
  }

  // Pass 3: compute subtree band for each eligible parent
  const bandedParents = eligibleParents.map((parent) => {
    const subtasks = subtasksByParent.get(parent.key) ?? [];
    let bandIndex = subtreeBand(parent, subtasks, flaggedFieldKey, myOpenMRIssueKeys, today);
    if (isForeignReviewWithMySubtask(parent, subtasks, myIssueKeys)) {
      const parentBand = classifyBand(parent, flaggedFieldKey, myOpenMRIssueKeys, today);
      // Done parents (e.g. "Reviewed") stay Done; bands 0-2 win via min.
      if (parentBand > IN_REVIEW_MY_SUBTASKS_BAND && parentBand !== DONE_BAND) {
        bandIndex = Math.min(bandIndex, IN_REVIEW_MY_SUBTASKS_BAND);
      }
    }
    return { parent, subtasks, bandIndex };
  });

  // Sort by display rank (stable — preserves server rank within a band)
  const displayRank = (bandIndex: number) => DISPLAY_RANK.get(MY_DAY_BANDS[bandIndex]) ?? bandIndex;
  bandedParents.sort((a, b) => displayRank(a.bandIndex) - displayRank(b.bandIndex));

  // Pass 4: group consecutive same-band entries
  const result: Array<{
    band: MyDayBand;
    parents: Array<{ parent: JiraIssue; subtasks: JiraIssue[] }>;
  }> = [];

  for (const bp of bandedParents) {
    const band = MY_DAY_BANDS[bp.bandIndex];
    const last = result[result.length - 1];
    if (last && last.band === band) {
      last.parents.push({ parent: bp.parent, subtasks: bp.subtasks });
    } else {
      result.push({ band, parents: [{ parent: bp.parent, subtasks: bp.subtasks }] });
    }
  }

  return result;
}
