---
phase: 89-three-channel-drift-detection
plan: 04
subsystem: frontend
tags: [react, tanstack-query, gitlab, drift-detection, vitest]

# Dependency graph
requires:
  - phase: 89-01
    provides: fetchOpenProjectMRs (fully-paginated, state=opened GitLab MR list fetcher)
  - phase: 89-02
    provides: computeRowDriftCount (branch+milestone-only per-row drift count, deliberately excludes TASK)
provides:
  - "ReleasesTab.tsx row-level D-15 aggregate drift indicator, fed by one project-wide open-MR fetch"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-14 fetch-once query mirrors the existing releaseBranches D-18 pattern byte-for-byte (same enabled guard shape, same staleTime)"
    - "Milestone candidates carry `id` alongside date/name/url so the matched candidate's GitLab milestone id survives into the per-row derivation without a second lookup"

key-files:
  modified:
    - taskflow/src/routes/dashboard/ReleasesTab.tsx
    - taskflow/src/routes/dashboard/ReleasesTab.test.tsx

key-decisions:
  - "driftCount gated on both openMrsLoaded and !version.released, following the same CR-01/WR-04 precedent already documented for branchMissing/milestoneMissing in this file — released versions' branches are deleted post-merge and would otherwise report drift forever"
  - "The visible '{n} drift' label is icon+text with aria-hidden on the visible text; a parallel sr-only span carries the full accessible description, mirroring the icon(hidden)+sr-only(text) shape of the sibling row-branch-present/row-missing-branch indicators rather than double-announcing the count"

requirements-completed: [DRIFT-09]

# Metrics
duration: ~35min
completed: 2026-08-11
---

# Phase 89 Plan 04: Releases-List Aggregate Drift Indicator Summary

**Added a single project-wide open-MR fetch to `ReleasesTab.tsx` feeding a per-row branch+milestone drift count (D-14/D-15), rendered as an orange "{n} drift" badge in the slot the Phase 88 comment already reserved, with a mandatory tooltip explaining the detail-page count can legitimately be higher.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2
- **Files modified:** 2

## Accomplishments

- One new `useQuery` keyed `['gitlab-open-mrs', activeGitlabProject]` calls `fetchOpenProjectMRs`, byte-for-byte mirroring the `releaseBranches` D-18 fetch-once guard and `staleTime` — proven fetch-once by a dedicated test asserting exactly one call across a three-row render (T-89-13 mitigation)
- Milestone `candidates` mapping extended to carry `id`; `bestMatch` selection now threads `matchedMilestoneId` alongside the existing exact/fuzzy match logic
- `MatchedVersion` gained `driftCount: number`, derived via `computeRowDriftCount(openMrs ?? [], derived, matchedMilestoneId)`, gated on `openMrsLoaded` (T-89-16 mitigation) and `!version.released` (CR-01/WR-04 precedent — planner discretion recorded per the plan, since D-14 didn't itself state a released-version rule)
- The D-15 indicator renders only when `driftCount > 0`, inserted between the `branchMissing` block and the `{/* Task count */}` comment exactly where the Phase 88 reserved-slot comment pointed; visible label `{n} drift` per the UI-SPEC copywriting contract, orange warning tone, `AlertTriangle` icon, native `title` attribute with the mandated D-14 tooltip copy ("{n} MRs need branch or milestone attention. Open the release for the full check, including task links.")
- 4 new additive tests in the existing `release-row drift indicators (D-17/D-18/D-19)` describe block: drift-count renders with a flagged MR, hides with zero drifting MRs, fetch-once guarantee across a multi-row render, and title mentions both branch and milestone. All 6 pre-existing tests in that block, plus the rest of the file's 23 tests, are untouched and green (29/29 total)
- Full suite: 2301 passed (up from the pre-plan baseline of 2297), 2 skipped, 13 todo — no regressions
- `npx tsc --noEmit` exits 0; `npm run check` stays at the documented 2-error baseline (BacklogPage.tsx/BacklogRow.tsx only, unrelated to this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fetch the project's open MRs once and derive a per-row drift count** - `b4b14204` (feat)
2. **Task 2: Render the drift indicator in the reserved slot and assert it in tests** - `aded3767` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/ReleasesTab.tsx` - New `gitlab-open-mrs` query, `driftCount` field on `MatchedVersion`, D-15 indicator span in the reserved slot
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` - `fetchOpenProjectMRs` added to the `@/services/gitlab` mock factory and the `beforeEach` re-establish block; `makeOpenMr` fixture helper; 4 new tests

## Decisions Made

- Kept the comment near the new query free of the literal `computeRowDriftCount` string (referencing "the drift-count derivation in toMatched below" instead) after the 89-02 SUMMARY's documented lesson that acceptance-criteria greps can be tripped by comments referencing the exact function name, even though the actual call site still contains it once
- `driftCount`'s visible "{n} drift" text is marked `aria-hidden="true"` with a parallel `sr-only` span carrying the full description, matching the existing `row-branch-present`/`row-missing-branch` icon(hidden)+sr-only(text) accessibility shape in this file rather than letting a screen reader announce the count twice

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing `node_modules` in the worktree**
- **Found during:** Pre-Task-1 setup
- **Issue:** The worktree had no `node_modules`; the husky pre-commit hook (biome, vitest) would fail with `command not found`.
- **Fix:** Ran `npm ci` in `taskflow/` (existing `package-lock.json`, no new dependency added).
- **Files modified:** none tracked (node_modules is gitignored)
- **Committed in:** N/A (not a tracked change)

**2. [Rule 1 - Bug] Fixed a biome import-sort violation introduced by Task 1's new import**
- **Found during:** Pre-Task-2 verification pass (`npx biome check`)
- **Issue:** The new `computeRowDriftCount` import from `./release-detail/driftDetection` was placed before `./ReleasesSkeleton` alphabetically but biome's import sort expects `./ReleasesSkeleton` first (case-sensitive sort), producing 1 error.
- **Fix:** Ran `npx biome check --write` on both modified files, which reordered the two relative imports.
- **Files modified:** `taskflow/src/routes/dashboard/ReleasesTab.tsx`
- **Verification:** `npx tsc --noEmit` and `npx vitest run src/routes/dashboard/ReleasesTab.test.tsx` both stayed green after the reorder; `npm run check` confirmed back to the documented 2-error baseline.
- **Committed in:** `aded3767` (part of Task 2 commit, since it was caught before Task 2's commit)

**3. [Process] Worktree HEAD was on a stale base commit at spawn time**
- **Found during:** Mandatory worktree branch check (first action)
- **Issue:** `git merge-base HEAD <expected-base>` did not equal the expected base; the worktree branch's tip (`ca59303f`, a later `chore: bump version` commit from an unrelated prior session) was not a descendant of the wave's expected base commit `76c8eb20`.
- **Fix:** Per the mandatory branch-check protocol, ran `git reset --hard 76c8eb20ff5753883f10ab351e96f51ec30dba8a` after confirming the working tree was clean (`git status --short` empty, no uncommitted work to lose).
- **Committed in:** N/A (reset, not a commit)

---

**Total deviations:** 3 (1 blocking/environment setup, 1 formatting auto-fix, 1 pre-execution branch-base correction)
**Impact on plan:** No functional impact — all fixes were either environment setup or a one-line import reorder. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ReleasesTab.tsx` now shows the D-14/D-15 aggregate drift count on the Releases list, giving the user a signal before they open a release's detail page. The detail page's own D-13 aggregate count (built in 89-02, wired in 89-03/89-05) can legitimately be higher since it also evaluates TASK drift — the row-level tooltip explicitly calls this out.
- `computeRowDriftCount` and `fetchOpenProjectMRs` are now both consumed at their intended call sites (89-02 and 89-01 respectively); no further phase-89 plans depend on this plan's output per the plan's `affects: []`.

---
*Phase: 89-three-channel-drift-detection*
*Completed: 2026-08-11*

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/ReleasesTab.tsx` — FOUND on disk
- `taskflow/src/routes/dashboard/ReleasesTab.test.tsx` — FOUND on disk
- `.planning/phases/89-three-channel-drift-detection/89-04-SUMMARY.md` — FOUND on disk
- Commit `b4b14204` (Task 1) — FOUND in `git log --oneline --all`
- Commit `aded3767` (Task 2) — FOUND in `git log --oneline --all`
- Commit `e97b5366` (SUMMARY) — FOUND in `git log --oneline --all`

---

## DESCOPED — feature removed 2026-08-11 (post-verification)

At UAT the user decided drift information belongs on the release **detail** page
only: *"I dont need the drift/mismatched info on the list page at all, remove it.
I only want the newly added things on detail."*

Everything this plan built was therefore removed:

- `ReleasesTab.tsx` — the `{n} mismatched` badge, the `driftCount` field on
  `MatchedVersion`, the project-wide `['gitlab-open-mrs', …]` query, and the
  now-unused `matchedMilestoneId` local.
- `driftDetection.ts` — `computeRowDriftCount` (only consumer was this plan).
- `gitlab.ts` — `fetchOpenProjectMRs` (only consumer was this plan).
- All corresponding tests, including the WR-05 regression test added earlier the
  same day (the behaviour it guarded no longer exists).

The release **detail** page is untouched: `MrDriftSection`, `useReleaseDetail`'s
three channels, `countFlaggedMRs` (D-13) and the union all remain. The only edit
inside `release-detail/` was deleting the dead `computeRowDriftCount` helper.

DRIFT-09 is marked **descoped** in `REQUIREMENTS.md` — deliberately removed on
user instruction, not an unmet requirement. This also retires the D-13/D-14
count-divergence confusion that prompted the earlier relabel, since there is now
only one drift number in the product.

Verification after removal: `npx tsc --noEmit` exits 0; `npx vitest run` 2306
passed / 2 skipped / 13 todo / 0 failed (down from 2322 — 16 tests removed with
the feature); biome unchanged from the documented baseline.
