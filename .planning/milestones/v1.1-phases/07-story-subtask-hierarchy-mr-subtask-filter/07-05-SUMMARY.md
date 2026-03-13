---
phase: 07-story-subtask-hierarchy-mr-subtask-filter
plan: "05"
subsystem: ui
tags: [react, tanstack-query, gitlab, query-key, race-condition]

# Dependency graph
requires:
  - phase: 07-story-subtask-hierarchy-mr-subtask-filter
    provides: MrAttentionTab with subtask-linked MR inclusion (MRAT-02)
provides:
  - MrAttentionTab gitlab-mrs query fires only after userId resolves (no empty-reviewer race)
  - Stale empty-array cache busted automatically when userId changes via new query key
  - gitlab.ts clean with no uncommitted duplicate function definition
affects: [MrAttentionTab, gitlab-mrs query, reviewer MR fetching]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Include async-resolved values (userId) in TanStack Query queryKey and enabled guard to prevent stale-cache race conditions"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx

key-decisions:
  - "queryKey for gitlab-mrs includes userId as third element — ensures fresh fetch when userId changes from undefined to real value"
  - "enabled guard requires !!userId — prevents query firing before validateGitLab resolves"
  - "gitlab.ts uncommitted diff discarded via git checkout — duplicate fetchProjectMilestonesInRange never committed"

patterns-established:
  - "Race-condition guard: always include async-resolved identifiers (userId) in both queryKey and enabled for dependent queries"

requirements-completed: [MRAT-01, MRAT-02]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 07 Plan 05: MR Attention Tab userId Race Condition Fix Summary

**Fixed reviewer MR empty-list bug by adding userId to gitlab-mrs queryKey and enabled guard, preventing the query from firing before validateGitLab resolves**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-13T08:22:54Z
- **Completed:** 2026-03-13T08:25:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `gitlab-mrs` query now waits for `userId` before firing — `fetchReviewerMRs` is always called with a real user ID
- Query key `['gitlab-mrs', gitlabBaseUrl, userId]` busts stale empty-array cache when userId arrives
- Test helpers corrected: stale-badge, no-stale, and linking tests now use `renderWithQueryAndUser` (matching the component's actual behavior)
- `gitlab.ts` uncommitted diff reverted — no duplicate `fetchProjectMilestonesInRange` definition

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix gitlab-mrs query key and enabled guard** - `f7b2da8` (feat)
2. **Task 2: Revert duplicate fetchProjectMilestonesInRange** - no commit needed (git checkout reverted uncommitted changes)

## Files Created/Modified
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` - Added userId to queryKey and enabled guard for gitlab-mrs query
- `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` - Switched stale-badge, no-stale, and linking tests to renderWithQueryAndUser

## Decisions Made
- Added `userId` as the third element in `queryKey: ['gitlab-mrs', gitlabBaseUrl, userId]` — TanStack Query treats the new key as a fresh query, bypassing stale empty-array cache when userId resolves from undefined to a real value
- Added `!!userId` to `enabled` guard — ensures query never fires while userId is still undefined, so `fetchReviewerMRs` always receives a real ID
- Discarded uncommitted diff in `gitlab.ts` via `git checkout --` — the diff added a second copy of `fetchProjectMilestonesInRange` that did not exist in HEAD

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript errors in `WorkloadTab.test.tsx` and `JiraStep.tsx` (timetracking field null vs undefined mismatch, unused SelectValue import) — confirmed out-of-scope, logged to deferred-items.
- `fetchProjectMilestonesInRange` did not exist in committed HEAD (plan said "already exists at line 469") — the uncommitted diff was the only copy. Discarding it was still correct: no duplicate created.

## Next Phase Readiness
- MR Attention tab reviewer MR fetching is fixed and all 7 tests pass
- No remaining blockers for Phase 07 requirements MRAT-01 and MRAT-02

---
*Phase: 07-story-subtask-hierarchy-mr-subtask-filter*
*Completed: 2026-03-13*
