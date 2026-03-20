---
phase: 27-refactoring-type-safety
plan: 05
subsystem: type-safety
tags: [typescript, biome, type-guards, double-casts, noExplicitAny]

# Dependency graph
requires:
  - phase: 27-refactoring-type-safety (plans 01-04)
    provides: Refactored modules with reduced type debt
provides:
  - Zero double-casts in production code (TYPE-01)
  - Zero any types in production code (TYPE-02)
  - Biome noExplicitAny enforcement as error
  - REFAC-06 documented as satisfied
affects: [future-phases]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-cast-from-unknown, union-event-types]

key-files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/recent-items.store.ts
    - taskflow/src/stores/pinned-tabs.store.ts
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/services/gitlab.ts
    - taskflow/src/routes/settings/ConnectionsSection.tsx
    - taskflow/biome.json

key-decisions:
  - "Single cast from unknown is safe for Zustand migrate (param typed as unknown by framework)"
  - "Widen ActionIcon onClick to MouseEvent | KeyboardEvent (callers ignore event param)"
  - "Replace Promise<any> with Promise<unknown> in ConnectionsSection (return value discarded)"

patterns-established:
  - "Zustand migrate: keep param as unknown, single cast to state type at return"
  - "Event handler unions: prefer widening prop types over double-casting events"

requirements-completed: [TYPE-01, TYPE-02, REFAC-06]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 27 Plan 05: Type Safety Cleanup Summary

**Zero double-casts, zero any types, Biome noExplicitAny enabled as error with test override**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-19T23:07:58Z
- **Completed:** 2026-03-19T23:12:53Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Eliminated all 6 remaining `as unknown as` double-casts across 5 production files
- Enabled Biome `noExplicitAny` rule as "error" for production code (test override remains "off")
- Verified TYPE-01 (zero double-casts) and TYPE-02 (zero any types) requirements complete
- REFAC-06 documented as satisfied by existing `partialize()` pattern (assessed in Plan 01)
- All 489 tests pass, tsc clean, Biome lint clean (0 errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix all remaining double-casts across 5 files** - `add6224` (fix)
2. **Task 2: Verify TYPE-02, enable Biome noExplicitAny, run final checks** - `d72154b` (feat)

## Files Created/Modified
- `taskflow/src/stores/settings.store.ts` - Replaced double-cast with single cast from unknown
- `taskflow/src/stores/recent-items.store.ts` - Replaced double-cast with single cast from unknown
- `taskflow/src/stores/pinned-tabs.store.ts` - Replaced double-cast with single cast from unknown
- `taskflow/src/routes/notifications/NotificationRow.tsx` - Widened onClick to MouseEvent | KeyboardEvent
- `taskflow/src/services/gitlab.ts` - Typed response.json() directly as GitLabMR[]
- `taskflow/src/routes/settings/ConnectionsSection.tsx` - Replaced Promise<any> with Promise<unknown>
- `taskflow/biome.json` - Enabled noExplicitAny as "error"

## Decisions Made
- Single cast from `unknown` is safe for Zustand migrate functions (framework types the param as `unknown`, so `persisted as StateType` is a single valid assertion)
- Widened ActionIcon `onClick` to `React.MouseEvent | React.KeyboardEvent` since all callers use arrow wrappers that ignore the event param
- Replaced `Promise<any>` with `Promise<unknown>` in ConnectionsSection since the return value is never used

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed noExplicitAny violation in ConnectionsSection.tsx**
- **Found during:** Task 2 (Biome noExplicitAny verification)
- **Issue:** `Promise<any>` in ConnectionCard props interface violated newly enabled rule
- **Fix:** Changed to `Promise<unknown>` (return value is discarded by caller)
- **Files modified:** `taskflow/src/routes/settings/ConnectionsSection.tsx`
- **Verification:** `npx biome lint src/` exits with 0 errors
- **Committed in:** d72154b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to satisfy the noExplicitAny rule enablement. No scope creep.

## Issues Encountered
- Initial plan suggested typing Zustand migrate `persisted` parameter as `Record<string, unknown>`, but this conflicts with Zustand's `unknown` param type. Fixed by keeping default parameter type and using single cast at return.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 27 type safety requirements complete (TYPE-01, TYPE-02, REFAC-06)
- Biome enforces no-any going forward, preventing regression
- Phase 27 fully complete (5/5 plans done)

---
*Phase: 27-refactoring-type-safety*
*Completed: 2026-03-20*
