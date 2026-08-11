/**
 * Post-release merge-back verdict resolution — pure precedence resolver and
 * date formatters for the release detail sidebar's "Merged back" row.
 *
 * React-free: every function here takes explicit parameters and returns
 * plain data — no closures over component state, no hooks, no store reads,
 * no `@/services/*` value imports (only a `import type` is used). This
 * module exists so `useReleaseDetail.ts` and `ReleaseDetailSidebar.tsx` can
 * call these as ordinary functions and so the full case matrix is
 * unit-testable in isolation (see `mergeBackVerification.test.ts`).
 *
 * Modeled 1:1 on `releaseBranch.ts`'s `BranchState`/`resolveBranchState`
 * discriminated-union + strict-precedence pattern (P87 D-09, 91 D-14).
 *
 * Load-bearing rules keyed to 91-CONTEXT.md's decisions (do not "fix" back
 * toward a more naive reading — these are deliberate):
 * - D-01: tag absence is NEVER evidence a release did not ship; no tag AND
 *   no merged MR resolves to `couldnt-verify`, never a negative verdict.
 * - D-02: a tracking MR's `state === 'merged'` is the ONLY positive MR
 *   signal — every other state (closed, opened, locked) defers to content
 *   comparison rather than being read as negative evidence.
 * - D-04: comparison is diff-based (`diffCount === 0`), never commit-count
 *   based, and a compare timeout resolves to `couldnt-verify` — GitLab
 *   documents `diffs` as possibly INCOMPLETE under timeout, so an
 *   incomplete diff must never be read as "no diff".
 * - D-09/D-11: `hidden` covers "cannot be attempted" (not released, or no
 *   matched milestone); `loading` is additive to D-09's four terminal
 *   outcomes, not a fifth verdict kind.
 */

import type { GitLabMR } from '@/services/gitlab';

/** Structural narrowing of `GitLabMR` — this module never depends on fields
 *  the verdict does not read. */
export type TrackingMR = Pick<GitLabMR, 'iid' | 'state' | 'web_url'> & {
  merged_at?: string | null;
};

/** Structurally compatible with `services/gitlab.ts`'s eventual
 *  `repository/compare` result shape by design, declared locally so this
 *  module stays service-free (no service-value import). */
export interface MergeBackCompareInput {
  diffCount: number;
  commitCount: number;
  timedOut: boolean;
}

/**
 * Discriminated union describing the merge-back verdict for a released
 * version, evaluated in strict precedence order by `resolveMergeBackVerdict`.
 *
 * P-01 (closes 91-RESEARCH Open Question 2): the `loading` kind is ADDITIVE
 * to D-09's four outcomes, not a deviation — D-09 enumerates the
 * terminal/visible outcomes, `hidden` covers "cannot be attempted", and
 * 91-UI-SPEC §Interaction Contract explicitly requires a loading treatment
 * matching `branchState.kind === 'loading'`. `BranchState` carries its own
 * `loading` kind for the same reason.
 *
 * P-02 (closes 91-RESEARCH Open Question 1): the `merged` kind carries a
 * `via` discriminant because D-10 only specifies the MR-sourced tooltip.
 * Content-compare-derived `merged` keeps the same icon, colour, and
 * main-line shape but has no MR and no merge date, so it gets its own
 * tooltip wording (authored in Plan 03) rather than an invented MR
 * reference or a tag-creation date masquerading as a merge date.
 */
export type MergeBackVerdict =
  | { kind: 'hidden' }
  | { kind: 'loading' }
  | {
      kind: 'couldnt-verify';
      reason: 'no-mr-no-tag' | 'check-failed';
      expectedTagName: string | null;
    }
  | {
      kind: 'merged';
      via: 'tracking-mr';
      defaultBranch: string;
      mrIid: number;
      mrUrl: string;
      mergedAt: string | null;
    }
  | { kind: 'merged'; via: 'content-compare'; defaultBranch: string; tagName: string }
  | {
      kind: 'likely-not-merged';
      defaultBranch: string;
      tagName: string;
      commitsNotInDefault: number;
    };

/**
 * Resolve the merge-back verdict from the release's released/milestone
 * state, the tracking-MR lookup, and the content-comparison fallback,
 * applying the eleven-step D-01/D-02/D-04/D-09/D-10/D-11 precedence order.
 *
 * All parameters are plain data (never live query objects), mirroring
 * `resolveBranchState`'s named-param style.
 *
 * @returns the resolved `MergeBackVerdict`
 */
export function resolveMergeBackVerdict(params: {
  releasedVersion: boolean;
  hasMatchedMilestone: boolean;
  defaultBranch: string | null;
  trackingMRs: readonly TrackingMR[] | undefined;
  trackingMRsCheckFailed: boolean;
  tagName: string | null;
  expectedTagName: string | null;
  compareResult: MergeBackCompareInput | undefined;
  compareCheckFailed: boolean;
}): MergeBackVerdict {
  const {
    releasedVersion,
    hasMatchedMilestone,
    defaultBranch,
    trackingMRs,
    trackingMRsCheckFailed,
    tagName,
    expectedTagName,
    compareResult,
    compareCheckFailed,
  } = params;

  // Step 1 (D-11): no dead `—` row — hide entirely when the check cannot be
  // attempted at all.
  if (!releasedVersion || !hasMatchedMilestone) {
    return { kind: 'hidden' };
  }

  // Step 2 (planner call P-05): every visible verdict's copy names the
  // fetched default branch per D-10, so rendering before the project query
  // resolves would print an empty branch name; this is honestly "still
  // loading", not a verdict.
  if (defaultBranch === null) {
    return { kind: 'loading' };
  }

  // Step 3: tracking-MR query still in flight (undefined and no error yet).
  if (trackingMRs === undefined && !trackingMRsCheckFailed) {
    return { kind: 'loading' };
  }

  // Step 4 (D-02): `merged` is the ONLY positive MR signal; every other
  // state defers to content comparison.
  const mergedMR = trackingMRs?.find((mr) => mr.state === 'merged');
  if (mergedMR) {
    return {
      kind: 'merged',
      via: 'tracking-mr',
      defaultBranch,
      mrIid: mergedMR.iid,
      mrUrl: mergedMR.web_url,
      mergedAt: mergedMR.merged_at ?? null,
    };
  }

  // Step 5 (D-01): tag absence is NEVER evidence a release did not ship;
  // Phase 88 established tags are an incomplete record.
  if (tagName === null) {
    return {
      kind: 'couldnt-verify',
      reason: trackingMRsCheckFailed ? 'check-failed' : 'no-mr-no-tag',
      expectedTagName,
    };
  }

  // Step 6: compare query still in flight.
  if (compareResult === undefined && !compareCheckFailed) {
    return { kind: 'loading' };
  }

  // Step 7: compare query errored.
  if (compareCheckFailed) {
    return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
  }

  // Step 8 (D-04): GitLab documents `diffs` as possibly INCOMPLETE under
  // timeout, and an incomplete diff must never be read as "no diff".
  if (compareResult?.timedOut) {
    return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
  }

  // Step 9 (D-04): diff-based, NOT commit-count-based, and never
  // `compare_same_ref`; correct under all three merge methods even though
  // D-03 confirms merge commits today.
  if (compareResult?.diffCount === 0) {
    return { kind: 'merged', via: 'content-compare', defaultBranch, tagName };
  }

  // Step 10 (planner call P-04): a non-empty diff plus an unknown MR
  // channel is not enough to put "Likely not merged" on a release — one
  // channel failed, so the app admits the gap per D-09's principle.
  if (trackingMRsCheckFailed) {
    return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
  }

  // Step 11: otherwise, both channels are healthy and the diff is non-empty.
  return {
    kind: 'likely-not-merged',
    defaultBranch,
    tagName,
    commitsNotInDefault: compareResult ? compareResult.commitCount : 0,
  };
}

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function parseValidDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format an ISO timestamp as `'21 Jul'` — day-of-month without zero
 * padding, space, three-letter English month. Built from
 * `Date.prototype.getUTCDate/getUTCMonth` against `MONTHS_SHORT` — NEVER
 * `toLocaleDateString`, which is locale-dependent and unstable across
 * machines (see `src/lib/standup-date.ts` L7).
 *
 * @returns `null` for `null`, `undefined`, `''`, or an invalid date
 */
export function formatVerdictDate(iso: string | null | undefined): string | null {
  const date = parseValidDate(iso);
  if (!date) return null;
  return `${date.getUTCDate()} ${MONTHS_SHORT[date.getUTCMonth()]}`;
}

/**
 * Format an ISO timestamp as `'21.07.2026'` — zero-padded `DD.MM.YYYY`.
 * Built from `Date.prototype.getUTCDate/getUTCMonth/getUTCFullYear` — NEVER
 * `toLocaleDateString`.
 *
 * @returns `null` for `null`, `undefined`, `''`, or an invalid date
 */
export function formatEvidenceDate(iso: string | null | undefined): string | null {
  const date = parseValidDate(iso);
  if (!date) return null;
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}.${month}.${year}`;
}
