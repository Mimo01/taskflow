---
phase: 91-post-release-merge-back-verification
verified: 2026-08-11T22:35:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "MERGE-03: the verdict is presented as advisory with a manual override"
    reason: "User decision D-12 (91-CONTEXT.md), given twice ('I dont want to store anything', then 'no override control at all'), explicitly descopes MERGE-03. ROADMAP.md Phase 91 success criterion 3 records this descope directly. Same precedent as DASH-06 (P84) and DRIFT-09 (P89) — absence is not a gap."
    accepted_by: "user (via 91-CONTEXT.md D-12)"
    accepted_at: "2026-08-11"
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "CR-01: tracking MR merged into a branch other than the default branch is no longer read as merge-back evidence — TrackingMR now projects target_branch (mergeBackVerification.ts:39) and step 4 requires mr.target_branch === defaultBranch (L175-177); confirmed independently by reading the resolver source and mergeBackVerification.test.ts:222-269"
    - "CR-02: compareRefs no longer coerces a malformed compare payload to diffCount: 0 — it throws when diffs/commits are not arrays (gitlab.ts:1945-1952); confirmed independently by reading gitlab.ts source"
    - "CR-03: an unparseable milestone title (releaseBranchName === null) no longer pins the row at permanent loading — trackingMRsUnavailable now falls through to a terminal couldnt-verify at step 5 (useReleaseDetail.ts:284, mergeBackVerification.ts:152-163); confirmed by reading source and useReleaseDetail.test.tsx"
    - "CR-04: a failed gitlab-project fetch no longer pins the row at permanent loading — defaultBranchCheckFailed is now captured (useReleaseDetail.ts:151-154, isError: defaultBranchCheckFailed) and resolves to couldnt-verify/check-failed at step 2 (mergeBackVerification.ts:145-150); confirmed by reading source"
  gaps_remaining: []
  regressions: []
gaps:
  - truth: "Detection prefers the tracking MR's state and falls back to content comparison, with each of the evidence channels degrading safely on ambiguous/failed/in-flight input — including the tag channel"
    status: failed
    reason: "New finding, independently reproduced by reading useReleaseDetail.ts and gitlab.ts (not merely trusting 91-REVIEW.md's narrative): three of the four evidence channels (defaultBranch, trackingMRs, compareResult) have an explicit in-flight AND failure signal threaded into resolveMergeBackVerdict (defaultBranchCheckFailed, trackingMRsCheckFailed/trackingMRsUnavailable, compareCheckFailed). The tag channel has neither. useReleaseDetail.ts:200-219 only ever passes the RESOLVED tag name (mergeBackTagName, derived from `releaseTags ?? []`) into the resolver — resolveMergeBackVerdict's parameter list (mergeBackVerification.ts:104-116) has no tagLookupPending/tagCheckFailed field at all, and step 5 (L205) treats `tagName === null` identically whether the tag query is still in flight, has resolved to genuinely no tag, or has failed. Independently confirmed: searchProjectTags (gitlab.ts:352-385) swallows every error inside a try/catch and returns [] (L380-382), making a 500/timeout/permission failure indistinguishable from 'tag does not exist' with no way for any caller to tell the difference. Concrete failure sequence (matches 91-REVIEW.md's walkthrough, reproduced independently): a released version whose tracking-MR query resolves first (e.g. to []) while the tag query is still loading renders a terminal 'Couldn't verify — no tracking MR and no vX.Y.Z tag found' claim; when the tag query then resolves, the row flips to Loading (the compare query only enables once the tag is known), then to the correct verdict. A user who loads the page during that window is shown a false negative claim as if it were final, not as a loading state. On tag-fetch failure, the row permanently shows this same reason text ('no ... tag found') for what is actually a check failure, misleading the user about why the verdict is unresolved even though the verdict kind itself stays in the safe couldnt-verify family. This is the same defect class as the already-fixed CR-03/CR-04 (a disabled/failed channel misread as either in-flight or resolved-negative), now confirmed unfixed in the one channel gap-closure plans 91-04/91-05/91-06 did not touch."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
        issue: "gitlab-release-tags useQuery (L200-211) does not capture isError; mergeBackTagName (L216-219) collapses 'still loading' and 'resolved to nothing' into the same null value with no separate signal passed to the resolver"
      - path: "taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts"
        issue: "resolveMergeBackVerdict's parameter surface (L104-116) and step 5 (L203-211) have no tagLookupPending/tagCheckFailed branch, unlike the equivalent guards already present for the other three channels at steps 2, 3, 6-7"
      - path: "taskflow/src/services/gitlab.ts"
        issue: "searchProjectTags (L352-385) swallows every transport/auth error inside catch { return allTags } (L380-382), making a genuine tag-fetch failure structurally indistinguishable from 'no matching tag' to every caller"
    missing:
      - "Thread the tag channel's in-flight and failure states into resolveMergeBackVerdict the same way the other three channels are threaded (tagLookupPending, tagCheckFailed params; insert a loading/couldnt-verify branch ahead of step 5)"
      - "A way for useReleaseDetail.ts to observe a genuine searchProjectTags failure (isError on the query, or a discriminated return type from searchProjectTags instead of swallow-to-[])"
      - "A hook test with a slow-resolving and a rejecting searchProjectTags asserting the verdict is 'loading' (not a terminal couldnt-verify) while pending, and 'couldnt-verify'/reason:'check-failed' (not reason:'no-mr-no-tag') on failure"
deferred: []
human_verification: []
---

# Phase 91: Post-Release Merge-Back Verification Verification Report

**Phase Goal:** Once a Jira fix version is marked released, users can see — as an advisory verdict, never a hard blocker — whether `release/[tag]` has actually been merged back into the project default branch, closing the release-coordination loop.
**Verified:** 2026-08-11T22:35:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap closure (plans 91-04, 91-05, 91-06 against the prior 91-VERIFICATION.md)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a released fix version's detail page, a "Merged back" row exists, is threaded end-to-end, and hides for unreleased/unmatched cases | ✓ VERIFIED (regression check, unchanged) | `mergeBackVerdict` still flows `useReleaseDetail.ts` → `ReleaseDetailPage.tsx` → `ReleaseDetailSidebar.tsx`; hidden case still gated on `!releasedVersion \|\| !hasMatchedMilestone` |
| 2 | A tracking MR merged into a branch other than the fetched default branch is never read as merge-back evidence (CR-01) | ✓ VERIFIED — gap closed | `TrackingMR` projects `target_branch` (mergeBackVerification.ts:39); step 4 filters on `mr.target_branch === defaultBranch` (L175-177); confirmed by reading source directly (not just the SUMMARY) and by `mergeBackVerification.test.ts:222-269`'s three CR-01 cases (master-target → likely-not-merged, master-target-no-tag → couldnt-verify, develop-target → merged/happy-path preserved) |
| 3 | `compareRefs` never reads a malformed comparison payload as a positive "no diff" verdict (CR-02) | ✓ VERIFIED — gap closed | `gitlab.ts:1945`: `if (!Array.isArray(body.diffs) \|\| !Array.isArray(body.commits)) { throw ... }` precedes the `diffCount`/`commitCount` assignment — confirmed by direct source read, no coercion-to-0 path remains |
| 4 | The row resolves to a terminal state (not an infinite spinner) for an unparseable milestone title or a failed default-branch fetch (CR-03/CR-04) | ✓ VERIFIED — gap closed | `useReleaseDetail.ts:151-154` captures `isError: defaultBranchCheckFailed` on the `gitlab-project` query; `trackingMRsUnavailable` (L284) is threaded through; resolver steps 2 (L145-150) and 3 (L152-163) both terminate at `couldnt-verify` rather than looping at `loading` — confirmed by direct source read |
| 5 | Detection prefers the tracking MR's state and falls back to content comparison, with EVERY evidence channel — including the tag channel — degrading safely on ambiguous/failed/in-flight input | ✗ FAILED (new finding) | Independently reproduced: the tag channel (`gitlab-release-tags` query, `useReleaseDetail.ts:200-219`) has no in-flight or failure signal threaded into `resolveMergeBackVerdict`, unlike the other three channels. A released version whose tracking-MR query resolves before the tag query renders a false terminal "Couldn't verify — no tag found" claim, then flips through Loading to the correct verdict once the tag resolves. `searchProjectTags` swallows every fetch error to `[]` (gitlab.ts:380-382), so a genuine tag-fetch failure is permanently misreported with the wrong reason text. See gap below |
| 6 | The existing "Release Branch" row no longer asserts an unverified merge (D-08) | ✓ VERIFIED (regression check, unchanged) | `grep -c "was merged and deleted" ReleaseDetailSidebar.tsx` = 0 |
| 7 | No manual override, confirm, dismiss, or acknowledge control exists anywhere near the verdict, and nothing persists (MERGE-03) | ✓ PASSED (override — intentional descope, D-12) | Re-confirmed by direct source read of the "Merged back" `MetaRow` block (`ReleaseDetailSidebar.tsx:285-338`): zero `Button`/`RowAction`/`onClick` inside it; every interactive control in the file (`RowAction`, the labeled-MR `openUrl` buttons) sits in unrelated rows |

**Score:** 4/5 must-haves verified (truth 5 renumbers what was previously truths 2+3 combined; the prior verification's truths 2, 3, 4 are now split into 4 verified sub-truths (2, 3, 4, 6, 7) plus one still-failing sub-truth (5) — net: 4 of 5 distinct concerns pass, 1 fails)

### Deferred Items

None.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` — `fetchSourceBranchMRs`, `compareRefs`, `GitLabCompareResult` | Fully-paginated MR lookup + compare call, both via `apiFetch`, both failing closed | ✓ VERIFIED | `fetchSourceBranchMRs` now a bounded `for` loop, `maxPages = 20` (L1853-1856, matches `searchProjectTags`'s own precedent); `compareRefs` throws on non-array `diffs`/`commits` (L1945-1952). Both confirmed by direct source read |
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` | `MergeBackVerdict` + `resolveMergeBackVerdict` + two date formatters, every channel degrading safely | ✓ EXISTS, SUBSTANTIVE, WIRED / ⚠️ ONE CHANNEL STILL UNGUARDED | 4 of 4 documented CR-01–CR-04 defects from the prior review are closed in this module and `useReleaseDetail.ts`; a 5th, newly-found gap (tag channel has no `tagLookupPending`/`tagCheckFailed` param) is open — see gap above |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | "Merged back" `MetaRow` + softened branch wording, zero interactive controls | ✓ VERIFIED | Row renders all 5 verdict kinds; D-08 wording change holds; zero controls confirmed directly (L285-338) |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Two gated queries + resolver call + `mergeBackVerdict` in return, with complete error/loading signal on every channel feeding the resolver | ✓ WIRED / ⚠️ ONE CHANNEL'S SIGNAL MISSING | `defaultBranchCheckFailed` and `trackingMRsUnavailable` are now threaded (closing CR-03/CR-04); the `gitlab-release-tags` query (L200-211) is not — it exposes no `isError`/pending signal to the resolver |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useReleaseDetail.ts` | `services/gitlab.ts` `fetchSourceBranchMRs`/`compareRefs` | two gated `useQuery` calls | ✓ WIRED | Unchanged from prior verification, re-confirmed |
| `ReleaseDetailPage.tsx` | `ReleaseDetailSidebar` | `mergeBackVerdict` prop | ✓ WIRED | Unchanged from prior verification, re-confirmed |
| `mergeBackVerification.ts` resolver output | `ReleaseDetailSidebar.tsx` row rendering | `verdict.kind` ternary chain | ✓ WIRED, but can render a transiently-false or permanently-mislabeled `couldnt-verify` value sourced from the tag channel gap | Wiring itself correct; the CR-01/02/03/04 data-correctness gaps from the prior report are closed, but the tag-channel gap above is a new instance of the same class |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| "Merged back" row | `mergeBackVerdict` | `resolveMergeBackVerdict(...)` fed by live `fetchSourceBranchMRs`/`compareRefs`/`fetchProject`/`searchProjectTags` queries | Yes — real GitLab API calls, not stubbed/hardcoded | ⚠️ FLOWING, MOSTLY TRUSTWORTHY — CR-01/CR-02/CR-03/CR-04's four documented false-positive/permanent-loading paths are closed and independently re-verified; one previously-unexamined channel (tag lookup) still lacks a loading/failure signal, producing a transient false-negative claim on ordinary page load and a permanently mislabeled (but not falsely-positive) reason on tag-fetch failure |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `resolveMergeBackVerdict` step 4 checks `target_branch` before accepting a merged MR as evidence | `grep -n "target_branch" mergeBackVerification.ts` | `TrackingMR` field (L39) + filter condition (L176) present | ✓ PASS — CR-01 closed |
| `compareRefs` fails closed on a malformed payload | `grep -n "Array.isArray(body.diffs)" gitlab.ts` | throw guard present at L1945 | ✓ PASS — CR-02 closed |
| `gitlab-project` query captures `isError` and it reaches the resolver | `grep -n "isError: defaultBranchCheckFailed" useReleaseDetail.ts` | present at L153 | ✓ PASS — CR-04 closed |
| Unparseable milestone title produces a terminal, not loading, verdict | `grep -n "trackingMRsUnavailable" useReleaseDetail.ts mergeBackVerification.ts` | threaded through in both files | ✓ PASS — CR-03 closed |
| `gitlab-release-tags` query captures `isError` and it reaches the resolver | `grep -n "isError" useReleaseDetail.ts` (tag query block, L200-211) | not present on that query; `resolveMergeBackVerdict` params (L104-116) have no `tagLookupPending`/`tagCheckFailed` field | ✗ FAIL — new gap, tag channel unguarded |
| `searchProjectTags` distinguishes failure from "no tag" | `grep -n "catch" gitlab.ts` (L380-382) | `catch { return allTags; }` — swallows every error to an empty/partial array | ✗ FAIL — confirms failure is unobservable to any caller |
| Full targeted suite green | `npx vitest run src/services/gitlab.test.ts src/routes/dashboard/release-detail/mergeBackVerification.test.ts src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | 4 files, 224 tests, all passed | ✓ PASS (but no test in the suite constructs a slow or rejecting `searchProjectTags` — the green suite does not contradict the tag-channel gap) |
| Typecheck clean | `cd taskflow && npx tsc --noEmit` | exit 0, no output | ✓ PASS |
| `biome check` on the four gap-closure-touched files | `npx biome check useReleaseDetail.ts useReleaseDetail.test.tsx mergeBackVerification.test.ts ReleaseDetailSidebar.test.tsx` | 4 formatter errors, all four files newly flagged (clean at `HEAD~8` per 91-REVIEW.md WR-02) | ⚠️ WARNING — cosmetic formatting regression, not a functional defect; noted, not blocking |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MERGE-01 | 91-03-PLAN.md, 91-06-PLAN.md | User sees whether `release/[tag]` merged into default branch, once released | ⚠️ PARTIALLY BLOCKED | Row exists, is wired, and CR-01/CR-02/CR-03/CR-04's four documented incorrect/stuck-forever verdicts are fixed and independently re-verified — but the tag channel's missing loading/failure signal means the row can still show a false terminal "no tag found" claim during ordinary page load before settling to the correct verdict, which is exactly the trustworthiness bar MERGE-01 sets |
| MERGE-02 | 91-01-PLAN.md, 91-02-PLAN.md, 91-03-PLAN.md, 91-04-PLAN.md, 91-05-PLAN.md | Detection prefers tracking MR state, falls back to content comparison | ⚠️ PARTIALLY BLOCKED | Both evidence channels resolve correctly once all their own inputs have arrived; the tracking-MR and compare channels each degrade safely (CR-01/CR-02 fixed); the tag lookup that gates the compare fallback does not degrade safely, so "falls back to content comparison" can transiently and misleadingly announce "couldn't verify" instead of correctly staying in `loading` |
| MERGE-03 | 91-03-PLAN.md, 91-06-PLAN.md | Verdict presented as advisory with a manual override | ✓ SATISFIED (via recorded descope) | D-12 (91-CONTEXT.md) is a hard, twice-given user decision descoping the override; ROADMAP.md success criterion 3 already records this; no override exists in code, matching the decision, not contradicting it |

No orphaned requirements — REQUIREMENTS.md maps only MERGE-01/02/03 to Phase 91 (lines 50-52, 109-111), and all three are addressed above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mergeBackVerification.ts` | 239-241 | Step 10 tests `trackingMRsCheckFailed` but not `trackingMRsUnavailable` before emitting the accusatory `likely-not-merged` (91-REVIEW.md WR-01) | ⚠️ Warning | Currently unreachable only via an undocumented coupling between `deriveReleaseBranchName` and `extractVersionFromMilestoneTitle` sharing one regex — not exploitable today, but the resolver's own parameter surface permits the unsafe combination, and no test guards against a future decoupling |
| `useReleaseDetail.ts`, `useReleaseDetail.test.tsx`, `mergeBackVerification.test.ts`, `ReleaseDetailSidebar.test.tsx` | various | `biome check` formatter diffs newly introduced by the gap-closure commits (91-REVIEW.md WR-02); confirmed all four files clean at `HEAD~8`, flagged now | ⚠️ Warning | Cosmetic only — no behavioral impact; gate is "no newly-flagged files" per the project's drifted-biome-baseline convention, and this phase newly flags 4 |
| `ReleaseDetailSidebar.tsx` | 285-340 | Five-branch nested ternary with duplicated date formatting, `couldnt-verify` as an implicit `else` (91-REVIEW.md WR-04, carried from prior WR-07) | ⚠️ Warning | A future verdict kind added without an explicit branch silently renders as "Couldn't verify" rather than a compile error |
| `services/gitlab.ts` | 352-385 | `searchProjectTags` swallows every transport error to `[]` inside `catch` | 🛑 Blocker (root cause of the open gap above) | Makes a genuine tag-fetch failure structurally indistinguishable from "no matching tag exists" to every current and future caller |

### Human Verification Required

None. All findings above are confirmed by direct source inspection (not SUMMARY.md narrative) and are not matters of visual judgment, real-time behavior, or subjective UX quality.

### Gaps Summary

This re-verification independently re-read every file the gap-closure plans (91-04/91-05/91-06) touched, rather than trusting their SUMMARY.md claims or the freshly-committed 91-REVIEW.md narrative alone. The four previously-reported blockers are genuinely closed:

- **CR-01** (git-flow false positive: MR merged only to `master` read as "merged into `develop`") — fixed via a `target_branch` filter, confirmed at the source line and via three dedicated unit tests.
- **CR-02** (malformed compare payload silently read as "no diff") — fixed via an explicit array-shape guard that throws, confirmed at the source line.
- **CR-03** (unparseable milestone title pins the row at permanent `Loading...`) — fixed via `trackingMRsUnavailable` falling through to a terminal `couldnt-verify`, confirmed at the source line.
- **CR-04** (failed `gitlab-project` fetch pins the row at permanent `Loading...`) — fixed via `defaultBranchCheckFailed` now being captured and threaded through, confirmed at the source line.

However, the code review committed alongside this run (`91-REVIEW.md`, HEAD `b5ba6472`) surfaced a fifth, previously-unexamined defect in the same class, and this verification independently reproduced it rather than taking the review's word for it: the tag-evidence channel (`gitlab-release-tags` query / `searchProjectTags`) has neither an in-flight signal nor a failure signal reaching `resolveMergeBackVerdict`, unlike the other three evidence channels this same gap-closure round just fixed. The concrete, reproducible consequence: on an ordinary page load where the tracking-MR query happens to resolve before the tag query, the row renders a terminal "Couldn't verify — no tag found" claim, then flips through `Loading...`, then to the correct final verdict — a false, unambiguous claim shown to the user as settled fact for a real span of wall-clock time, not a loading state. On a genuine tag-fetch failure (`searchProjectTags` swallows every error to `[]`), the row permanently shows the wrong *reason* for being unable to verify (implying "no tag exists" rather than "the check failed"), though it does at least stay within the safe `couldnt-verify` family rather than flipping to a false `merged`/`likely-not-merged`.

Given the goal is specifically "users can see ... whether it has actually been merged back," and given this exact channel-guard omission is the pattern this same gap-closure round demonstrated it knows how to fix for the other three channels, this is assessed as a genuine, actionable gap rather than a nitpick — it defeats success criterion 2's "falls back to content comparison" for the specific and common timing where the tag query has not yet settled, and partially undermines success criterion 1's trust bar during that window. It is not, however, a regression of any previously-fixed defect, and it never produces a false positive (`merged` when not merged) or false accusation (`likely-not-merged` when actually merged) — only a transient/mislabeled `couldn't-verify`, the module's own designated "admit the gap" state, arriving one step too early. MERGE-03 remains correctly and legitimately descoped per D-12 and is not counted against the phase. The WR-01 asymmetry and WR-02 biome-formatting findings are warnings only (unreachable today / cosmetic) and are recorded but do not block.

---

_Verified: 2026-08-11T22:35:00Z_
_Verifier: Claude (gsd-verifier)_
