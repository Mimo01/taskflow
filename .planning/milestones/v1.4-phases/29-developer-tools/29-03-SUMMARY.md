---
phase: 29-developer-tools
plan: 03
subsystem: api
tags: [apiFetch, operation-profiling, routing, keyboard-shortcuts, command-palette]

# Dependency graph
requires:
  - phase: 29-developer-tools plan 01
    provides: apiFetch operation parameter, dev tools stores, DevToolsPage component
provides:
  - 57 apiFetch call sites annotated with operation labels for profiler grouping
  - /dev-tools route registered replacing /debug-logs
  - Cmd+Shift+D shortcut with command palette integration
  - Sidebar and Settings cleaned of old debug-logs references
affects: [dev-tools, api-profiling]

# Tech tracking
tech-stack:
  added: []
  patterns: [operation-label-annotation]

key-files:
  created: []
  modified:
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/sprints.ts
    - taskflow/src/services/jira/backlog.ts
    - taskflow/src/services/jira/comments.ts
    - taskflow/src/services/jira/links.ts
    - taskflow/src/services/jira/fields.ts
    - taskflow/src/services/jira/transitions.ts
    - taskflow/src/services/jira/projects.ts
    - taskflow/src/services/jira/client.ts
    - taskflow/src/services/jira/versions.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/notifications.ts
    - taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
    - taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/routes.tsx
    - taskflow/src/lib/shortcuts.ts
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/settings/Settings.tsx

key-decisions:
  - "57 call sites annotated (exceeds 15-20 target) for comprehensive profiler coverage"
  - "Advanced section removed from Settings entirely since DebugModeSection was its only content"

patterns-established:
  - "Operation label convention: every apiFetch call should include a 4th string argument grouping it by user-facing operation"

requirements-completed: [DEVT-02, DEVT-04]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 29 Plan 03: Operation Labels & Routing Summary

**57 apiFetch call sites annotated with operation labels for profiler grouping, /dev-tools route replaces /debug-logs with Cmd+Shift+D shortcut and command palette entry**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T09:35:19Z
- **Completed:** 2026-03-20T09:42:44Z
- **Tasks:** 2
- **Files modified:** 25

## Accomplishments
- 57 apiFetch call sites annotated across 16 service/route files with operation labels (Load Sprint Board, Load My Tasks, Load Issue Detail, Search Issues, Create/Edit Issue, Load Backlog, Manage Comments, Manage Links, Load Fields, Issue Transition, Validate Connection, Load Releases, Load Merge Requests, Load MR Detail, Fetch Notifications)
- /dev-tools route registered in routes.tsx, replacing /debug-logs
- Cmd+Shift+D shortcut (nav-devtools) added to shortcuts registry with navMeta for automatic command palette inclusion
- Sidebar cleaned: Bug icon removed, debug-logs NavLink removed, devToolsEnabled destructuring removed
- Settings cleaned: DebugModeSection import removed, Advanced section entirely removed

## Task Commits

Each task was committed atomically:

1. **Task 1: Annotate apiFetch call sites with operation labels** - `3ab873d` (feat)
2. **Task 2: Wire routing, shortcut, and remove old debug-logs references** - `9667d7b` (feat)

## Files Created/Modified
- `taskflow/src/services/jira/issues.ts` - Load My Tasks, Load Issue Detail, Search Issues, Create/Edit Issue labels
- `taskflow/src/services/jira/sprints.ts` - Load Sprint Board labels
- `taskflow/src/services/jira/backlog.ts` - Load Backlog labels
- `taskflow/src/services/jira/comments.ts` - Load Issue Detail, Manage Comments labels
- `taskflow/src/services/jira/links.ts` - Load Issue Detail, Manage Links labels
- `taskflow/src/services/jira/fields.ts` - Load Fields labels
- `taskflow/src/services/jira/transitions.ts` - Load Fields, Issue Transition labels
- `taskflow/src/services/jira/projects.ts` - Validate Connection labels
- `taskflow/src/services/jira/client.ts` - Search Issues labels
- `taskflow/src/services/jira/versions.ts` - Load Releases label
- `taskflow/src/services/gitlab.ts` - Load Merge Requests, Load MR Detail, Load Releases, Validate Connection labels
- `taskflow/src/services/notifications.ts` - Fetch Notifications labels
- `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` - Create/Edit Issue labels
- `taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx` - Load Fields label
- `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx` - Load Issue Detail labels
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Load Fields label
- `taskflow/src/routes/routes.tsx` - /dev-tools route replacing /debug-logs
- `taskflow/src/lib/shortcuts.ts` - nav-devtools shortcut entry
- `taskflow/src/components/app/Sidebar.tsx` - Removed Bug icon and debug-logs link
- `taskflow/src/routes/settings/Settings.tsx` - Removed DebugModeSection and Advanced section
- `taskflow/src/services/jira/comments.test.ts` - Updated assertions for operation labels
- `taskflow/src/services/jira/issues.test.ts` - Updated assertions for operation labels
- `taskflow/src/services/jira/links.test.ts` - Updated assertions for operation labels
- `taskflow/src/services/jira/sprints.test.ts` - Updated assertions for operation labels
- `taskflow/src/services/jira/transitions.test.ts` - Updated assertions for operation labels

## Decisions Made
- Annotated 57 call sites (exceeding the 15-20 target) for comprehensive profiler coverage across all service modules
- Removed the entire Advanced section from Settings since DebugModeSection was its only content (dev tools settings now live in the DevToolsPage itself)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 5 test files with operation label assertions**
- **Found during:** Task 2 (verification step)
- **Issue:** Existing tests asserted `toHaveBeenCalledWith` on apiFetch without the new 4th operation label argument, causing 9 test failures
- **Fix:** Added the correct operation label string as 4th argument to all failing assertions
- **Files modified:** comments.test.ts, issues.test.ts, links.test.ts, sprints.test.ts, transitions.test.ts
- **Verification:** All 615 tests pass
- **Committed in:** 9667d7b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test fix was necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Operation profiling data pipeline complete: all high-traffic call sites labeled, profiler store aggregates by operation
- Dev Tools accessible via /dev-tools route, Cmd+Shift+D shortcut, and command palette
- Old debug-logs references fully cleaned from routing, sidebar, and settings

---
*Phase: 29-developer-tools*
*Completed: 2026-03-20*
