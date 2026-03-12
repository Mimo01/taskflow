---
phase: 05-api-foundation-quick-wins
plan: 05
subsystem: api
tags: [jira, jql, sprint, subtasks, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    provides: fetchSprintIssues two-query strategy (05-03)
provides:
  - issuetype not in subtaskIssueTypes() guard in fetchSprintIssues first JQL
  - APIF-02 guard test verifying guard text appears in first fetch URL
affects: [hierarchy-ui, sprint-board, my-tasks]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JQL guard pattern: issuetype not in subtaskIssueTypes() before resolution clause to prevent Jira DC edge case where openSprints() returns subtasks"

key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts

key-decisions:
  - "Test the JQL guard by asserting the percent-encoded guard string appears in the first fetch URL (not by mocking Jira filtering behavior — mocks bypass Jira's actual filtering)"
  - "Guard placement: AND issuetype not in subtaskIssueTypes() goes after assigneeClause and before AND resolution = Unresolved"

patterns-established:
  - "TDD guard validation: assert URL string contains expected JQL fragment rather than simulating Jira's filter response"

requirements-completed: [APIF-02]

# Metrics
duration: 5min
completed: 2026-03-12
---

# Phase 5 Plan 05: Sprint JQL Subtask Guard Summary

**issuetype not in subtaskIssueTypes() guard added to fetchSprintIssues first JQL, preventing Jira DC edge case where openSprints() returns subtasks causing empty sprint view**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-12T15:32:26Z
- **Completed:** 2026-03-12T15:37:00Z
- **Tasks:** 1 (TDD: RED + GREEN commits)
- **Files modified:** 2

## Accomplishments
- Added `AND issuetype not in subtaskIssueTypes()` guard to the first JQL in `fetchSprintIssues` — placed between assigneeClause and `AND resolution = Unresolved`
- Added APIF-02 guard test verifying the guard text appears percent-encoded in the first fetch call URL
- All 5 APIF-02 tests pass (4 existing + 1 new guard test); 30 total jira.test.ts tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing APIF-02 guard test** - `6f12070` (test)
2. **Task 1 GREEN: Add issuetype guard to sprint JQL** - `22c5e32` (fix)

_Note: TDD tasks have separate RED and GREEN commits per protocol_

## Files Created/Modified
- `taskflow/src/services/jira.ts` - First JQL now includes `AND issuetype not in subtaskIssueTypes()` before `AND resolution = Unresolved`
- `taskflow/src/services/jira.test.ts` - New guard test asserts `issuetype%20not%20in%20subtaskIssueTypes()` in first fetch URL

## Decisions Made
- Asserted percent-encoded URL string (`issuetype%20not%20in%20subtaskIssueTypes()`) rather than `+`-encoded — the code uses `encodeURIComponent` which produces `%20` not `+`
- Single mock response (empty issues) sufficient for guard test — no second fetch call occurs when parentKeys is empty

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Corrected URL encoding in test assertion**
- **Found during:** Task 1 RED phase
- **Issue:** Plan suggested `issuetype+not+in+subtaskIssueTypes()` but `encodeURIComponent` produces `%20` for spaces (not `+`)
- **Fix:** Updated test assertion to `issuetype%20not%20in%20subtaskIssueTypes()`
- **Files modified:** taskflow/src/services/jira.test.ts
- **Verification:** Test fails on pre-fix code, passes after guard added to jira.ts
- **Committed in:** 6f12070 (RED commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — encoding mismatch in test assertion)
**Impact on plan:** Minor correction necessary for test correctness. No scope creep.

## Issues Encountered
- Pre-existing `TopBar.test.tsx` failures (Tauri invoke errors) are unrelated to this plan and were present before execution. Out of scope per deviation rules.

## Next Phase Readiness
- APIF-02 gap is now closed: fetchSprintIssues correctly excludes subtasks from first query parentKeys on Jira DC
- Ready to proceed with remaining gap closure plans (05-06)

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*
