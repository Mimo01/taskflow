---
phase: 05-api-foundation-quick-wins
plan: "06"
subsystem: auth
tags: [zustand, persist, tauri-store, jira, project-key]

# Dependency graph
requires:
  - phase: 05-api-foundation-quick-wins
    provides: auth store with activeJiraProject persisted to Tauri Store (auth.json)
provides:
  - onRehydrateStorage guard that nullifies stale numeric activeJiraProject values on startup
  - handleProjectChange parameter renamed to projectKey in TokenSection.tsx
affects:
  - releases tab (fetchFixVersions uses activeJiraProject)
  - any future code reading activeJiraProject from the store

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand persist onRehydrateStorage for migrating/sanitizing stale persisted values"

key-files:
  created: []
  modified:
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/routes/settings/TokenSection.tsx

key-decisions:
  - "Use onRehydrateStorage (not a runtime action) so stale numeric IDs are cleared exactly once at app startup before any queries fire"
  - "Regex /^\\d+$/ is the correct guard — Jira project keys always contain at least one letter"

patterns-established:
  - "onRehydrateStorage pattern: use outer function returning inner state callback for Zustand persist middleware cleanup"

requirements-completed: [REL-01]

# Metrics
duration: 3min
completed: 2026-03-12
---

# Phase 5 Plan 06: Releases Wrong Project Fix Summary

**Zustand persist `onRehydrateStorage` guard clears stale numeric `activeJiraProject` from auth.json, fixing Releases tab showing versions from the wrong Jira project**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-12T15:36:17Z
- **Completed:** 2026-03-12T15:39:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Added `onRehydrateStorage` callback to auth store persist config — nullifies `activeJiraProject` when it is a pure numeric string (legacy data from prior app version)
- Renamed `handleProjectChange` parameter from `projectId` to `projectKey` in TokenSection.tsx to prevent future confusion and regression
- Zero new TypeScript errors introduced

## Task Commits

Each task was committed atomically:

1. **Task 1: Clear stale numeric project IDs on store rehydration** - `31d66a5` (fix)
2. **Task 2: Rename handleProjectChange parameter + verify build** - `cee3508` (fix)

**Plan metadata:** _(docs commit to follow)_

## Files Created/Modified

- `taskflow/src/stores/auth.store.ts` — Added `onRehydrateStorage` to persist options; nullifies numeric-only `activeJiraProject` on rehydration
- `taskflow/src/routes/settings/TokenSection.tsx` — Renamed `projectId` parameter to `projectKey` in `handleProjectChange`

## Decisions Made

- Used `onRehydrateStorage` hook rather than a runtime action so the stale value is cleared once at startup before `fetchFixVersions` or any other query fires — no race condition possible
- Regex `/^\d+$/` is the correct discriminator: Jira project keys are always alphanumeric with at least one letter (e.g., `PROJ`, `ABC123`); a pure numeric string can only be a legacy numeric ID

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

The plan's verification step referenced `npm run test`, but the project has no test script configured (scripts are: `dev`, `build`, `preview`, `tauri`). TypeScript compilation confirmed zero errors in the modified files — this is the substantive correctness check available.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UAT Test 3 (Releases tab shows wrong project) is now addressable: users with a stale numeric `activeJiraProject` in `auth.json` will be prompted to re-select their project on next app restart
- No blockers for subsequent plans in Phase 5 or Phase 6

---
*Phase: 05-api-foundation-quick-wins*
*Completed: 2026-03-12*
