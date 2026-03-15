---
phase: 13-epic-management
plan: "02"
subsystem: ui
tags: [react, tanstack-query, react-router, vitest, tdd, epics, sidebar]

# Dependency graph
requires:
  - phase: 13-01
    provides: EpicEnriched interface and fetchEpicsWithEnrichment service function
provides:
  - EpicsPage route component at /epics
  - /epics NavLink in Sidebar (shared, all roles)
  - Route registration in main.tsx
  - CreateEpicDialog.tsx stub (full impl in 13-03)
affects:
  - 13-03 (CreateEpicDialog.tsx stub replaced by full implementation)
  - 13-04 (onEpicClick wired via Outlet context)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useAuthStore for jiraBaseUrl/activeJiraProject + useSettingsStore for field keys (consistent with BacklogPage pattern)
    - epicsData !== undefined check for empty state (vs isLoading) — avoids showing empty state when query not yet enabled

key-files:
  created:
    - taskflow/src/routes/dashboard/EpicsPage.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
  modified:
    - taskflow/src/routes/dashboard/EpicsPage.test.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx

key-decisions:
  - "EpicsPage reads jiraBaseUrl/activeJiraProject from useAuthStore (not useSettingsStore) — consistent with BacklogPage pattern; test mock updated accordingly"
  - "Empty state uses epicsData !== undefined check instead of !isLoading — when query disabled (token not yet loaded), epicsData is undefined so empty state correctly does not render"
  - "CreateEpicDialog.tsx stub created alongside EpicsPage to avoid TS2307 import errors; plan 13-03 replaces it with full implementation"
  - "EpicsPage.test.tsx received readSecret mock + auth store mock (Rule 1 auto-fix — Wave 0 stubs were missing mocks needed to turn GREEN)"

patterns-established:
  - "Pattern: TanStack Query v5 empty state check — use data !== undefined instead of !isLoading to distinguish disabled query (undefined) from resolved empty array ([])"

requirements-completed: [EPIC-01]

# Metrics
duration: 11min
completed: 2026-03-14
---

# Phase 13 Plan 02: EpicsPage Route + Sidebar NavLink Summary

**EpicsPage route component rendering epic table with all EPIC-01 fields, /epics NavLink in Sidebar (shared), and route registered in main.tsx**

## Performance

- **Duration:** 11 min
- **Started:** 2026-03-14T21:58:56Z
- **Completed:** 2026-03-14T22:10:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created EpicsPage.tsx as default export with: epic name (clickable button), status badge, story count column, story points column, progress bar (role="progressbar"), assignee initials avatar
- Empty state renders "No epics found for this project." when fetchEpicsWithEnrichment returns []
- CreateEpicDialog local useState controls `+ Create Epic` button; stub dialog created (plan 13-03 will replace)
- onEpicClick from useOutletContext with optional chaining — wired fully in plan 13-04
- Added BookOpen icon and shared /epics NavLink to Sidebar after Create Issue, before role-specific section
- Registered `{ path: '/epics', element: <EpicsPage /> }` in main.tsx alongside /backlog route
- Both EPIC-01 tests GREEN; zero regressions in full suite (pre-existing Wave 0 stubs for 13-03/13-04 remain RED as expected)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create EpicsPage.tsx and CreateEpicDialog stub** - `5270c0d`
2. **Task 2: Add /epics NavLink to Sidebar + register route in main.tsx** - `9789c88`

**Plan metadata:** *(committed after summary)*

## Files Created/Modified

- `taskflow/src/routes/dashboard/EpicsPage.tsx` — New route component (130 lines)
- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` — Stub (3 lines; replaced in 13-03)
- `taskflow/src/routes/dashboard/EpicsPage.test.tsx` — Added missing mocks (readSecret, auth store) for GREEN state
- `taskflow/src/components/app/Sidebar.tsx` — Added BookOpen import + shared /epics NavLink
- `taskflow/src/main.tsx` — Added EpicsPage import + /epics route

## Decisions Made

- **useAuthStore for jiraBaseUrl/activeJiraProject:** Matches BacklogPage pattern (auth data in auth store, field keys in settings store). The Wave 0 test stub had mixed these into useSettingsStore, so the test was updated with a proper auth store mock.
- **epicsData !== undefined for empty state:** TanStack Query v5 sets `isLoading=false` when query is disabled (enabled: false) and data is `undefined`. Using `epicsData !== undefined` correctly distinguishes "query returned empty array" from "query not yet enabled" — avoids false empty state flash before token loads.
- **CreateEpicDialog stub in same plan:** Plan specified creating stub alongside EpicsPage to avoid TS2307 compile errors. Stub is minimal (returns null) and plan 13-03 will replace it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EpicsPage.test.tsx missing readSecret and auth store mocks**
- **Found during:** Task 1 (TDD GREEN phase — tests failed due to disabled query)
- **Issue:** Wave 0 test stub mocked `useSettingsStore` with `jiraBaseUrl`/`activeJiraProject` fields that don't exist in `SettingsState`. The stub also had no readSecret mock, so `token` stayed null and the query was never enabled.
- **Fix:** Added `vi.mock('@/services/stronghold', ...)` + `vi.mock('@/stores/auth.store', ...)` to test; moved `jiraBaseUrl`/`activeJiraProject` to auth store mock; updated component to read those from `useAuthStore`. Also added `beforeEach` readSecret restoration since `vi.clearAllMocks()` cleared the implementation between tests.
- **Files modified:** taskflow/src/routes/dashboard/EpicsPage.test.tsx, taskflow/src/routes/dashboard/EpicsPage.tsx
- **Commit:** 5270c0d

**2. [Rule 1 - Bug] Empty state condition uses epicsData !== undefined instead of !isLoading**
- **Found during:** Task 1 (test 2 failing — empty state not rendering)
- **Issue:** Original condition `epics.length === 0 && !isLoading` is ambiguous in TQ v5: both "query disabled" and "query resolved with []" have `isLoading=false` and `epics=[]`. Need to distinguish using `epicsData !== undefined`.
- **Fix:** Changed to `epicsData !== undefined && epics.length === 0` — only shows empty state when query has actually resolved with empty data.
- **Files modified:** taskflow/src/routes/dashboard/EpicsPage.tsx
- **Commit:** 5270c0d

---

**Total deviations:** 2 auto-fixed (Rule 1 — test mock gaps + TQ v5 loading state behavior)
**Impact on plan:** Both auto-fixes necessary for correct test behavior. No scope creep.

## Issues Encountered

- Wave 0 test stubs for EpicDetailSheet and CreateEpicDialog remain RED (expected — those components don't exist yet, created in 13-03/13-04)
- Pre-existing TypeScript errors in EpicDetailSheet.test.tsx (TS2307, component doesn't exist yet) are expected Wave 0 artifacts

## Next Phase Readiness

- /epics route accessible from Sidebar in all roles
- EpicsPage fetches and renders epic list using fetchEpicsWithEnrichment from 13-01
- CreateEpicDialog stub in place for 13-03 to replace with full implementation
- onEpicClick ready for 13-04 to wire via Outlet context

---
*Phase: 13-epic-management*
*Completed: 2026-03-14*
