---
phase: 88-release-branch-milestone-creation
verified: 2026-08-10T20:45:00Z
status: gaps_found
score: 6/9 must-haves verified (3 blocker defects compromise stated goal)
overrides_applied: 0
gaps:
  - truth: "RELBR-03: user sees a trustworthy release-level warning when the release branch is missing"
    status: failed
    reason: "CR-01 — the Releases-list missing-branch indicator (branchMissing) is derived from Set membership over `releaseBranches ?? []` with no isLoading/isError guard. It renders a false-positive 'No release branch' warning on every page load until the branch-set query resolves, and permanently if the query errors (401/403/500/timeout). The indicator's entire purpose is trustworthy drift signal; as implemented it defaults to 'drift' on absence of evidence rather than on confirmed absence."
    artifacts:
      - path: "taskflow/src/routes/dashboard/ReleasesTab.tsx"
        issue: "Line ~190: `const { data: releaseBranches } = useQuery(...)` discards isLoading/isError. Line ~246: `const branchMissing = derived !== null && !releaseBranchNames.has(derived);` has no branchesLoaded guard, unlike the milestone side which has a `milestonesError` chip."
    missing:
      - "Destructure isSuccess/isError from the gitlab-release-branches query and gate branchMissing on isSuccess"
      - "Surface a branch-fetch-error chip analogous to the existing milestonesError chip so a failed fetch reads as 'GitLab unavailable', not 'no branch'"
  - truth: "RELMS-02: after creating a GitLab milestone, its presence is reflected everywhere the release is shown, including the Releases list"
    status: failed
    reason: "CR-02 — createMilestoneMutation.onSuccess in useReleaseDetail.ts invalidates only the detail page's windowed milestone key (['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to], this-version ±7d). ReleasesTab caches the SAME key prefix but a DIFFERENT window (min..max of all fix versions ±7d). TanStack Query invalidateQueries matches by prefix, and the detail window array is not a prefix of the list window array, so the list's cache entry is never invalidated. A user who creates a milestone from the detail page and navigates back to Releases still sees 'No GitLab link' plus the missing-milestone warning triangle for up to the 5-minute staleTime."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
        issue: "Lines 186-198: createMilestoneMutation.onSuccess invalidates the byte-specific windowed key only, not the project-level ['gitlab-milestones', activeGitlabProject] prefix. The sibling createBranch mutation gets this right (invalidates project-level ['gitlab-release-branches', activeGitlabProject])."
    missing:
      - "Invalidate at project granularity: queryClient.invalidateQueries({ queryKey: ['gitlab-milestones', activeGitlabProject] }) so every window variant (detail page's and the list's) is covered"
  - truth: "RELBR-04: user can create the missing release branch off the GitLab project default branch from the release detail view"
    status: failed
    reason: "CR-03 — resolveBranchState conflates 'query in flight' with 'query errored': both leave branchExists === undefined, mapped to { kind: 'loading' }. useReleaseDetail.ts destructures only `data` from the gitlab-branch query, discarding isError. Any failure of the branch-existence check (401/403/500/timeout — real paths, since fetchBranch throws on non-404 errors) pins the sidebar at 'Loading...' indefinitely, with no error copy and no retry. Because the Create-branch button only renders for kind === 'missing', a user whose PAT lacks read_repository (or hits any transient failure) cannot reach the create action at all — the feature dead-ends silently."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
        issue: "Lines 118-136: gitlab-branch useQuery discards isError; branchState is computed from branchResult?.exists alone."
      - path: "taskflow/src/routes/dashboard/release-detail/releaseBranch.ts"
        issue: "resolveBranchState has no branchCheckFailed parameter and no 'check-failed' BranchState variant; branchExists === undefined always resolves to 'loading', including on real query errors."
    missing:
      - "Thread isError from the gitlab-branch query into resolveBranchState as a distinct signal"
      - "Add a 'check-failed' BranchState variant rendered as an error with a retry affordance in ReleaseDetailSidebar.tsx, evaluated before the undefined->loading fallback"
human_verification:
  - test: "Create a real release branch from the release detail view against a live GitLab project (default branch resolved from the API, not hardcoded)"
    expected: "Branch is created at the correct ref; the sidebar flips from 'missing' to 'exists' after invalidation; a 403 (protected-branch rule, missing api scope) surfaces GitLab's actionable message text, not a generic 'Failed to create branch'"
    why_human: "Both 88-05-T3 and 88-06-T3 live-GitLab checkpoints were explicitly waived by the user during execution. No create-branch or create-milestone write has ever executed against a real GitLab instance — only mocked-fetch unit tests exist for these write paths. The `search=release/` server-side filter semantics that populate the Releases-list branch set (D-18) are also unconfirmed against a real API."
  - test: "Create a real GitLab milestone from the release detail view against a live GitLab project"
    expected: "Milestone is created with the correct title and due_date; the detail sidebar and the Releases list both reflect the new milestone without a manual refresh or tab revisit beyond normal cache staleness"
    why_human: "Same waived-checkpoint gap as above (88-06-T3). Additionally CR-02 (confirmed in code) means this will observably fail on the Releases list even once the write itself is confirmed to work against real GitLab — see gap above."
  - test: "Confirm a 401/403 response from a real GitLab PAT lacking scope renders an actionable error inside the create dialogs, and confirm the Releases-tab branch-fetch-error path (once CR-01 is fixed) surfaces distinctly from a genuine missing-branch state"
    expected: "User sees GitLab's explanatory message body, not a generic failure string (WR-11); a failed fetch reads as 'GitLab unavailable' rather than false drift"
    why_human: "Requires a real GitLab token/project combination with restricted permissions; cannot be simulated meaningfully via mocked fetch alone for behavioral confidence."
---

# Phase 88: Release Branch / Milestone Creation — Verification Report

**Phase Goal:** Users can see whether the release branch and GitLab milestone exist for a release, and create either one directly from the release view when missing, so drift detection and corrective actions (later phases) always have a real branch/milestone to target.
**Verified:** 2026-08-10T20:45:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | RELBR-01: release branch name resolves as `release/<version>` from matched milestone title, version component only | VERIFIED | `releaseBranch.ts` `deriveReleaseBranchName`/`extractVersionFromMilestoneTitle`; 22 passing unit tests in `releaseBranch.test.ts` |
| 2 | RELBR-02: release detail view shows whether the release branch exists | VERIFIED (with caveat) | `useReleaseDetail.ts` fetches `gitlab-branch` via `fetchBranch`; `ReleaseDetailSidebar.tsx` renders exists/missing/loading/unresolvable/blocked/invalid-ref states. Caveat: see CR-03 — failure is silently indistinguishable from loading |
| 3 | RELBR-03: user sees a trustworthy release-level warning when the branch is missing (both detail view and Releases list) | **FAILED** | Detail-view sidebar row is directionally correct but shares CR-03's silent-failure gap. Releases-list indicator (`ReleasesTab.tsx`) is a confirmed false positive on load/error — see CR-01 below |
| 4 | RELBR-04: user can create the missing branch off the project default branch, behind a confirm dialog | **FAILED** (reachability) | `CreateBranchDialog.tsx` + `createBranchMutation` exist, use fetched `default_branch` (not hardcoded), invalidate on success, and are unit-tested. But CR-03 means the Create button is unreachable whenever the branch-existence check fails, and the entire write path has never executed against real GitLab (waived checkpoint) |
| 5 | RELBR-05: branch name validated against git-ref rules before creation | VERIFIED | `isValidGitRefName` in `releaseBranch.ts`, gates `invalid-ref` state before any create button renders; 12 dedicated unit tests (2 of which — WR-07 — use unescaped control-char literals, a code-quality warning, not a functional gap) |
| 6 | RELMS-01: user sees when no GitLab milestone matches the fix version | VERIFIED | Existing "No GitLab milestone matched" alert unchanged (confirmed untouched per plan intent); Releases-list `milestoneMissing` computed correctly (though WR-04 flags it fires on undated/already-released versions too — a secondary false-positive, not reviewed as blocker) |
| 7 | RELMS-02: user can create a GitLab milestone from the release view, behind a confirm dialog | **FAILED** (propagation) | `CreateMilestoneDialog.tsx` + `createMilestoneMutation` exist and are unit-tested; the detail page itself updates on success. But CR-02 means the Releases list — the other place this phase explicitly promises drift visibility (Plan 88-04) — never reflects the new milestone due to a cache-key window mismatch |
| 8 | RELMS-03: create dialog lists latest existing milestones for reference, lets user type final name | VERIFIED | `CreateMilestoneDialog.tsx` renders `ownWindowMilestones` as read-only reference list; format regex `MILESTONE_TITLE_FORMAT_RE` enforced; unit tests cover format enforcement (WR-01's leading-space prefill bug is a UX defect, not a missing capability) |
| 9 | RELMS-04: duplicate milestone title detected and blocked before creation | VERIFIED | `findDuplicateMilestone` in `releaseMilestone.ts`, whitespace/case-normalized comparison, ancestor-filtered via `project_id`; dedicated unit coverage |

**Score:** 6/9 truths independently verified as implemented; 3 are compromised by confirmed blocker defects that strike at the phase's core promise (trustworthy signal + reachable corrective action + list-level propagation).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` | Pure branch derivation/validation/state module | VERIFIED | React-free, exports match plan frontmatter, substantive logic, wired into hook and sidebar |
| `taskflow/src/routes/dashboard/release-detail/releaseMilestone.ts` | Pure milestone format/dedup module | VERIFIED | React-free, exports match, wired into hook and dialog |
| `taskflow/src/services/gitlab.ts` | fetchProject, fetchProjectBranches, fetchBranch, createBranch, createMilestone | VERIFIED | All five present; pagination fully walked (no page cap per review); `encodeURIComponent` on branch-name path segments confirmed by review |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Queries + mutations for branch/milestone state and creation | VERIFIED (exists/substantive/wired) but data-flow compromised | CR-02, CR-03 originate here |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | Release Branch MetaRow, all BranchState variants | VERIFIED (renders) | Renders 'Loading...' for both in-flight and errored states (CR-03 downstream effect) |
| `taskflow/src/routes/dashboard/release-detail/CreateBranchDialog.tsx` | Confirm-only create dialog | VERIFIED | Exists, unit-tested, presentational per D-21 |
| `taskflow/src/routes/dashboard/release-detail/CreateMilestoneDialog.tsx` | Confirm-only create dialog with format/dup validation | VERIFIED | Exists, unit-tested; WR-01 prefill bug noted as warning, not blocker |
| `taskflow/src/routes/dashboard/ReleasesTab.tsx` | Single paginated branch fetch + per-row drift icons | VERIFIED (exists/wired) but data-flow compromised | CR-01 originates here |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ReleasesTab.tsx` | `fetchProjectBranches` | single top-level `useQuery` | WIRED | Confirmed one query, not per-row |
| `ReleasesTab.tsx` `branchMissing` | `releaseBranchNames` Set | membership check | **WIRED BUT UNTRUSTWORTHY** | CR-01 — membership check has no loading/error guard |
| `useReleaseDetail.ts` `createBranchMutation.onSuccess` | `['gitlab-branch', ...]` + `['gitlab-release-branches', ...]` | `invalidateQueries` | WIRED | Both detail and list keys correctly invalidated — this is the pattern CR-02 fails to replicate |
| `useReleaseDetail.ts` `createMilestoneMutation.onSuccess` | `['gitlab-milestones', activeGitlabProject, milestoneWindow?.from, milestoneWindow?.to]` | `invalidateQueries` | **PARTIAL — WRONG KEY GRANULARITY** | CR-02 — only the detail-page window key invalidated, not project-level prefix; Releases-list window never matches |
| `useReleaseDetail.ts` `gitlab-branch` query | `resolveBranchState` | `branchExists: branchResult?.exists` | **PARTIAL — NO ERROR SIGNAL** | CR-03 — errored and loading states are indistinguishable |
| `CreateBranchDialog.tsx` / `CreateMilestoneDialog.tsx` | `useReleaseDetail.ts` mutations | props | WIRED | Presentational split confirmed (D-21) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ReleasesTab.tsx` row `branchMissing` icon | `branchMissing` | `releaseBranchNames` Set built from `gitlab-release-branches` query `data` | Only when query has resolved successfully; unguarded otherwise | ⚠️ HOLLOW on load/error — renders drift signal with no confirmed evidence |
| `ReleaseDetailSidebar.tsx` "Release Branch" row | `branchState` | `resolveBranchState({ branchExists: branchResult?.exists })` | Only distinguishes exists/missing when query succeeds; collapses errored to same UI as loading | ⚠️ HOLLOW on error — indistinguishable from in-flight, no recovery path |
| Releases-list milestone drift (`milestoneMissing`) after a successful create | `milestones` query `data` under list's own window key | Never invalidated by `createMilestoneMutation` | Stale after a real create until 5-min staleTime elapses | ⚠️ HOLLOW — cache never refreshed by the write it should observe |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| RELBR-01 | 88-01 | Branch name resolves as `release/<version>` | SATISFIED | `deriveReleaseBranchName` |
| RELBR-02 | 88-03 | User sees whether branch exists | SATISFIED (caveated by CR-03) | Sidebar row renders; but errors are silently invisible |
| RELBR-03 | 88-03, 88-04 | Warning when branch missing | **BLOCKED** | CR-01 makes the list-level warning untrustworthy (false positives) |
| RELBR-04 | 88-05 | User can create branch, confirm dialog | **BLOCKED** (reachability + unverified live) | CR-03 makes the create button unreachable on check failure; live-GitLab checkpoint waived |
| RELBR-05 | 88-01, 88-05 | Git-ref validation before creation | SATISFIED | `isValidGitRefName` |
| RELMS-01 | 88-01 (implicit), pre-existing | User sees no-match state | SATISFIED | Unchanged existing alert confirmed |
| RELMS-02 | 88-06 | User can create milestone, confirm dialog | **BLOCKED** (propagation + unverified live) | CR-02 breaks list-level reflection; live-GitLab checkpoint waived |
| RELMS-03 | 88-06 | Reference list + typed name | SATISFIED | Confirmed rendering (WR-01 is a secondary UX defect on prefill, not a missing capability) |
| RELMS-04 | 88-01, 88-06 | Duplicate detection blocks creation | SATISFIED | `findDuplicateMilestone` |

No orphaned requirements — all 9 IDs (RELBR-01..05, RELMS-01..04) are mapped to Phase 88 in `.planning/REQUIREMENTS.md` and claimed across plans 88-01 through 88-06.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `ReleasesTab.tsx` | ~190, ~246 | Query result state discarded (`isLoading`/`isError` unused) feeding a user-facing drift signal | 🛑 Blocker (CR-01) | False-positive warning on every load / permanent on error |
| `useReleaseDetail.ts` | 186-198 | Cache invalidation at wrong key granularity | 🛑 Blocker (CR-02) | Successful write invisible on Releases list |
| `useReleaseDetail.ts` / `releaseBranch.ts` | 118-139 / 129-133 | Loading and error states conflated (`undefined` used for both) | 🛑 Blocker (CR-03) | Create action unreachable, no recovery, no explanation |
| `CreateMilestoneDialog.tsx` | 68-70 | Invalid leading-space title prefill | ⚠️ Warning (WR-01) | Dialog opens already invalid |
| `gitlab.ts` | 1052-1055, 1109-1112 | 401/403 discards response body before extracting `message` | ⚠️ Warning (WR-11) | Least-covered path (write ops) shows generic error, no cause |
| `ReleasesTab.tsx` | 243 | `milestoneMissing` fires on undated/already-released versions | ⚠️ Warning (WR-04) | Secondary false-positive, duplicates existing "No date set" badge |
| `CreateBranchDialog.tsx` / `CreateMilestoneDialog.tsx` | various | Cancel/Escape/backdrop remain live during write | ⚠️ Warning (WR-03) | Silent failure swallowing on dismiss mid-flight |
| `ReleaseDetailPage.tsx` / `useReleaseDetail.ts` | 369 / 169, 181 | `activeGitlabProject ?? 0` fallback on mutations (queries are guarded, mutations are not) | ⚠️ Warning (WR-10) | Duplicate detection silently disabled; would POST to project 0 |
| `releaseBranch.test.ts` | 124, 128 | Raw unescaped control bytes in test source | ⚠️ Warning (WR-07) | Test fragile to encoding round-trips |

No unresolved TBD/FIXME/XXX debt markers found in the phase's changed files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite for phase-touched files | `npx vitest run` on 8 touched test files | 187/187 passed | ✓ PASS (but does not exercise the loading/error/cache-window edge cases that CR-01/02/03 depend on — confirmed by direct code reading, not by test failure) |

### Probe Execution

Not applicable — `probe.sh` exists in the phase directory but targets earlier research/discovery, not this verification's runnable-check scope; no `scripts/*/tests/probe-*.sh` conventional probes declared in PLAN/SUMMARY files for this phase.

### Human Verification Required

See `human_verification` in frontmatter. Both live-GitLab write checkpoints (88-05-T3 create-branch, 88-06-T3 create-milestone) were explicitly waived by the user during execution — no `createBranch` or `createMilestone` call has ever executed against a real GitLab instance. Coverage is mocked-fetch unit tests only. This is independent of, and in addition to, the three confirmed code-level blockers above.

### Gaps Summary

The phase delivers substantial, well-tested infrastructure: pure derivation/validation modules, five new GitLab service functions with correct pagination and encoding, two new dialogs, and full prop/hook wiring. Six of nine observable truths hold cleanly under direct code inspection.

However, the code review (88-REVIEW.md) identified three blocker-severity defects, and all three are independently confirmed here by reading the exact lines in question:

1. **CR-01** undermines the "users can see whether the branch exists" half of the goal at the list level — the indicator is a false positive on every page load and a permanent false positive on any branch-fetch error, which is precisely backwards for a trust signal whose entire purpose is drift detection.
2. **CR-03** undermines the "create... when missing" half of the goal at the detail level — any failure of the branch-existence check (not a hypothetical; `fetchBranch` throws on 401/403/500/timeout) leaves the sidebar pinned at "Loading..." forever with the Create button unreachable and no error, no retry.
3. **CR-02** undermines cross-view consistency, which Plan 88-04 explicitly promised as this phase's differentiator ("the user explicitly overrode a scope-conservative recommendation" to get list-level visibility) — a successful milestone create is invisible on the Releases list for up to 5 minutes (or indefinitely if the tab stays mounted), directly contradicting the phase's stated purpose of giving later phases (drift detection) "a real branch/milestone to target" with a signal users can trust.

These are not edge-case nitpicks — they strike at the exact quality (trustworthy signal, reachable action) the goal's own wording calls out. Combined with the two waived live-GitLab checkpoints (the write paths have never executed against a real GitLab instance), the phase goal is not yet reliably achieved in production conditions, despite substantial and mostly correct implementation.

**Recommendation:** Route back through `/gsd-plan-phase --gaps` to close CR-01/CR-02/CR-03 (all three have concrete, small fixes already specified in 88-REVIEW.md) before considering this phase complete. The live-GitLab checkpoints should also be un-waived and actually run once the fixes land, since CR-03 specifically affects the error paths those checkpoints would have exercised.

---

_Verified: 2026-08-10T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
