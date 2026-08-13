---
phase: 91-post-release-merge-back-verification
verified: 2026-08-12T00:20:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "MERGE-03: the verdict is presented as advisory with a manual override"
    reason: "User decision D-12 (91-CONTEXT.md), given twice ('I dont want to store anything', then 'no override control at all'), explicitly descopes MERGE-03. ROADMAP.md Phase 91 success criterion 3 records this descope directly. Same precedent as DASH-06 (P84) and DRIFT-09 (P89) — absence is not a gap."
    accepted_by: "user (via 91-CONTEXT.md D-12)"
    accepted_at: "2026-08-11"
re_verification:
  previous_status: gaps_found
  previous_score: 6/7
  gaps_closed:
    - "91-VERIFICATION truth 6 (Release Branch row asserted 'No matching tag found' while the tag channel was pending or had failed): closed by 91-09. TagChannelHealth ('resolved'|'pending'|'failed') is now exported from releaseBranch.ts, threaded as a required field on BranchState's 'released' variant, derived in useReleaseDetail.ts as tagCheckFailed ? 'failed' : tagLookupPending ? 'pending' : 'resolved' (failed tested before pending, matching mergeBackVerification.ts step 4.5), and passed into the resolveBranchState call alongside releaseTagName. ReleaseDetailSidebar.tsx's released-row tooltip now branches failed-then-pending-then-resolved, only when tagName is null, and the resolved-null-tag sentence is preserved byte-for-byte. Confirmed by direct source read of releaseBranch.ts:87-219, useReleaseDetail.ts:200-252, and ReleaseDetailSidebar.tsx:257-274 — not by trusting 91-09-SUMMARY.md's narrative."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification: []
---

# Phase 91: Post-Release Merge-Back Verification Verification Report

**Phase Goal:** Once a Jira fix version is marked released, users can see — as an advisory verdict, never a hard blocker — whether `release/[tag]` has actually been merged back into the project default branch, closing the release-coordination loop.
**Verified:** 2026-08-12T00:20:00Z
**Status:** passed
**Re-verification:** Yes — fourth pass, after gap-closure round 3 (plan 91-09) against the prior 91-VERIFICATION.md's remaining gap (truth 6)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a released fix version's detail page, a "Merged back" row exists, is threaded end-to-end, and hides for unreleased/unmatched cases | ✓ VERIFIED (regression, unchanged) | `mergeBackVerdict` flows `useReleaseDetail.ts` (L310-324) → `ReleaseDetailPage.tsx` → `ReleaseDetailSidebar.tsx`; hidden case gated on `!releasedVersion \|\| !hasMatchedMilestone` in `resolveMergeBackVerdict` step 1 |
| 2 | A tracking MR merged into a branch other than the fetched default branch is never read as merge-back evidence (CR-01, round 1) | ✓ VERIFIED (regression, unchanged) | `TrackingMR` projects `target_branch`; step 4 filters `mr.state === 'merged' && mr.target_branch === defaultBranch` |
| 3 | `compareRefs` never reads a malformed comparison payload as a positive "no diff" verdict (CR-02, round 1) | ✓ VERIFIED (regression, unchanged) | `gitlab.ts` throws when `!Array.isArray(body.diffs) \|\| !Array.isArray(body.commits)` before the diffCount/commitCount assignment |
| 4 | The row resolves to a terminal state (not an infinite spinner) for an unparseable milestone title or a failed default-branch fetch (CR-03/CR-04, round 1) | ✓ VERIFIED (regression, unchanged) | `defaultBranchCheckFailed`/`trackingMRsUnavailable` threaded through; resolver steps 2/3 both terminate at `couldnt-verify` rather than looping at `loading` |
| 5 | The tag evidence channel carries both an in-flight signal and a failure signal into `resolveMergeBackVerdict`, so the "Merged back" row never shows a false terminal claim while the tag lookup is pending or has failed (round 2) | ✓ VERIFIED (regression, unchanged) | `searchProjectTags` (`gitlab.ts:363-403`) throws on transport failure, 401/403, other non-ok status, and non-array body; `useReleaseDetail.ts:202-242` derives `tagCheckFailed`/`tagLookupPending`/`tagChannel`, all flow into `resolveMergeBackVerdict` (L310-324) |
| 6 | The "Release Branch" row (D-08) reports only tag facts it has actually obtained — it never asserts "No matching tag found" while the tag lookup is in flight or has failed | ✓ VERIFIED — gap closed this round (91-09) | `releaseBranch.ts:101` exports `TagChannelHealth = 'resolved' \| 'pending' \| 'failed'`; the `released` `BranchState` variant (L124) carries a required `tagChannel` field; `resolveBranchState` (L162-219) threads it through unchanged precedence; `useReleaseDetail.ts:238-252` derives `tagChannel` (failed-before-pending) and passes it into `resolveBranchState`'s call; `ReleaseDetailSidebar.tsx:257-274` branches the tooltip failed→"Couldn't check for a matching tag." / pending→"Checking for a matching tag…" / resolved-null→unchanged "No matching tag found…" sentence. Confirmed by direct source read of all three files, not the SUMMARY narrative |
| 7 | No manual override, confirm, dismiss, or acknowledge control exists anywhere near the verdict, and nothing persists (MERGE-03) | ✓ PASSED (override — intentional descope, D-12) | `grep -Ein "override\|dismiss\|acknowledge"` on `ReleaseDetailSidebar.tsx` and `useReleaseDetail.ts` returns 0 matches; `RowAction` count unchanged at 3, none inside the "Merged back" or "Release Branch" released blocks |

**Score:** 7/7 truths verified (6 pass on direct re-read + 1 override for the intentionally descoped MERGE-03)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` — `searchProjectTags`, `fetchSourceBranchMRs`, `compareRefs`, `GitLabCompareResult` | All four evidence-channel fetchers fail closed via `apiFetch`, none swallow errors into a data-shaped value | ✓ VERIFIED | Unchanged from round 2, re-confirmed by direct read (L363-403) |
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` | `MergeBackVerdict` + `resolveMergeBackVerdict`, every one of the four evidence channels degrading safely | ✓ VERIFIED | Unchanged from round 2, out of scope for 91-09 (scope fence honored — no edits to this file this round) |
| `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` | `resolveBranchState` reports only tag facts the tag channel has actually resolved | ✓ VERIFIED — updated this round | `TagChannelHealth` type (L101), widened `released` variant with required `tagChannel` (L124), `resolveBranchState` threads it through at L215 with unchanged precedence order (confirmed: 8 distinct `kind` values still returned, no new early return added) |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | "Merged back" `MetaRow` renders all 5 verdict kinds correctly, zero interactive controls; "Release Branch" row states only what it knows | ✓ VERIFIED | "Merged back" row unchanged and correct (re-confirmed). "Release Branch" row: released-state tooltip (L257-274) now branches on `tagChannel`; "No matching tag found" appears exactly once in the file, reachable only when `tagChannel === 'resolved'` |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Two gated queries + resolver call + `mergeBackVerdict`/`branchState` in return, with complete error/loading signal reaching BOTH consumers of the tag channel | ✓ VERIFIED | `tagChannel` derivation (L238-242) reaches both `resolveBranchState` (L244-252) and `resolveMergeBackVerdict` (L310-324) — the gap this round closed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useReleaseDetail.ts` | `services/gitlab.ts` `searchProjectTags`/`fetchSourceBranchMRs`/`compareRefs` | three gated `useQuery` calls | ✓ WIRED | Unchanged, re-confirmed; all three fetchers fail closed |
| `useReleaseDetail.ts` tag channel (`tagLookupPending`/`tagCheckFailed`) | `mergeBackVerification.ts` `resolveMergeBackVerdict` | direct params (L318-320) | ✓ WIRED | Unchanged from round 2, re-confirmed |
| `useReleaseDetail.ts` tag channel (`tagChannel`) | `releaseBranch.ts` `resolveBranchState` | `tagChannel` param on the call (L251) | ✓ WIRED — gap closed this round | Confirmed by direct source read; this is the exact link the prior verification recorded as NOT WIRED |
| `mergeBackVerification.ts` resolver output | `ReleaseDetailSidebar.tsx` "Merged back" row rendering | `verdict.kind` ternary chain | ✓ WIRED | Unchanged, re-confirmed |
| `releaseBranch.ts` resolver output (`branchState.tagChannel`) | `ReleaseDetailSidebar.tsx` "Release Branch" row tooltip | three-way ternary on `tagChannel`, gated on `tagName === null` | ✓ WIRED | The value now carries enough information to distinguish "resolved to nothing" from "still resolving" from "failed to resolve"; the row states only what it knows |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| "Merged back" row | `mergeBackVerdict` | `resolveMergeBackVerdict(...)` fed by live `fetchSourceBranchMRs`/`compareRefs`/`fetchProject`/`searchProjectTags` queries, all four channels guarded | Yes — real GitLab API calls, no stubs | ✓ FLOWING, TRUSTWORTHY |
| "Release Branch" row (released state) | `branchState.tagName` + `branchState.tagChannel` | `resolveBranchState(...)` fed by the same `searchProjectTags` query, now with the channel-health signal | Yes — the row can now distinguish "resolved to nothing," "still resolving," and "failed to resolve," and words the tooltip accordingly | ✓ FLOWING, TRUSTWORTHY — gap closed |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `TagChannelHealth` exported and required on `released` variant | `grep -n "export type TagChannelHealth" releaseBranch.ts` / read `BranchState` union | present, `tagChannel: TagChannelHealth` with no `?` on the variant | ✓ PASS |
| Tag channel reaches `resolveBranchState` | `grep -n "tagChannel" useReleaseDetail.ts` and the `resolveBranchState(` call site | derivation at L238-242, passed at L251 | ✓ PASS — new gap from round 3 closed |
| "No matching tag found" only reachable when resolved | `grep -c "No matching tag found" ReleaseDetailSidebar.tsx` | exactly 1, inside the `tagChannel === 'resolved'` (implicit else) branch of the ternary at L263-267 | ✓ PASS |
| Pending/failed tooltip strings present | `grep -c "Checking for a matching tag" / "Couldn't check for a matching tag"` | exactly 1 each | ✓ PASS |
| No override/dismiss/acknowledge control introduced | `grep -Ein "override\|dismiss\|acknowledge" ReleaseDetailSidebar.tsx useReleaseDetail.ts` | 0 matches | ✓ PASS — MERGE-03/D-12 descope holds |
| Targeted 5-file suite green with increased count | `npx vitest run src/services/gitlab.test.ts src/routes/dashboard/release-detail/mergeBackVerification.test.ts src/routes/dashboard/release-detail/releaseBranch.test.ts src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | 5 files, 303 tests, all passed (up from 244) | ✓ PASS — independently re-run, not trusted from SUMMARY |
| Typecheck clean | `cd taskflow && npx tsc --noEmit` | exit 0, no output | ✓ PASS — independently re-run |
| `biome check` on release-detail directory + gitlab.ts/gitlab.test.ts | `npx biome check src/routes/dashboard/release-detail/ src/services/gitlab.ts src/services/gitlab.test.ts` | "Checked 34 files in 33ms. No fixes applied." | ✓ PASS |
| Full project test suite green | `npx vitest run` (whole repo) | 180 files passed, 2 skipped, 2466 tests passed, 13 todo | ✓ PASS — matches the context claim, independently re-run |
| Commit hashes from 91-09-SUMMARY.md exist in git log | `git log --oneline -15` | `fe4e2ee6`, `af2612ad`, `dc26b23d`, `5dc1ce32` all present, plus the review refresh `5b0cf47c` | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MERGE-01 | 91-01 through 91-09 PLAN.md | User sees whether `release/[tag]` merged into default branch, once released | ✓ SATISFIED | The "Merged back" row is fully correct across all four evidence channels; the sibling "Release Branch" row's wording gap (truth 6) is now closed by 91-09, so both rows in this feature state only what they know |
| MERGE-02 | 91-01, 91-02, 91-03, 91-04, 91-05, 91-07, 91-08 | Detection prefers tracking MR state, falls back to content comparison, with every channel degrading safely | ✓ SATISFIED | All four evidence channels carry both an in-flight and a failure signal into `resolveMergeBackVerdict`, unchanged and re-confirmed this round |
| MERGE-03 | 91-03, 91-06, 91-08 | Verdict presented as advisory with a manual override | ✓ SATISFIED (via recorded descope) | D-12 (91-CONTEXT.md) is a hard, twice-given user decision descoping the override; ROADMAP.md success criterion 3 already records this; no override exists in code, matching the decision |

No orphaned requirements — REQUIREMENTS.md maps only MERGE-01/02/03 to Phase 91 (lines 50-52, 109-111), and all three are addressed above.

### Anti-Patterns Found

None introduced by 91-09 that rise to blocker level against this phase's own must-haves. The freshly-committed 91-REVIEW.md (covering 91-01..91-09, superseding the prior review) raises findings that are cross-checked below against the success criteria rather than re-litigated as verification gaps:

| File | Line | Pattern | Severity | Cross-check against phase goal |
|------|------|---------|----------|------|
| `services/gitlab.ts` | 398-403 (`searchProjectTags`) | Validates the array wrapper but not element shape before casting to `GitLabTag[]`; a malformed-but-array-shaped 200 body can crash `findReleaseTag` in the render phase (91-REVIEW CR-01, escalated to critical this round) | 🛑 Blocker (per code review) but **not a phase-goal blocker** | Reachable only on a malformed/adversarial API response shape (proxy interstitial or error body that happens to be array-shaped), not on any of the three enumerated tag-channel states (resolved/pending/failed) this phase's must-haves define. Does not contradict any of the 7 observable truths above — it is a robustness gap in an edge case outside the phase's scoped truths, not evidence the advisory verdict is wrong or blocking in normal operation. Recommend a follow-up plan; not gating this verification |
| `releaseBranch.ts` | 120-123 (doc comment) vs `:178` (optional param w/ default) | The "REQUIRED — type-system enforcement" doc claim overstates what the type system actually enforces, since the sole producer (`resolveBranchState`) accepts an optional, defaulted param (91-REVIEW WR-01) | ⚠️ Warning | The current single call site (`useReleaseDetail.ts:251`) does pass `tagChannel` correctly — confirmed by direct read. This is a documentation-accuracy / future-regression-risk concern, not a present defect in truth 6 |
| `useReleaseDetail.ts` | 238-252 | No hook-level test asserts the `tagChannel` derivation itself reaches `resolveBranchState` with the right value (91-REVIEW WR-02) | ⚠️ Warning | Functionally verified correct by direct source read (both this pass and cross-referenced against the derivation logic); a coverage gap, not a broken behavior |
| `ReleaseDetailSidebar.tsx` | 257-274 | Tag-channel distinction lives only in the `title` attribute — invisible without hover, absent from a useful accessible form (91-REVIEW WR-03) | ⚠️ Warning | An accessibility/UX quality concern outside grep-verifiable scope — noted for human verification consideration, does not block the "user can see the advisory verdict" truth since the information is present, just not maximally discoverable |

### Human Verification Required

None required to determine phase-goal achievement. WR-03 (tag-channel distinction only in `title` attribute, not visible without hover) is a legitimate UX/accessibility polish item, but the phase's success criteria and must-haves do not require a specific accessibility affordance beyond the existing `title`-attribute pattern already used throughout this row and the "Merged back" row — this is consistent with the established convention (91-UI-SPEC.md), not a deviation. Not escalating to human_needed.

### Gaps Summary

This fourth verification pass independently re-read every file touched by 91-09 rather than trusting its SUMMARY.md claims or the freshly-refreshed 91-REVIEW.md narrative alone. The prior round's single remaining gap — the "Release Branch" row asserting "No matching tag found" while the tag channel was pending or had failed — is genuinely closed:

- `releaseBranch.ts` exports `TagChannelHealth = 'resolved' | 'pending' | 'failed'` and widens the `released` `BranchState` variant with a required `tagChannel` field — confirmed at the source line.
- `resolveBranchState` threads an optional, defaulted `tagChannel` param through unchanged precedence into the `released` variant only — confirmed no new early return, no precedence reorder, 8 `kind` values still returned.
- `useReleaseDetail.ts` derives `tagChannel` (failed tested before pending, matching the `mergeBackVerification.ts` step 4.5 precedent) from the already-in-scope `tagCheckFailed`/`tagLookupPending` signals and passes it into the `resolveBranchState` call — confirmed at the source line, this is the exact wiring the prior verification recorded as NOT WIRED.
- `ReleaseDetailSidebar.tsx`'s released-row tooltip now branches failed→"Couldn't check for a matching tag." / pending→"Checking for a matching tag…" / resolved-null→the original, byte-identical "No matching tag found…" sentence — confirmed the sentence occurs exactly once in the file and only in the resolved branch.
- The five-file targeted suite (303 tests, up from 244) is green, `tsc --noEmit` is clean, `biome check` reports zero diagnostics, and the whole-project suite (2466 tests) passes — all independently re-run in this verification pass, not taken from any SUMMARY narrative.

All three success criteria hold: (1) users see the merge-back verdict for a released version, now with an accurate sibling "Release Branch" row that no longer overclaims; (2) tracking-MR-state-first, compare-fallback detection with every channel degrading safely, unchanged and re-confirmed; (3) the verdict is advisory with no hard block and no manual override, per the D-12 hard descope of MERGE-03.

The freshly-refreshed 91-REVIEW.md raises one new critical (CR-01: unvalidated tag *elements*, a narrow malformed-response robustness gap) and ten warnings. These are legitimate follow-up items for a future plan but do not falsify any of this phase's 7 observable truths or its 3 success criteria — none of them describe a scenario inside the tag channel's three defined states (resolved/pending/failed) that this phase's must-haves govern; CR-01 describes a fourth, adversarial-response scenario outside that enumeration. Per the instruction to treat code review findings as advisory and separate from goal verification unless they indicate a genuine success-criteria gap, this verification does not block on them, but flags CR-01 for prompt follow-up given its severity classification in the code review.

**Status: passed.** All must-haves verified (6 direct + 1 legitimate override), no remaining gaps, no human verification items outstanding.

---

_Verified: 2026-08-12T00:20:00Z_
_Verifier: Claude (gsd-verifier)_
