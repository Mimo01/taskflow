---
phase: 88-release-branch-milestone-creation
plan: 07
subsystem: ui
tags: [react, tanstack-query, accessibility, releases]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    provides: "gitlab-release-branches one-shot paginated branch query + row-missing-branch/row-missing-milestone drift indicators (88-04)"
provides:
  - "isSuccess/isError-gated branchMissing derivation in ReleasesTab.tsx"
  - "branches-error-chip surfacing 'GitLab unavailable' when the branch fetch errors"
  - "milestoneMissing scoped to dated, unreleased versions only"
  - "sr-only accessible names on both drift-indicator icons"
affects: [89-drift-flagging, releases-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query-state-gated derived boolean: fire a drift/warning signal only on isSuccess, never on isLoading/isError, to avoid false positives from absence-of-evidence"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx

key-decisions:
  - "branchMissing now requires branchesLoaded (isSuccess) === true before asserting absence — an in-flight or errored branch query no longer renders a false 'No release branch' warning"
  - "branches-error-chip is a distinct conditional from the existing milestonesError chip, rendered as a sibling in the same header row, both sharing amber styling and literal 'GitLab unavailable' text (no error object interpolated)"
  - "milestoneMissing requires bestMatch.type === 'none' && !!version.releaseDate && !version.released — undated versions already show the 'No date set' badge, and historical released versions with closed/deleted milestones no longer dilute the drift signal for unreleased versions"
  - "Both indicator spans now render AlertTriangle with aria-hidden='true' plus a sibling sr-only span carrying the same text as the existing title attribute — title attributes and data-testid values were left untouched so the pre-existing title-assertion test still passes"

patterns-established:
  - "Query-state-gated drift indicator: destructure isSuccess/isError from useQuery, gate the derived warning boolean on isSuccess, and add a matching isError chip so silence during loading/error never reads as a confirmed negative"

requirements-completed: [RELBR-03, RELMS-01]

# Metrics
duration: 25min
completed: 2026-08-10
---

# Phase 88 Plan 07: Guard drift indicators against absence-of-evidence Summary

**Gated the Releases-list missing-branch/missing-milestone drift triangles on confirmed query state (isSuccess) instead of bare Set-membership over possibly-undefined data, added a distinct branch-fetch-error chip, scoped the missing-milestone indicator to dated/unreleased versions only, and gave both drift icons screen-reader-visible text.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-10T20:57:00Z (approx, per session)
- **Completed:** 2026-08-10T21:00:30Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments

- CR-01 closed: `branchMissing` requires `branchesLoaded` (the `gitlab-release-branches` query's `isSuccess`) before asserting absence, eliminating the false-positive-on-every-load-until-resolved and permanent-false-positive-on-error bugs.
- A new `branches-error-chip` (identical shape/styling to the existing `milestonesError` chip) surfaces "GitLab unavailable" in the header row specifically when the branch query errors, keeping the two error sources (milestones vs. branches) visually and semantically distinct.
- WR-04 closed: `milestoneMissing` now requires a set release date and an unreleased version, so undated versions (already flagged via "No date set") and historical released versions no longer trigger a redundant/diluting warning.
- WR-06 closed: both `row-missing-milestone` and `row-missing-branch` icons carry `aria-hidden="true"` with a sibling `sr-only` span exposing the same text already used in the wrapper's `title` attribute, giving screen-reader users a text equivalent.
- Five new regression tests added (2 for CR-01 loading/error states, 3 for WR-04/WR-06 scoping and accessible text), all failing against the pre-change implementation and passing after.

## Task Commits

Each task was committed atomically:

1. **Task 1: Gate the missing-branch indicator on query success and surface a branch-fetch-error chip (CR-01)** - `6503aa8a` (fix, TDD)
2. **Task 2: Scope the missing-milestone indicator to dated unreleased versions and give both indicators accessible names (WR-04, WR-06)** - `df03bcc1` (fix, TDD)

_Both tasks followed RED→GREEN TDD: tests were written and confirmed failing before the corresponding source change._

## Files Created/Modified

- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - Destructured `isSuccess`/`isError` from the `gitlab-release-branches` query; gated `branchMissing`; added the `branches-error-chip` header chip; scoped `milestoneMissing` to dated+unreleased versions; added `aria-hidden` + `sr-only` text to both drift-indicator spans.
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` - Added 5 regression tests: in-flight branch query (no false positive), errored branch query (chip shown, no false positive), undated version (no milestone-missing triangle), released version (no milestone-missing triangle), confirmed-drift case asserting the new sr-only text.

## Decisions Made

- Query key `['gitlab-release-branches', activeGitlabProject]`, its `queryFn`, `enabled` guard, and `staleTime` were left untouched per the plan's explicit instruction — this key is a cross-component cache contract with `useReleaseDetail.ts`'s `createBranchMutation.onSuccess`.
- The branch-error chip and milestone-error chip are separate conditionals (not merged) so the pre-existing milestone-unavailable behavior is unaffected by this change.
- Chose not to touch the "No date set" badge or the row `<button>` structure, per the plan's explicit scope boundary.

## Deviations from Plan

None - plan executed exactly as written. Both tasks' acceptance-criteria grep assertions (exact-match-count checks for `isSuccess: branchesLoaded`, `branchesLoaded && derived !== null`, `branches-error-chip`, the `milestoneMissing` derivation string, `sr-only` count of 2, `aria-hidden="true"` count of 2) all passed as specified.

## Issues Encountered

- **Worktree base drift:** The worktree's initial `git merge-base` check against the target base commit (`7e7c3debc25efc15502d3925dddb1ff3547c4f47`) did not match — HEAD was still on an earlier commit (`ca59303f`) that predated the Phase 88 plans 88-01 through 88-06 (including the `feat(88-04): row indicator icons + ReleasesTab test coverage` commit this plan depends on). Ran the branch-check's `git reset --hard` to the correct base commit, which brought in the drift-indicator code this plan modifies. Resolved before any task work began; no impact on the final result.
- **Missing `node_modules`:** The worktree's `taskflow/` directory had no `node_modules` installed (test runner failed with `ERR_MODULE_NOT_FOUND` for `@vitejs/plugin-react`). Symlinked `taskflow/node_modules` to the main checkout's `taskflow/node_modules` (confirmed gitignored via `git status --ignored`, so it does not appear in any commit) rather than running a fresh install, since the lockfile-pinned dependencies were already present and verified at the main checkout.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CR-01, WR-04, and WR-06 are closed; the Releases list's drift signals (branch + milestone) are now trustworthy (confirmed-absence-only) and accessible.
- `cd taskflow && npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` — 22/22 passing.
- `cd taskflow && npx tsc --noEmit` — clean, no new type errors.
- `cd taskflow && npx biome check src/routes/dashboard/ReleasesTab.tsx src/routes/dashboard/ReleasesTab.test.tsx` — zero errors.
- Full suite (`npm test` via pre-commit hook) — 2190 passed, 0 failed after both commits.
- No changes to the `['gitlab-release-branches', activeGitlabProject]` or `['gitlab-milestones', …]` query keys — safe for other Phase 88/89 plans that share these caches.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/ReleasesTab.tsx
- FOUND: taskflow/src/routes/dashboard/ReleasesTab.test.tsx
- FOUND: .planning/phases/88-release-branch-milestone-creation/88-07-SUMMARY.md
- FOUND commit: 6503aa8a (Task 1)
- FOUND commit: df03bcc1 (Task 2)
- FOUND commit: 0d558b6f (docs: plan summary)
