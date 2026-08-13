---
phase: 91-post-release-merge-back-verification
plan: 07
subsystem: ui
tags: [gitlab, react-query, merge-back-verification, resolver, error-handling]

# Dependency graph
requires:
  - phase: 91-post-release-merge-back-verification
    provides: "the three prior evidence-channel guards (defaultBranchCheckFailed, trackingMRsCheckFailed/trackingMRsUnavailable, compareCheckFailed) this plan mirrors for the fourth (tag) channel"
provides:
  - "searchProjectTags fails closed on transport/auth/shape errors instead of swallowing to an empty/partial array"
  - "resolveMergeBackVerdict accepts tagLookupPending/tagCheckFailed params with a step-4.5 loading/failure guard, symmetric with the other three channels"
  - "WR-01 closed: step 10 requires a healthy tracking-MR channel (trackingMRsCheckFailed OR trackingMRsUnavailable) before emitting likely-not-merged"
affects: [91-08]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fail-closed GitLab fetcher matching compareRefs's error discipline (transport throw, 401/403 ApiError, other non-ok plain Error with only the status, non-array-body guard)", "resolver channel guard: optional {channel}Pending/{channel}CheckFailed params destructured with = false defaults, guard sits below the definitive-positive-evidence branch and above the channel's terminal resolution"]

key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts
    - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts
    - taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts

key-decisions:
  - "Step 4.5 guard placed strictly below step 4 (merged-tracking-MR resolution) and above step 5 (tagName === null D-01 fallback), so a merged default-branch-targeting tracking MR still outranks a pending/failed tag lookup"
  - "tagCheckFailed checked before tagLookupPending inside the new guard so a simultaneous pending+failed state resolves to check-failed, matching the plan's precedence requirement"
  - "No new MergeBackVerdict kind, no new reason value beyond the existing 'no-mr-no-tag' | 'check-failed' union, no override/dismiss/confirm affordance (D-12 preserved)"

patterns-established:
  - "Fourth instance of the fail-closed-fetcher + resolver-channel-guard pair established by CR-01/02/03/04 in this same phase — any future evidence channel should follow this exact shape (throw in the fetcher, optional Pending/CheckFailed params in the resolver)"

requirements-completed: [MERGE-01, MERGE-02]

duration: 25min
completed: 2026-08-11
---

# Phase 91 Plan 07: Tag Evidence Channel Fail-Closed + Resolver Guard Summary

**Fourth and final merge-back evidence channel (tags) now fails closed end-to-end: `searchProjectTags` throws instead of swallowing errors to `[]`, and `resolveMergeBackVerdict` gained a symmetric loading/failure guard plus the WR-01 step-10 fix.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `searchProjectTags` (`gitlab.ts`) now mirrors `compareRefs`'s error discipline exactly: rethrows a transport error, throws `ApiError` on 401/403, throws a plain `Error` with only the status for other non-ok responses, and throws on a non-array 200 body — never interpolating body/URL/search/token into the message
- `resolveMergeBackVerdict` gained optional `tagLookupPending`/`tagCheckFailed` params and a new step 4.5 guard that resolves a still-loading tag lookup to `loading` and a failed one to `couldnt-verify`/`check-failed`, placed below the merged-tracking-MR resolution so definitive positive evidence still wins
- WR-01 closed: step 10's condition changed from `trackingMRsCheckFailed` to `trackingMRsCheckFailed || trackingMRsUnavailable`, so the accusatory `likely-not-merged` verdict now requires a genuinely healthy tracking-MR channel
- 7 new `searchProjectTags` unit cases + 14 new `resolveMergeBackVerdict` unit cases (loading/failure guard, precedence lock, default-compatibility lock, WR-01 guard) — targeted suite grew from the 224 tests recorded in 91-VERIFICATION to 240

## Task Commits

Each task was committed atomically:

1. **Task 1: Make searchProjectTags fail closed** - `3cadb62f` (fix)
2. **Task 2: Tag-channel loading/failure guard + WR-01 fix** - `6b0fb673` (fix)

_No separate plan-metadata commit — worktree mode; orchestrator handles STATE.md/ROADMAP.md centrally after merge._

## Files Created/Modified
- `taskflow/src/services/gitlab.ts` - `searchProjectTags` rewritten to fail closed (throw on transport/401/403/other-non-ok/non-array-body); JSDoc rewritten with `@throws`
- `taskflow/src/services/gitlab.test.ts` - added `describe('searchProjectTags (tag-channel fail-closed)')` with 7 cases (success, pagination, transport rejection, 500, 401 ApiError, non-array body, no-token-in-message)
- `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.ts` - added `tagLookupPending`/`tagCheckFailed` params, step 4.5 guard, WR-01 fix at step 10, module doc-comment header update
- `taskflow/src/routes/dashboard/release-detail/mergeBackVerification.test.ts` - added two new `describe` blocks: tag-channel loading/failure guards (7 cases) and WR-01 step-10 guard (2 cases)

## Decisions Made
- Step 4.5 guard ordering and the tagCheckFailed-before-tagLookupPending precedence inside it are load-bearing design choices carried directly from the plan (see `key-decisions` above) — no deviation from plan.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The worktree's `node_modules` was not populated (fresh worktree checkout). Symlinked `node_modules` from the main checkout's root and `taskflow/` directories (not committed — outside git, purely a local test-execution prerequisite) so `vitest`/`tsc` could run. No project files were affected; this is standard worktree setup, not a plan deviation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both root causes of 91-VERIFICATION's remaining gap (truth 5, tag channel) are closed at the service and resolver layer, with unit coverage
- Plan 91-08 can now wire `useReleaseDetail.ts`'s `gitlab-release-tags` query's `isError`/pending state into these new `tagLookupPending`/`tagCheckFailed` resolver params — the resolver has branches ready to receive them
- Full targeted suite (`gitlab.test.ts`, `mergeBackVerification.test.ts`, `ReleaseDetailSidebar.test.tsx`, `useReleaseDetail.test.tsx`) is green at 240 tests (was 224); `tsc --noEmit` clean

---
*Phase: 91-post-release-merge-back-verification*
*Completed: 2026-08-11*

## Self-Check: PASSED

All 4 modified source/test files found on disk; all 3 commit hashes (`3cadb62f`, `6b0fb673`, `9ea672db`) found in git log.
