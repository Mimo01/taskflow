---
phase: 47-v17-debt-cleanup
plan: "01"
subsystem: ui
tags: [react, tanstack-query, vitest, refactor]

# Dependency graph
requires: []
provides:
  - BacklogPage uses shared STALE_TIME_MS constant instead of literal 30_000 for query staleTime
  - SprintBoardTab.test.tsx has dead fetchSprintIssues mock removed
  - stats.html bundle analysis artifact is gitignored and deleted from disk
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Use STALE_TIME_MS from @/lib/query-constants for query staleTime values (not literals)"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/.gitignore

key-decisions:
  - "Replace literal 30_000 with shared STALE_TIME_MS constant — single source of truth enforced"

patterns-established:
  - "STALE_TIME_MS constant: always import from @/lib/query-constants for staleTime values"

requirements-completed: [LOAD-03]

# Metrics
duration: 3min
completed: 2026-03-30
---

# Phase 47 Plan 01: v1.7 Debt Cleanup — Stale Constants, Dead Mock, Artifact Ignore

**Replaced two staleTime: 30_000 literals with STALE_TIME_MS constant in BacklogPage, removed dead fetchSprintIssues mock from SprintBoardTab tests, and gitignored stats.html bundle artifact**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-30T16:30:50Z
- **Completed:** 2026-03-30T16:33:17Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- BacklogPage.tsx now imports and uses STALE_TIME_MS from @/lib/query-constants for both sprint query staleTime values
- Removed dead fetchSprintIssues mock from the @/services/jira vi.mock block in SprintBoardTab.test.tsx (the service no longer exports this function after the split into jira/issues module)
- Added `stats.html` gitignore rule and deleted the file from disk

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace literal 30_000 with STALE_TIME_MS and remove dead mock** - `58a1cf5` (refactor)
2. **Task 2: Add stats.html to .gitignore** - `a1c6af9` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - Added STALE_TIME_MS import, replaced two staleTime: 30_000 literals
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` - Removed fetchSprintIssues from @/services/jira mock factory
- `taskflow/.gitignore` - Added stats.html bundle analysis artifact rule

## Decisions Made
None - followed plan as specified.

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Code debt items from v1.7 audit resolved
- Full test suite green (830 passed, 5 skipped)
- Ready for remaining 47-v17-debt-cleanup plans

## Self-Check: PASSED

- FOUND: .planning/phases/47-v17-debt-cleanup/47-01-SUMMARY.md
- FOUND: taskflow/src/routes/dashboard/BacklogPage.tsx
- FOUND: taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
- FOUND: taskflow/.gitignore (contains stats.html)
- FOUND: stats.html deleted from disk
- FOUND: commit 58a1cf5 (task 1)
- FOUND: commit a1c6af9 (task 2)

---
*Phase: 47-v17-debt-cleanup*
*Completed: 2026-03-30*
