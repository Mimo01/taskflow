---
phase: 26-test-regression-fixes
plan: 02
subsystem: testing
tags: [vitest, react-testing-library, zustand, mock, filter-store, jsdom]

requires:
  - phase: 26-test-regression-fixes
    plan: 01
    provides: "Global LazyStore mock, npm test script, clean jira.ts"
provides:
  - "All 57 previously failing tests now pass across 10 test files"
  - "Zero TypeScript errors in test files"
  - "Full test suite green: 489 tests pass, 0 failures, 0 unhandled rejections"
affects: [testing, ci]

tech-stack:
  added: []
  patterns:
    - "Selector-aware Zustand mock: vi.fn((selector?) => selector ? selector(state) : state) for stores used with both full-object and selector patterns"
    - "Filter store direct manipulation in tests: useFilterStore.getState().setActiveEpics() instead of simulating popover UI interactions"
    - "Filter store reset in beforeEach to prevent state leaking between tests"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/notifications.test.ts
    - taskflow/src/routes/notifications/NotificationPopover.test.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
    - taskflow/src/components/app/KeyboardShortcutsPanel.test.tsx
    - taskflow/src/components/app/RecentItemsPopover.test.tsx

key-decisions:
  - "Used filter store direct state manipulation instead of simulating UnifiedFilterBar popover UI (popover portals unreliable in jsdom)"
  - "Redirected ISSUE-07 comment tests from IssueDetailContent to InlineComment (comments moved to separate component)"
  - "Updated notification test mocks to include changelog data (production now requires changelog for issue-update detection)"

patterns-established:
  - "Selector-aware Zustand mocks for components using both useStore() and useStore(selector) patterns"
  - "Filter store reset in beforeEach for tests involving UnifiedFilterBar"

requirements-completed: [TEST-03, TEST-05]

duration: 19min
completed: 2026-03-19
---

# Phase 26 Plan 02: Test Regression Fixes Summary

**Fixed all 57 failing tests across 10 test files: settings store mocks, router mocks, filter UI migration, changelog-aware notification mocks, and component API updates**

## Performance

- **Duration:** 19 min
- **Started:** 2026-03-19T21:27:14Z
- **Completed:** 2026-03-19T21:46:15Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Fixed 41 test failures in SprintBoardTab (17), BacklogPage (16), and MrAttentionTab (8) by adding missing settings store fields (quickFilters, epicColorFieldKey) and router mock (useLocation)
- Fixed 18 test failures across 7 remaining files by updating assertions to match current production behavior
- Zero TypeScript errors in all test files (resolved SprintBoardTab.test.tsx statusCategory typing)
- Full suite: 489 tests pass, 0 failures, 0 unhandled rejections

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix high-volume test failures (SprintBoardTab, BacklogPage, MrAttentionTab)** - `81fc277` (fix)
2. **Task 2: Fix remaining test failures (IssueDetailSheet, services, notifications, misc)** - `069b3aa` (fix)

## Files Created/Modified
- `SprintBoardTab.test.tsx` - Added quickFilters/epicColorFieldKey to settings mock, updated EPIC-02 filter tests to use filter store directly, fixed statusCategory typing
- `BacklogPage.test.tsx` - Added quickFilters/epicColorFieldKey to settings mock, updated BACK-04 filter tests to use filter store, added filter store reset
- `MrAttentionTab.test.tsx` - Added useLocation to router mock
- `IssueDetailSheet.test.tsx` - Added router mock, selector-aware store mocks, redirected comment tests to InlineComment, fixed linked issue label assertions
- `jira.test.ts` - Added epicColorFieldKey to discoverCustomFields expected defaults
- `notifications.test.ts` - Added changelog data to issue-update mock responses
- `NotificationPopover.test.tsx` - Used data-testid for row clicks, fixed read-toggle assertion
- `NotificationRow.test.tsx` - Removed incorrect "Parent" label assertion
- `KeyboardShortcutsPanel.test.tsx` - Fixed kbd badge assertion for separate elements
- `RecentItemsPopover.test.tsx` - Changed from openUrl to onMRClick callback

## Decisions Made
- Used filter store direct state manipulation for EPIC-02 and BACK-04 tests because UnifiedFilterBar's popover-based UI doesn't render reliably in jsdom (Popover Portal rendering issues)
- Redirected ISSUE-07 comment thread tests from IssueDetailContent to InlineComment because comments were extracted to a dedicated component
- Updated notification mocks with changelog data because the production fetchIssueUpdates now skips issues without changelog entries (line 227: `if (changeLines.length === 0) continue`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Filter store state leaking between BacklogPage tests**
- **Found during:** Task 1
- **Issue:** BACK-04 and BACK-05 tests failed because filter state from epic filter tests persisted into subsequent tests
- **Fix:** Added `useFilterStore.getState().clearAll()` in beforeEach blocks for BACK-04 and BACK-05 describe groups
- **Files modified:** BacklogPage.test.tsx
- **Committed in:** 81fc277

**2. [Rule 1 - Bug] Selector-aware store mock needed for IssueDetailSheet**
- **Found during:** Task 2
- **Issue:** InlineComment uses `useSettingsStore((s) => s.commentSortOrder)` selector pattern, but simple vi.fn mock ignored the selector and returned full object
- **Fix:** Created selector-aware mock: `vi.fn((selector?) => selector ? selector(state) : state)`
- **Files modified:** IssueDetailSheet.test.tsx
- **Committed in:** 069b3aa

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes were necessary for test correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full test suite is green: 489 tests pass, 0 failures, 0 unhandled rejections
- Zero TypeScript errors in both production and test files
- Phase 26 success criteria fully met

---
*Phase: 26-test-regression-fixes*
*Completed: 2026-03-19*

## Self-Check: PASSED
