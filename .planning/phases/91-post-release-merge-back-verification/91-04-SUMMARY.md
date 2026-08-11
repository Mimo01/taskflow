---
phase: 91-post-release-merge-back-verification
plan: 04
subsystem: api
tags: [gitlab, merge-back-verification, pagination, error-handling]

requires:
  - phase: 91-post-release-merge-back-verification (plans 01-03)
    provides: fetchSourceBranchMRs, compareRefs, resolveMergeBackVerdict scaffolding
provides:
  - compareRefs fails closed on a malformed compare payload instead of silently reading it as diffCount 0
  - fetchSourceBranchMRs pagination bounded at 20 pages, matching searchProjectTags precedent
  - target_branch verified to survive fetchSourceBranchMRs verbatim for the resolver (91-05) to filter on
affects: [91-05, 91-06]

tech-stack:
  added: []
  patterns:
    - "Fail-closed payload validation: narrow API response body to unknown, require expected shape as arrays before use, throw a plain Error (never ApiError) on shape mismatch without interpolating body/URL/token"
    - "Bounded pagination for-loop with maxPages constant declared immediately above the loop, mirroring searchProjectTags's `const maxPages = 20;` precedent"

key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts

key-decisions:
  - "compareRefs throws a plain Error (not ApiError) on a malformed 200 body, matching the file's existing distinction between auth failures (ApiError) and all other failures (Error)"
  - "fetchSourceBranchMRs keeps returning target_branch unfiltered — filtering on target_branch is explicitly deferred to the resolver (Plan 91-05), this plan only proves the field survives the service boundary"

requirements-completed: [MERGE-02]

duration: 25min
completed: 2026-08-11
---

# Phase 91 Plan 04: GitLab Service Hardening (CR-02, WR-06) Summary

**compareRefs now throws on any non-array diffs/commits body instead of silently reading it as an empty diff, and fetchSourceBranchMRs pagination is bounded at 20 pages like its sibling fetchers**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-11T19:47:00Z (approx, worktree base reset)
- **Completed:** 2026-08-11T19:50:05Z
- **Tasks:** 2 completed
- **Files modified:** 2

## Accomplishments
- `compareRefs` (`taskflow/src/services/gitlab.ts`) validates that both `diffs` and `commits` are arrays before constructing its return value; a malformed body (e.g. `{ message: 'Insufficient permissions' }`, or `commits: null`) now throws `Failed to compare refs: unexpected response shape` instead of coercing to `diffCount: 0` / `commitCount: 0`. This closes CR-02 — the module's own D-04 invariant ("an incomplete diff must never be read as no diff") is now enforced at the source, so a malformed 200 surfaces as `compareCheckFailed` and the resolver reaches `couldnt-verify` rather than a false "merged" verdict.
- `fetchSourceBranchMRs`'s `while (true)` loop was replaced with a `for (let page = 1; page <= maxPages; page++)` loop with `const maxPages = 20;`, mirroring `searchProjectTags`'s existing precedent in the same file. This closes WR-06. Full pagination behavior is unchanged and still proven by the existing `T-91-05` test (100+3 fixture, no cap hit).
- Added a page-ceiling regression test proving a server that always returns a full page stops after exactly 20 requests with 2000 results (rather than spinning forever).
- Added a `target_branch`-preservation fixture (CR-01 service-side prerequisite): a page with one MR targeting `master` and one targeting `develop` returns both verbatim, with no client-side filtering inside `fetchSourceBranchMRs` — confirming the field the resolver needs (Plan 91-05) actually survives this service function.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make compareRefs fail closed on a malformed compare payload (CR-02)** - `b76a58be` (fix)
2. **Task 2: Bound fetchSourceBranchMRs pagination and cover a non-default target_branch fixture (WR-06, CR-01 service side)** - `3649901c` (fix)

**Plan metadata:** committed with this SUMMARY.md (see final commit below)

## Files Created/Modified
- `taskflow/src/services/gitlab.ts` - `compareRefs` now validates `diffs`/`commits` are arrays before use, throwing otherwise; `fetchSourceBranchMRs` pagination bounded at `maxPages = 20`
- `taskflow/src/services/gitlab.test.ts` - two new `compareRefs` malformed-payload cases (diffs-side via `{message:...}`, commits-side via `commits: null`); widened `makeMR` factory to accept overrides; two new `fetchSourceBranchMRs` cases (20-call page ceiling, target_branch preservation)

## Decisions Made
- Kept the plain-`Error` vs `ApiError` distinction exactly as the file already establishes it (401/403 → `ApiError`, everything else → `Error`), applying it to the new shape-validation throw for consistency.
- Did not touch `resolveMergeBackVerdict` or `useReleaseDetail.ts` in this plan — CR-01 (target_branch filtering in the resolver), CR-03, and CR-04 are explicitly out of scope here per the plan's `files_modified` list; this plan only proves the service layer carries the field the resolver will need.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` specs and all acceptance criteria passed without needing any Rule 1-4 adjustments.

**Environment note (not a deviation from the plan's code, but from a typical setup):** the worktree had no `node_modules` (git-ignored, not populated on worktree creation). Verified the worktree's `package-lock.json` was byte-identical to the main repo's, then symlinked `taskflow/node_modules` to the main repo's installed `taskflow/node_modules` rather than running `npm install` — this avoids an unnecessary reinstall/network dependency for running the plan's required `vitest`/`tsc` verification commands. No package.json or lockfile was modified.

## Issues Encountered
- A stray git-tracked file (`node_modules/.vite/vitest/.../results.json`) was present in the repo despite `node_modules/` being gitignored. Restoring the `node_modules` symlink workflow briefly deleted it from the working tree; restored via `git checkout --` before staging so no incidental deletion is included in this plan's commits. Out of scope for this plan — not fixed further, just left as it was.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `fetchSourceBranchMRs` now verifiably returns `target_branch` unfiltered and paginates safely — Plan 91-05 (CR-01 resolver fix) can filter on `target_branch === defaultBranch` in `resolveMergeBackVerdict` with confidence the upstream data is correct and bounded.
- `compareRefs`'s fail-closed behavior means Plan 91-05/91-06's resolver work for CR-03/CR-04 (permanent-loading fixes) can rely on the compare channel already degrading safely on malformed input; only the tracking-MR channel and the two loading-state gaps remain.
- No blockers for the next wave.

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*
