---
phase: 88-release-branch-milestone-creation
plan: 03
subsystem: ui
tags: [react-query, tanstack-query, gitlab, release-detail]

# Dependency graph
requires:
  - phase: 88-release-branch-milestone-creation
    provides: "Plan 88-01's releaseBranch.ts (resolveBranchState, deriveReleaseBranchName, BranchState) and releaseMilestone.ts (ownProjectMilestones); Plan 88-02's gitlab.ts fetchProject/fetchBranch"
provides:
  - "useReleaseDetail.ts: gitlab-project and gitlab-branch queries; branchState, releaseBranchName, defaultBranch, ownWindowMilestones return values"
  - "ReleaseDetailSidebar.tsx: Release Branch MetaRow rendering all six BranchState variants"
  - "ReleaseDetailSidebar.test.tsx: component coverage for every BranchState variant"
affects: [88-05-branch-create-action, 88-06-milestone-create-dialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two new useQuery blocks in useReleaseDetail.ts follow the file's established enabled-guard composition (base guard + feature-specific gate)"
    - "resolveBranchState fed with branchExists: undefined (not false) while query has no data, so the state resolves to 'loading' not 'missing'"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
  modified:
    - taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx

key-decisions:
  - "D-05 cache contract preserved literally: the windowed gitlab-milestones query key was not touched; diff shows zero removed lines matching that key"
  - "D-21 held: ReleaseDetailSidebar.tsx remains presentational — no useQuery/useStore/readSecret calls were introduced, branchState is a prop"
  - "D-14 held: defaultBranch derives strictly from project?.default_branch ?? null; no hardcoded 'main' string literal used as a fallback"

patterns-established: []

requirements-completed: [RELBR-02, RELBR-03, RELMS-01]

# Metrics
duration: ~20min
completed: 2026-08-10
---

# Phase 88 Plan 03: Release Branch Sidebar Wiring (read-only) Summary

**Wired `gitlab-project`/`gitlab-branch` queries into `useReleaseDetail.ts` and rendered a new "Release Branch" `MetaRow` in `ReleaseDetailSidebar.tsx` covering all six `BranchState` variants, giving the release detail view read-only visibility into whether `release/<version>` exists.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-10T19:03:00Z
- **Completed:** 2026-08-10T19:06:20Z
- **Tasks:** 2
- **Files modified:** 4 (3 modified, 1 new)

## Accomplishments
- `useReleaseDetail.ts` now runs two additional queries (`gitlab-project`, `gitlab-branch`) with the file's established enabled-guard shape and exposes `branchState`, `releaseBranchName`, `defaultBranch`, `ownWindowMilestones` — the windowed `gitlab-milestones` query key was left byte-identical (D-05 cross-component cache contract with `ReleasesTab`/`UpcomingReleasesTimeline` verified intact by diff)
- `ReleaseDetailSidebar.tsx` renders a new "Release Branch" `MetaRow` immediately after "GitLab Milestone", covering all six `BranchState` variants with the exact UI-SPEC copy (blocked-no-milestone, unresolvable, invalid-ref, loading, exists, missing) using only the already-imported `AlertTriangle`/`Check` icons and existing orange/green tint patterns — no new icon imports, no new Badge tone
- `ReleaseDetailSidebar.test.tsx` (new) covers all six states with 6 passing assertions
- `ReleaseDetailPage.tsx` threads `branchState` from the hook to the sidebar
- `IssuesSection.tsx` left completely untouched (D-20 verified — not in `git diff --name-only`)
- Full `taskflow` suite (2170 tests) passes; `tsc --noEmit` clean; `npm run check` at the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline — no new errors

## Task Commits

Each task was committed atomically:

1. **Task 88-03-T1: Add gitlab-project and gitlab-branch queries to useReleaseDetail** - `07983e76` (feat)
2. **Task 88-03-T2: Render the Release Branch MetaRow in the sidebar (all six states) + component test** - `af5cd590` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts` - Added `fetchProject`/`fetchBranch` imports, `deriveReleaseBranchName`/`resolveBranchState` imports from `./releaseBranch`, `ownProjectMilestones` import from `./releaseMilestone`; two new queries (`gitlab-project`, `gitlab-branch`); derived `releaseBranchName`, `defaultBranch`, `branchState`, `ownWindowMilestones`; all four added to the `as const` return object
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx` - Added `branchState: BranchState` required prop (type-only import from `./releaseBranch`); new "Release Branch" `MetaRow` rendering all six states with UI-SPEC-exact copy and `data-testid` hooks
- `taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx` - New file: `renderSidebar(overrides)` helper + one `it` per `BranchState` variant (6 tests)
- `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` - Destructure `branchState` from `useReleaseDetail`; pass `branchState={branchState}` to `<ReleaseDetailSidebar />`

## Decisions Made
- Followed the plan literally for both tasks — no deviation from the specified query shapes, MetaRow placement, or copy strings.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Worktree had no `node_modules` (fresh worktree provisioned after a base reset from a stale branch to the expected `88-02` base commit); symlinked `taskflow/node_modules` to the main checkout's install, consistent with the workaround documented in the 88-01/88-02 summaries. The symlink is not committed (`node_modules` is gitignored).
- The provisioned worktree branch initially pointed at a newer, unrelated `main` commit (`ca59303f`, version bump) rather than the expected `88-02` base (`53daa4d7`); the mandatory pre-flight base-drift check caught this and `git reset --hard` corrected it before any file was touched (working tree was clean at the time, so this was safe).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `useReleaseDetail.ts` now exposes everything Plan 88-05 (branch create action) needs: `branchState`, `releaseBranchName`, `defaultBranch` — the create action can gate on `branchState.kind === 'missing'` and use `defaultBranch` as the source ref with no hardcoded `'main'`.
- `ownWindowMilestones` is ready for Plan 88-06's create-milestone dialog reference list and duplicate check, reusing the already-cached windowed query with zero additional fetches.
- No blockers. `IssuesSection.tsx` is unmodified, so Plan 88-04 (if it touches that file) has a clean starting point.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*

## Self-Check: PASSED

All 4 files verified present on disk (3 modified + 1 new); both commit hashes (`07983e76`, `af5cd590`) verified present in `git log`.
