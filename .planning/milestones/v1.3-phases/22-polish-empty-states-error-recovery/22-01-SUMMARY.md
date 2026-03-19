---
phase: 22-polish-empty-states-error-recovery
plan: 01
subsystem: ui
tags: [error-handling, api-error, empty-state, error-state, stale-data, auth-detection, lucide-react]

# Dependency graph
requires:
  - phase: 18-app-icon-multi-page-settings
    provides: Settings page with /settings route for Reconnect CTA
provides:
  - ApiError class with isAuthError/getErrorSource helpers
  - EmptyState shared component for icon/title/subtitle/action layouts
  - ErrorState shared component with auth detection and Reconnect CTA
  - StaleDataBanner shared component with Retry/Dismiss buttons
  - jira.ts and gitlab.ts retrofitted to throw ApiError on 401/403
affects: [22-02, 22-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [ApiError class for HTTP status preservation, isAuthError duck-typing for auth detection]

key-files:
  created:
    - taskflow/src/lib/api-error.ts
    - taskflow/src/lib/api-error.test.ts
    - taskflow/src/components/ui/empty-state.tsx
    - taskflow/src/components/ui/empty-state.test.tsx
    - taskflow/src/components/ui/error-state.tsx
    - taskflow/src/components/ui/error-state.test.tsx
    - taskflow/src/components/ui/stale-data-banner.tsx
    - taskflow/src/components/ui/stale-data-banner.test.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/gitlab.ts
    - taskflow/src/services/jira.test.ts

key-decisions:
  - "ApiError extends Error with status + source fields for structured HTTP error propagation"
  - "isAuthError uses 3-tier detection: ApiError.status, raw object .status, Error.message heuristic"
  - "fetchAllSearchPages throws ApiError for 401/403 before raw Response throw for other statuses"
  - "Catch handlers in fetchSprintIssues/fetchBacklogIssues passthrough ApiError via instanceof check"
  - "Network errors (Cannot reach) kept as plain Error since they are not auth failures"

patterns-established:
  - "ApiError pattern: throw new ApiError(message, response.status, 'jira'|'gitlab') for 401/403"
  - "Auth detection pattern: isAuthError(error) returns boolean, getErrorSource(error) returns service name"
  - "ErrorState component pattern: auto-detects auth via isAuthError, shows Reconnect to /settings"

requirements-completed: [POLISH-01, POLISH-02, POLISH-03]

# Metrics
duration: 12min
completed: 2026-03-16
---

# Phase 22 Plan 01: Foundation Components Summary

**ApiError class with auth detection helpers, EmptyState/ErrorState/StaleDataBanner shared components, and jira/gitlab service retrofit for 401/403 ApiError throws**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-16T15:16:35Z
- **Completed:** 2026-03-16T15:28:59Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- ApiError class preserves HTTP status and source ('jira'|'gitlab') for downstream auth detection
- EmptyState renders Lucide icon, title, optional subtitle, and optional action ReactNode
- ErrorState auto-detects auth errors (401/403) and shows Reconnect CTA navigating to /settings
- StaleDataBanner renders dismissible warning with Retry button
- Retrofitted 15+ throw sites in jira.ts and 12+ in gitlab.ts to throw ApiError on 401/403
- 31 new tests (21 Task 1 + 10 Task 2), all 439 suite tests passing

## Task Commits

Each task was committed atomically:

1. **Task 1: ApiError class + isAuthError/getErrorSource helpers + EmptyState + StaleDataBanner** - `88bf0aa` (feat)
2. **Task 2: ErrorState component + ApiError retrofit in jira.ts and gitlab.ts** - `078b880` (feat)

_TDD workflow: RED tests written first (fail confirmed), then GREEN implementation._

## Files Created/Modified
- `taskflow/src/lib/api-error.ts` - ApiError class, isAuthError, getErrorSource helpers
- `taskflow/src/lib/api-error.test.ts` - 12 tests for ApiError, isAuthError, getErrorSource
- `taskflow/src/components/ui/empty-state.tsx` - EmptyState shared component
- `taskflow/src/components/ui/empty-state.test.tsx` - 6 tests for EmptyState
- `taskflow/src/components/ui/error-state.tsx` - ErrorState with auth detection and Reconnect CTA
- `taskflow/src/components/ui/error-state.test.tsx` - 10 tests for ErrorState
- `taskflow/src/components/ui/stale-data-banner.tsx` - StaleDataBanner with Retry/Dismiss
- `taskflow/src/components/ui/stale-data-banner.test.tsx` - 3 tests for StaleDataBanner
- `taskflow/src/services/jira.ts` - Added ApiError import, 15+ throw sites retrofitted for 401/403
- `taskflow/src/services/gitlab.ts` - Added ApiError import, 12+ throw sites retrofitted for 401/403
- `taskflow/src/services/jira.test.ts` - Updated fetchProjectStatuses test for new ApiError message format

## Decisions Made
- ApiError extends Error with status + source fields for structured HTTP error propagation
- isAuthError uses 3-tier detection: ApiError.status, raw object .status, Error.message heuristic
- fetchAllSearchPages throws ApiError for 401/403 before raw Response throw for other statuses
- Catch handlers passthrough ApiError via instanceof check to preserve auth error info
- Network errors (Cannot reach) kept as plain Error since they are not auth failures
- fetchFixVersions extracts server errorMessages before 401/403 check to preserve specific error context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated fetchProjectStatuses test expectation**
- **Found during:** Task 2 (service retrofit)
- **Issue:** Test expected "Failed to fetch project statuses: 403" but ApiError message omits ": 403" suffix
- **Fix:** Updated test to match "Failed to fetch project statuses" (status preserved in ApiError.status field)
- **Files modified:** taskflow/src/services/jira.test.ts
- **Verification:** Test passes, ApiError.status still carries 403
- **Committed in:** 078b880 (Task 2 commit)

**2. [Rule 1 - Bug] Preserved fetchFixVersions error message extraction order**
- **Found during:** Task 2 (service retrofit)
- **Issue:** 401/403 check before response.json() would lose server-provided error messages
- **Fix:** Moved JSON extraction before 401/403 check so ApiError carries specific server message
- **Files modified:** taskflow/src/services/jira.ts
- **Verification:** "Permission denied" message preserved in ApiError, test passes
- **Committed in:** 078b880 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for backward compatibility. No scope creep.

## Issues Encountered
None - plan executed as specified with minor test adaptation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 4 shared components ready for consumption by Plans 02 and 03
- Plans 02/03 can import EmptyState, ErrorState, StaleDataBanner from @/components/ui/
- Plans 02/03 can use isAuthError/getErrorSource from @/lib/api-error
- jira.ts and gitlab.ts already throw ApiError on 401/403 for all endpoints

---
*Phase: 22-polish-empty-states-error-recovery*
*Completed: 2026-03-16*
