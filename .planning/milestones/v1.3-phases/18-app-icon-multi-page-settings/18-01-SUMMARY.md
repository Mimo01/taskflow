---
phase: 18-app-icon-multi-page-settings
plan: 01
subsystem: ui
tags: [zustand, settings, density, vitest, react-testing-library, typescript]

# Dependency graph
requires: []
provides:
  - "Density type exported from settings.store.ts"
  - "density, sprintCollapseByDefault, showSubtasksInMyTasks fields in settings store"
  - "Zustand persist version:1 with migrate function for legacy data"
  - "Settings.test.tsx — sidebar nav test scaffold (RED)"
  - "ConnectionsSection.test.tsx — inline test-connection feedback test scaffold (RED)"
  - "ConnectionsSection.tsx — minimal stub for TypeScript resolution"
affects:
  - 18-03
  - 18-04
  - 18-05

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zustand persist migration: version + migrate fields for backward-compatible store evolution"
    - "Wave 0 TDD: write RED test scaffolds before implementing components"

key-files:
  created:
    - taskflow/src/routes/settings/ConnectionsSection.test.tsx
    - taskflow/src/routes/settings/ConnectionsSection.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/routes/settings/Settings.test.tsx

key-decisions:
  - "Used 'as unknown as SettingsState' in migrate return to satisfy TypeScript strict mode — Record<string,unknown> cannot directly cast to interface"
  - "Created minimal ConnectionsSection.tsx stub at Wave 0 so TypeScript resolves the import and test file compiles — stub returns null"
  - "Wrapped Settings.test.tsx renders with QueryClientProvider — Settings component uses TokenSection which calls useQueryClient"

patterns-established:
  - "Persist migration pattern: cast persisted to Record<string,unknown>, guard each new field with undefined check, return as unknown as T"
  - "Test scaffold pattern: mock all store and service dependencies at vi.mock level; use describe+it with @testing-library queries only"

requirements-completed: [SETTINGS-01, SETTINGS-02, SETTINGS-03, SETTINGS-04, SETTINGS-05]

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 18 Plan 01: Settings Store Migration + Test Scaffolds Summary

**Zustand settings store extended with density/sprint pref fields + version:1 migrate; RED test scaffolds written for sidebar nav and inline connection feedback**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T12:22:07Z
- **Completed:** 2026-03-15T12:25:56Z
- **Tasks:** 2
- **Files modified:** 4 (including 2 new files)

## Accomplishments

- Settings store now exports `Density` type and carries `density`, `sprintCollapseByDefault`, `showSubtasksInMyTasks` fields with correct defaults
- Zustand persist config bumped to `version: 1` with `migrate` function that injects defaults when upgrading legacy persisted data
- `Settings.test.tsx` rewritten for 5-section sidebar nav structure (Connections, Appearance, Notifications, Workflow, Role) with `aria-current` and section switching tests
- `ConnectionsSection.test.tsx` created describing inline test-connection feedback (idle, pending, success, error states, and reset on input change)
- Both test files compile cleanly; tests are RED as expected at Wave 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate settings store** - `8c05fa7` (feat)
2. **Task 2: Write test scaffolds** - `36f90bc` (test)

## Files Created/Modified

- `taskflow/src/stores/settings.store.ts` — Added Density type export, density/sprintCollapseByDefault/showSubtasksInMyTasks fields + setters, version:1 persist config with migrate function
- `taskflow/src/routes/settings/Settings.test.tsx` — Rewritten for sidebar nav structure; old flat-scroll tests removed
- `taskflow/src/routes/settings/ConnectionsSection.test.tsx` — New test scaffold for inline connection feedback
- `taskflow/src/routes/settings/ConnectionsSection.tsx` — Minimal stub (returns null) for TypeScript import resolution

## Decisions Made

- Used `as unknown as SettingsState` in the migrate return type — TypeScript strict mode rejects a direct cast from `Record<string, unknown>` to the interface; double-cast is the correct pattern
- Created a minimal `ConnectionsSection.tsx` stub so that the test file compiles (zero TypeScript errors) while the component remains unimplemented — the stub returns null and will be replaced by Plan 18-03
- Wrapped all `Settings.test.tsx` renders with `QueryClientProvider` because the existing `TokenSection` component (rendered by `Settings`) calls `useQueryClient()`, requiring a client in the React tree

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added ConnectionsSection.tsx stub for TypeScript resolution**
- **Found during:** Task 2 (ConnectionsSection.test.tsx creation)
- **Issue:** Plan said "TypeScript errors = 0 on both files" but importing a non-existent module produces TS2307
- **Fix:** Created minimal stub `ConnectionsSection.tsx` returning null — the plan implies Wave 0 ends with zero TS errors on the test files
- **Files modified:** taskflow/src/routes/settings/ConnectionsSection.tsx (created)
- **Verification:** `npx tsc --noEmit` shows 0 errors in settings files
- **Committed in:** 36f90bc (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added QueryClientProvider wrapper in Settings.test.tsx**
- **Found during:** Task 2 (Settings.test.tsx rewrite)
- **Issue:** Settings component renders TokenSection which calls useQueryClient — tests crashed with "No QueryClient set" without the wrapper
- **Fix:** Added `renderWithQuery()` helper wrapping all renders with QueryClientProvider
- **Files modified:** taskflow/src/routes/settings/Settings.test.tsx
- **Verification:** Tests reach the actual assertions (correctly failing on missing sidebar nav) rather than crashing on infrastructure error
- **Committed in:** 36f90bc (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug/missing-file, 1 missing critical infrastructure)
**Impact on plan:** Both auto-fixes essential for plan success criteria (zero TS errors, compilable test files). No scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `SprintBoardTab.test.tsx` (7 errors) and `EpicDetailSheet.test.tsx` (1 error) are unrelated to this plan's changes and logged as out-of-scope

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Settings store ready for Plans 18-03 to 18-05 — density/sprint pref fields available to components
- RED test scaffolds define the contract Plans 18-03/18-04/18-05 must make GREEN
- ConnectionsSection.tsx stub will be replaced by Plan 18-03 implementation
- No blockers for Wave 1 plans

---
*Phase: 18-app-icon-multi-page-settings*
*Completed: 2026-03-15*
