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
 * - CR-03/CR-04: a permanently disabled or errored evidence channel must
 *   never be reported as `loading` — that kind is reserved for genuinely
 *   in-flight queries. A channel that will never resolve (disabled query,
 *   failed fetch) must terminate at `couldnt-verify`.
 * - 91-VERIFICATION truth 5: EVERY evidence channel carries both an
 *   in-flight signal and a failure signal into this resolver. The tag
 *   channel was the fourth and last channel missing both — see the step 4.5
 *   guard below — this is the same defect class CR-03/CR-04 closed for the
 *   default-branch and tracking-MR channels; adding a fifth channel without
 *   both signals is the defect this phase closed four times.
 */

import type { GitLabMR } from '@/services/gitlab';

/** Structural narrowing of `GitLabMR` — this module never depends on fields
 *  the verdict does not read. */
export type TrackingMR = Pick<GitLabMR, 'iid' | 'state' | 'web_url' | 'target_branch'> & {
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
      /** WR-08: the BARE version that was searched for (e.g. `33.5.0`), NOT a
       *  `v`-prefixed spelling. `findReleaseTag` matches either form, so
       *  naming one of them in the UI copy would describe a lookup that did
       *  not happen. Renderers must present it as "with or without a leading
       *  v" rather than as a literal tag name. */
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
  defaultBranchCheckFailed: boolean;
  /** WR-04: the default-branch query is permanently disabled (no GitLab
   *  credentials), so `defaultBranch` will never arrive. Distinct from
   *  `defaultBranchCheckFailed` (the query ran and errored) for the same
   *  reason `trackingMRsUnavailable` is distinct from
   *  `trackingMRsCheckFailed`; both terminate at `couldnt-verify`. */
  defaultBranchUnavailable: boolean;
  trackingMRs: readonly TrackingMR[] | undefined;
  trackingMRsCheckFailed: boolean;
  trackingMRsUnavailable: boolean;
  tagName: string | null;
  tagLookupPending: boolean;
  tagCheckFailed: boolean;
  expectedTagName: string | null;
  compareResult: MergeBackCompareInput | undefined;
  compareCheckFailed: boolean;
}): MergeBackVerdict {
  // WR-06: every channel-health param is REQUIRED with no `= false` default.
  // The module header's invariant — EVERY evidence channel carries both an
  // in-flight signal and a failure signal into this resolver — is only
  // checkable in the type system, and optional-with-`false` permitted exactly
  // the omission the header forbids: a second call site (a releases-list
  // badge, a bulk report) would silently emit `no-mr-no-tag` for a genuine
  // check failure. An omission must now fail to compile.
  const {
    releasedVersion,
    hasMatchedMilestone,
    defaultBranch,
    defaultBranchCheckFailed,
    defaultBranchUnavailable,
    trackingMRs,
    trackingMRsCheckFailed,
    trackingMRsUnavailable,
    tagName,
    tagLookupPending,
    tagCheckFailed,
    expectedTagName,
    compareResult,
    compareCheckFailed,
  } = params;

  // Step 1 (D-11): no dead `—` row — hide entirely when the check cannot be
  // attempted at all.
  if (!releasedVersion || !hasMatchedMilestone) {
    return { kind: 'hidden' };
  }

  // Step 2 (planner call P-05, CR-04): every visible verdict's copy names
  // the fetched default branch per D-10, so rendering before the project
  // query resolves would print an empty branch name; this is honestly
  // "still loading", not a verdict — UNLESS the query has permanently
  // failed (`defaultBranchCheckFailed`), in which case `defaultBranch` will
  // never arrive and reporting `loading` forever would pin the row at
  // "Loading…" for a 500/timeout that already happened. Mirrors
  // `releaseBranch.ts`'s `branchCheckFailed` -> `check-failed` precedent.
  // WR-04 extends this guard to `defaultBranchUnavailable`: a query disabled
  // for want of credentials never runs, so it never errors either — without
  // this half the row reports `loading` forever, the same shape CR-04 fixed
  // for the errored case.
  if (defaultBranch === null) {
    if (defaultBranchCheckFailed || defaultBranchUnavailable) {
      return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
    }
    return { kind: 'loading' };
  }

  // Step 3 (CR-03): tracking-MR query still in flight (undefined and no
  // error yet) — but ONLY when the query is genuinely in flight. When
  // `trackingMRsUnavailable` is true (no release branch name is derivable
  // from the milestone title, so the query is disabled and will never run),
  // fall through instead: step 4 finds no evidence (trackingMRs stays
  // undefined) and step 5 resolves to `couldnt-verify` with
  // `reason: 'check-failed'` for the unparseable-title case (WR-09 — the
  // channel was never queried, so `no-mr-no-tag` would assert a negative it
  // never established) — the correct terminal answer, needing no new verdict
  // kind. Parallels
  // `releaseBranch.ts`'s `BranchState.kind === 'unresolvable'`.
  if (trackingMRs === undefined && !trackingMRsCheckFailed && !trackingMRsUnavailable) {
    return { kind: 'loading' };
  }

  // Step 4 (D-02, CR-01): `merged` is the ONLY positive MR signal; every
  // other state defers to content comparison. CR-01: a merged MR is only
  // evidence when it targeted the fetched default branch. In the standard
  // git-flow shape this feature exists to police, `release/X` is merged by
  // TWO MRs — one into `master`, one into `develop`. An unfiltered match
  // would report the release as merged back when only the `master` MR
  // landed — the exact false positive MERGE-01 exists to prevent. Strict
  // equality only: never a hardcoded `'main'`/`'develop'`, never `includes`,
  // never case-insensitive or prefix matching (git branch names are
  // case-sensitive, and `develop-old` must never satisfy `develop`).
  const mergedCandidates = trackingMRs?.filter(
    (mr) => mr.state === 'merged' && mr.target_branch === defaultBranch,
  );
  // WR-02: pick deterministically — highest `merged_at` first (treating
  // null/undefined/unparseable as lowest), tie-broken by highest `iid`.
  // Input arrives in GitLab's `created_at desc` default sort order, so
  // relying on array/find order would make the cited MR non-reproducible.
  const mergedMR = mergedCandidates?.reduce<TrackingMR | undefined>((best, candidate) => {
    if (!best) return candidate;
    const bestTime = Date.parse(best.merged_at ?? '');
    const candidateTime = Date.parse(candidate.merged_at ?? '');
    const bestMs = Number.isNaN(bestTime) ? -Infinity : bestTime;
    const candidateMs = Number.isNaN(candidateTime) ? -Infinity : candidateTime;
    if (candidateMs > bestMs) return candidate;
    if (candidateMs < bestMs) return best;
    return candidate.iid > best.iid ? candidate : best;
  }, undefined);
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

  // Step 4.5 (91-VERIFICATION truth 5): the tag channel's loading/failure
  // guard, symmetric with steps 2/3/6-7. MUST sit here — below step 4, above
  // step 5 — because a merged tracking MR targeting the default branch is
  // definitive positive evidence (D-02) and must still win even while the
  // tag lookup is pending or failed; placing this guard above step 4 would
  // let a slow/broken tag fetch mask a settled positive verdict. Fires only
  // when `tagName === null`: a resolved tag makes the channel's own
  // pending/failed state irrelevant, so we fall through to step 5 in that
  // case. Before this guard a tracking-MR query that resolved before the
  // tag query rendered a terminal "no tag found" claim as settled fact
  // before flipping to Loading and then to the real verdict, and a genuine
  // tag-fetch failure permanently showed `no-mr-no-tag` for what was
  // actually a check failure — the same defect class CR-03/CR-04 fixed for
  // the other two channels.
  if (tagName === null) {
    if (tagCheckFailed) {
      return { kind: 'couldnt-verify', reason: 'check-failed', expectedTagName };
    }
    if (tagLookupPending) {
      return { kind: 'loading' };
    }
  }

  // Step 5 (D-01): tag absence is NEVER evidence a release did not ship;
  // Phase 88 established tags are an incomplete record.
  // WR-09: `trackingMRsUnavailable` must be consulted here too. Step 3
  // deliberately falls through when the tracking-MR query is permanently
  // disabled, so step 4 finds nothing and this step used to report
  // `no-mr-no-tag` — "no tracking MR and no release tag found" — asserting a
  // negative for a query that never executed. Step 10 already refuses to make
  // an evidence claim under exactly this flag and calls that guard "a
  // contract, not dead code"; this step now honours the same contract. The
  // verdict KIND is unchanged (`couldnt-verify` either way) — this is the
  // tooltip's copy telling the truth about which channels were checked.
  if (tagName === null) {
    return {
      kind: 'couldnt-verify',
      reason: trackingMRsCheckFailed || trackingMRsUnavailable ? 'check-failed' : 'no-mr-no-tag',
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

  // Step 10 (planner call P-04, WR-01): a non-empty diff plus an unhealthy
  // MR channel is not enough to put the accusatory "Likely not merged" on a
  // release — one channel failed or is permanently unavailable, so the app
  // admits the gap per D-09's principle. Emitting `likely-not-merged`
  // requires a HEALTHY tracking-MR channel, so this checks BOTH
  // `trackingMRsCheckFailed` (transient fetch failure) and
  // `trackingMRsUnavailable` (permanently disabled query, e.g. an
  // unparseable milestone title) — 91-REVIEW WR-01. `trackingMRsUnavailable`
  // is today unreachable at this point only through an undocumented
  // coupling between `deriveReleaseBranchName` and
  // `extractVersionFromMilestoneTitle` sharing one regex; the resolver's own
  // parameter surface permits the unsafe combination, so this guard is a
  // contract, not dead code.
  if (trackingMRsCheckFailed || trackingMRsUnavailable) {
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
