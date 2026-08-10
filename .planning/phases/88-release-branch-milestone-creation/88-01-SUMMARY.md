---
phase: 88-release-branch-milestone-creation
plan: 01
subsystem: release-detail
tags: [pure-module, vitest, git-ref-validation, milestone-format, release-branch]

# Dependency graph
requires:
  - phase: 87-release-detail-decomposition
    provides: release-detail/ folder convention (pure module + co-located Vitest suite, mirroring releaseSummaries.ts)
provides:
  - "releaseBranch.ts: RELEASE_BRANCH_PREFIX, extractVersionFromMilestoneTitle, deriveReleaseBranchName, isValidGitRefName, resolveBranchState, BranchState"
  - "releaseMilestone.ts: MILESTONE_TITLE_FORMAT_RE, isValidMilestoneTitle, formatMilestoneDueDate, buildMilestoneTitle, ownProjectMilestones, normalizeMilestoneTitle, findDuplicateMilestone, MilestoneLike"
affects: [88-02-gitlab-service-writes, 88-03-branch-ui, 88-04-milestone-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "React-free pure module + co-located Vitest suite (releaseSummaries.ts convention extended to releaseBranch.ts/releaseMilestone.ts)"
    - "Structural type (MilestoneLike) instead of importing a service type, to keep pure modules decoupled from services/gitlab.ts"

key-files:
  created:
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.ts
    - taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts
    - taskflow/src/routes/dashboard/release-detail/releaseMilestone.ts
    - taskflow/src/routes/dashboard/release-detail/releaseMilestone.test.ts
  modified: []

key-decisions:
  - "D-09 implemented literally: deriveReleaseBranchName strips the ' (DD.MM.YYYY)' suffix and derives from the version component only; a version-token-free title (e.g. 'Sprint 42') never produces a sanitized-guess branch name (D-11)."
  - "isValidGitRefName ported verbatim from 88-RESEARCH.md Pattern 3, including the biome-ignore comment for the control-character regex."
  - "ownProjectMilestones degrades to an unfiltered pass-through when no element in the input carries a numeric project_id, per the RESEARCH A3 defensive-default instruction — avoids silently emptying the reference list if this GitLab instance doesn't return project_id."

patterns-established:
  - "Pattern 1: Discriminated-union state resolution (BranchState) evaluated in explicit precedence order (no-milestone -> unresolvable -> invalid-ref -> tri-state exists/missing/loading), documented inline with the D-number driving each branch."

requirements-completed: [RELBR-01, RELBR-05, RELMS-03, RELMS-04]

# Metrics
duration: 25min
completed: 2026-08-10
---

# Phase 88 Plan 01: Pure release-branch and release-milestone modules Summary

**React-free `releaseBranch.ts` (version-only branch derivation + git-ref validation + branch-state resolution) and `releaseMilestone.ts` (real `X.Y.Z (DD.MM.YYYY)` title format + due-date formatting + ancestor filtering + duplicate detection), each with a co-located Vitest suite closing all four Wave 0 test gaps.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T16:53:00Z
- **Completed:** 2026-08-10T16:57:34Z
- **Tasks:** 2
- **Files modified:** 4 (all new)

## Accomplishments
- `releaseBranch.ts` exports `RELEASE_BRANCH_PREFIX`, `extractVersionFromMilestoneTitle`, `deriveReleaseBranchName`, `isValidGitRefName`, `resolveBranchState` + `BranchState` type — zero imports, 35 passing unit tests covering every case in the plan's `<behavior>` block (RELBR-01, RELBR-05).
- `releaseMilestone.ts` exports `MILESTONE_TITLE_FORMAT_RE`, `isValidMilestoneTitle`, `formatMilestoneDueDate`, `buildMilestoneTitle`, `ownProjectMilestones`, `normalizeMilestoneTitle`, `findDuplicateMilestone` + `MilestoneLike` type — no `@/services/gitlab` or `react` imports, 18 passing unit tests (RELMS-03, RELMS-04).
- Both modules compile cleanly under `tsc --noEmit` and the full `taskflow` suite (2136 tests) passes with `npm run check` at the documented 2-error `BacklogPage.tsx`/`BacklogRow.tsx` baseline — no new errors introduced.

## Task Commits

Each task was committed atomically:

1. **Task 88-01-T1: Pure releaseBranch module** - `ffa4f1cb` (feat)
2. **Task 88-01-T2: Pure releaseMilestone module** - `5fc30711` (feat), formatting fix - `8934c68b` (style)

**Plan metadata:** (SUMMARY commit follows this file)

## Files Created/Modified
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.ts` - version extraction, branch-name derivation, git-ref validation, branch-state resolution (zero imports)
- `taskflow/src/routes/dashboard/release-detail/releaseBranch.test.ts` - 35 tests across 4 describe blocks (extractVersionFromMilestoneTitle, deriveReleaseBranchName, isValidGitRefName, resolveBranchState)
- `taskflow/src/routes/dashboard/release-detail/releaseMilestone.ts` - title-format regex/validator, due-date formatting, ancestor filtering, duplicate detection (structural `MilestoneLike` type, no service coupling)
- `taskflow/src/routes/dashboard/release-detail/releaseMilestone.test.ts` - 18 tests across 6 describe blocks (MILESTONE_TITLE_FORMAT, formatMilestoneDueDate, buildMilestoneTitle, ownProjectMilestones, normalizeMilestoneTitle, findDuplicateMilestone)

## Decisions Made
- Followed 88-RESEARCH.md Pattern 3 verbatim for `isValidGitRefName`'s rule subset and the control-character regex comment, per the plan's explicit instruction to reuse that body.
- `ownProjectMilestones`'s numeric-`project_id`-presence check applies globally across the input list (not per-element) — a single project-owned entry in a mixed list is enough to trigger real filtering, matching the RESEARCH A3 "field entirely absent on this instance" framing rather than a per-element fallback that would behave unpredictably on partial data.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a Biome formatting violation in `releaseMilestone.ts`**
- **Found during:** Task 88-01-T2 overall-verification (`npm run check`)
- **Issue:** The `findDuplicateMilestone` implementation's multi-line `.find(...)` call didn't match Biome's single-line formatting rule, raising the error count from the documented 2-error baseline to 3.
- **Fix:** Ran `npx biome check --write` scoped to the four new files; Biome collapsed the callback onto one line.
- **Files modified:** `taskflow/src/routes/dashboard/release-detail/releaseMilestone.ts`
- **Verification:** `npm run check` back to exactly 2 errors (BacklogPage/BacklogRow baseline, unchanged); `npm run test -- src/routes/dashboard/release-detail/` still 66/66 passing; `tsc --noEmit` clean.
- **Committed in:** `8934c68b`

---

**Total deviations:** 1 auto-fixed (1 bug/formatting)
**Impact on plan:** Cosmetic-only fix required to preserve the plan's `npm run check` zero-new-errors success criterion. No scope creep, no behavior change.

## Issues Encountered
- The worktree had no `node_modules` (fresh worktree, package-lock.json byte-identical to the main checkout) — symlinked `taskflow/node_modules` to the main repo's install rather than re-running `npm install`, to keep the worktree's dependency tree in lockstep with the main checkout without a multi-minute reinstall. This is a local worktree-only workaround (the symlink itself is not committed; `node_modules` is gitignored).
- The initial `resolveBranchState` control-character test cases were drafted with visually-empty placeholder strings; verified via `od -c` that the Write tool actually emitted the real ASCII control byte (`\x01`) and DEL byte (`\x7f`) into the file, so the tests correctly exercise the intended rule — no code change needed, confirmed via byte inspection.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both pure modules are ready for Plan 88-02 (GitLab service writes) to consume: `deriveReleaseBranchName`/`isValidGitRefName`/`resolveBranchState` for the branch-creation flow, and `isValidMilestoneTitle`/`buildMilestoneTitle`/`findDuplicateMilestone` for the milestone-creation dialog.
- `MilestoneLike`'s structural typing means Plan 88-02 can extend `GitLabMilestone` with `project_id`/`group_id` (per D-07) without touching this plan's files — no coordination needed at the type level.
- No blockers. The RELMS-04 duplicate-check algorithm (exact vs. fuzzy) remains probe-gated per 88-RESEARCH.md Open Questions #1 — `findDuplicateMilestone`'s normalized-comparison default is documented as the defensive fallback pending `probe.sh` results, consistent with the plan's stated scope.

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*
