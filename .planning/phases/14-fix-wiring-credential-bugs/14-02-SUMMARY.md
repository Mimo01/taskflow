---
phase: 14-fix-wiring-credential-bugs
plan: "02"
subsystem: ui
tags: [react, tanstack-query, cache-invalidation, jira, backlog]

# Dependency graph
requires:
  - phase: 12-backlog-view
    provides: BacklogPage useQuery with key ['jira-backlog-view', activeJiraProject, jiraBaseUrl]
  - phase: 11-create-edit-issue-form
    provides: handleCreateModalClose in AppLayout (main.tsx) for story creation flow
provides:
  - Correct cache invalidation so backlog list refreshes after story creation without page reload
affects: [backlog-view, story-creation-flow]

# Tech tracking
tech-stack:
  added: []
  patterns: [TanStack Query v5 prefix-match invalidation — use shortest prefix key to match all parameterized variants]

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx

key-decisions:
  - "Cache invalidation key fixed to ['jira-backlog-view'] — prefix match covers all ['jira-backlog-view', project, url] variants per TanStack Query v5 default behavior"

patterns-established:
  - "Invalidation prefix pattern: invalidateQueries({ queryKey: ['base-key'] }) matches all queries whose key starts with 'base-key'"

requirements-completed: [BACK-03]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 14 Plan 02: Fix Cache Invalidation Key Summary

**One-line fix to `handleCreateModalClose` in main.tsx: `['jira-backlog']` corrected to `['jira-backlog-view']` so backlog refreshes after story creation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T00:41:00Z
- **Completed:** 2026-03-15T00:44:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Fixed the cache invalidation mismatch that caused the backlog list to stay stale after creating a story from the backlog
- BACK-03 test coverage now GREEN (16/16 BacklogPage tests pass)
- Full suite remains at 365 passing, no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix cache invalidation key in main.tsx handleCreateModalClose** - `51e84b0` (fix)

## Files Created/Modified
- `taskflow/src/main.tsx` - Changed invalidateQueries key from `['jira-backlog']` to `['jira-backlog-view']` (line 130)

## Decisions Made
- TanStack Query v5 prefix-match behavior means `['jira-backlog-view']` correctly invalidates all queries whose key starts with that prefix, including the full parameterized key `['jira-backlog-view', activeJiraProject, jiraBaseUrl]` used in BacklogPage.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- BACK-03 is now GREEN; backlog refresh after story creation is fully functional
- No blockers for remaining phase 14 plans

---
*Phase: 14-fix-wiring-credential-bugs*
*Completed: 2026-03-15*
