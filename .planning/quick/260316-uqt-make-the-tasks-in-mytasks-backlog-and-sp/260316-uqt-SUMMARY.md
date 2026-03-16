---
phase: quick
plan: 260316-uqt
subsystem: api
tags: [jira, jql, sorting, rank]

key-files:
  modified:
    - taskflow/src/services/jira.ts

key-decisions:
  - "Only changed parent-issue queries; subtask queries left as-is since subtasks inherit order from parent grouping"

requirements-completed: []

duration: 2min
completed: 2026-03-16
---

# Quick Task 260316-uqt: Sort MyTasks and SprintBoard by Jira Rank Order

**Changed JQL ordering from `updated DESC` to `rank ASC` in fetchSprintIssues and fetchMyTasksHierarchy so tasks appear in Jira board priority order**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T21:11:41Z
- **Completed:** 2026-03-16T21:13:41Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- fetchSprintIssues parent query now uses ORDER BY rank ASC (was updated DESC)
- fetchMyTasksHierarchy myStoriesJql now uses ORDER BY rank ASC (was updated DESC)
- Backlog queries already used rank ASC -- confirmed unchanged
- Search and epic queries intentionally left with updated DESC

## Task Commits

1. **Task 1: Change JQL ordering from updated DESC to rank ASC** - `a7bff1a` (feat)

## Files Modified
- `taskflow/src/services/jira.ts` - Changed ORDER BY clause in fetchSprintIssues (line 302) and fetchMyTasksHierarchy (line 398)

## Decisions Made
- Only changed parent-issue queries; subtask queries left as-is since subtasks inherit order from parent grouping and don't support rank on Jira DC

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

---
*Quick task: 260316-uqt*
*Completed: 2026-03-16*
