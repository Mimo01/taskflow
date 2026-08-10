/**
 * Release branch derivation — pure version extraction, branch-name derivation,
 * git-ref validation, and branch-state resolution for the release detail page.
 *
 * React-free: every function here takes explicit parameters and returns plain
 * data — no closures over component state, no hooks, no store reads, no
 * service imports. This module exists so `useReleaseDetail.ts` and its
 * section components can call these as ordinary functions and so they are
 * unit-testable in isolation (see `releaseBranch.test.ts`).
 *
 * Three rules load-bearing for this module (do not "fix" back toward the
 * literal requirement text — see 88-CONTEXT.md D-09/D-10/D-11):
 * - D-09 (supersedes RELBR-01's literal reading): the team's real GitLab
 *   milestone titles are `X.Y.Z (DD.MM.YYYY)` (e.g. `33.5.0 (21.07.2026)`),
 *   which is NOT a valid git ref — spaces and parentheses are disallowed.
 *   The branch name is derived from the milestone title's VERSION COMPONENT
 *   ONLY; the ` (DD.MM.YYYY)` suffix is stripped.
 * - D-11 (RELBR-05): if a matched milestone's title contains no parseable
 *   `X.Y.Z` version (legacy/off-convention titles), the branch name is
 *   unresolvable. This module never sanitizes-and-guesses a branch name from
 *   the raw title — a title with no leading version token always derives
 *   `null`, never a slugified fallback.
 * - D-10: a matched milestone is a hard prerequisite for a derivable branch
 *   name. With no matched milestone, branch status/create is blocked before
 *   any derivation is attempted.
 */

/** Hardcoded release-branch prefix (RELBR-01). Not configurable — a
 *  configurable prefix is an explicitly deferred idea for this phase. */
export const RELEASE_BRANCH_PREFIX = 'release/';

/**
 * Extract the leading `X.Y.Z` semver-shaped token from a milestone title.
 * Real titles are `"33.5.0 (21.07.2026)"` (D-01); this deliberately does NOT
 * require the full `(DD.MM.YYYY)` suffix to be present, so a bare-version
 * title (or a legacy title with a valid leading version) still resolves —
 * D-11 only blocks when NO version token is found at all.
 *
 * @param title - a GitLab milestone title, or null/undefined
 * @returns the bare version string (e.g. `"33.5.0"`), or `null` when no
 *   leading `X.Y.Z` token is present
 */
export function extractVersionFromMilestoneTitle(title: string | null | undefined): string | null {
  if (!title) return null;
  const match = title.trim().match(/^(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

/**
 * Derive the release branch name from a milestone title's version component
 * (D-09). Never falls back to slugifying the raw title (D-11) — a title with
 * no leading version token derives `null`, never a sanitized guess.
 *
 * @param milestoneTitle - a GitLab milestone title, or null/undefined
 * @returns `"release/{version}"`, or `null` when no version can be extracted
 */
export function deriveReleaseBranchName(milestoneTitle: string | null | undefined): string | null {
  const version = extractVersionFromMilestoneTitle(milestoneTitle);
  return version ? `${RELEASE_BRANCH_PREFIX}${version}` : null;
}

/**
 * Practical subset of `git-check-ref-format(1)` worth enforcing client-side
 * before a create call (RELBR-05). GitLab still validates server-side; this
 * is fast UX feedback, not the source of truth (D-08's server-authority
 * pattern applies here too).
 *
 * @param name - a candidate git ref name (e.g. `"release/33.5.0"`)
 * @returns `true` only when the name is a valid git ref per this rule subset
 */
export function isValidGitRefName(name: string): boolean {
  if (!name || name.length > 255) return false;
  if (name.startsWith('/') || name.endsWith('/')) return false;
  if (name.endsWith('.lock')) return false;
  if (name.endsWith('.')) return false;
  if (name.includes('..')) return false;
  if (name.includes('//')) return false;
  if (name.includes('@{')) return false;
  if (name === '@') return false;
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional — validating ASCII control chars are absent
  if (/[\x00-\x1f\x7f]/.test(name)) return false;
  if (/[\s~^:?*[\\]/.test(name)) return false;
  if (name.split('/').some((seg) => seg.startsWith('.'))) return false;
  return true;
}

/** Discriminated union describing the release branch's derived/resolved
 *  state, evaluated in strict precedence order by `resolveBranchState`:
 *  no matched milestone (D-10) -> unresolvable (D-11) -> invalid ref
 *  (RELBR-05) -> check-failed (CR-03) -> branchExists tri-state
 *  (loading/exists/missing). */
export type BranchState =
  | { kind: 'blocked-no-milestone' }
  | { kind: 'unresolvable' }
  | { kind: 'invalid-ref'; branchName: string }
  | { kind: 'check-failed'; branchName: string }
  | { kind: 'loading'; branchName: string }
  | { kind: 'exists'; branchName: string }
  | { kind: 'missing'; branchName: string };

/**
 * Resolve the release branch UI state from the matched milestone and the
 * branch-existence query result, applying the D-10/D-11/RELBR-05/CR-03
 * precedence order.
 *
 * @param params.hasMatchedMilestone - whether a GitLab milestone was matched to the fix version (D-10 gate)
 * @param params.milestoneTitle - the matched milestone's title, if any
 * @param params.branchExists - `undefined` while the existence query is in flight, else the fetched boolean
 * @param params.branchCheckFailed - `true` when the branch-existence query errored — distinct from
 *   `branchExists === undefined`, which means in flight. `fetchBranch` throws on 401/403/500/timeout,
 *   so without this signal a failed check is indistinguishable from loading and pins the UI at
 *   'Loading…' forever.
 * @returns the resolved `BranchState`
 */
export function resolveBranchState(params: {
  hasMatchedMilestone: boolean;
  milestoneTitle: string | null | undefined;
  branchExists: boolean | undefined;
  branchCheckFailed?: boolean;
}): BranchState {
  const { hasMatchedMilestone, milestoneTitle, branchExists, branchCheckFailed } = params;

  if (!hasMatchedMilestone) {
    return { kind: 'blocked-no-milestone' };
  }

  const branchName = deriveReleaseBranchName(milestoneTitle);
  if (!branchName) {
    return { kind: 'unresolvable' };
  }

  if (!isValidGitRefName(branchName)) {
    return { kind: 'invalid-ref', branchName };
  }

  // CR-03: must stay above the undefined -> loading fallback, because an
  // errored query also leaves `branchExists` undefined — without this
  // branch a failed check is indistinguishable from an in-flight one.
  if (branchCheckFailed) {
    return { kind: 'check-failed', branchName };
  }

  if (branchExists === undefined) {
    return { kind: 'loading', branchName };
  }

  return branchExists ? { kind: 'exists', branchName } : { kind: 'missing', branchName };
}
