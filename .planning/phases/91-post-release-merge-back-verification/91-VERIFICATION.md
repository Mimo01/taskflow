---
phase: 91-post-release-merge-back-verification
verified: 2026-08-11T19:22:02Z
status: gaps_found
score: 3/5 must-haves verified
overrides_applied: 1
overrides:
  - must_have: "MERGE-03: the verdict is presented as advisory with a manual override"
    reason: "User decision D-12 (91-CONTEXT.md), given twice ('I dont want to store anything', then 'no override control at all'), explicitly descopes MERGE-03. ROADMAP.md Phase 91 success criterion 3 records this descope directly. Same precedent as DASH-06 (P84) and DRIFT-09 (P89) — absence is not a gap."
    accepted_by: "user (via 91-CONTEXT.md D-12)"
    accepted_at: "2026-08-11"
gaps:
  - truth: "Detection prefers the tracking MR's state (merged/merged_at) when one exists, and falls back to content comparison when no such MR is found — and the resulting verdict is trustworthy"
    status: failed
    reason: "CR-01 (91-REVIEW.md): fetchSourceBranchMRs finds every MR sourced from the release branch with no target_branch constraint, and resolveMergeBackVerdict step 4 (mergeBackVerification.ts:144) accepts ANY MR with state === 'merged' as merge-back evidence into defaultBranch — it never checks mr.target_branch === defaultBranch. TrackingMR (line 35) does not even project target_branch. In the standard git-flow shape this feature exists to police, release/X is merged by two MRs — one into master, one into develop. If only the master MR merged (the exact failure mode MERGE-01 exists to detect), this code renders a green 'Merged into develop' verdict citing the master MR's iid as evidence. This is a false positive on the feature's own core failure case, not an edge case."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts"
        issue: "Line 35 TrackingMR omits target_branch; line 144 mergedMR = trackingMRs?.find((mr) => mr.state === 'merged') has no target_branch check"
      - path: "taskflow/src/services/gitlab.ts"
        issue: "fetchSourceBranchMRs (~L1836-1893) does not project or filter on target_branch even though GitLabMR already carries the field (L454)"
    missing:
      - "Project target_branch on TrackingMR and require mr.target_branch === defaultBranch before treating an MR as merge-back evidence (91-REVIEW.md CR-01 fix)"
      - "A resolver test: merged MR with target_branch: 'master', defaultBranch: 'develop' → likely-not-merged, not merged"
      - "A gitlab.test.ts fixture whose MRs target something other than the default branch"
  - truth: "compareRefs / resolveMergeBackVerdict never reads an unverifiable comparison as a positive 'Merged' verdict"
    status: failed
    reason: "CR-02 (91-REVIEW.md): compareRefs (gitlab.ts ~L1930-1938) still coerces a non-array diffs/commits payload to diffCount: 0 / commitCount: 0 via 'Array.isArray(data.diffs) ? data.diffs.length : 0'. Step 9 of resolveMergeBackVerdict reads diffCount === 0 as the strongest positive claim ('merged'). Any 200 response with an unexpected shape (proxy/SSO interstitial, API version change, {message: ...} body) is therefore read as evidence the release merged — directly contradicting the module's own documented D-04 invariant ('an incomplete diff must never be read as no diff')."
    artifacts:
      - path: "taskflow/src/services/gitlab.ts"
        issue: "compareRefs still defaults diffCount/commitCount to 0 on a malformed body instead of throwing toward couldnt-verify"
    missing:
      - "Throw when diffs/commits are not arrays so the failure surfaces as compareCheckFailed → couldnt-verify (91-REVIEW.md CR-02 fix)"
      - "A gitlab.test.ts case for a 200 with {message: ...} asserting it does not produce diffCount: 0"
  - truth: "The 'Merged back' row resolves to a terminal state (not an infinite spinner) for realistic release/milestone configurations"
    status: failed
    reason: "CR-03 and CR-04 (91-REVIEW.md), both still present and unfixed. CR-03: a matched milestone with an unparseable title (releaseBranchName === null, the same state releaseBranch.ts's BranchState.kind === 'unresolvable' already models) disables the tracking-MR query, leaving trackingMRs undefined and trackingMRsCheckFailed false forever — resolveMergeBackVerdict step 3 (mergeBackVerification.ts:138) returns { kind: 'loading' } permanently, with no fallback. CR-04: the gitlab-project query in useReleaseDetail.ts (L151-157) never captures isError, so a failed/500/timeout fetchProject leaves defaultBranch === null forever, and step 2 of the resolver unconditionally maps that to { kind: 'loading' }. Both are the identical defect class releaseBranch.ts already documents and guards against for the branch row (a disabled query is indistinguishable from an in-flight one using only data === undefined / isError === false)."
    artifacts:
      - path: "taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts"
        issue: "gitlab-project useQuery (~L150-157) does not destructure isError; no trackingMRsEnabled signal is threaded to the resolver for the releaseBranchName === null case"
      - path: "taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts"
        issue: "Step 2 (L133-135) and step 3 (L138-140) have no terminal branch for 'this channel is permanently disabled, not in flight'"
    missing:
      - "Capture isError on the gitlab-project query and thread it into resolveMergeBackVerdict so a failed project fetch resolves to couldnt-verify, not loading (CR-04 fix)"
      - "An explicit 'cannot be attempted' signal for the disabled tracking-MR query when releaseBranchName === null, resolved to couldnt-verify or hidden rather than loading (CR-03 fix)"
      - "A hook test asserting the verdict is NOT loading when fetchProject rejects, and NOT loading when the milestone title is unparseable — WR-03 in 91-REVIEW.md notes no such test exists today"
deferred: []
human_verification: []
---

# Phase 91: Post-Release Merge-Back Verification Verification Report

**Phase Goal:** Once a Jira fix version is marked released, users can see — as an advisory verdict, never a hard blocker — whether `release/[tag]` has actually been merged back into the project default branch, closing the release-coordination loop.
**Verified:** 2026-08-11T19:22:02Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | On a released fix version's detail page, a "Merged back" row exists, is threaded end-to-end, and hides for unreleased/unmatched cases | ✓ VERIFIED | `mergeBackVerdict` prop flows `useReleaseDetail.ts` → `ReleaseDetailPage.tsx` → `ReleaseDetailSidebar.tsx`; hidden-case, five-kind rendering, and zero-extra-calls-when-unreleased all covered by passing tests (`ReleaseDetailSidebar.test.tsx`, `useReleaseDetail.test.tsx`) |
| 2 | The row states a verdict that is actually trustworthy (MERGE-01's real intent — not merely "a row renders") | ✗ FAILED | CR-01: a tracking MR merged into a branch OTHER than the default branch is read as positive merge-back evidence (see gap 1 below) — the feature's own target failure case renders a false "Merged" verdict |
| 3 | Detection prefers the tracking MR's state and falls back to content comparison, with each channel degrading safely on ambiguous/failed input | ✗ FAILED | CR-02: a malformed compare response silently reads as `diffCount: 0` → `merged`, contradicting the module's own documented D-04 invariant (see gap 2 below) |
| 4 | The row resolves to a terminal state rather than an infinite spinner for realistic configurations | ✗ FAILED | CR-03 (unparseable milestone title) and CR-04 (failed `gitlab-project` fetch) both pin the row at permanent `Loading...` — same defect class `releaseBranch.ts` already guards against and this module does not (see gap 3 below) |
| 5 | The existing "Release Branch" row no longer asserts an unverified merge (D-08) | ✓ VERIFIED | `grep -c "was merged and deleted" ReleaseDetailSidebar.tsx` = 0; wording is now `"{branch} deleted · tagged {tag}"`; `Check` icon replaced with `GitBranch` in that block |
| 6 | No manual override, confirm, dismiss, or acknowledge control exists anywhere near the verdict, and nothing persists (MERGE-03) | ✓ PASSED (override — intentional descope, D-12) | 91-CONTEXT.md D-12 records the user's explicit "no override control at all" decision (given twice); ROADMAP.md Phase 91 success criterion 3 records the same descope; code inspection confirms zero `RowAction`/`Button`/`onClick` inside the "Merged back" row (`ReleaseDetailSidebar.tsx` L286+); no Zustand/Tauri store write exists anywhere in the diff |

**Score:** 3/5 must-haves verified (truth 6 passes via a recorded, legitimate override; truths 2, 3, 4 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/gitlab.ts` — `fetchSourceBranchMRs`, `compareRefs`, `GitLabCompareResult` | Fully-paginated MR lookup + compare call, both via `apiFetch` | ✓ VERIFIED (as specified) / ⚠️ INSUFFICIENT (missing `target_branch` projection needed for correctness) | Both functions exist, typecheck, paginate without a cap, and never leak the token — but `fetchSourceBranchMRs`'s result lacks the field the resolver needs to be correct (CR-01) |
| `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` | `MergeBackVerdict` + `resolveMergeBackVerdict` + two date formatters | ✓ EXISTS, SUBSTANTIVE, WIRED / ✗ NOT TRUSTWORTHY | 256 lines, React-free, 11-step precedence resolver present and unit-tested in isolation — but 2 of its precedence steps (4 and 9→11 boundary) and 2 of its "loading" fallbacks (steps 2, 3) produce wrong or stuck answers on realistic inputs (CR-01–CR-04) |
| `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` | "Merged back" `MetaRow` + softened branch wording | ✓ VERIFIED | Row renders all 5 verdict kinds with D-10's exact copy; D-08 wording change confirmed; zero interactive controls confirmed |
| `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` | Two gated queries + resolver call + `mergeBackVerdict` in return | ✓ WIRED / ✗ INCOMPLETE ERROR SIGNAL | Queries fire correctly gated on `releasedVersion` (D-05 verified: zero extra calls when unreleased) — but the `gitlab-project` query's `isError` is never captured and passed through (CR-04) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `useReleaseDetail.ts` | `services/gitlab.ts` `fetchSourceBranchMRs`/`compareRefs` | two gated `useQuery` calls | ✓ WIRED | Confirmed via grep + read; both queries present with correct `enabled` gates |
| `ReleaseDetailPage.tsx` | `ReleaseDetailSidebar` | `mergeBackVerdict` prop | ✓ WIRED | `grep -n "mergeBackVerdict={mergeBackVerdict}" ReleaseDetailPage.tsx` → 1 match |
| `mergeBackVerification.ts` resolver output | `ReleaseDetailSidebar.tsx` row rendering | `verdict.kind` ternary chain | ✓ WIRED, but renders an untrustworthy value in the CR-01/CR-02/CR-03/CR-04 cases | Wiring itself is correct; the value flowing through it is sometimes wrong (a data-correctness gap, not a wiring gap) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| "Merged back" row | `mergeBackVerdict` | `resolveMergeBackVerdict(...)` fed by live `fetchSourceBranchMRs`/`compareRefs`/`fetchProject` queries | Yes — real GitLab API calls, not stubbed/hardcoded | ⚠️ FLOWING BUT UNTRUSTWORTHY — the data is real, but the resolution logic over that real data is provably wrong for two documented, common inputs (a release merged only to master; a malformed compare payload) and stuck (loading forever) for two other documented, realistic inputs |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `resolveMergeBackVerdict` step 4 checks `target_branch` before accepting a merged MR as evidence | `grep -n "target_branch" mergeBackVerification.ts mergeBackVerification.test.ts` | 0 matches in either file | ✗ FAIL — confirms CR-01 is unaddressed at the source |
| `compareRefs` fails closed on a malformed payload | `grep -n "diffCount: Array.isArray" gitlab.ts` | `Array.isArray(data.diffs) ? data.diffs.length : 0` present | ✗ FAIL — confirms CR-02 is unaddressed at the source |
| `gitlab-project` query captures `isError` | `grep -n "isError" useReleaseDetail.ts` (project query block, L150-157) | not present on that query | ✗ FAIL — confirms CR-04 is unaddressed at the source |
| Full targeted suite green | `npx vitest run src/services/gitlab.test.ts src/routes/dashboard/release-detail/mergeBackVerification.test.ts src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` | 4 files, 205 tests, all passed | ✓ PASS (but confirms WR-03: no test in the suite exercises the target-branch mismatch, malformed-payload, or permanent-loading scenarios — green tests do not contradict the gaps above) |
| Typecheck clean | `cd taskflow && npx tsc --noEmit` | exit 0, no output | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| MERGE-01 | 91-03-PLAN.md | User sees whether `release/[tag]` merged into default branch, once released | ✗ BLOCKED | Row exists and is wired, but the verdict it shows is not reliably correct — CR-01 makes the row assert "Merged" for the exact scenario (release merged to master, not develop) the requirement exists to surface, and CR-03/CR-04 leave it permanently unresolved for realistic inputs |
| MERGE-02 | 91-01-PLAN.md, 91-02-PLAN.md, 91-03-PLAN.md | Detection prefers tracking MR state, falls back to content comparison | ✗ BLOCKED | Both evidence channels are implemented but each has a documented false-positive path (CR-01 on the MR channel, CR-02 on the compare channel) that a code review already identified with concrete repro conditions |
| MERGE-03 | 91-03-PLAN.md | Verdict presented as advisory with a manual override | ✓ SATISFIED (via recorded descope) | D-12 (91-CONTEXT.md) is a hard, twice-given user decision descoping the override; ROADMAP.md success criterion 3 already records this; no override exists in code, matching the decision, not contradicting it |

No orphaned requirements — REQUIREMENTS.md maps only MERGE-01/02/03 to Phase 91, and all three are addressed above.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `mergeBackVerification.ts` | 144 | `.find()` on merged MRs with no `target_branch` filter, no deterministic tie-break for multiple merged MRs (91-REVIEW.md WR-02) | 🛑 Blocker (compounds CR-01) | Even after CR-01 is fixed, `.find()` picks GitLab's default sort order (`created_at desc`), not "most relevant" — the tooltip could cite the wrong MR among several correctly-target-branch-filtered merges |
| `useReleaseDetail.test.tsx` | ~508-516 | `expect(result.current.mergeBackVerdict).toHaveProperty('kind')` — a tautology for a discriminated union (91-REVIEW.md WR-03) | ⚠️ Warning | The hook's test suite cannot fail on any of the CR-01–CR-04 bug states; the only near-miss assertion is happy-path-only |
| `ReleaseDetailSidebar.test.tsx` | 250-256 | `MetaRow` "no buttons" (D-12) lock enforced via a Tailwind class selector (`.flex.items-start.gap-2`) rather than a stable test hook (91-REVIEW.md WR-05) | ⚠️ Warning | A future `MetaRow` className change silently disables the D-12 regression lock without failing the test |
| `services/gitlab.ts` | 1847 | `fetchSourceBranchMRs`'s `while (true)` pagination has no page ceiling (91-REVIEW.md WR-06) | ⚠️ Warning | Inconsistent with `searchProjectTags`'s own `maxPages = 20` precedent two hundred lines away; low real-world likelihood but no bound at all |

These four are carried directly from the already-committed 91-REVIEW.md (`critical: 4, warning: 7, info: 3`) and independently reconfirmed by re-reading the live source above — no code changes have landed since the review commit (`1630ff57` is HEAD).

### Human Verification Required

None. All findings above are confirmed by direct source inspection and are not matters of visual judgment, real-time behavior, or subjective UX quality.

### Gaps Summary

The phase delivers a correctly-shaped, correctly-wired advisory row with good architecture (pure resolver, discriminated union, gated queries, no writes, no override) — but the code review committed alongside this phase (`91-REVIEW.md`) found 4 critical defects, and **none have been fixed**: the git history shows the review commit (`1630ff57`) is HEAD, with no subsequent commits touching `mergeBackVerification.ts`, `gitlab.ts`, or `useReleaseDetail.ts`.

Two of the four defects (CR-01, CR-02) are not incidental bugs — they invert the feature's core promise. CR-01 in particular means the row can show a green "Merged into develop" verdict for a release that was merged only to `master`, which is described in the review as "the exact false positive this feature exists to prevent, and the common case in a git-flow repo." A user trusting this row to close the release-coordination loop (the phase's stated goal) would be told the loop is closed when it is not — the specific failure this phase was commissioned to catch. The other two (CR-03, CR-04) leave the row stuck at "Loading..." forever for an unparseable milestone title or a failed default-branch fetch, silently withholding the verdict for exactly the ambiguous cases where a user most needs the "couldn't verify" honesty the phase's own D-09 design already committed to elsewhere in the module.

Given these are the phase's own two success criteria (1: user sees whether it merged; 2: detection prefers tracking-MR then falls back to content comparison) being falsified by evidence the phase's own review already produced, this is not a polish gap — it is the phase goal not being reliably achieved. MERGE-03 is correctly and legitimately descoped per D-12 and is not counted against the phase.

---

_Verified: 2026-08-11T19:22:02Z_
_Verifier: Claude (gsd-verifier)_
