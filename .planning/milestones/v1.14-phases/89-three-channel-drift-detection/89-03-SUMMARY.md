---
phase: 89-three-channel-drift-detection
plan: 03
subsystem: frontend
tags: [react-query, gitlab, drift-detection, useReleaseDetail]

# Dependency graph
requires:
  - phase: 89-01
    provides: fetchAllProjectMRs, fetchBranchTargetedMRs, fetchRecentProjectMRs (deleted this plan)
  - phase: 89-02
    provides: driftDetection.ts — unionMRs, selectChannelA, buildDriftRows, countFlaggedMRs, buildIssueMrIndex
provides:
  - "useReleaseDetail.ts wired to all three discovery channels (DRIFT-01/02/03), returning driftRows/driftFlaggedCount/isLoadingDrift/hasMatchedMilestone"
  - "Issues table's matchedRows/wrongMilestoneByKey re-sourced from the three-channel union (D-05/D-06)"
  - "fetchRecentProjectMRs and buildWrongMilestoneMap fully deleted from the codebase — no stub, no fallback"
affects: [89-04, 89-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Channel query key discipline: Channel A is project-scoped only (['gitlab-all-project-mrs', activeGitlabProject]), never versionId-scoped, to keep the fetch itself release-independent"
    - "Cheap double-union accepted over threading a prebuilt Map through buildDriftRows's three-array signature"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx
    - taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/release-detail/driftDetection.ts

key-decisions:
  - "Accepted the plan's 'second cheap union' option: buildDriftRows still takes channelA/B/C arrays and unions internally; useReleaseDetail.ts separately calls unionMRs once more to feed buildIssueMrIndex and the unmatchedMRs derivation, rather than threading a prebuilt Map through buildDriftRows's signature"
  - "unmatchedMRs is sourced by filtering the union with linkMRToTask against fixVersionIssueKeys directly (not via driftRows' taskReason), keeping its GitLabMR[] shape byte-identical to what IssuesSection/UnmatchedMRsSection already consume"

requirements-completed: [DRIFT-01, DRIFT-02, DRIFT-03, DRIFT-04]

# Metrics
duration: ~45min
completed: 2026-08-11
---

# Phase 89 Plan 03: Wire Three-Channel Drift Detection Into useReleaseDetail Summary

**Wired Channels A/B/C into `useReleaseDetail.ts` (new project-scoped `gitlab-all-project-mrs` key, unchanged `gitlab-milestone-mrs` key, branch-derived `gitlab-branch-mrs` key gated by D-18), re-sourced the Issues table's MR cell from the union via `buildIssueMrIndex`, and deleted `fetchRecentProjectMRs`/`buildWrongMilestoneMap` with no stub left behind.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-08-11T05:36:00Z (approx, worktree base reset time)
- **Completed:** 2026-08-11T06:21:00Z
- **Tasks:** 3/3 (plus 2 small follow-up fixes to satisfy the plan's repo-wide grep verification)
- **Files modified:** 6

## Accomplishments

- Channel A (`fetchAllProjectMRs`) added under a new, strictly project-scoped query key `['gitlab-all-project-mrs', activeGitlabProject]` — no `versionId` in the key, and never reusing the deleted `gitlab-recent-project-mrs` key (T-89-09 mitigation, verified by grep)
- Channel B (existing `milestoneMRs` query) left unchanged — same key, same cache contract with `ReleasesTab`/`UpcomingReleasesTimeline`
- Channel C (`fetchBranchTargetedMRs`) added under `['gitlab-branch-mrs', activeGitlabProject, releaseBranchName]`, `enabled` gated on `releaseBranchName !== null` (D-18 degraded state)
- `driftRows`, `driftFlaggedCount`, `isLoadingDrift`, `hasMatchedMilestone` derived via `driftDetection.ts`'s `selectChannelA`/`buildDriftRows`/`countFlaggedMRs` and added to the hook's return object
- The Issues table's `matchedRows`/`wrongMilestoneByKey` re-sourced from a hoisted `unionMRs(channelA, milestoneMRs, branchTargetedMRs)` via `buildIssueMrIndex` (D-05/D-06); `unmatchedMRs` re-derived from the same union filtered by `linkMRToTask`, replacing the deleted `matchIssuesToMRs`-direct call
- `buildWrongMilestoneMap` deleted (with its JSDoc) from `releaseSummaries.ts`; `matchIssuesToMRs` retained (still used inside `driftDetection.ts`'s `buildIssueMrIndex`)
- `fetchRecentProjectMRs` and its `describe('fetchRecentProjectMRs (GGX-WARN-01)')` test block (7 tests) deleted from `gitlab.ts`/`gitlab.test.ts` — no stub, no re-export
- Two stale doc-comment references to the deleted names in `driftDetection.ts` (written by plan 89-02, out of this plan's original file list) rephrased so the plan's repo-wide `grep -rn 'fetchRecentProjectMRs\|buildWrongMilestoneMap' taskflow/src` verification returns zero matches
- Two new regression tests added to `useReleaseDetail.test.tsx`: Channel A's fetch args/key, and Channel C NOT called when no milestone matched (D-18)
- Full suite: 2293 passed, 2 skipped, 13 todo (down from 89-02's 2297 — net effect of removing 7 `fetchRecentProjectMRs` tests, adding 2 new ones, no regressions)
- `npx tsc --noEmit` exits 0; `npm run check` stays at the documented 2-error biome baseline (`BacklogPage.tsx`/`BacklogRow.tsx`, both pre-existing and untouched by this plan)

## Task Commits

1. **Task 1: Add the three channel queries to useReleaseDetail and derive the drift rows** — `f9f30ee2` (feat)
2. **Task 2: Re-source the Issues table data from the union and delete buildWrongMilestoneMap** — `7db094f3` (feat)
3. **Task 3: Delete fetchRecentProjectMRs and its test block** — `e4092532` (fix)
4. **Follow-up: remove a stale `buildWrongMilestoneMap` literal from a driftDetection.ts JSDoc** — `c1aa0524` (fix)

## Files Created/Modified

- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` — three channel queries added, drift derivation added, Issues-table data re-sourced from the union, dead GGX-WARN-01 heuristic removed
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx` — mock factory extended with `fetchAllProjectMRs`/`fetchBranchTargetedMRs`, `fetchRecentProjectMRs` mock removed, two new tests (Channel A key/args, Channel C disabled-state)
- `taskflow/src/routes/dashboard/release-detail/releaseSummaries.ts` — `buildWrongMilestoneMap` and its JSDoc deleted; `matchIssuesToMRs` unchanged
- `taskflow/src/services/gitlab.ts` — `fetchRecentProjectMRs` and its JSDoc deleted
- `taskflow/src/services/gitlab.test.ts` — `describe('fetchRecentProjectMRs (GGX-WARN-01)')` block and its import deleted
- `taskflow/src/routes/dashboard/release-detail/driftDetection.ts` — two JSDoc comment lines rephrased to drop literal references to the deleted names (not a functional change; the file's exported behavior is unchanged from plan 89-02)

## Decisions Made

- Kept `buildDriftRows`'s existing three-array signature rather than threading a prebuilt `Map` through it — the plan explicitly allowed either option ("if it does not [accept a prebuilt union], call unionMRs once and keep buildDriftRows taking the three arrays, accepting the second cheap union"); the 89-02 signature does not accept a prebuilt union, so the cheap second union was accepted.
- `unmatchedMRs` is derived by filtering the union directly with `linkMRToTask`, not by reading `driftRows[].taskReason`, because `driftRows` also contains unevaluated (merged/closed/locked) MRs whose `taskReason` is always `null` regardless of link status — filtering the raw union against the same predicate `selectChannelA`/`evaluateTaskDrift` use internally keeps the semantics ("has no matching fix-version key") exact and independent of MR state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kept a temporary `fetchRecentProjectMRs`/`buildWrongMilestoneMap` import live during Task 1 to avoid a broken intermediate compile state**
- **Found during:** Task 1
- **Issue:** The plan's Task 1 action only adds the three new queries and drift derivation; the GGX-WARN-01 block (still using `fetchRecentProjectMRs`/`buildWrongMilestoneMap`) is explicitly Task 2's removal target. Removing the imports in Task 1 (as an initial pass did) broke `tsc --noEmit` before Task 2 landed.
- **Fix:** Restored both imports for the duration of Task 1's commit, then removed them cleanly in Task 2 once the GGX-WARN-01 block itself was deleted — keeping every commit independently green per the mandatory per-task verification gate.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`
- **Verification:** `npx tsc --noEmit` exits 0 at both the Task 1 and Task 2 commit boundaries.
- **Committed in:** `f9f30ee2` (Task 1), cleaned up in `7db094f3` (Task 2)

**2. [Rule 1 - Bug] Rephrased two JSDoc comments in `driftDetection.ts` (a file outside this plan's declared file list) to drop literal references to the deleted function/heuristic names**
- **Found during:** Task 3's final verification pass (`grep -rn 'fetchRecentProjectMRs\|buildWrongMilestoneMap' taskflow/src`)
- **Issue:** `driftDetection.ts` (written by plan 89-02, not declared in this plan's `files_modified`) documented its `buildIssueMrIndex` function with a JSDoc line naming both `fetchRecentProjectMRs` and `buildWrongMilestoneMap` as the heuristic it replaces. After Task 3 deleted both, this comment became the only remaining repo-wide match for the plan's own verification grep, which explicitly requires zero output.
- **Fix:** Rephrased both lines to describe the deleted heuristic without repeating the literal identifier strings (e.g. "capped-recent-MR-fetch plus wrong-milestone-map heuristic (both since deleted)"). No functional/exported-behavior change to `driftDetection.ts`.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/driftDetection.ts`
- **Verification:** `grep -rn 'fetchRecentProjectMRs\|buildWrongMilestoneMap' taskflow/src` returns no output; `npx tsc --noEmit` exits 0; full suite stays green.
- **Committed in:** `e4092532` (first line, part of Task 3's commit) and `c1aa0524` (second line, separate follow-up fix committed after Task 3 since it was caught during the plan-level verification pass, not the task-level one)

## Issues Encountered

None beyond the two auto-fixed deviations above.

## User Setup Required

None.

## Next Phase Readiness

- `useReleaseDetail.ts` now exposes `driftRows`, `driftFlaggedCount`, `isLoadingDrift`, and `hasMatchedMilestone` — ready for the new MR-drift section component (plan 89-04/89-05 scope, per the phase's roadmap).
- `unmatchedMRs` is preserved in the hook's return (byte-identical `GitLabMR[]` shape) for `UnmatchedMRsSection.tsx`'s current consumer — plan 89-05 is documented as the plan that removes it together with its last consumer.
- The three-channel union is now the single source of truth for every MR the release detail page reasons about; `fetchRecentProjectMRs`/`buildWrongMilestoneMap` cannot be resurrected as a silent fallback since both were deleted outright with no stub or re-export.

---
*Phase: 89-three-channel-drift-detection*
*Completed: 2026-08-11*
