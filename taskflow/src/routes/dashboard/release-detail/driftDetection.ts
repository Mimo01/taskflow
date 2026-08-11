/**
 * Drift detection — pure three-channel MR discovery/reconciliation for the
 * release detail page.
 *
 * React-free: every function here takes explicit parameters and returns plain
 * data — no closures over component state, no hooks, no store reads. This
 * module exists so `useReleaseDetail.ts` (and the new MR-drift section) can
 * call these as ordinary functions and so they are unit-testable in isolation
 * (see `driftDetection.test.ts`).
 *
 * Three overrides load-bearing for this module — do not "fix" them back
 * toward the literal requirement text (see 89-CONTEXT.md):
 * - D-10 (supersedes DRIFT-08's literal reading): merged/closed/locked MRs
 *   are muted — all three columns render `na` and no predicate is called.
 *   Draft MRs ARE evaluated and counted: GitLab's `state` for a draft MR is
 *   still `'opened'`, so the single `mr.state === 'opened'` gate already
 *   covers open+draft without a separate check of the `draft` field. Adding
 *   such a guard to the evaluation gate would silently revert D-10 to
 *   DRIFT-08's literal text — do not do this.
 * - D-11 (supersedes the natural reading of DRIFT-07): an MR with no
 *   parseable Jira key IS flagged in the TASK column — this is an enforced
 *   convention, not an oversight, and the resulting drift count carries a
 *   permanent floor of untraceable MRs with no corrective action in this or
 *   any planned phase.
 * - D-12: the TASK predicate is two-part and the two reasons are
 *   distinguishable (`'no-linked-task'` vs `'not-in-fix-version'`) so the UI
 *   tooltip can explain which case applies — do not collapse to a boolean.
 */

import type { GitLabMR } from '@/services/gitlab';
import type { JiraIssue } from '@/services/jira';
import { extractTicketKeys, linkMRToTask } from '@/services/linkEngine';
import { matchIssuesToMRs } from './releaseSummaries';

/** The three discovery channels (DRIFT-01/02/03). */
export type Channel = 'A' | 'B' | 'C';

/** Drift column render state (D-07): `ok` = check glyph, `flag` = warning glyph, `na` = em dash. */
export type DriftMark = 'ok' | 'flag' | 'na';

/** D-12 — the TASK predicate is two-part; `null` means no drift. */
export type TaskDriftReason = 'no-linked-task' | 'not-in-fix-version' | null;

/** One row of the MR-drift list — a union entry plus its evaluated drift state. */
export interface DriftRow {
  mr: GitLabMR;
  channels: Set<Channel>;
  evaluated: boolean;
  br: DriftMark;
  ms: DriftMark;
  task: DriftMark;
  taskReason: TaskDriftReason;
  /** Keys extracted from title + source_branch — shared with the UI tooltip so it never re-derives them. */
  taskKeys: string[];
  /** True when any of br/ms/task is 'flag' (D-13's per-row unit of count). */
  flagged: boolean;
}

/**
 * Union three MR arrays into one map keyed by the MR's stable numeric `id`
 * (DRIFT-04). `id` is the GitLab-global identifier; `iid` is only unique
 * per-project, so two distinct MRs (even in different projects/forks) could
 * share an `iid` — keying by `id` avoids that collision.
 *
 * Preserves the FIRST-seen `mr` object for a duplicate id — Channel A is
 * added first, so it "wins" when the same MR is discovered by more than one
 * channel — and never mutates the input arrays.
 *
 * @param channelA - MRs discovered via Jira-key linkage (DRIFT-01)
 * @param channelB - MRs discovered via the GitLab milestone (DRIFT-02)
 * @param channelC - MRs discovered via the release branch target (DRIFT-03)
 * @returns Map of MR id -> { mr, channels } with per-MR channel provenance
 */
export function unionMRs(
  channelA: GitLabMR[],
  channelB: GitLabMR[],
  channelC: GitLabMR[],
): Map<number, { mr: GitLabMR; channels: Set<Channel> }> {
  const union = new Map<number, { mr: GitLabMR; channels: Set<Channel> }>();
  const add = (mrs: GitLabMR[], channel: Channel) => {
    for (const mr of mrs) {
      const existing = union.get(mr.id);
      if (existing) {
        existing.channels.add(channel);
      } else {
        union.set(mr.id, { mr, channels: new Set([channel]) });
      }
    }
  };
  add(channelA, 'A');
  add(channelB, 'B');
  add(channelC, 'C');
  return union;
}

/**
 * Channel A (DRIFT-01): select the project-wide MR universe down to those
 * that link to one of the fix version's issue keys via `linkMRToTask`
 * (title-first, source-branch fallback). This is the DISCOVERY question
 * ("does at least one key on this MR belong to this release?") — it is
 * deliberately different from `evaluateTaskDrift`'s ANY-match question over
 * ALL extracted keys; do not merge the two.
 *
 * @param allProjectMRs - the project's full MR universe (fully paginated, all states)
 * @param fixVersionIssueKeys - Jira issue keys in the release's fix version
 * @returns the subset of `allProjectMRs` that link to at least one key
 */
export function selectChannelA(
  allProjectMRs: GitLabMR[],
  fixVersionIssueKeys: Set<string>,
): GitLabMR[] {
  return allProjectMRs.filter((mr) => linkMRToTask(mr, fixVersionIssueKeys) !== null);
}

/**
 * BR predicate (DRIFT-05): the MR's target branch does not match the
 * release branch. Returns `false` (not a flag) when `releaseBranchName` is
 * null — that is the D-18 degraded state, rendered as `na` upstream by
 * `buildDriftRows`, not evaluated as a real drift condition.
 *
 * @param mr - the MR to evaluate
 * @param releaseBranchName - the derived release branch name, or null (D-18)
 * @returns true when the MR's target branch drifts from the release branch
 */
export function evaluateBranchDrift(mr: GitLabMR, releaseBranchName: string | null): boolean {
  if (releaseBranchName === null) return false; // D-18 degraded state
  return mr.target_branch !== releaseBranchName;
}

/**
 * MS predicate (DRIFT-06): the MR's milestone is absent or does not match
 * the release's matched milestone. Takes the id as a number, not the
 * milestone object, so a caller cannot pass a `GitLabMilestone` and reach
 * for fields the MR-embedded milestone doesn't carry — `GitLabMR['milestone']`
 * is the narrow `{ id, title } | null` shape, not the full `GitLabMilestone`
 * interface (Pitfall 1).
 *
 * @param mr - the MR to evaluate
 * @param matchedMilestoneId - the release's matched GitLab milestone id, or null (D-18)
 * @returns true when the MR's milestone drifts from the release's milestone
 */
export function evaluateMilestoneDrift(mr: GitLabMR, matchedMilestoneId: number | null): boolean {
  if (matchedMilestoneId === null) return false; // D-18 degraded state
  return mr.milestone === null || mr.milestone.id !== matchedMilestoneId;
}

/**
 * Extract the combined title + source_branch Jira key list for an MR — the
 * single source of truth shared by `evaluateTaskDrift` and the UI tooltip
 * (Task 3's `buildDriftRows`) so neither re-derives it independently.
 *
 * @param mr - the MR to extract keys from
 * @returns deduplicated keys from title then source_branch, in that order
 */
export function extractMrTaskKeys(mr: GitLabMR): string[] {
  return [...extractTicketKeys(mr.title), ...extractTicketKeys(mr.source_branch)];
}

/**
 * TASK predicate (DRIFT-07, D-11/D-12): two-part — an MR fails when it has
 * no extractable Jira key at all (D-11: an enforced convention, not an
 * oversight) OR when every extracted key is absent from the fix version's
 * issue set. Checks ALL extracted keys, not just the first — contrast with
 * `linkMRToTask`'s first-match discovery semantics (see `selectChannelA`).
 *
 * @param mr - the MR to evaluate
 * @param fixVersionIssueKeys - Jira issue keys in the release's fix version
 * @returns the drift reason, or null when at least one key is in the fix version
 */
export function evaluateTaskDrift(mr: GitLabMR, fixVersionIssueKeys: Set<string>): TaskDriftReason {
  const keys = extractMrTaskKeys(mr);
  if (keys.length === 0) return 'no-linked-task'; // D-11
  const matched = keys.some((k) => fixVersionIssueKeys.has(k));
  return matched ? null : 'not-in-fix-version'; // D-12
}

/**
 * State classification gate (D-10): an MR is evaluated when — and only
 * when — its GitLab `state` is `'opened'`. This single check covers BOTH
 * open and draft MRs, since GitLab never reports a separate `'draft'` state
 * value (a draft MR's `state` remains `'opened'`; `draft` is an independent
 * boolean field). `'merged'`, `'closed'` and `'locked'` (a transient
 * merge-in-progress state, grouped with muted per RESEARCH Pitfall 3 — it is
 * not actionable) all fall through as muted.
 *
 * D-10 WARNING: do not add a guard on the `draft` field to this gate. Doing
 * so would silently revert D-10 back to DRIFT-08's literal text (draft excluded).
 *
 * @param mr - the MR to classify
 * @returns true when the MR should be evaluated by the drift predicates
 */
export function classifyMrState(mr: GitLabMR): boolean {
  return mr.state === 'opened';
}

/**
 * Build the deterministically-ordered drift row list (DRIFT-04/05/06/07,
 * D-03, D-10, D-18).
 *
 * For MRs not evaluated (merged/closed/locked), all three columns render
 * `na`, `taskReason` is null, `flagged` is false, and NO predicate is
 * called (D-10 — gate the calls, do not call-and-discard).
 *
 * For evaluated MRs: `br`/`ms` render `na` when `releaseBranchName`/
 * `matchedMilestoneId` is null (D-18 degraded state), else `flag`/`ok` from
 * the respective predicate. `task` always evaluates (it needs no
 * milestone/branch) and is `ok` when `taskReason` is null, else `flag`.
 *
 * Rows are sorted flagged-first, then by `mr.iid` descending within each
 * partition (D-03 + UI-SPEC Layout Contract) — a deterministic comparator,
 * proven order-independent of input array order by test.
 *
 * @param input - the three channel arrays plus the release's resolved branch/milestone/fix-version-key context
 * @returns the assembled, sorted drift rows
 */
export function buildDriftRows(input: {
  channelA: GitLabMR[];
  channelB: GitLabMR[];
  channelC: GitLabMR[];
  releaseBranchName: string | null;
  matchedMilestoneId: number | null;
  fixVersionIssueKeys: Set<string>;
}): DriftRow[] {
  const {
    channelA,
    channelB,
    channelC,
    releaseBranchName,
    matchedMilestoneId,
    fixVersionIssueKeys,
  } = input;
  const union = unionMRs(channelA, channelB, channelC);

  const rows: DriftRow[] = [];
  for (const { mr, channels } of union.values()) {
    const evaluated = classifyMrState(mr);
    const taskKeys = extractMrTaskKeys(mr);

    if (!evaluated) {
      rows.push({
        mr,
        channels,
        evaluated: false,
        br: 'na',
        ms: 'na',
        task: 'na',
        taskReason: null,
        taskKeys,
        flagged: false,
      });
      continue;
    }

    const br: DriftMark =
      releaseBranchName === null
        ? 'na'
        : evaluateBranchDrift(mr, releaseBranchName)
          ? 'flag'
          : 'ok';
    const ms: DriftMark =
      matchedMilestoneId === null
        ? 'na'
        : evaluateMilestoneDrift(mr, matchedMilestoneId)
          ? 'flag'
          : 'ok';
    const taskReason = evaluateTaskDrift(mr, fixVersionIssueKeys);
    const task: DriftMark = taskReason === null ? 'ok' : 'flag';
    const flagged = br === 'flag' || ms === 'flag' || task === 'flag';

    rows.push({ mr, channels, evaluated: true, br, ms, task, taskReason, taskKeys, flagged });
  }

  // Deterministic comparator: flagged rows first, then mr.iid descending within each partition.
  rows.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    return b.mr.iid - a.mr.iid;
  });

  return rows;
}

/**
 * D-13: the aggregate drift count — the number of ROWS with at least one
 * flag, not the total number of flags across all rows. An MR flagged in all
 * three columns contributes 1, not 3, so the number always matches the
 * count of orange rows on screen.
 *
 * @param rows - drift rows from `buildDriftRows`
 * @returns count of flagged rows
 */
export function countFlaggedMRs(rows: DriftRow[]): number {
  return rows.filter((r) => r.flagged).length;
}

/**
 * D-05/D-06: re-source the Issues table's MR cell (`matchedRows` +
 * `wrongMilestoneByKey`) from the three-channel union instead of the old
 * capped-recent-MR-fetch plus wrong-milestone-map heuristic (both since
 * deleted). The two returned shapes are byte-identical to what
 * `IssuesSection` already consumes — this is a data-source swap, not a
 * redesign.
 *
 * `matchedRows` comes from the existing `matchIssuesToMRs` (reused, not
 * reimplemented) called against the subset of the union's MRs that carry
 * the release's matched milestone id (empty subset when that id is null).
 * For every row whose `mr` is still null, `wrongMilestoneByKey` records the
 * first union MR that links to the issue's key but carries a different or
 * absent milestone.
 *
 * @param union - the three-channel union map from `unionMRs`
 * @param releaseIssues - Jira issues in the release's fix version
 * @param matchedMilestoneId - the release's matched GitLab milestone id, or null
 * @returns matched rows (issue -> mr | null) and the wrong-milestone map
 */
export function buildIssueMrIndex(
  union: Map<number, { mr: GitLabMR; channels: Set<Channel> }>,
  releaseIssues: JiraIssue[],
  matchedMilestoneId: number | null,
): {
  matchedRows: Array<{ issue: JiraIssue; mr: GitLabMR | null }>;
  wrongMilestoneByKey: Map<string, GitLabMR>;
} {
  const unionList = Array.from(union.values()).map((entry) => entry.mr);

  const releaseMilestoneMrs =
    matchedMilestoneId === null
      ? []
      : unionList.filter((mr) => mr.milestone?.id === matchedMilestoneId);

  const { matchedRows } = matchIssuesToMRs(releaseIssues, releaseMilestoneMrs);

  const wrongMilestoneByKey = new Map<string, GitLabMR>();
  if (matchedMilestoneId !== null) {
    for (const row of matchedRows) {
      if (row.mr !== null) continue;
      const keySet = new Set([row.issue.key]);
      const offending = unionList.find(
        (mr) =>
          linkMRToTask(mr, keySet) !== null &&
          (mr.milestone == null || mr.milestone.id !== matchedMilestoneId),
      );
      if (offending) wrongMilestoneByKey.set(row.issue.key, offending);
    }
  }

  return { matchedRows, wrongMilestoneByKey };
}
