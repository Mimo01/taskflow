---
phase: 90-per-mr-corrective-actions
verified: 2026-08-11T14:04:11Z
status: human_needed
score: 4/4 must-haves verified (code + automated evidence); 2 open items flagged for human decision
overrides_applied: 0
human_verification:
  - test: "Re-confirm MRFIX-03 independence and the CR-01 rollback fix on live GitLab (interleaved BR-pending -> MS-success -> BR-failure on one row)"
    expected: "MS cell stays green/idle after BR fails; MS's milestone write is not reverted by BR's rollback"
    why_human: "The Plan 04 live UAT (blanket 'approved' for all 10 steps) was run BEFORE the CR-01 critical-bug fix (commit 8e8e4676, applied post-review). CR-01 was exactly a rollback defect that clobbered a concurrent successful write — the same scenario UAT step 6 (Independence) and step 7 (Failure+retry) exercised. The automated test suite now has a dedicated regression test for this exact sequence (`useMrFixMutation.test.tsx` — 'CR-01: a BR rollback that lands after a successful MS write leaves the milestone patch intact...') and it passes, but no human has watched the fixed code do this against real GitLab data."
  - test: "Run the roadmap-mandated D-16 probe (approvals / protected-branch fact base) against live GitLab with a real PAT"
    expected: "reset_approvals_on_push, sample MR approved_by, and protected_branches are recorded in 90-PROBE-RESULTS.md; A1 gets a real verdict"
    why_human: "No GitLab PAT was reachable in any execution environment across all 4 plans. 90-PROBE-RESULTS.md is status: not-run and RESEARCH Open Question A1 is UNRESOLVED (probe D skipped). Per D-16 this changes no UI regardless of outcome, so it does not block the goal, but it is an honest outstanding item the roadmap explicitly asked for."
---

# Phase 90: Per-MR Corrective Actions Verification Report

**Phase Goal:** Users can fix flagged drift directly from an MR's row — retarget to the release branch and/or assign the release milestone — each as an independently retryable, optimistic action with no confirm dialog and no inline warning (per user decision).
**Verified:** 2026-08-11T14:04:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can retarget a flagged MR to the release branch from its row, optimistic + rollback, no confirm/warning | ✓ VERIFIED (code+tests) / UNCERTAIN (live, see human item) | `updateMergeRequest` in `gitlab.ts:1113-1156` PUTs only `target_branch`; `DriftActionCell` in `MrDriftSection.tsx:297-310` is a real `<button>` firing `useMrFixMutation`; no `confirm(`/`Dialog`/`toast(` anywhere in the two touched UI files (grep confirmed empty); optimistic patch verified in `useMrFixMutation.ts:88-108`, rollback via field-scoped inverse patch `onError` (lines 212-222). Live GitLab persistence was UAT-approved but predates the CR-01 fix (see human item below) |
| 2 | User can assign the release milestone to a flagged MR from its row, optimistic + rollback | ✓ VERIFIED (code+tests) | Same mechanism, `action: 'assign-milestone'` sends `{ milestone_id: milestone.id }` (`useMrFixMutation.ts:177-180`); patch writes `milestone: {id,title}` (matches `GitLabMR.milestone`'s narrow shape) |
| 3 | Each action shows its own per-row status and is independently retryable without affecting the other | ✓ VERIFIED — dedicated regression test | `useMrFixMutation` is called once per (MR, action) cell — separate `useMutation`/`useState` per instance (`useMrFixMutation.ts:142-160`). CR-01 (a critical review finding: whole-array rollback clobbering a sibling cell's successful write) was fixed in commit `8e8e4676` — rollback is now a field-scoped inverse patch (`onMutate`/`onError`, lines 200-222). A dedicated test — `useMrFixMutation.test.tsx:531` `'CR-01: a BR rollback that lands after a successful MS write leaves the milestone patch intact in every channel cache'` — asserts actual cache CONTENTS (not just hook status) after BR-pending → MS-success → BR-failure and passes (verified by direct re-run: 1 passed). Independent per-cell lock (`fire()` no-ops while pending) and independent status also covered by the `independent` test in `MrDriftSection.test.tsx` |
| 4 | Retarget is unavailable/disabled while the release branch does not exist | ✓ VERIFIED | `actionable` in `DriftActionCell` requires `fix.releaseBranchExists && fix.releaseBranchName != null` for retarget (`MrDriftSection.tsx:172-177`); inert branch renders a non-button `<span>` with the verbatim D-14 tooltip (`MrDriftSection.tsx:283-293`); test `'unavailable: with no release branch, drift-br is not a button, a click calls nothing, and MS on the same row is still actionable'` (`MrDriftSection.test.tsx:678`) directly asserts `tagName !== 'BUTTON'`, zero `updateMergeRequest` calls after click, and MS stays actionable. Re-run confirmed passing |

**Score:** 4/4 truths hold at the code/automated-test level. Two open items (below) are surfaced for human decision, not classified as failures — the underlying mechanism they concern is independently proven by a passing regression test.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` — `flattenGitLabError`, `updateMergeRequest` | Error normaliser + PUT endpoint | ✓ VERIFIED | Both exported, explicit-pick body construction confirmed (no spread/stringify), WR-01/WR-02 fixes present (empty-string→undefined, nested-object JSON.stringify fallback) |
| `taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts` | Per-(MR,action) mutation hook + cache helpers | ✓ VERIFIED | `patchMrInChannelCaches`, `invalidateMrChannelCaches`, `useMrFixMutation` all present; `restoreMrChannelCaches` correctly REMOVED (CR-01 fix eliminated the whole-array-restore footgun per the reviewer's suggested fix) |
| `taskflow/src/routes/dashboard/release-detail/mrChannelKeys.ts` | Shared query-key factory (WR-06 fix) | ✓ VERIFIED | New file; both `useReleaseDetail.ts` (query sites) and `useMrFixMutation.ts` (patch/invalidate sites) import from it — grep confirms both ends now agree by construction, not by duplicated literals |
| `taskflow/src/routes/dashboard/release-detail/MrDriftSection.tsx` — `DriftActionCell`, `applyHeldOrder` | Interactive BR/MS cells + frozen sort | ✓ VERIFIED | Both present; WR-05 (focus-preserving pending state), WR-08 (error branch gated on `actionable`, auto-clears on `mark === 'ok'`), WR-09 (`heldForVersion` ref resets order per `versionId`) all independently confirmed in the read source |
| `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` | `fix` prop wiring | ✓ VERIFIED | `fix={{ ... releaseBranchExists: branchState.kind === 'exists' ... }}` present at the call site |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `DriftActionCell` | `useMrFixMutation` | hook call | ✓ WIRED | One instance per cell, confirmed unconditional call (Rules of Hooks) |
| `patchMrInChannelCaches` | `queryClient.setQueriesData` | prefix-matched patch | ✓ WIRED | Uses `mrChannelKeys.channelForProject` two-element keys exclusively |
| `useReleaseDetail` query sites | `mrChannelKeys` | shared key factory | ✓ WIRED | `useReleaseDetail.ts:356,371,389` all import and call `mrChannelKeys.*` |
| `ReleaseDetailPage` | `MrDriftSection` `fix` prop | `branchState.kind === 'exists'` | ✓ WIRED | Confirmed at call site |

### Anti-Patterns Found

None. No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any of the five phase-owned source files. No `confirm(`, `Dialog`, or `toast(` calls in the touched UI files (D-16 requirement).

### Code Review Follow-Through (90-REVIEW.md)

The review found 1 critical (CR-01) + 9 warnings (WR-01..WR-09) + 3 info items. All 9 fix commits were located in git log (`8e8e4676` through `ced51a6b`) and the corresponding source was read directly to confirm each fix is real, not just claimed:

| ID | Claim | Verified in code |
|----|-------|-------------------|
| CR-01 | Field-scoped rollback, no whole-array restore | ✓ `restoreMrChannelCaches` removed; `onError` uses inverse-patch; dedicated cache-content regression test passes |
| WR-01 | Empty flattened message returns `undefined`, not `''` | ✓ `gitlab.ts` final `return flat !== undefined && flat.length > 0 ? flat : undefined` |
| WR-02 | Nested object field value no longer `[object Object]` | ✓ `JSON.stringify(errs)` fallback added |
| WR-03 | One falsy-projectId convention | ✓ `if (!projectId) return undefined;` in `onMutate`, matches `onSettled`'s `if (projectId)` |
| WR-04 | Doc/behavior mismatch on baseUrl leak | ✓ doc comment corrected, message literal is `'Cannot reach GitLab — check the base URL'` (no interpolation) |
| WR-05 | Pending state preserves focus, error is announced | ✓ pending renders `<button aria-disabled aria-busy>` (not a span); `role="status" aria-live="polite"` live region present |
| WR-06 | Channel key literals de-duplicated | ✓ `mrChannelKeys.ts` created, both producer and consumer sides import it |
| WR-07 | Patch type narrowed, undefined-valued keys stripped | ✓ `MrFixPatch` type + `Object.entries(patch).filter(([, v]) => v !== undefined)` |
| WR-08 | Error branch gated on `actionable`; clears when `mark` becomes `ok` | ✓ both behaviors present (`!actionable` non-interactive branch; `lastMarkRef`-gated `reset()` call) |
| WR-09 | Held order resets per release | ✓ `heldForVersion` ref compares `versionId` and resets `orderRef` |

Info items (IN-01, IN-02, IN-03) were NOT all addressed (e.g. IN-01 — `onSuccess` still discards the server-returned `GitLabMR` rather than patching with it) — acceptable, these are info-severity, non-blocking suggestions, not must-haves.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| MRFIX-01 | Retarget MR to release branch, optimistic + rollback, no dialog | ✓ SATISFIED (code/tests) | See Truth 1 |
| MRFIX-02 | Assign release milestone, optimistic + rollback | ✓ SATISFIED | See Truth 2 |
| MRFIX-03 | Independent per-row status/retry | ✓ SATISFIED | See Truth 3, CR-01 regression test |
| MRFIX-04 | Retarget unavailable without release branch | ✓ SATISFIED | See Truth 4 |

No orphaned requirements — REQUIREMENTS.md maps exactly MRFIX-01..04 to Phase 90 and all four appear in plan frontmatter `requirements:` fields.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| CR-01 regression (cache-content assertion after interleaved BR-fail/MS-success) | `npx vitest run useMrFixMutation.test.tsx -t "CR-01"` | 1 passed | ✓ PASS |
| MRFIX-04 unavailable-state | `npx vitest run MrDriftSection.test.tsx -t "unavailable"` | 1 passed | ✓ PASS |
| flattenGitLabError shapes | `npx vitest run gitlab.test.ts -t "flattenGitLabError"` | 9 passed | ✓ PASS |
| Full release-detail + gitlab suite | `npx vitest run src/routes/dashboard/release-detail/ src/services/gitlab.test.ts` | 366 passed | ✓ PASS |
| Type check | `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Biome baseline | `npx biome check ./src` | 16 diagnostics, all in `BacklogPage.tsx`/`BacklogRow.tsx`/`chart.tsx`/`MyTasksPage.tsx(.test.tsx)` — none in any Phase 90 file | ✓ PASS (matches documented, pre-existing baseline) |
| No confirm/dialog/toast in touched UI files | `grep -nE "confirm\(|Dialog|toast\(" MrDriftSection.tsx useMrFixMutation.ts` | no matches | ✓ PASS |

### Probe Execution

`probe.sh` exists and is syntactically valid but was never executed against live GitLab in any of the 4 plans — no PAT was reachable in any execution environment. `90-PROBE-RESULTS.md` is honestly recorded as `status: not-run`, and RESEARCH Open Question A1 is `UNRESOLVED (probe D skipped)`. Per D-16 (explicit, twice-reaffirmed user decision) this is documentation-only and changes no UI regardless of outcome — `flattenGitLabError` already handles all three known error-body shapes defensively. Not a code blocker; carried forward as an open item (see Human Verification below).

### Human Verification Required

#### 1. Re-confirm MRFIX-03/CR-01 independence live, post-fix

**Test:** On a release detail page with a row flagged in both BR and MS, click BR (leave it slow/in-flight if possible), then click MS while BR is still pending, then force BR to fail (e.g. disconnect network or target a protected branch).
**Expected:** MS's cell stays green/idle; BR's failure rollback does not revert MS's already-successful milestone assignment.
**Why human:** The Plan 04 UAT was approved as one blanket "approved" for all 10 steps, and it ran BEFORE the CR-01 fix (commit `8e8e4676`) was applied during code review — the review found this exact scenario broken with a reproduced test. The fix is now covered by a passing automated cache-content regression test, but no human has watched the corrected code do this against real GitLab data since the fix landed.

#### 2. Run the roadmap D-16 probe with a live GitLab PAT

**Test:** Run `.planning/phases/90-per-mr-corrective-actions/probe.sh` with real `GITLAB_BASE_URL`, `GITLAB_PAT`, `PROJECT_ID`, `SAMPLE_MR_IID`, `SCRATCH_MR_IID`.
**Expected:** `90-PROBE-RESULTS.md`'s `## Raw output`/`## Findings`/`## A1 resolution` get replaced with real GitLab data; RESEARCH A1 gets a real verdict.
**Why human:** No PAT was reachable in any execution environment across all 4 plans; it lives in the Tauri Stronghold vault. Non-blocking per D-16 (no UI changes regardless of outcome), but it's an explicit roadmap deliverable that remains unfulfilled.

### Gaps Summary

No FAILED must-haves. All four roadmap success criteria are demonstrably true at the code and automated-test level, including a targeted regression test for the exact defect (CR-01) that the code review found and that most directly threatens the "independent retry" success criterion. The phase is not blocked, but two items should be surfaced to the developer for a decision: (1) whether the existing live-UAT approval is sufficient given it predates the CR-01 fix, or whether a short re-check is warranted before this ships to real users; (2) whether to schedule the still-unrun D-16 probe.

---

_Verified: 2026-08-11T14:04:11Z_
_Verifier: Claude (gsd-verifier)_
