---
phase: 91-post-release-merge-back-verification
plan: 09
subsystem: ui
tags: [react, tanstack-query, gitlab, release-detail, tooltip]

# Dependency graph
requires:
  - phase: 91-post-release-merge-back-verification (plan 07/08)
    provides: tagLookupPending/tagCheckFailed signals threaded into resolveMergeBackVerdict's "Merged back" row, and the failed-before-pending precedent (step 4.5)
provides:
  - TagChannelHealth discriminant on BranchState's released variant and resolveBranchState
  - Released-row tooltip that reports "no matching tag" only when the tag channel actually resolved
  - tagChannel derivation wired from useReleaseDetail.ts into resolveBranchState, closing the gap 91-VERIFICATION recorded as NOT WIRED
affects: [91-post-release-merge-back-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Required discriminant field on a discriminated-union variant, with an optional+defaulted function param feeding it — same asymmetric-required pattern as mergeBackVerification.ts's tagLookupPending/tagCheckFailed"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts

key-decisions:
  - "tagChannel required on the released BranchState variant but optional (default 'resolved') on resolveBranchState's params — same asymmetric-required pattern 91-REVIEW WR-04 asked for"
  - "Precedence: failed tested before pending, matching mergeBackVerification.ts step 4.5, and only evaluated when tagName is null"

patterns-established:
  - "TagChannelHealth = 'resolved' | 'pending' | 'failed' — second consumer of the same tag-channel signal pair, exported from releaseBranch.ts for useReleaseDetail.ts to import as a type"

requirements-completed: [MERGE-01, MERGE-02]

# Metrics
duration: 25min
completed: 2026-08-11
---

# Phase 91 Plan 09: Release Branch tag-channel health Summary

**Release Branch row no longer claims "No matching tag found" while the tag lookup is pending or failed — a TagChannelHealth discriminant now travels end-to-end from the live GitLab tag query into the released-row tooltip, closing 91-VERIFICATION truth 6.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- `TagChannelHealth` type (`'resolved' | 'pending' | 'failed'`) exported from `releaseBranch.ts`; `BranchState`'s `released` variant widened with a required `tagChannel` field so no producer can silently omit it
- `resolveBranchState` threads an optional `tagChannel` param (default `'resolved'`, backward-compatible) into the `released` variant without disturbing its existing 8-way precedence chain
- `ReleaseDetailSidebar.tsx`'s released-row tooltip now branches failed-then-pending-then-resolved (mirroring `mergeBackVerification.ts` step 4.5), only when `tagName` is null; the tagged and resolved-no-tag tooltips stay byte-identical
- `useReleaseDetail.ts` derives `tagChannel` from the existing `tagCheckFailed`/`tagLookupPending` signals and passes it to `resolveBranchState`, wiring the second (and last) consumer of the tag channel — the same fix already applied to the "Merged back" row in 91-07/91-08
- Stale comment in `useReleaseDetail.ts` claiming "the branch row above is unaffected" by tag-channel health corrected to reflect the new wiring

## Task Commits

1. **Task 1: TagChannelHealth discriminant on BranchState/resolveBranchState** - `fe4e2ee6` (feat)
2. **Task 2: Suppress negative tag claim unless tagChannel resolved** - `af2612ad` (feat)
3. **Task 3: Thread tagChannel into useReleaseDetail.ts + phase gates** - `dc26b23d` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` - `TagChannelHealth` type, widened `released` variant, `tagChannel` param on `resolveBranchState`
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` - updated two existing `toEqual` literals + 4 new cases (default, pending, failed, precedence lock)
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - three-way tooltip branch on `branchState.tagChannel`
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - updated two existing literals + 3 new render cases (resolved-null-tag exact sentence, pending, failed)
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - `tagChannel` derivation (failed > pending > resolved) threaded into the `resolveBranchState` call; corrected stale comment

## Decisions Made
- Matched the plan exactly: `tagChannel` required on the emitted variant, optional+defaulted on the resolver's params, precedence failed-before-pending gated on `tagName === null` only.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The pre-commit hook runs a whole-project `tsc --noEmit`, so Task 1's commit could not be isolated until Task 2's `ReleaseDetailSidebar.tsx`/`.test.tsx` edits (which also require the new required `tagChannel` field) existed on disk — both tasks' code was written before either was committed, then committed separately with each commit's `git add` scoped to only that task's files, preserving the one-commit-per-task convention without violating `--no-verify`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

91-VERIFICATION truth 6 (the last recorded gap) is closed. All five files in scope pass `tsc --noEmit`, `biome check`, and the five-file targeted suite (303 tests, up from the 244 baseline + pre-existing `releaseBranch.test.ts` count). `git diff --stat` for this plan's commits is confined to the five `files_modified`. MERGE-03/D-12 descope holds — zero `override|dismiss|acknowledge` tokens in either touched file, `RowAction` count unchanged at 3.

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 5 modified files and the summary file exist on disk; all 4 commit hashes (fe4e2ee6, af2612ad, dc26b23d, 5dc1ce32) found in git log.
