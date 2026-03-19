---
phase: 22-polish-empty-states-error-recovery
plan: 02
subsystem: ui
tags: [empty-state, error-state, stale-data-banner, dashboard-views, lucide-icons, three-state-detection]

# Dependency graph
requires:
  - phase: 22-polish-empty-states-error-recovery
    plan: 01
    provides: EmptyState, ErrorState, StaleDataBanner shared components + ApiError class
provides:
  - 5 dashboard views using shared empty/error/stale components with per-view icons and copy
  - Three-state error detection pattern (no data error, stale data banner, empty state) in all views
affects: [22-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [three-state detection pattern (isError && !data -> ErrorState, isError && data -> StaleDataBanner, !isError && empty -> EmptyState)]

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/SprintProgressTab.test.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx

key-decisions:
  - "bannerDismissed state must be declared after useQuery to avoid 'Cannot access before initialization' error"
  - "BacklogPage error/stale states rendered outside the loading/empty/content ternary to avoid nesting complexity"
  - "MrAttentionTab Connect GitLab CTA uses useNavigate for consistency with ErrorState's Reconnect CTA"
  - "SprintProgressTab content guard changed from !isLoading && !isError to data && data.length > 0 to properly separate empty from populated states"

patterns-established:
  - "Three-state detection: {isError && !data -> ErrorState}, {isError && data && !bannerDismissed -> StaleDataBanner}, {!isError && data.length === 0 -> EmptyState}"
  - "bannerDismissed + useEffect reset on error change for auto-clearing stale banner when new errors occur"

requirements-completed: [POLISH-01, POLISH-02]

# Metrics
duration: 9min
completed: 2026-03-16
---

# Phase 22 Plan 02: Dashboard View Retrofit Summary

**Replaced inline empty/error JSX in 5 dashboard views with shared EmptyState, ErrorState, and StaleDataBanner components using per-view Lucide icons and copywriting**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-16T17:29:18Z
- **Completed:** 2026-03-16T17:39:00Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- MyTasksTab: ClipboardList icon, "You're all caught up!" empty state, ErrorState with Retry, StaleDataBanner
- SprintBoardTab: Columns3 icon, "No sprint issues" empty state, ErrorState with Retry, StaleDataBanner
- SprintProgressTab: BarChart3 icon, "No sprint data yet" empty state with proper data.length > 0 guard
- BacklogPage: Inbox icon, "Backlog is empty" with Create Issue CTA button, ErrorState, StaleDataBanner
- MrAttentionTab: GitMerge icon, "No merge requests need attention" with conditional Connect GitLab CTA
- All 439 tests passing with updated test mocks and assertions

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace empty/error states in MyTasksTab, SprintBoardTab, SprintProgressTab** - `e86b442` (feat)
2. **Task 2: Replace empty/error states in BacklogPage and MrAttentionTab** - `4c4105a` (feat)

## Files Created/Modified
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` - EmptyState + ErrorState + StaleDataBanner integration
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - EmptyState + ErrorState + StaleDataBanner integration
- `taskflow/src/routes/dashboard/SprintProgressTab.tsx` - EmptyState + ErrorState + StaleDataBanner integration
- `taskflow/src/routes/dashboard/BacklogPage.tsx` - EmptyState with Create Issue CTA + ErrorState + StaleDataBanner
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` - EmptyState with conditional Connect GitLab CTA + ErrorState + StaleDataBanner
- `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` - Updated useNavigate mock, error/empty text assertions
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` - Updated useNavigate mock, error/empty text assertions
- `taskflow/src/routes/dashboard/SprintProgressTab.test.tsx` - Added react-router-dom mock, updated empty data assertions
- `taskflow/src/routes/dashboard/BacklogPage.test.tsx` - Added useNavigate mock
- `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` - Added react-router-dom mock with useNavigate

## Decisions Made
- bannerDismissed state placed after useQuery destructuring to avoid TDZ reference error with error variable
- BacklogPage renders error/stale states outside the loading/empty/content ternary chain for clearer control flow
- MrAttentionTab uses useNavigate for Connect GitLab CTA to stay consistent with ErrorState's pattern
- SprintProgressTab content guard tightened from `!isLoading && !isError` to `data && data.length > 0` to separate empty from populated rendering paths

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added useNavigate mock to 5 test files**
- **Found during:** Task 1 (ErrorState requires useNavigate from react-router-dom)
- **Issue:** Test files mocked react-router-dom without useNavigate, causing "Cannot access 'useNavigate'" errors
- **Fix:** Added `useNavigate: vi.fn(() => vi.fn())` to all affected test mock factories
- **Files modified:** MyTasksTab.test.tsx, SprintBoardTab.test.tsx, SprintProgressTab.test.tsx, BacklogPage.test.tsx, MrAttentionTab.test.tsx
- **Verification:** All 439 tests pass
- **Committed in:** e86b442 (Task 1) and 4c4105a (Task 2)

**2. [Rule 1 - Bug] Fixed bannerDismissed useEffect placement in SprintBoardTab**
- **Found during:** Task 1
- **Issue:** bannerDismissed + useEffect referencing `error` was placed before useQuery destructuring, causing TDZ error
- **Fix:** Moved state declaration and effect after the useQuery call
- **Files modified:** taskflow/src/routes/dashboard/SprintBoardTab.tsx
- **Verification:** All SprintBoardTab tests pass
- **Committed in:** e86b442 (Task 1)

**3. [Rule 1 - Bug] Updated test assertions for new component text patterns**
- **Found during:** Task 1
- **Issue:** Tests expected old inline text ("Failed to fetch tasks", "No issues in the current sprint") that was replaced by shared component text
- **Fix:** Updated findByText matchers to match ErrorState ("Couldn't load...") and EmptyState ("You're all caught up!", "No sprint issues", "No sprint data yet") text
- **Files modified:** MyTasksTab.test.tsx, SprintBoardTab.test.tsx, SprintProgressTab.test.tsx
- **Verification:** All tests pass
- **Committed in:** e86b442 (Task 1)

**4. [Rule 1 - Bug] Fixed findByText multiple match errors in SprintProgressTab tests**
- **Found during:** Task 1
- **Issue:** `/to do/i` pattern matched both bucket label and stacked bar percentage text, causing findByText to throw
- **Fix:** Changed `findByText(/to do/i)` to `findAllByText(/to do/i)` in affected assertions
- **Files modified:** SprintProgressTab.test.tsx
- **Verification:** All SprintProgressTab tests pass
- **Committed in:** e86b442 (Task 1)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 blocking)
**Impact on plan:** All fixes necessary for test compatibility with new shared components. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 03 can proceed to retrofit remaining views (WorkloadTab, ReleasesTab, EpicsPage, etc.)
- Three-state detection pattern established and proven across 5 views
- Test mock pattern for useNavigate documented for future view retrofits

---
*Phase: 22-polish-empty-states-error-recovery*
*Completed: 2026-03-16*
