---
phase: 88-release-branch-milestone-creation
plan: 05
subsystem: ui
tags: [react-query, gitlab, release-detail, write-path]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    provides: "Plan 88-02's gitlab.ts createBranch; Plan 88-03's useReleaseDetail.ts branchState/releaseBranchName/defaultBranch and the sidebar Release Branch MetaRow"
provides:
  - "CreateBranchDialog.tsx: presentational confirm-only dialog with in-dialog D-16 error rendering"
  - "useReleaseDetail.ts: non-optimistic createBranchMutation invalidating gitlab-branch + gitlab-release-branches on success"
  - "ReleaseDetailSidebar.tsx: shared BranchCreateButton trigger with per-state disabled reasons (D-10/D-11/D-14/RELBR-05)"
  - "ReleaseDetailPage.tsx: dialog open-state ownership, closes only on mutation success (D-15/D-16)"
affects: [88-06-milestone-create-dialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared trigger subcomponent (BranchCreateButton) so a UI-SPEC-locked copy string is authored once while each call site supplies a literal disabled-reason title attribute"
    - "Mutation follows useFieldMutation's useMutation + queryClient.invalidateQueries skeleton, explicitly stripped of onMutate/onError rollback per D-15"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.tsx
    - taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "D-15 held: createBranchMutation has no onMutate/optimistic write/rollback/toast; invalidates ['gitlab-branch', ...] and ['gitlab-release-branches', ...] on success only"
  - "D-16 held: dialog closes ONLY inside the mutate() onSuccess callback; a failed mutation leaves the dialog open with the raw Error message rendered inline"
  - "D-14 held: ref is always the fetched defaultBranch; grep-verified zero hardcoded 'main' string in useReleaseDetail.ts"
  - "Introduced a local BranchCreateButton subcomponent (not in the plan's literal action text) to satisfy the plan's own acceptance criteria that 'Create branch' appear exactly once in ReleaseDetailSidebar.tsx while still rendering literal per-state title=\"...\" disabled-reason attributes at each of the four call sites"

patterns-established: []

requirements-completed: []

# Metrics
duration: ~35min
completed: 2026-08-10
---

# Phase 88 Plan 05: Release Branch Create Action Summary

**Added the create-release-branch write path — CreateBranchDialog, a non-optimistic createBranchMutation, and sidebar Create-button wiring with D-10/D-11/D-14 disabled-reason states — but the plan's blocking live-GitLab checkpoint (Task 3) was waived by the user rather than executed, so the actual write path has never fired against a real GitLab instance.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-10T19:15:00Z
- **Completed:** 2026-08-10T19:40:00Z
- **Tasks:** 2 auto (committed) + 1 checkpoint (waived, not performed)
- **Files modified:** 6 (2 new, 4 modified)

## Accomplishments
- `CreateBranchDialog.tsx` — confirm-only dialog copied from `ConfirmSprintMoveDialog`'s structure, with the UI-SPEC-locked copy ("Create release branch" / "Create branch" / "Creating…" / "Cancel") and a D-16 in-dialog error block (`Couldn't create branch: {errorMessage}`); presentational only, zero `useQuery`/`useMutation`/`readSecret` calls (D-21). 4 tests covering render, confirm, pending, and error-stays-open.
- `useReleaseDetail.ts` — `createBranchMutation` follows `updateMilestone`'s write shape via `createBranch(baseUrl, token, projectId, releaseBranchName, defaultBranch)`; `defaultBranch` is always the fetched `gitlab-project` value, never a hardcoded fallback (D-14); `onSuccess` invalidates both `['gitlab-branch', activeGitlabProject, releaseBranchName]` and `['gitlab-release-branches', activeGitlabProject]` so the Releases-list indicator (Plan 88-04) also clears; no `onMutate`, no optimistic write, no toast (D-15).
- `ReleaseDetailSidebar.tsx` — new `BranchCreateButton` shared subcomponent renders the "Create branch" trigger at four call sites (`missing`+`defaultBranch` → enabled; `missing`+no `defaultBranch` → disabled/"Project default branch not loaded yet"; `blocked-no-milestone` → disabled/"Create the milestone first"; `unresolvable`/`invalid-ref` → disabled/"Branch name can't be derived from this milestone title"); no button for `exists`/`loading`.
- `ReleaseDetailPage.tsx` — owns `createBranchOpen` dialog state; `onCreateBranch` resets the mutation before opening (clears any stale error from a prior attempt); `onConfirm` calls `mutate(undefined, { onSuccess: () => setCreateBranchOpen(false) })` so the dialog closes only on success.
- Full `taskflow` suite (2177 tests, 2 skipped) passes; `tsc --noEmit` clean; `biome check` at the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline — no new errors.

## Task Commits

Each auto task was committed atomically:

1. **Task 88-05-T1: CreateBranchDialog presentational component + test** - `f3f1f3d2` (feat)
2. **Task 88-05-T2: createBranch mutation in useReleaseDetail + sidebar Create action wiring** - `d473a159` (feat)

Task 88-05-T3 (checkpoint) has no commit — see "Checkpoint Waived" below.

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.tsx` - New: props-driven confirm dialog (`open`, `onOpenChange`, `branchName`, `defaultBranch`, `onConfirm`, `isPending`, `errorMessage`)
- `taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.test.tsx` - New: 4 tests (render/confirm/pending/error)
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - Added `useMutation`/`useQueryClient` imports, `createBranch` import, `createBranchMutation`, added to the `as const` return object
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - Added `defaultBranch`/`onCreateBranch` props, `BranchCreateButton` subcomponent, four gated call sites in the "Release Branch" `MetaRow`
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - Updated `renderSidebar` helper with the two new required props
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - Added `CreateBranchDialog` import, `createBranchOpen` state, destructured `releaseBranchName`/`defaultBranch`/`createBranchMutation`, wired dialog render + sidebar props

## Decisions Made
- Extracted a local `BranchCreateButton` subcomponent rather than a single dynamically-computed `title`/`disabled` object, so that the plan's own acceptance criteria could both be satisfied simultaneously: `grep -c "Create branch"` returns exactly 1 (the button copy is authored once, inside the subcomponent) while `grep -c 'title="Create the milestone first"'` also returns exactly 1 (each of the four call sites still carries its own literal JSX `title="..."` attribute). This is a documented deviation from the plan's literal `<action>` text, which described four separate inline `<Button>` blocks — that literal reading would have made the "Create branch" grep count 4, failing its own stated acceptance criterion.
- Reworded two comments in `useReleaseDetail.ts` (removed the words "toast" and "'main'" from comment prose) after they tripped the `grep -c "toast"` / `grep -c "'main'"` acceptance-criteria checks as false positives — the checks were scanning comment text, not just code semantics.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed biome formatting on CreateBranchDialog.tsx's description JSX**
- **Found during:** Task 1 verification (`npx biome check`)
- **Issue:** The `Create {branchName} off {defaultBranch}?` sentence's line-wrap didn't match biome's formatter output
- **Fix:** `npx biome check --write` scoped to the two new files
- **Files modified:** `CreateBranchDialog.tsx`
- **Verification:** Re-ran the 4-test file, still green; `biome check` on the two files clean
- **Committed in:** `f3f1f3d2`

**2. [Rule 1 - Bug] Restructured the sidebar's Create-button rendering to satisfy conflicting acceptance-criteria greps**
- **Found during:** Task 2 verification
- **Issue:** A literal reading of the plan's `<action>` text (four separate inline `<Button>...Create branch</Button>` blocks) would make `grep -c "Create branch"` return 4, failing the plan's own acceptance criterion of `1`
- **Fix:** Extracted the shared `BranchCreateButton` subcomponent (see Decisions Made above)
- **Files modified:** `ReleaseDetailSidebar.tsx`
- **Verification:** All 8 of Task 2's acceptance-criteria greps individually confirmed to return their exact expected values
- **Committed in:** `d473a159`

**3. [Rule 1 - Bug] Reworded two comments that tripped false-positive acceptance-criteria greps**
- **Found during:** Task 2 verification
- **Issue:** Comment prose containing the literal substrings "toast" and `'main'` (in explanatory comments about NOT using them) caused `grep -c "toast"` and `grep -c "'main'"` to return 1 instead of the required 0
- **Fix:** Reworded both comments to convey the same meaning without the flagged substrings
- **Files modified:** `useReleaseDetail.ts`
- **Verification:** Both greps confirmed to return `0`
- **Committed in:** `d473a159`

---

**Total deviations:** 3 auto-fixed (all Rule 1, structural/wording only — no behavior change, no scope creep)

## Checkpoint Waived — NOT Performed

**Task 88-05-T3 ("Verify live branch creation against real GitLab") was waived by the user, not executed.**

The coordinator relayed the user's verbatim response: *"I do not have any release to test it on, consider it approved."*

**What this means concretely:**
- No live write was made against a real GitLab instance. The POST to `/projects/:id/repository/branches` has never actually fired outside of mocked-`apiFetch` unit tests.
- None of the 8 manual verification steps in the plan's `<how-to-verify>` block were run.
- The following behaviors are therefore **unverified in practice** (covered only by automated tests with mocked fetch responses):
  1. **The actual GitLab POST succeeding** — `createBranch`'s request shape, headers, and response parsing have only been exercised against `gitlab.test.ts`'s mocked fixtures (Plan 88-02), never a live server.
  2. **The real `default_branch` being used as `ref`** — D-14's "never hardcoded `main`" guarantee is grep-verified in source and unit-tested with a mocked `fetchProject` response, but never confirmed against an actual project's real default branch value returned by a live GitLab instance.
  3. **D-16 in-dialog server-error rendering** — the dialog's error-message display is tested with a synthetic `errorMessage` prop; it has never rendered an actual GitLab rejection body (e.g. a real "Branch already exists" 400 response).
  4. **D-15 cache invalidation flipping both surfaces** — the mutation's `onSuccess` invalidation of `['gitlab-branch', ...]` and `['gitlab-release-branches', ...]` is implemented and grep-verified in source, but the resulting UI flip (sidebar row switching from `missing` to `exists`, and the Releases-list drift icon clearing per Plan 88-04) has never been observed against live server state.

**Recommendation for follow-up:** The next time a release exists with a matched milestone and no branch, run the 8-step verification from `88-05-PLAN.md`'s checkpoint before relying on this write path in a real workflow. This gap should surface in `/gsd-progress` and `/gsd-audit-uat` rather than being treated as closed.

## Issues Encountered
- Worktree had no `node_modules`; symlinked `taskflow/node_modules` to the main checkout's install (same workaround as Plans 88-01/88-02/88-03). Not committed (gitignored).
- Worktree branch initially pointed at a newer `main` commit (`ca59303f`, version bump) rather than the expected `88-04` base (`d9764406`); the mandatory pre-flight base-drift check caught this and `git reset --hard` corrected it before any file was touched (working tree was clean, so this was safe).

## User Setup Required

None for the code itself. **Live-GitLab verification of this plan's write path remains outstanding** — see "Checkpoint Waived" above.

## Next Phase Readiness
- The create-branch write path is code-complete and unit-tested but has zero live-GitLab confirmation. Plan 88-06 (milestone creation) follows the same `createMilestone`/dialog/mutation shape and should account for the same class of live-verification gap when it reaches its own checkpoint.
- `ReleaseDetailPage.tsx` and `ReleaseDetailSidebar.tsx` are otherwise unchanged in structure from Plan 88-03/88-04's shape; no blockers for Plan 88-06's sidebar additions.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 6 files verified present on disk (2 new + 4 modified); both commit hashes (`f3f1f3d2`, `d473a159`) verified present in `git log`. `npx tsc --noEmit` clean. Full suite: 2177 passed / 2 skipped / 0 failed. `biome check` at the documented 2-error baseline (no new errors).
