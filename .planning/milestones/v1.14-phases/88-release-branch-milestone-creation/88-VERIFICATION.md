---
phase: 88-release-branch-milestone-creation
verified: 2026-08-10T22:20:00Z
status: human_needed
score: 9/9 must-haves verified at code level (2 carry unresolved live-GitLab evidence gaps)
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 6/9
  gaps_closed:
    - "RELBR-03: Releases-list missing-branch indicator is false-positive on load/error (old CR-01) — fixed by 88-07 (6503aa8a): `branchesLoaded` (isSuccess) now gates `branchMissing`, and a `branches-error-chip` distinguishes a failed fetch from a confirmed-missing branch."
    - "RELMS-02: createMilestoneMutation invalidated only the detail page's windowed cache key, never reaching the Releases-list's differently-windowed cache entry (old CR-02) — fixed by 88-09 (579db8b1): invalidation is now project-granular (`['gitlab-milestones', activeGitlabProject]`), confirmed present in useReleaseDetail.ts:229-231."
    - "RELBR-04: loading and errored branch-existence checks were conflated, pinning the sidebar at 'Loading...' forever and making the Create button unreachable on any check failure (old CR-03) — fixed by 88-08/88-09 (4c82bd6b, 932c525d): a distinct 'check-failed' BranchState renders with a working Retry action, evaluated before the undefined->loading fallback (releaseBranch.ts:139-141, ReleaseDetailSidebar.tsx:218-226/270-279)."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Create a real release branch from the release detail view against a live GitLab project"
    expected: "Branch is created at the correct ref (project's fetched `default_branch`, not hardcoded); the sidebar flips from 'missing' to 'exists' after invalidation; a 403 (protected-branch rule, missing api scope) surfaces GitLab's actionable message text inside the dialog"
    why_human: "88-11 Task 2 (RELBR-04's live-GitLab checkpoint, un-waiving 88-05-T3) was explicitly waived by the user at the wave-4 checkpoint (88-11-SUMMARY.md: 'waived — not performed'). No createBranch call has ever executed against a real GitLab instance; coverage is mocked-fetch unit tests only."
  - test: "Create a real GitLab milestone from the release detail view against a live GitLab project, then navigate back to the Releases list without a manual refresh"
    expected: "Milestone is created with the correct title and due_date; both the detail sidebar and the Releases list reflect the new milestone (the fixed project-granular invalidation should make the list update within normal cache staleness)"
    why_human: "88-11 Task 3 (RELMS-02's live-GitLab checkpoint, un-waiving 88-06-T3) was explicitly waived by the user. The project-granular invalidation fix (CR-02, closed by 88-09) is confirmed correct by code reading and unit test, but the actual cross-view propagation against a real GitLab response has never been observed."
  - test: "Confirm a 401/403 response from a real GitLab PAT lacking scope renders an actionable error inside the create-branch and create-milestone dialogs"
    expected: "User sees GitLab's explanatory message body, not a generic failure string; an object-shaped `message` body (GitLab's Grape validation-error shape, e.g. duplicate-title rejection) does not render as the literal string '[object Object]'"
    why_human: "88-11 Task 4 (restricted-PAT error surfacing) was explicitly waived — no second scope-restricted PAT was tested. Additionally, WR-01 (gitlab.ts:1056-1070, 1119-1133) is confirmed still open at HEAD: the response-body cast only flattens `string` and `string[]` message shapes, not GitLab's object-keyed validation-error shape, so this failure mode is untested against live GitLab and has a known code-level gap."
---

# Phase 88: Release Branch / Milestone Creation — Verification Report

**Phase Goal:** Release branch and GitLab milestone creation from the release detail view (see ROADMAP.md §88) — users can see whether the release branch and GitLab milestone exist for a release, and create either one directly from the release view when missing, so drift detection and corrective actions always have a real branch/milestone to target.
**Verified:** 2026-08-10T22:20:00Z
**Status:** human_needed
**Re-verification:** Yes — previous 88-VERIFICATION.md (commit b35844ea, 20:22:35Z) found 3 blocker-severity gaps (old CR-01/CR-02/CR-03). That report predates gap-closure plans 88-07..88-11 (20:58Z–21:49Z) and the two post-plan commits f63e785a/00669748 (21:53Z–22:07Z); it is stale relative to HEAD and has been superseded by this report.

## Important note on 88-REVIEW.md

`88-REVIEW.md` at HEAD (commit 590ac19e) carries `reviewed: 2026-08-10T19:58:36Z` in its frontmatter — a timestamp captured **before** fix commit `00669748` (author time 22:06:49Z) was written, even though the file was committed to git one commit after it. Direct code inspection below confirms the three issues 590ac19e reports as open (critical CR-01 duplicate-detection narrowing, WR-02 duplicate fetch, WR-03 missing test mock) are **already fixed at HEAD** — `00669748`'s commit message states it fixes exactly these three findings, and the code matches that claim. `88-REVIEW.md` is therefore stale documentation, not an accurate description of HEAD; this verification relies on direct code reading, not on either SUMMARY.md or REVIEW.md claims.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RELBR-01: release branch name resolves as `release/<version>` from matched milestone title, version component only | ✓ VERIFIED | `releaseBranch.ts` `deriveReleaseBranchName`/`extractVersionFromMilestoneTitle`; unit tests pass |
| 2 | RELBR-02: release detail view shows whether the release branch exists | ✓ VERIFIED | `useReleaseDetail.ts` fetches `gitlab-branch`, destructures `isError` as `branchCheckFailed`; `ReleaseDetailSidebar.tsx` renders exists/missing/loading/check-failed/unresolvable/blocked/invalid-ref states distinctly |
| 3 | RELBR-03: user sees a trustworthy release-level warning when the branch is missing (detail view and Releases list) | ✓ VERIFIED (old CR-01 closed) | `ReleasesTab.tsx:190-193` destructures `isSuccess: branchesLoaded, isError: branchesError`; line 259 gates `branchMissing` on `branchesLoaded &&`; a distinct `branches-error-chip` (line 317-325) renders on fetch failure instead of a false "missing" signal |
| 4 | RELBR-04: user can create the missing branch off the project default branch, behind a confirm dialog | ✓ VERIFIED (code level); ⚠ live write unconfirmed | `CreateBranchDialog.tsx` + `createBranchMutation` (useReleaseDetail.ts:161-187) use fetched `default_branch`, invalidate both `gitlab-branch` and `gitlab-release-branches` on success, unit-tested. Old CR-03 (create button unreachable on check failure) closed — see truth 2. But no `createBranch` call has ever executed against real GitLab (88-11 Task 2 waived) |
| 5 | RELBR-05: branch name validated against git-ref rules before creation | ✓ VERIFIED | `isValidGitRefName` in `releaseBranch.ts` gates `invalid-ref` state before any create button renders; dedicated unit tests pass |
| 6 | RELMS-01: user sees when no GitLab milestone matches the fix version | ✓ VERIFIED | Existing "No GitLab milestone matched" alert unchanged; `ReleasesTab.tsx` `milestoneMissing` scoped to dated, unreleased versions only (WR-04-old fix retained) |
| 7 | RELMS-02: user can create a GitLab milestone from the release view, behind a confirm dialog, reflected on the Releases list | ✓ VERIFIED (code level); ⚠ live propagation unconfirmed | `CreateMilestoneDialog.tsx` + `createMilestoneMutation` exist, unit-tested. Old CR-02 (cache-key granularity) closed: `useReleaseDetail.ts:229-231` invalidates `['gitlab-milestones', activeGitlabProject]` at project granularity, a prefix that also matches `ReleasesTab`'s differently-windowed cache entry. Live cross-view propagation has never been observed (88-11 Task 3 waived) |
| 8 | RELMS-03: create dialog lists latest existing milestones for reference, lets user type final name | ✓ VERIFIED | `CreateMilestoneDialog.tsx` renders `recentMilestonesByDate(recentMilestones)` (shared helper, no divergent local sort — old WR-05 also resolved); `MILESTONE_TITLE_FORMAT_RE` enforced; prefill uses a version extracted from the Jira version name (old WR-01 prefill bug fixed in 88-10) |
| 9 | RELMS-04: duplicate milestone title detected and blocked before creation | ✓ VERIFIED — live-verified | `findDuplicateMilestone` runs over the full ancestor-filtered `ownProjectMilestoneList` (uncapped), not a display-capped slice — confirmed fixed by commit `00669748` after the `f63e785a` regression (new CR-01) that had narrowed it to 5 entries. Live-verified: `probe.sh` run against 265 real milestone titles, zero collisions (88-11-SUMMARY.md) |

**Score:** 9/9 truths verified at the code level (artifacts exist, are substantive, and are wired correctly). 2 of the 9 (RELBR-04, RELMS-02) carry an unresolved evidence gap: their write paths have never executed against a real GitLab instance, by explicit user waiver — routed to Human Verification below rather than marked failed, since the code-level implementation is sound and unit-tested.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` | Pure branch derivation/validation/state module, incl. `check-failed` state | ✓ VERIFIED | React-free; `check-failed` variant present (line 96, 139-141) ahead of the loading fallback |
| `taskflow/src/routes/dashboard/release-detail/releaseMilestone.ts` | Pure milestone format/dedup module, `recentMilestonesByDate` display-only helper | ✓ VERIFIED | `findDuplicateMilestone` takes the full list; `recentMilestonesByDate` (capped at `RECENT_MILESTONE_LIMIT=5`) used only for rendering, confirmed separate call sites |
| `taskflow/src/services/gitlab.ts` | fetchProject, fetchProjectBranches, fetchBranch, createBranch, createMilestone, fetchProjectMilestones | ✓ VERIFIED | All present; 401/403 paths read response body before classifying (WR-11 fixed); object-shaped `message` bodies still unhandled (WR-01 open, non-blocking) |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Queries + mutations for branch/milestone state and creation, project-granular invalidation, single milestone fetch | ✓ VERIFIED | Single `'all'` milestones query (`gitlab-milestones`, `'all'`) with local windowing via `filterMilestonesToRange` — old WR-02 duplicate-fetch fixed; `ownWindowMilestones` dead code removed (old WR-04 fixed); `branchCheckFailed` threaded from `isError` |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | Release Branch MetaRow, all BranchState variants incl. check-failed + Retry | ✓ VERIFIED | `branch-status-check-failed` testid, Retry button wired to `onRetryBranchCheck` (lines 218-226, 270-279) |
| `taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.tsx` | Confirm-only create dialog, locked during pending | ✓ VERIFIED | `handleOpenChange` blocks dismissal while `isPending` |
| `taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.tsx` | Confirm-only create dialog with format/dup validation, valid prefill, locked during pending | ✓ VERIFIED | Prefill via `extractVersionFromMilestoneTitle(bareVersionName)`; duplicate check runs over uncapped `recentMilestones` prop, display capped separately |
| `taskflow/src/routes/dashboard/ReleasesTab.tsx` | Single paginated branch fetch + per-row drift icons, loading/error-guarded | ✓ VERIFIED | `branchesLoaded`/`branchesError` destructured and used to gate `branchMissing` and render `branches-error-chip` |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | Regression coverage incl. `fetchProjectMilestones` mock | ✓ VERIFIED | Mock factory includes `fetchProjectMilestones: vi.fn()` (line 31); old WR-03 (query threw on every test run) fixed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ReleasesTab.tsx` `gitlab-release-branches` query | `branchMissing` | `isSuccess` gate | ✓ WIRED | `branchesLoaded && derived !== null && !releaseBranchNames.has(derived)` |
| `ReleasesTab.tsx` `gitlab-release-branches` query | header status chip | `isError` | ✓ WIRED | `branchesError` renders `branches-error-chip` |
| `useReleaseDetail.ts` `createMilestoneMutation.onSuccess` | Releases list's windowed milestone cache | project-granular `invalidateQueries` | ✓ WIRED | `['gitlab-milestones', activeGitlabProject]` is a prefix match for every window variant, including the list's |
| `useReleaseDetail.ts` `gitlab-branch` query `isError` | `resolveBranchState` | `branchCheckFailed` param | ✓ WIRED | Evaluated ahead of the `undefined -> loading` fallback (releaseBranch.ts:139-141) |
| `ReleaseDetailSidebar.tsx` check-failed arm | `useReleaseDetail.ts` `refetchBranchCheck` | `onRetryBranchCheck` prop | ✓ WIRED | Retry button calls the wrapped `refetch()` |
| `CreateMilestoneDialog.tsx` `findDuplicateMilestone` | `ownProjectMilestoneList` (uncapped) | `recentMilestones` prop | ✓ WIRED | Confirmed NOT the capped display slice — this is exactly the regression `00669748` fixed |
| `useReleaseDetail.ts` `allProjectMilestones` query | both `milestones` (windowed) and `ownProjectMilestoneList` (unwindowed) | single fetch, local derivation | ✓ WIRED | Confirms old WR-02 (double-fetch) is closed |
| `CreateBranchDialog.tsx` / `CreateMilestoneDialog.tsx` | `useReleaseDetail.ts` mutations | props | ✓ WIRED | Presentational split intact (D-21) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ReleasesTab.tsx` row `branchMissing`/`branches-error-chip` | `branchMissing`, `branchesError` | `gitlab-release-branches` query `isSuccess`/`isError`/`data` | Only fires "missing" on confirmed absence; fetch failures render a distinct chip | ✓ FLOWING |
| `ReleaseDetailSidebar.tsx` "Release Branch" row | `branchState` | `resolveBranchState({ branchExists, branchCheckFailed })` | Distinguishes exists/missing/check-failed/loading correctly | ✓ FLOWING |
| Releases-list milestone drift after a milestone create | `milestones` query data under the list's own window key | Invalidated by `createMilestoneMutation` via project-level prefix | Cache invalidation confirmed correct in code; real-world propagation against a live GitLab response not yet observed | ⚠ CODE-VERIFIED, LIVE-UNCONFIRMED |
| `CreateMilestoneDialog.tsx` duplicate check | `duplicate` | `findDuplicateMilestone(recentMilestones, …)` where `recentMilestones` = uncapped `ownProjectMilestoneList` | Full ancestor-filtered list, not the 5-entry display slice | ✓ FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RELBR-01 | 88-01 | Branch name resolves as `release/<version>` | ✓ SATISFIED | `deriveReleaseBranchName` |
| RELBR-02 | 88-03 | User sees whether branch exists | ✓ SATISFIED | Sidebar row renders all states distinctly, including check-failed |
| RELBR-03 | 88-03, 88-04, 88-07 | Warning when branch missing | ✓ SATISFIED | List-level indicator now loading/error-guarded |
| RELBR-04 | 88-05, 88-08, 88-09 | User can create branch, confirm dialog | ✓ SATISFIED (code); live write unconfirmed | Reachability fixed; write path never executed against real GitLab — see human_verification |
| RELBR-05 | 88-01, 88-05 | Git-ref validation before creation | ✓ SATISFIED | `isValidGitRefName` |
| RELMS-01 | 88-01 (implicit), pre-existing | User sees no-match state | ✓ SATISFIED | Unchanged existing alert confirmed |
| RELMS-02 | 88-06, 88-09 | User can create milestone, confirm dialog, list reflects it | ✓ SATISFIED (code); live propagation unconfirmed | Invalidation-granularity fix confirmed in code — see human_verification |
| RELMS-03 | 88-06, 88-10 | Reference list + typed name | ✓ SATISFIED | Prefill bug fixed; sort uses shared helper |
| RELMS-04 | 88-01, 88-06, 88-11 | Duplicate detection blocks creation | ✓ SATISFIED — live-verified | `findDuplicateMilestone` over uncapped list; probe.sh confirms zero collisions against 265 real titles |

No orphaned requirements — all 9 IDs (RELBR-01..05, RELMS-01..04) are mapped to Phase 88 in `.planning/REQUIREMENTS.md` and claimed across plans 88-01 through 88-11.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `gitlab.ts` | 1056-1070, 1119-1133 | 401/403/400 `message` cast only flattens `string`/`string[]`, not GitLab's object-keyed validation-error shape | ⚠ Warning (WR-01, still open) | Duplicate-title or other attribute-keyed rejections would render `[object Object]` in the dialog, the only error surface (D-15 forbids toasts) |
| `useReleaseDetail.ts` | 32-41 (docstring), `releaseMilestone.ts` 167-169 (JSDoc) | Stale doc comments describing pre-`f63e785a` scope ("Runs all 6 queries", "the source list is the ±7-day windowed milestone query") | ⚠ Warning (WR-07, still open) | Misleading to future maintainers in a codebase that treats header comments as spec |
| `ReleasesTab.tsx` | 309-325 | Two visually-identical "GitLab unavailable" chips can render side by side when both milestone and branch queries fail | ⚠ Warning (WR-08, still open) | Accessibility-tree ambiguity; distinguishing info lives only in the unreachable `title` attribute |
| `CreateBranchDialog.tsx` / `CreateMilestoneDialog.tsx` | ~36-39 / ~113-116 | `...(rest as [])` cast defeats the type system in the dismissal-lock wrapper, duplicated verbatim in both dialogs | ⚠ Warning (WR-09, still open) | Cosmetic type-safety gap; not currently exploitable since neither call site consumes `rest` |
| `gitlab.ts` | 296-329, 836-868 | Unbounded `while(true)`-style pagination with no page ceiling | ⚠ Warning (WR-06, still open, pre-existing) | A misbehaving server/proxy could hang the renderer; unverified against the team's live instance |

No unresolved TBD/FIXME/XXX debt markers found in the phase's changed files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `tsc --noEmit` clean | `npx tsc --noEmit` | No output | ✓ PASS |
| Phase-touched test files pass | `npx vitest run` on `ReleasesTab.test.tsx` + `release-detail/*` (8 files) | 8 files / 140 tests passed | ✓ PASS |
| Full suite | `npx vitest run` | 175 files / 2230 passed, 2 skipped, 13 todo | ✓ PASS |
| Lint baseline | `npx biome check src` | 2 errors (BacklogPage.tsx/BacklogRow.tsx, pre-existing baseline per project memory), 30 warnings | ✓ PASS (matches known baseline, no new errors in phase files) |
| Duplicate detection over full uncapped list | `npx vitest run src/routes/dashboard/release-detail/releaseMilestone.test.ts` | 25/25 passed, incl. D-06 ancestor-exclusion test | ✓ PASS |

### Probe Execution

`probe.sh` requires live GitLab credentials (`GITLAB_BASE_URL`, `GITLAB_PAT`, `PROJECT_ID`) and network access this verification pass does not have; it cannot be re-executed here. Per `88-11-SUMMARY.md`, it **was** executed by the user/orchestrator against `git.devel.sun.orange.sk` project 455 (265 milestones, `include_ancestors=true`) on 2026-08-10, with a verbatim recorded verdict: `PROBE B => PASS (project_id field present — D-07 local filter is viable)` and zero `COLLISION:` lines from Probe C. This is accepted as live evidence for RELMS-04 (Truth #9) — it is the one part of the phase with real-GitLab confirmation. Tasks 2-4 of the same plan (live create-branch, live create-milestone, restricted-PAT) were explicitly waived and are not substituted here.

### Human Verification Required

See `human_verification` in frontmatter. Three items, all stemming from the 88-11 wave-4 waiver:

1. Live create-branch write against a real GitLab project (RELBR-04).
2. Live create-milestone write + Releases-list propagation against a real GitLab project (RELMS-02) — the code-level fix (project-granular cache invalidation) is verified correct by direct reading, but has never been observed against a real GitLab response.
3. Restricted-PAT 401/403 error-message surfacing in both dialogs, including the still-open WR-01 object-shaped-message gap.

### Gaps Summary

The phase's three previously-confirmed blocker defects (old CR-01: false-positive missing-branch warning on the Releases list; old CR-02: wrong cache-invalidation granularity breaking cross-view milestone propagation; old CR-03: loading/error conflation making the Create-branch button silently unreachable) are all independently confirmed **closed** at HEAD by direct code reading — not by trusting SUMMARY.md or the stale 88-REVIEW.md. `resolveBranchState` carries a distinct `check-failed` variant evaluated ahead of the loading fallback with a working Retry button; `ReleasesTab.tsx` gates its drift indicator on `isSuccess` and shows a distinct error chip; `createMilestoneMutation` invalidates at project-level cache-key granularity.

A second round of drift was introduced and independently resolved entirely outside the plan sequence: commit `f63e785a` widened the create-dialog's reference list to the 5 most recent milestones by date but, in doing so, accidentally narrowed `findDuplicateMilestone`'s comparison scope to the same 5-entry slice — the opposite of its own commit message's claim. Commit `00669748`, applied roughly 13 minutes later, correctly separated the display-capped list from the duplicate-check's uncapped list, collapsed a newly-introduced duplicate paginated fetch, and repaired a test-mock gap that had made the new query's test coverage silently vacuous. All three of these are confirmed fixed by direct code reading (not by the 590ac19e `88-REVIEW.md`, whose `reviewed:` timestamp predates the `00669748` fix despite being the later git commit — that file is stale and should be regenerated before being relied on again).

What remains open is not a code defect but an evidence gap: the create-branch and create-milestone write paths — the core deliverable this phase promises ("create... when missing") — have **never executed against a real GitLab instance**. This was an explicit, informed user decision at the 88-11 wave-4 checkpoint, not an oversight, and is recorded as such in `88-11-SUMMARY.md`. Given that the code-level implementation is sound, well-tested, and the specific defects a reviewer would look for (reachability, cache propagation, error surfacing) have been found and fixed once already in this exact area, this verification treats the phase as code-complete but routes the outstanding live-write and restricted-PAT checks to human verification rather than failing the phase outright.

**Recommendation:** Un-waive and run 88-11 Tasks 2-4 (or an equivalent live smoke test) before treating this phase's write paths as production-trustworthy. WR-01 (object-shaped GitLab error messages) is worth fixing opportunistically since it directly affects what the restricted-PAT checkpoint will observe.

---

_Verified: 2026-08-10T22:20:00Z_
_Verifier: Claude (gsd-verifier)_
