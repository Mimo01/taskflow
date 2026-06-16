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
 * My Day band enumeration, ordered by urgency (lowest index = highest attention).
 *
 * D-04 band order: flagged/blocked → overdue → in-review-with-my-MR → in-progress → to-do → done
 */
export const MY_DAY_BANDS = [
  'flagged-blocked', // 0 — flagged OR status name contains "block" (case-insensitive)
  'overdue', // 1 — duedate < today AND statusCategory !== 'done'
  'in-review-my-mr', // 2 — status name contains "review" AND issue has my linked open MR
  'in-progress', // 3 — statusCategory === 'indeterminate' (not review)
  'to-do', // 4 — statusCategory === 'new'
  'done', // 5 — statusCategory === 'done'
] as const;

export type MyDayBand = (typeof MY_DAY_BANDS)[number];

/**
 * Classify a single issue into a band index (0–5).
 *
 * Lower index = higher attention. The check order is intentional:
 * done → flagged/blocked → overdue → in-review-my-mr → in-progress → to-do
 */
export function classifyBand(
  issue: JiraIssue,
  flaggedFieldKey: string,
  myOpenMRIssueKeys: Set<string>,
  today: Date = new Date(),
): number {
  const category = issue.fields.status.statusCategory?.key;
  const statusName = issue.fields.status.name.toLowerCase();

  // Band 0: flagged or blocked (checked before done — flagged always wins per D-04 must_haves)
  const flagged = isIssueFlagged(issue, flaggedFieldKey);
  if (flagged || statusName.includes('block')) return 0;

  // Band 5: done
  if (category === 'done') return 5;

  // Band 1: overdue (duedate in past, not done)
  const duedate = issue.fields.duedate as string | null | undefined;
  if (duedate) {
    const due = new Date(duedate);
    due.setHours(23, 59, 59, 999);
    if (due < today) return 1;
  }

  // Band 2: in-review with my open MR
  if (statusName.includes('review') && myOpenMRIssueKeys.has(issue.key)) return 2;

  // Band 3: in-progress (indeterminate but not caught by review+MR above)
  if (category === 'indeterminate') return 3;

  // Band 4: to-do (statusCategory 'new', or anything unmatched)
  return 4;
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
  // Math.min with spread on empty array returns Infinity; cap at 5 (done)
  return Math.min(parentBand, ...subtaskBands, 5);
}

/**
 * Group issues into My Day bands, sorted by urgency ascending.
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
    const bandIndex = subtreeBand(parent, subtasks, flaggedFieldKey, myOpenMRIssueKeys, today);
    return { parent, subtasks, bandIndex };
  });

  // Sort by band index ascending (stable — preserves server rank within a band)
  bandedParents.sort((a, b) => a.bandIndex - b.bandIndex);

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
