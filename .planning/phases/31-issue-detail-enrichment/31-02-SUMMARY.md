---
phase: 31-issue-detail-enrichment
plan: 02
subsystem: ui
tags: [react, overdue-badge, clone-issue, jira, issue-detail]

requires:
  - phase: 25-tooling-dependencies
    provides: Biome linting and updated dependencies
provides:
  - OverdueBadge component with isOverdue utility function
  - Clone Issue button in issue detail action bar
  - duedate field added to sprint, my-tasks, and backlog API fetches
affects: [issue-detail, sprint-board, backlog, create-edit-issue]

tech-stack:
  added: []
  patterns:
    - "Reusable badge component with pure utility function for testability"
    - "Clone = create mode with pre-filled initialValues (separate handler from edit)"

key-files:
  created:
    - taskflow/src/routes/dashboard/issue-detail/OverdueBadge.tsx
    - taskflow/src/routes/dashboard/issue-detail/OverdueBadge.test.ts
  modified:
    - taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
    - taskflow/src/routes/dashboard/IssueDetailPage.tsx
    - taskflow/src/routes/dashboard/CreateEditIssueModal.tsx
    - taskflow/src/main.tsx
    - taskflow/src/services/jira.ts

key-decisions:
  - "OverdueBadge placed in issue-detail/ subdirectory as reusable component (plan referenced FieldsSection.tsx which is actually IssueDetailSidebar.tsx)"
  - "Clone button uses separate handleOpenClone handler (mode: create + initialValues) to avoid Pitfall 3 (clone opening edit instead of create)"
  - "Labels added to EditInitialValues as optional field; form does not render labels yet (documented limitation)"

patterns-established:
  - "isOverdue pure function exported separately for testability"
  - "Clone pattern: mode=create with pre-filled initialValues via dedicated outlet context callback"

requirements-completed: [DETAIL-10, DETAIL-11, DETAIL-03, DETAIL-04]

duration: 6min
completed: 2026-03-22
---

# Phase 31 Plan 02: Overdue Badge & Clone Issue Summary

**OverdueBadge component with pure isOverdue utility integrated into 3 views, Clone Issue button opening create-mode modal with pre-filled fields**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T17:35:23Z
- **Completed:** 2026-03-22T17:41:39Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- OverdueBadge renders red "Overdue" badge on past-due non-done issues across IssueDetailSidebar, TaskRow, and BacklogRow
- Clone button in action bar opens CreateEditIssueModal in create mode with summary, description, assignee, priority, story points, and epic link pre-filled
- Added duedate to sprint issues, my-tasks, and backlog API field lists so OverdueBadge has data in list views
- 6 unit tests for isOverdue logic covering all edge cases

## Task Commits

Each task was committed atomically:

1. **Task 1: OverdueBadge component + isOverdue utility with tests, integrate into 3 locations** - `cc27c8e` (test: RED), `a7447f7` (feat: GREEN + integration)
2. **Task 2: Clone Issue button in action bar** - `9f59c57` (feat)

_Note: Task 1 used TDD with RED/GREEN commits._

## Files Created/Modified
- `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.tsx` - Reusable OverdueBadge component + isOverdue pure function
- `taskflow/src/routes/dashboard/issue-detail/OverdueBadge.test.ts` - 6 unit tests for isOverdue logic
- `taskflow/src/routes/dashboard/IssueDetailSidebar.tsx` - Added OverdueBadge next to due date in sidebar
- `taskflow/src/routes/dashboard/TaskRow.tsx` - Added OverdueBadge after summary in task rows
- `taskflow/src/routes/dashboard/BacklogRow.tsx` - Added OverdueBadge after summary in backlog rows
- `taskflow/src/routes/dashboard/IssueDetailContent.tsx` - Added Clone button with Copy icon in action bar
- `taskflow/src/routes/dashboard/IssueDetailPage.tsx` - Wired openClone callback from outlet context
- `taskflow/src/routes/dashboard/CreateEditIssueModal.tsx` - Extended EditInitialValues with optional labels
- `taskflow/src/main.tsx` - Added handleOpenClone handler and openClone in outlet context
- `taskflow/src/services/jira.ts` - Added duedate to sprint, my-tasks, and backlog fetch field lists

## Decisions Made
- Plan referenced `issue-detail/FieldsSection.tsx` but actual file is `IssueDetailSidebar.tsx` -- adapted integration to correct file
- Clone uses a dedicated `handleOpenClone` handler that sets `mode: 'create'` with `initialValues`, avoiding Pitfall 3 (clone opening edit mode)
- Labels field added to EditInitialValues as optional but form does not render a labels field yet -- documented as known limitation

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Adapted file paths from plan to actual codebase structure**
- **Found during:** Task 1 (OverdueBadge integration)
- **Issue:** Plan referenced `issue-detail/FieldsSection.tsx` which does not exist; the due date rendering is in `IssueDetailSidebar.tsx`
- **Fix:** Integrated OverdueBadge into IssueDetailSidebar.tsx instead, at the same logical location (due date MetaRow)
- **Files modified:** taskflow/src/routes/dashboard/IssueDetailSidebar.tsx
- **Verification:** Badge renders next to due date in sidebar
- **Committed in:** a7447f7

**2. [Rule 2 - Missing Critical] Added duedate to API fetch field lists**
- **Found during:** Task 1 (OverdueBadge integration into TaskRow/BacklogRow)
- **Issue:** Sprint issues and backlog fetches did not request `duedate` field, so OverdueBadge would always receive null in list views
- **Fix:** Added `duedate` to fields in fetchSprintIssues, fetchMyTasksHierarchy, fetchBacklogIssues, and fetchBacklogView
- **Files modified:** taskflow/src/services/jira.ts
- **Verification:** Field present in API request strings
- **Committed in:** a7447f7

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both auto-fixes necessary for correct OverdueBadge rendering. No scope creep.

## Issues Encountered
- Pre-existing test failures in SprintBoardTab.test.tsx (UnifiedFilterBar.tsx:299) and IssueDetailSheet.test.tsx (useNavigate outside Router) -- not caused by this plan's changes

## Known Stubs
None -- all components are fully wired with real data sources.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- OverdueBadge is reusable and can be added to additional views (e.g., search results if a dedicated view is added)
- Clone button functional; labels pre-fill awaits form support for labels field

## Self-Check: PASSED

All 10 files verified present. All 3 commit hashes verified in git log.

---
*Phase: 31-issue-detail-enrichment*
*Completed: 2026-03-22*
