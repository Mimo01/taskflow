---
phase: 05-api-foundation-quick-wins
plan: "08"
subsystem: api
tags: [jira, releases, fix-versions, zustand, tauri, tdd]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    provides: fetchFixVersions stub and auth.store.ts foundation
provides:
  - fetchFixVersions calling correct Jira Server endpoint /rest/api/2/project/{projectKey}/versions
  - Bare-array response unwrap in fetchFixVersions (Array.isArray guard)
  - Safe onRehydrateStorage using useAuthStore.setState() instead of direct mutation
affects: [releases-tab, jira-project-selector, auth-store]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Jira Server project versions endpoint returns bare array, not paginated envelope
    - Zustand onRehydrateStorage: use setState() not direct mutation to survive async Tauri hydration

key-files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/stores/auth.store.ts

key-decisions:
  - "REL-01: fetchFixVersions must use /rest/api/2/project/{projectKey}/versions — Jira Server silently ignores ?projectKey= filter on /rest/api/2/version"
  - "REL-01: onRehydrateStorage clears numeric activeJiraProject via useAuthStore.setState() — direct mutation is overwritten by async Tauri storage hydration"

patterns-established:
  - "Jira Server bare array: /rest/api/2/project/{key}/versions returns [] not { values: [] }"
  - "Zustand + Tauri persist: use setState() in onRehydrateStorage callbacks, never direct mutation"

requirements-completed: [REL-01]

# Metrics
duration: 2min
completed: 2026-03-12
---

# Phase 5 Plan 08: fetchFixVersions Correct Endpoint + Auth Store Safe Rehydration Summary

**Fixed Releases tab showing wrong-project versions: corrected Jira Server endpoint from /rest/api/2/version?projectKey= (silently ignored) to /rest/api/2/project/{key}/versions with bare-array unwrap, and replaced direct state mutation in onRehydrateStorage with useAuthStore.setState() to survive Tauri async hydration**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-12T18:22:00Z
- **Completed:** 2026-03-12T17:23:43Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- fetchFixVersions now calls `/rest/api/2/project/${projectKey}/versions` — the correct Jira Server project versions endpoint
- Response unwrap changed from `data.values ?? []` to `Array.isArray(data) ? data : []` — Jira Server returns a bare array not a paginated envelope
- onRehydrateStorage now uses `useAuthStore.setState({ activeJiraProject: null })` — survives async Tauri storage hydration that previously overwrote direct mutation
- 3 REL-01 tests updated/added; full suite (33 tests) passes with no regressions

## Task Commits

Each task was committed atomically:

1. **RED — Add failing REL-01 tests** - `13f25d4` (test)
2. **GREEN — Fix fetchFixVersions endpoint + auth store rehydration** - `a14bf61` (fix)

## Files Created/Modified

- `taskflow/src/services/jira.ts` - Fixed URL and response unwrap in fetchFixVersions
- `taskflow/src/services/jira.test.ts` - Replaced PM-03 envelope tests with REL-01 bare-array and URL tests
- `taskflow/src/stores/auth.store.ts` - onRehydrateStorage uses useAuthStore.setState() not direct mutation

## Decisions Made

- Used `Array.isArray(data) ? data : []` guard — correctly handles both the bare array case and any unexpected envelope shape
- Removed `&maxResults=50` query param — project versions endpoint returns all versions by default; pagination can be added in a future plan if needed

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REL-01 complete: Releases tab will now fetch versions from the correct project
- Auth store rehydration guard is safe against async Tauri storage timing
- REL-02 and REL-03 (version filtering, release detail view) can proceed with correct data foundation

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*
