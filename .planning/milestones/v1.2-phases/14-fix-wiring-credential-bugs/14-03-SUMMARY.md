---
phase: 14-fix-wiring-credential-bugs
plan: 03
subsystem: ui
tags: [react, zustand, jira, tauri, stronghold, vitest]

# Dependency graph
requires:
  - phase: 13-epic-management
    provides: CreateEpicDialog component with buggy useSettingsStore type-cast pattern
  - phase: 14-fix-wiring-credential-bugs
    provides: auth.store.ts with jiraBaseUrl/activeJiraProject fields; stronghold.ts readSecret pattern
provides:
  - CreateEpicDialog reads jiraBaseUrl/activeJiraProject from useAuthStore (correct source)
  - CreateEpicDialog fetches jiraToken via readSecret('jira-pat') inside mutationFn at call time
  - No type-cast on useSettingsStore remains in CreateEpicDialog
  - EPIC-04 test contract updated to match corrected production code
affects: [epic-management, credentials-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Credential sourcing: useAuthStore for connection config (baseUrl, projectKey); readSecret inside mutationFn for PAT — established by SprintBoardTab, now applied to CreateEpicDialog"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/CreateEpicDialog.tsx
    - taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx

key-decisions:
  - "14-03: CreateEpicDialog jiraToken fetched via readSecret('jira-pat') inside mutationFn — not held in component state or useEffect; consistent with SprintBoardTab pattern"
  - "14-03: useSettingsStore type-cast removed entirely; settings store now used only for epicNameFieldKey as intended"

patterns-established:
  - "Credential anti-pattern to avoid: never type-cast useSettingsStore to include auth fields (jiraBaseUrl, activeJiraProject, jiraToken) — those fields do not exist in SettingsState"

requirements-completed:
  - EPIC-04

# Metrics
duration: 5min
completed: 2026-03-15
---

# Phase 14 Plan 03: CreateEpicDialog Credential Sources Fix Summary

**Removed useSettingsStore type-cast anti-pattern from CreateEpicDialog; wired jiraBaseUrl/activeJiraProject to useAuthStore and jiraToken to readSecret('jira-pat') inside mutationFn — EPIC-04 GREEN**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-14T23:41:26Z
- **Completed:** 2026-03-14T23:46:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced type-cast `useSettingsStore() as { jiraBaseUrl?: string; ... }` with proper `useAuthStore()` destructure for connection config fields
- Added `readSecret('jira-pat')` call inside `mutationFn` (token fetched at mutation call time, not render time) — consistent with SprintBoardTab established pattern
- Updated CreateEpicDialog.test.tsx mocks: split settings mock to epicNameFieldKey only, added useAuthStore mock, added stronghold readSecret mock
- Full test suite remains at 365 passing; EPIC-04 tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1 + 2: Fix CreateEpicDialog.tsx credential sources + update test mocks** - `e841120` (fix)

## Files Created/Modified

- `taskflow/src/routes/dashboard/CreateEpicDialog.tsx` - Removed type-cast; imports useAuthStore + readSecret; reads credentials from correct sources
- `taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx` - Updated vi.mock blocks: settings store provides only epicNameFieldKey; added auth.store and stronghold mocks

## Decisions Made

- Tasks 1 and 2 committed together as a single atomic fix — production code change and test mock update are tightly coupled and meaningless in isolation; combined commit avoids a transient RED state in git history

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Pre-existing failure in `notifications.test.ts` (18 errors) is unrelated to this plan and was present before execution. Full suite at 365 passing meets the >=365 plan threshold.

## Next Phase Readiness

- EPIC-04 credential sourcing is now correct; CreateEpicDialog will work at runtime with real Jira credentials
- Phase 14 fix-wiring-credential-bugs plans can proceed; this plan satisfies EPIC-04 requirement

---
*Phase: 14-fix-wiring-credential-bugs*
*Completed: 2026-03-15*

## Self-Check: PASSED

- FOUND: taskflow/src/routes/dashboard/CreateEpicDialog.tsx
- FOUND: taskflow/src/routes/dashboard/CreateEpicDialog.test.tsx
- FOUND: .planning/phases/14-fix-wiring-credential-bugs/14-03-SUMMARY.md
- FOUND: commit e841120 (fix(14-03): correct CreateEpicDialog credential sources)
