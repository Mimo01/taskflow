---
phase: 91-post-release-merge-back-verification
plan: 06
subsystem: release-detail-hook

tags: [gitlab, merge-back, react-query, vitest, gap-closure, test-quality]

# Dependency graph
requires:
  - phase: 91-post-release-merge-back-verification (plan 05)
    provides: "resolveMergeBackVerdict's optional defaultBranchCheckFailed / trackingMRsUnavailable params"
provides:
  - "Live wiring of the two terminal signals from useReleaseDetail.ts's query state into resolveMergeBackVerdict"
  - "Non-tautological hook test coverage for CR-01/CR-03/CR-04 bug states"
  - "A data-testid-anchored D-12 no-control regression lock covering non-button controls"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Label-derived data-testid slug (meta-row-<kebab-label>) on a shared row component, so a regression lock in a consumer test survives arbitrary className/layout changes to the shared component"
    - "setupMocks override pattern extended (fetchProjectImpl/milestoneTitle/fetchSourceBranchMRsImpl/compareRefsImpl) following the existing fetchBranchImpl precedent, so each new hook test case controls exactly the mock it needs"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
    - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx

key-decisions:
  - "defaultBranchCheckFailed is destructured as isError from the existing gitlab-project useQuery with no other change to that query's queryKey/enabled/staleTime, preserving the D-15/P88 CR-02 cache contract"
  - "trackingMRsUnavailable is derived as `releasedVersion && releaseBranchName === null` immediately above the resolver call, mirroring releaseBranch.ts's unresolvable-kind precedent rather than adding a new query or verdict kind"
  - "MetaRow's data-testid slug is a plain lowercase+hyphen transform of the label prop, so it stays in sync automatically if a label's copy ever changes"
  - "The D-12 lock now checks for input/select/textarea/[role=checkbox]/[role=switch]/[role=menuitem] in addition to button, and asserts no override/dismiss/acknowledge/confirm text — catching any future non-button affordance, not just a <button>"

patterns-established:
  - "Any future MetaRow-based regression lock should scope via getByTestId('meta-row-<slug>') rather than a Tailwind class selector on the row"

requirements-completed: [MERGE-01, MERGE-03]

duration: 20min
completed: 2026-08-11
---

# Phase 91 Plan 06: Wire merge-back terminal signals into the hook and lock the D-12 regression Summary

**useReleaseDetail.ts now threads a failed project fetch and an unparseable milestone title into resolveMergeBackVerdict as real terminal signals, the hook test suite asserts against the CR-01/CR-03/CR-04 bug states instead of a discriminated-union tautology, and the D-12 "no override control" lock is anchored to a stable data-testid covering every interactive-element kind**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-11T21:58:00Z (approx, worktree base commit 9e574ac6)
- **Completed:** 2026-08-11T22:02:58Z
- **Tasks:** 3 completed
- **Files modified:** 4

## Accomplishments
- CR-04 closed end to end: the `gitlab-project` query's `isError` is now destructured as `defaultBranchCheckFailed` and passed to `resolveMergeBackVerdict`, so a failed/500/timeout project fetch resolves to `couldnt-verify` in the live app, not a permanent spinner
- CR-03 closed end to end: `trackingMRsUnavailable` (`releasedVersion && releaseBranchName === null`) is derived and passed to the resolver, so an unparseable milestone title now falls through to a terminal `couldnt-verify` answer instead of pinning at `loading` forever
- WR-03 closed: the hook test's `toHaveProperty('kind')` tautology is deleted and replaced with 4 cases that assert the real discriminant against CR-04 (rejected `fetchProject`), CR-03 (unparseable milestone title), CR-01 (MR merged to a non-default branch → `likely-not-merged`, not `merged`), and a preserved happy path (MR merged to the actual default branch → `merged`/`tracking-mr`)
- WR-05 closed: `MetaRow` gained a label-derived `data-testid` (`meta-row-<slug>`); the D-12 "no button in the row" lock now scopes via that stable hook instead of a Tailwind class selector, and was strengthened to check for `input`/`select`/`textarea`/`[role="checkbox"]`/`[role="switch"]`/`[role="menuitem"]` plus absence of override/dismiss/acknowledge/confirm text; a second lock case covers the `couldnt-verify` verdict
- Full targeted suite (`gitlab.test.ts` + `mergeBackVerification.test.ts` + `ReleaseDetailSidebar.test.tsx` + `useReleaseDetail.test.tsx`) is green at 224 tests (verification's required minimum was 205); `tsc --noEmit` exits clean

## Task Commits

1. **Task 1: Thread the project-fetch error and the tracking-MR-unavailable signal into the resolver** - `430a958c` (fix)
2. **Task 2: Replace the hook test's tautology with bug-state assertions** - `6550721a` (test)
3. **Task 3: Re-anchor the D-12 no-control regression lock to a stable test hook** - `b08027fd` (test)

**Plan metadata:** (this SUMMARY.md commit, below)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - `gitlab-project` query now destructures `isError: defaultBranchCheckFailed` (queryKey/enabled/staleTime unchanged); `trackingMRsUnavailable` derived above the `resolveMergeBackVerdict` call and both new values passed as arguments
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` - `setupMocks` extended with `fetchProjectImpl`/`milestoneTitle`/`fetchSourceBranchMRsImpl`/`compareRefsImpl` overrides; the tautological "exposes mergeBackVerdict with a kind property" case deleted; 4 new cases added covering CR-04, CR-03, CR-01, and the tracking-mr happy path
- `taskflow/src/routes/dashboard/release-detail/MetaRow.tsx` - outer `div` gained `data-testid={`meta-row-${slug}`}` where `slug` is the label lowercased with spaces replaced by hyphens; no other prop/layout/DOM change
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - D-12 lock case rewritten to use `screen.getByTestId('meta-row-merged-back')`; strengthened to check non-button interactive elements and forbidden override-language text; a second lock case added for the `couldnt-verify` verdict

## Decisions Made
- Kept `defaultBranchCheckFailed` naming and destructuring pattern identical to the existing `branchCheckFailed` two blocks below, per the plan's explicit instruction, for consistency and to make future review pattern-matching trivial.
- Did not add any new query, mutation, store write, or override/dismiss UI — this phase remains strictly read-only advisory per D-12/D-15, and Task 3 exists solely to lock that recorded descope more durably, not to relax it.
- Used `as unknown as typeof gitlab.fetchProject` for the `fetchProjectImpl` mock override cast (rather than a direct type assertion) because the override's return shape (`{ default_branch: string }`) is intentionally narrower than the full `GitLabProject` type the hook only reads `default_branch` from; TypeScript's structural-overlap check flags the direct cast as a possible mistake, so the `unknown` intermediate step is required for a legitimate narrowing.

## Deviations from Plan

None - plan executed as written. All three tasks' acceptance criteria (greps, specific call-site assertions, full targeted suite, `tsc --noEmit`) were verified to pass exactly as specified in 91-06-PLAN.md before each commit.

## Issues Encountered
- This worktree's `taskflow/node_modules` did not exist at the start of execution (same class of issue documented in 91-05-SUMMARY.md). Symlinked `taskflow/node_modules` to the main checkout's `taskflow/node_modules` for the duration of verification/commit runs, then removed the symlink afterward — a local, untracked, gitignored convenience link, not a change to any tracked file or dependency manifest. `git status --short` is clean after removal.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CR-01, CR-02 (resolver-level target_branch filtering and deterministic MR selection), CR-03, and CR-04 are now closed both in the pure resolver (91-05) and in the live hook wiring (this plan). CR-02 in `gitlab.ts` (malformed `compareRefs` payload silently reading as `diffCount: 0`) was explicitly out of scope for plans 91-05 and 91-06 and is tracked separately in the sibling 91-04 worktree's scope.
- MERGE-03 remains satisfied via the recorded D-12 descope; this plan's Task 3 makes that descope's regression lock durable against future `MetaRow` styling changes without introducing any override affordance.
- The full targeted suite for the phase (`gitlab.test.ts`, `mergeBackVerification.test.ts`, `ReleaseDetailSidebar.test.tsx`, `useReleaseDetail.test.tsx`) passes at 224 tests; `tsc --noEmit` is clean. This plan closes gap 3 and gap 4's WR-03/WR-05 warnings from 91-VERIFICATION.md; re-verification of the full phase (including the sibling 91-04 worktree's CR-01/WR-06 work) is the orchestrator's next step after both wave-2 worktrees merge back.

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*
