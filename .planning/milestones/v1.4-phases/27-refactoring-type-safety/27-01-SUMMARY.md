---
phase: 27-refactoring-type-safety
plan: 01
subsystem: stores, routing, ui
tags: [zustand, tauri-store, react-router, tailwind]

# Dependency graph
requires:
  - phase: 25-tooling-dependencies
    provides: Biome config, Tailwind v4 setup
  - phase: 26-test-regression-fixes
    provides: LazyStore mock pattern, passing test suite
provides:
  - createTauriStorage shared factory for Zustand persist middleware
  - Extracted route configuration file (routes.tsx)
  - CSS utility class bg-disabled-stripe
affects: [27-02, 27-03, 27-04, 27-05]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared storage factory, centralized route config, CSS utility over inline styles]

key-files:
  created:
    - taskflow/src/lib/tauri-storage.ts
    - taskflow/src/routes/routes.tsx
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/stores/pinned-tabs.store.ts
    - taskflow/src/stores/recent-items.store.ts
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/index.css

key-decisions:
  - "REFAC-06 satisfied by existing partialize() pattern — no store split needed"
  - "Used CSS utility class (.bg-disabled-stripe) instead of Tailwind arbitrary value for gradient"
  - "Route imports use relative paths from routes/ directory"

patterns-established:
  - "createTauriStorage(filename): shared factory for all Zustand stores needing Tauri persistence"
  - "routes.tsx: centralized route config imported by main.tsx"
  - "CSS utility classes preferred over inline style= attributes"

requirements-completed: [REFAC-04, REFAC-06, REFAC-07, REFAC-08]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 27 Plan 01: Shared Utilities & Small Refactors Summary

**createTauriStorage factory deduplicating 5 stores, route extraction to routes.tsx, inline style replaced with CSS class**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-19T22:57:42Z
- **Completed:** 2026-03-20T00:02:37Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Extracted shared createTauriStorage() factory to lib/tauri-storage.ts, removing ~70 lines of duplicated adapter code across 5 stores
- Extracted 15 route definitions from main.tsx to routes/routes.tsx, reducing main.tsx coupling
- Replaced SprintBoardTab inline style with .bg-disabled-stripe CSS utility class
- Assessed REFAC-06: notifications store already uses partialize() and merge() for clean state separation -- no split needed

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract createTauriStorage factory and apply to all 5 stores** - `bd441f8` (refactor)
2. **Task 2: Extract route config from main.tsx + replace SprintBoardTab inline style** - `e575881` (refactor)

## Files Created/Modified
- `taskflow/src/lib/tauri-storage.ts` - Shared createTauriStorage(filename) factory wrapping LazyStore + createJSONStorage
- `taskflow/src/routes/routes.tsx` - Centralized RouteObject[] array with all 15 app routes
- `taskflow/src/stores/settings.store.ts` - Uses createTauriStorage('settings.json')
- `taskflow/src/stores/auth.store.ts` - Uses createTauriStorage('auth.json')
- `taskflow/src/stores/notifications.store.ts` - Uses createTauriStorage('notifications.json')
- `taskflow/src/stores/pinned-tabs.store.ts` - Uses createTauriStorage('pinned-tabs.json')
- `taskflow/src/stores/recent-items.store.ts` - Uses createTauriStorage('recent-items.json')
- `taskflow/src/main.tsx` - Imports routes from routes.tsx, uses children: routes
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Removed inline style, uses bg-disabled-stripe class
- `taskflow/src/index.css` - Added .bg-disabled-stripe utility class

## Decisions Made
- REFAC-06 (notifications store split) assessed as already satisfied by existing partialize() and merge() patterns -- store cleanly separates persisted from transient state
- Used a CSS utility class (.bg-disabled-stripe) in index.css rather than Tailwind arbitrary value syntax for the repeating gradient, as the complex gradient syntax with nested parentheses is more maintainable as a named class
- Route imports in routes.tsx use relative paths from the routes/ directory (e.g., './dashboard/Dashboard')

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 stores now use shared createTauriStorage factory -- ready for Plan 02-05
- Route config is centralized for any future route additions
- All 489 tests pass, no regressions

---
*Phase: 27-refactoring-type-safety*
*Completed: 2026-03-20*
