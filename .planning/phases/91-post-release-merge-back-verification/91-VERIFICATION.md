---
phase: 91-post-release-merge-back-verification
verified: 2026-08-11T23:45:00Z
status: gaps_found
score: 6/7 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "MERGE-03: the verdict is presented as advisory with a manual override"
    reason: "User decision D-12 (91-CONTEXT.md), given twice ('I dont want to store anything', then 'no override control at all'), explicitly descopes MERGE-03. ROADMAP.md Phase 91 success criterion 3 records this descope directly. Same precedent as DASH-06 (P84) and DRIFT-09 (P89) — absence is not a gap."
    accepted_by: "user (via 91-CONTEXT.md D-12)"
    accepted_at: "2026-08-11"
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "91-VERIFICATION truth 5 (tag channel had no in-flight/failure signal reaching resolveMergeBackVerdict): closed by 91-07 (searchProjectTags now fails closed instead of swallowing errors to []; resolveMergeBackVerdict gained tagLookupPending/tagCheckFailed params and a step-4.5 guard) and 91-08 (useReleaseDetail.ts now destructures isError: tagCheckFailed on the gitlab-release-tags query, derives tagLookupPending from needsTagLookup, and threads both into the resolver call). Confirmed independently by direct source read of mergeBackVerification.ts:213-234 and useReleaseDetail.ts:201-220,295-309, not by trusting 91-07/91-08-SUMMARY.md's narrative. Full targeted suite (244 tests) passes, tsc clean, biome clean on all phase-touched files."
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "The existing 'Release Branch' row (D-08) reports only tag facts it has actually obtained — it must not assert 'No matching tag found' while the tag lookup is still in flight or has failed"
    status: failed
    reason: "New finding, first raised in the code review committed this run (91-REVIEW.md CR-01, HEAD fb865993) and independently reproduced by reading the source directly rather than trusting the review's narrative. 91-07/91-08 gave the tag channel an in-flight signal (tagLookupPending) and a failure signal (tagCheckFailed) and threaded both into resolveMergeBackVerdict for the 'Merged back' row (mergeBackVerification.ts:213-234) — but resolveBranchState, which drives the separate 'Release Branch' row, was never given either signal. useReleaseDetail.ts:230-237 calls resolveBranchState with only `releaseTagName: mergeBackTagName`, and mergeBackTagName is null in three structurally different situations (tag query in flight, tag query failed, tag query resolved with no match) that resolveBranchState (releaseBranch.ts:137-192) cannot distinguish. ReleaseDetailSidebar.tsx:257-263 renders the same tooltip text — 'release/X deleted. No matching tag found — tags are an incomplete record, so this is not evidence the release did not ship.' — in all three cases. For every released version with a deleted branch this is a false, settled-sounding claim shown for the duration of the tag fetch on ordinary page load, and shown permanently on a genuine tag-fetch failure (now a real possibility since 91-07 made searchProjectTags throw instead of swallowing errors). This is the exact same defect class D-08 exists to eliminate (an unverified negative asserted as fact) and the same class CR-03/CR-04/truth-5 closed for four other channel/row combinations this same gap-closure round — left open specifically on the one consumer (the Release Branch row) that the 91-07/91-08 plans did not touch. It does NOT affect the 'Merged back' row itself (MERGE-01/02's primary deliverable), which correctly threads both tag signals and was independently re-verified as correct above."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
        issue: "resolveBranchState call (L230-237) passes only releaseTagName: mergeBackTagName — no tagLookupPending/tagCheckFailed equivalent, even though both values already exist in scope (L220, L201) and are threaded into the sibling resolveMergeBackVerdict call a few lines below"
      - path: "taskflow/src/routes/dashboard/release-detail/releaseBranch.ts"
        issue: "resolveBranchState's params (L137-144) and the 'released' BranchState variant (L103) carry only tagName: string | null — no channel-health discriminant, so a pending/failed tag fetch is structurally indistinguishable from a resolved absence"
      - path: "taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx"
        issue: "L257-263 renders the same 'No matching tag found' tooltip whenever branchState.tagName is falsy, with no way to know from BranchState alone whether the tag channel is pending, failed, or genuinely resolved to nothing"
    missing:
      - "Thread tagLookupPending/tagCheckFailed (or a single derived tagChannel: 'resolved' | 'pending' | 'failed') into resolveBranchState the same way they are already threaded into resolveMergeBackVerdict"
      - "Widen BranchState's 'released' variant (or add a sibling field) to carry the channel-health discriminant so the sidebar can suppress or reword the negative tag claim when the channel is not resolved"
      - "A releaseBranch.test.ts case asserting the released-branch tooltip does not claim 'No matching tag found' while the tag query is pending or has failed"
deferred: []
human_verification: []
---

# Phase 91: Post-Release Merge-Back Verification Verification Report

**Phase Goal:** Once a Jira fix version is marked released, users can see — as an advisory verdict, never a hard blocker — whether `release/[tag]` has actually been merged back into the project default branch, closing the release-coordination loop.
**Verified:** 2026-08-11T23:45:00Z
**Status:** gaps_found
**Re-verification:** Yes — third pass, after gap-closure round 2 (plans 91-07, 91-08) against the prior 91-VERIFICATION.md's truth-5 gap

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a released fix version's detail page, a "Merged back" row exists, is threaded end-to-end, and hides for unreleased/unmatched cases | ✓ VERIFIED (regression, unchanged) | `mergeBackVerdict` flows `useReleaseDetail.ts` (L295-309) → `ReleaseDetailPage.tsx` → `ReleaseDetailSidebar.tsx` (L285); hidden case gated on `!releasedVersion \|\| !hasMatchedMilestone` in `resolveMergeBackVerdict` step 1 |
| 2 | A tracking MR merged into a branch other than the fetched default branch is never read as merge-back evidence (CR-01, prior round) | ✓ VERIFIED (regression, unchanged) | `TrackingMR` projects `target_branch` (mergeBackVerification.ts:45); step 4 filters `mr.state === 'merged' && mr.target_branch === defaultBranch` (L185-187) |
| 3 | `compareRefs` never reads a malformed comparison payload as a positive "no diff" verdict (CR-02, prior round) | ✓ VERIFIED (regression, unchanged) | `gitlab.ts:1951-1952`: `if (!Array.isArray(body.diffs) \|\| !Array.isArray(body.commits)) throw ...` precedes the diffCount/commitCount assignment |
| 4 | The row resolves to a terminal state (not an infinite spinner) for an unparseable milestone title or a failed default-branch fetch (CR-03/CR-04, prior round) | ✓ VERIFIED (regression, unchanged) | `useReleaseDetail.ts:151`: `isError: defaultBranchCheckFailed` on `gitlab-project`; `trackingMRsUnavailable` (L293) threaded through; resolver steps 2/3 (mergeBackVerification.ts:150-173) both terminate at `couldnt-verify` rather than looping at `loading` |
| 5 | The tag evidence channel — the fourth of four — carries both an in-flight signal and a failure signal into `resolveMergeBackVerdict`, so the "Merged back" row never shows a false terminal claim while the tag lookup is pending or has failed | ✓ VERIFIED — gap closed this round | `searchProjectTags` (gitlab.ts:363-403) now throws on transport failure, 401/403, other non-ok status, and non-array body — no more `catch { return allTags }` swallow; `useReleaseDetail.ts:201-220` destructures `isError: tagCheckFailed` and derives `tagLookupPending = needsTagLookup && releaseTags === undefined && !tagCheckFailed`; both flow into `resolveMergeBackVerdict` (L295-309); the resolver's step 4.5 (mergeBackVerification.ts:213-234) resolves pending→`loading`, failed→`couldnt-verify`/`check-failed`, placed correctly below step 4 (a merged tracking MR still wins) and above step 5 (D-01's tag-absence fallback). Confirmed by direct source read, not the SUMMARY narrative; 244-test targeted suite green, `tsc --noEmit` clean |
| 6 | The existing "Release Branch" row (D-08) reports only tag facts it has actually obtained — no unverified negative while the tag channel is pending/failed | ✗ FAILED (new finding, this round) | `useReleaseDetail.ts:230-237`'s call to `resolveBranchState` passes only the resolved `mergeBackTagName`, with no `tagLookupPending`/`tagCheckFailed` equivalent; `resolveBranchState` (releaseBranch.ts:137-192) and its `BranchState` union (L92-104) have no channel-health field; `ReleaseDetailSidebar.tsx:257-263` renders "No matching tag found — tags are an incomplete record..." whenever `tagName` is falsy, indistinguishable from "still fetching" or "fetch failed." See gap below |
| 7 | No manual override, confirm, dismiss, or acknowledge control exists anywhere near the verdict, and nothing persists (MERGE-03) | ✓ PASSED (override — intentional descope, D-12) | Re-confirmed by direct source read of the "Merged back" `MetaRow` block (`ReleaseDetailSidebar.tsx:285-340`) and a targeted grep for `RowAction`/`Button`/`onClick` in the file: every interactive control (`RowAction` at L202, L243, L274) sits in the "GitLab Milestone" or "Release Branch" rows, none in "Merged back" |

**Score:** 6/7 truths verified (5 pass on direct re-read + 1 override for the intentionally descoped MERGE-03; 1 new, independently-confirmed gap)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` — `searchProjectTags`, `fetchSourceBranchMRs`, `compareRefs`, `GitLabCompareResult` | All four evidence-channel fetchers fail closed via `apiFetch`, none swallow errors into a data-shaped value | ✓ VERIFIED | `searchProjectTags` (L363-403) now mirrors `compareRefs`'s error discipline exactly — confirmed by direct read; `fetchSourceBranchMRs`/`compareRefs` unchanged from prior round, re-confirmed |
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` | `MergeBackVerdict` + `resolveMergeBackVerdict`, every one of the four evidence channels degrading safely (loading vs. failed vs. resolved-negative) | ✓ VERIFIED | Step 4.5 (L213-234) closes the last open channel guard; module header (L33-38) documents the completed invariant; 21 new unit cases across 91-07/91-08 lock loading/failure/precedence/default-compatibility behavior |
| `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` | `resolveBranchState` reports only tag facts the tag channel has actually resolved | ✗ NOT UPDATED THIS ROUND | `resolveBranchState`'s signature and the `released` `BranchState` variant are unchanged from the prior verification pass — they never received the tag channel's health signal, even though that signal now exists two call sites away in the same hook |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | "Merged back" `MetaRow` renders all 5 verdict kinds correctly, zero interactive controls; "Release Branch" row states only what it knows | ⚠️ PARTIAL | "Merged back" row: ✓ verified, all 5 kinds render correctly from a fully-guarded verdict, zero controls confirmed. "Release Branch" row: ✗ the released-state tooltip (L257-263) can assert "No matching tag found" while the tag channel is pending or failed |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Two gated queries + resolver call + `mergeBackVerdict`/`branchState` in return, with complete error/loading signal reaching BOTH consumers of the tag channel | ⚠️ PARTIAL | `mergeBackVerdict`'s inputs (L295-309): fully wired, all 4 channels guarded. `branchState`'s inputs (L230-237): only the resolved tag name reaches it — `tagLookupPending`/`tagCheckFailed`, both already computed in the same function a few lines above, are not passed through |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useReleaseDetail.ts` | `services/gitlab.ts` `searchProjectTags`/`fetchSourceBranchMRs`/`compareRefs` | three gated `useQuery` calls | ✓ WIRED | Unchanged from prior verification, re-confirmed; all three fetchers fail closed |
| `useReleaseDetail.ts` tag channel (`tagLookupPending`/`tagCheckFailed`) | `mergeBackVerification.ts` `resolveMergeBackVerdict` | direct params (L303-305) | ✓ WIRED — gap closed this round | Confirmed by direct source read; the branch this round's plans (91-07/91-08) targeted |
| `useReleaseDetail.ts` tag channel (`tagLookupPending`/`tagCheckFailed`) | `releaseBranch.ts` `resolveBranchState` | — | ✗ NOT WIRED | Only `releaseTagName: mergeBackTagName` (L236) reaches `resolveBranchState`; the two health signals are computed (L201, L220) but never passed to this second consumer of the same tag channel |
| `mergeBackVerification.ts` resolver output | `ReleaseDetailSidebar.tsx` "Merged back" row rendering | `verdict.kind` ternary chain | ✓ WIRED | Fully correct — every documented false-positive/permanent-loading/mislabeled-reason defect (CR-01 through CR-04, truth 5) is closed and independently re-verified |
| `releaseBranch.ts` resolver output | `ReleaseDetailSidebar.tsx` "Release Branch" row rendering | `branchState.kind === 'released'` tooltip | ⚠️ WIRED BUT DATA CAN BE STALE/MISLEADING | Wiring itself is correct; the value it carries (`tagName: string \| null`) cannot represent "channel unhealthy," so the row states more than it knows |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| "Merged back" row | `mergeBackVerdict` | `resolveMergeBackVerdict(...)` fed by live `fetchSourceBranchMRs`/`compareRefs`/`fetchProject`/`searchProjectTags` queries, all four channels guarded | Yes — real GitLab API calls, no stubs | ✓ FLOWING, TRUSTWORTHY — all four previously-identified false-claim/permanent-loading paths (CR-01–CR-04, truth 5) are closed and independently re-verified this round |
| "Release Branch" row (released state) | `branchState.tagName` | `resolveBranchState(...)` fed by the same `searchProjectTags` query, but without the channel-health signal | Partially — the underlying fetch is real, but the row cannot distinguish "resolved to nothing" from "still resolving" or "failed to resolve" | ⚠️ FLOWING BUT UNGUARDED — same root data source as the row above, one hop upstream of a fix that was applied to only one of its two consumers |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `searchProjectTags` fails closed (no swallow-to-`[]`) | `grep -n "catch { return allTags" gitlab.ts` | no match; `catch { throw new Error(...) }` at transport-error site, explicit throws for non-ok/non-array | ✓ PASS |
| Tag channel reaches `resolveMergeBackVerdict` | `grep -n "tagLookupPending\|tagCheckFailed" useReleaseDetail.ts mergeBackVerification.ts` | present in both files, threaded through the resolver call | ✓ PASS — truth 5 gap closed |
| Tag channel reaches `resolveBranchState` | `grep -n "tagLookupPending\|tagCheckFailed" releaseBranch.ts` and the `resolveBranchState(` call site in `useReleaseDetail.ts` | no match in `releaseBranch.ts`; call site passes only `releaseTagName` | ✗ FAIL — new gap, confirms 91-REVIEW.md CR-01 |
| Full targeted suite green | `npx vitest run src/services/gitlab.test.ts src/routes/dashboard/release-detail/mergeBackVerification.test.ts src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | 4 files, 244 tests, all passed | ✓ PASS (no test in the suite exercises the branch-row-during-tag-pending case — the green suite does not contradict the gap) |
| Typecheck clean | `cd taskflow && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| `biome check` on release-detail directory + gitlab.ts/gitlab.test.ts | `npx biome check src/routes/dashboard/release-detail/ src/services/gitlab.ts src/services/gitlab.test.ts` | "Checked 34 files in 54ms. No fixes applied." | ✓ PASS — prior round's formatting regression (91-REVIEW.md WR-02 in the previous review) is closed |
| "Merged back" row has zero interactive controls | `grep -n "RowAction\|Button\|onClick" ReleaseDetailSidebar.tsx` cross-referenced against line ranges | all three `RowAction` usages (L202, L243, L274) fall outside the L285-340 "Merged back" block | ✓ PASS — MERGE-03 descope holds |
| Commit hashes from 91-07/91-08 SUMMARY.md exist in git log | `git log --oneline -15` | `3cadb62f`, `6b0fb673`, `9ea672db`, `550bcc53`, `694f1088`, `c28984b9`, `4bcaedb3` all present | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MERGE-01 | 91-01 through 91-08 PLAN.md (07/08 close the final gap) | User sees whether `release/[tag]` merged into default branch, once released | ✓ SATISFIED for the "Merged back" row (the row this requirement is about); the adjacent "Release Branch" row's tag wording is inaccurate during pending/failed windows — see gap | The "Merged back" row — the row MERGE-01 and D-07/D-10 describe as the requirement's deliverable — is fully correct across all four evidence channels. The gap found this round is in a different, pre-existing row (D-08's wording softening), not in MERGE-01's own row |
| MERGE-02 | 91-01, 91-02, 91-03, 91-04, 91-05, 91-07, 91-08 | Detection prefers tracking MR state, falls back to content comparison, with every channel degrading safely | ✓ SATISFIED | All four evidence channels (default branch, tracking MRs, compare, tags) now carry both an in-flight and a failure signal into `resolveMergeBackVerdict`; independently re-verified this round for the tag channel specifically |
| MERGE-03 | 91-03, 91-06, 91-08 | Verdict presented as advisory with a manual override | ✓ SATISFIED (via recorded descope) | D-12 (91-CONTEXT.md) is a hard, twice-given user decision descoping the override; ROADMAP.md success criterion 3 already records this; no override exists in code, matching the decision |

No orphaned requirements — REQUIREMENTS.md maps only MERGE-01/02/03 to Phase 91 (lines 50-52, 109-111), and all three are addressed above. The new gap (Release Branch row tag wording) is downstream of the same tag-evidence channel MERGE-02 concerns but attaches to D-08 (context-file scope, not a REQUIREMENTS.md ID) rather than to a distinct requirement — it is tracked as a gap, not a fourth unsatisfied requirement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `useReleaseDetail.ts` / `releaseBranch.ts` | 230-237 / 137-192 | Tag channel's health signal computed but not passed to `resolveBranchState`, while the identical signal is passed a few lines later to `resolveMergeBackVerdict` (91-REVIEW.md CR-01) | 🛑 Blocker (root cause of the gap above) | Release Branch row can assert an unverified negative during a real, reachable window (page load before the tag query settles, or after a genuine tag-fetch failure) |
| `services/gitlab.ts` | 398-403 | `searchProjectTags` validates the array wrapper but not element shape before casting to `GitLabTag[]` (91-REVIEW.md WR-02) | ⚠️ Warning | A malformed-but-array-shaped 200 body (API version change, partial error payload) would crash `findReleaseTag`'s `t.toLowerCase()` in the render phase rather than surfacing as a `couldnt-verify` verdict; low likelihood, not exercised by any current test |
| `useReleaseDetail.ts` / `mergeBackVerification.ts` | 220, 293 / 155-160 | `tagLookupPending`/`trackingMRsUnavailable`/`defaultBranch === null` guards model only "will never run because of a missing derived value," not "disabled because credentials are absent" (91-REVIEW.md WR-01, narrow reachability) | ⚠️ Warning | A `gitlabToken` that never resolves (readSecret rejects) with milestone/project data present from cache could theoretically pin a channel at `loading` forever; reachability is narrow because a missing token upstream normally also blocks the milestone match, not independently confirmed as reachable in this pass |
| `mergeBackVerification.ts` | 114-123 | The four channel-health params (`defaultBranchCheckFailed`, `trackingMRsUnavailable`, `tagLookupPending`, `tagCheckFailed`) are optional with `= false` defaults, so a future second call site can silently omit them and reproduce the pre-fix behavior (91-REVIEW.md WR-04) | ⚠️ Warning | Type system does not enforce the module's own stated invariant ("EVERY evidence channel carries both an in-flight signal and a failure signal") |
| `ReleaseDetailSidebar.tsx` | 285-340 | Five-branch nested ternary with duplicated date formatting, `couldnt-verify` as an implicit `else` (carried forward, deliberately deferred per 91-08-SUMMARY.md) | ⚠️ Warning | A future verdict kind added without an explicit branch silently renders as "Couldn't verify" rather than a compile error |

### Human Verification Required

None. All findings above are confirmed by direct source inspection (not SUMMARY.md narrative) and are not matters of visual judgment, real-time behavior, or subjective UX quality.

### Gaps Summary

This third verification pass independently re-read every file touched by 91-07/91-08 rather than trusting their SUMMARY.md claims or the freshly-committed 91-REVIEW.md narrative alone. The prior round's single remaining gap — the tag evidence channel (the fourth of four) having no in-flight or failure signal reaching `resolveMergeBackVerdict` — is genuinely closed:

- `searchProjectTags` (`gitlab.ts:363-403`) now fails closed exactly like `compareRefs`: throws on transport failure, 401/403, other non-ok status, and a non-array 200 body — confirmed at the source line.
- `resolveMergeBackVerdict` gained a step-4.5 guard (`mergeBackVerification.ts:213-234`) correctly placed below the merged-tracking-MR check and above the tag-absence fallback, resolving pending→`loading` and failed→`couldnt-verify`/`check-failed` — confirmed at the source line, plus WR-01's step-10 fix (`trackingMRsCheckFailed || trackingMRsUnavailable`).
- `useReleaseDetail.ts` now destructures `isError: tagCheckFailed` on the `gitlab-release-tags` query and derives `tagLookupPending` from `needsTagLookup` (not React Query's own pending state, avoiding the CR-03 defect class for a disabled query) — confirmed at the source line, both threaded into the resolver call.
- The full targeted suite (244 tests) is green, `tsc --noEmit` is clean, and `biome check` reports zero diagnostics across the release-detail directory and `gitlab.ts` — the prior round's formatting regression is also resolved.

However, this verification independently identified and reproduced (not merely deferred to) the finding raised in the fresh code review committed this run: `resolveBranchState`, which drives the pre-existing "Release Branch" row (D-08's wording-softening target from Phase 88), was never given the same two channel-health signals that were just threaded into `resolveMergeBackVerdict`'s parallel row. `useReleaseDetail.ts:230-237` passes `resolveBranchState` only the *resolved* `mergeBackTagName`, which is `null` in three structurally different situations (tag query in flight, tag query failed, tag query resolved with genuinely no match) that `resolveBranchState`/`BranchState` (`releaseBranch.ts`) cannot tell apart. `ReleaseDetailSidebar.tsx:257-263` renders the same "No matching tag found — tags are an incomplete record..." tooltip in all three cases — a false, settled-sounding claim for the duration of the tag fetch on ordinary page load, and a permanently mislabeled one on a genuine tag-fetch failure (now a real, reachable outcome since 91-07 made the fetcher throw instead of swallowing errors).

This is assessed as a genuine gap, not a nitpick, for three reasons: (1) it is the identical defect class (an unverified negative asserted as settled fact) that this same gap-closure round fixed four times over for the sibling row and channels; (2) D-08 in `91-CONTEXT.md` explicitly states the Release Branch row's wording correction "is a required change, not an optional polish"; (3) the fix is mechanically identical to the one already applied two call sites away in the same function, using values (`tagLookupPending`, `tagCheckFailed`) that are already in scope. It is scoped narrowly, however: it does not affect the "Merged back" row itself — MERGE-01/02's actual deliverable, independently re-verified above as fully correct across all four evidence channels — and MERGE-03 remains correctly and legitimately descoped per D-12, unaffected by this finding.

The WR-01/WR-02/WR-04 findings carried forward from `91-REVIEW.md` are assessed as warnings, not blockers: WR-01's reachability is narrow (a disabled-by-missing-credentials path not confirmed reachable given upstream milestone-match gating), WR-02 is a low-probability crash path with no reproduction in this pass, and WR-04 is a type-system enforcement gap with no current exploiting call site.

---

_Verified: 2026-08-11T23:45:00Z_
_Verifier: Claude (gsd-verifier)_
