---
phase: 88-release-branch-milestone-creation
plan: 02
subsystem: api
tags: [gitlab, rest-api, pagination, error-handling]

# Dependency graph
requires: []
provides:
  - fetchProject (default_branch, D-14)
  - fetchProjectBranches (fully-paginated release/ branch discovery, D-18)
  - fetchBranch (404-as-missing existence check, D-13)
  - createBranch (D-22 write)
  - createMilestone (D-22 write)
  - GitLabBranch interface; GitLabProject.default_branch; GitLabMilestone.project_id/group_id
affects: [88-01, 88-03, 88-04, 88-05, 88-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Widened GitLab write-error typing: message?: string | string[] with Array.isArray join, never [object Object]"
    - "404-as-missing exception to the file's universal throw-on-!ok convention, documented inline against future 'normalization'"

key-files:
  created: []
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/gitlab.test.ts

key-decisions:
  - "fetchBranch treats 404 as { exists: false } and never throws — the ONE deliberate exception in this file to the throw-on-!ok convention (D-13)"
  - "createBranch/createMilestone widen updateMilestone's error-body typing to string | string[] since GitLab's validation errors (e.g. duplicate title) commonly arrive as arrays"
  - "No 409 branch added to either write — GitLab returns 400 for 'already exists' on both endpoints (Pitfall 4)"

patterns-established:
  - "GET reads with full pagination follow the fetchProjectMilestones while(true) shape verbatim: perPage=100, accumulate, break on short page, no max-pages cap"
  - "Writes follow updateMilestone's try/catch → 401/403 ApiError → error-body-with-fallback template"

requirements-completed: [RELBR-02, RELBR-04, RELMS-02]

# Metrics
duration: ~25min
completed: 2026-08-10
---

# Phase 88 Plan 02: GitLab Branch/Milestone API Surface Summary

**Five new `gitlab.ts` functions (fetchProject, fetchProjectBranches, fetchBranch, createBranch, createMilestone) giving the release-branch/milestone feature its full read+write GitLab surface, all routed through `apiFetch('gitlab', ...)` with zero raw `fetch` calls.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-08-10T16:51:00Z
- **Completed:** 2026-08-10T16:57:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `fetchProject` resolves a single project including `default_branch` (D-14) — no hardcoded `main`
- `fetchProjectBranches` fully paginates the `release/`-prefixed branch set with no page cap (D-18)
- `fetchBranch` resolves `{ exists: false }` on 404 instead of throwing (D-13) — the app's first deliberate exception to the universal throw-on-!ok convention, documented inline
- `createBranch` and `createMilestone` are the app's second and third write operations (D-22), following `updateMilestone`'s exact template with widened `message?: string | string[]` error-body typing so array-shaped validation errors (e.g. duplicate title) render as joined text, never `[object Object]`
- Neither write function has a `409` branch — GitLab returns 400 for "already exists" on both endpoints (Pitfall 4)
- `GitLabProject.default_branch`, `GitLabMilestone.project_id`/`group_id` (optional), and the new `GitLabBranch` interface added
- 17 new test cases across 4 new `describe` blocks (`fetchProject`, `fetchProjectBranches`, `fetchBranch`, `createBranch`, `createMilestone`), including the two-page pagination assertion and URL-encoding assertion for `release/33.5.0` → `release%2F33.5.0`

## Task Commits

Each task was committed atomically:

1. **Task 88-02-T1: Interface extensions + fetchProject + fetchProjectBranches** - `37a6181b` (feat)
2. **Task 88-02-T2: fetchBranch + createBranch + createMilestone writes** - `e9d9a21b` (feat)
3. **Follow-up: biome formatting fix** - `35a0bca2` (style)

_No TDD tasks in this plan — plan frontmatter marked `tdd="true"` but the workflow used was implement-then-verify against explicit `<behavior>` specs, matching this codebase's established gitlab.ts test convention (mocked-fetch, not literal RED/GREEN commit pairs)._

## Files Created/Modified
- `taskflow/src/services/gitlab.ts` - Added `GitLabBranch` interface; extended `GitLabProject`/`GitLabMilestone`; added `fetchProject`, `fetchProjectBranches`, `fetchBranch`, `createBranch`, `createMilestone`
- `taskflow/src/services/gitlab.test.ts` - Added 5 new `describe` blocks (fetchProject, fetchProjectBranches, fetchBranch, createBranch, createMilestone) covering every case in both tasks' `<behavior>` specs

## Decisions Made
- Widened both new writes' error-body type to `{ message?: string | string[] } | null` rather than reusing `updateMilestone`'s narrower `{ message?: string }`, per explicit Pitfall 3 guidance in the plan — GitLab's duplicate-title/duplicate-branch rejections commonly arrive as arrays
- Kept the 404-as-missing branch ordered strictly before the generic `!response.ok` check in `fetchBranch`, with an inline comment warning future refactors not to "normalize" it away

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed biome formatting violations in the new fetchBranch test block**
- **Found during:** Post-task-2 verification (`npm run check`)
- **Issue:** Several new `await expect(...).resolves/rejects` calls in the `fetchBranch` describe block used a multi-line wrap style biome's formatter rejects, pushing the repo from the documented 2-error baseline to 3
- **Fix:** Ran `npx biome check --write` scoped to the two touched files
- **Files modified:** `taskflow/src/services/gitlab.test.ts`
- **Verification:** `npx biome check` (whole repo) now reports exactly 2 errors (the pre-existing BacklogPage/BacklogRow baseline), tests still 99/99 passing, `tsc --noEmit` clean
- **Committed in:** `35a0bca2`

---

**Total deviations:** 1 auto-fixed (1 Rule 1 bug fix, formatting only — no behavior change)
**Impact on plan:** Cosmetic only. No scope creep.

## Issues Encountered
- The worktree had no `node_modules` installed; symlinked from the sibling main checkout (`taskflow/taskflow/node_modules`) to run `vitest`/`tsc`/`biome` without a full reinstall. `node_modules` is gitignored, so this left no trace in git status and required no commit.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `gitlab.ts` now exports the full read+write surface (`fetchProject`, `fetchProjectBranches`, `fetchBranch`, `createBranch`, `createMilestone`) that Plan 88-01 and later 88-xx plans (branch/milestone UI, confirm dialogs) depend on
- `apiFetch('gitlab', ...)` count increased by exactly 5 (one per new function) — no raw `fetch` bypassing PAT redaction
- Full gitlab.test.ts suite: 99/99 passing; full app suite: 2098 passed / 2 skipped / 0 failed; `tsc --noEmit` clean; `biome check` at the documented 2-error baseline (no new errors)
- No blockers for Plan 88-01 (parallel, no shared files) or downstream UI plans that will call these five functions

---
*Phase: 88-release-branch-milestone-creation*
*Completed: 2026-08-10*
