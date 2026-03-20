---
phase: 29-developer-tools
plan: 01
subsystem: api, stores
tags: [zustand, profiler, instrumentation, dev-tools, settings-migration]

requires:
  - phase: none
    provides: n/a
provides:
  - Granular dev tools settings store (v8) with 6 toggles replacing debugMode
  - Operation profiler store with fetch grouping by label and 2s timeout
  - Extended debug-log store with operation field and configurable retention
  - Instrumented apiFetch with operation parameter and granular toggle gates
affects: [29-02, 29-03, developer-tools-ui]

tech-stack:
  added: []
  patterns: [operation-label grouping with timeout-based finalization, granular toggle gating in fetch wrapper]

key-files:
  created:
    - taskflow/src/stores/operation-profiler.store.ts
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/debug-log.store.ts
    - taskflow/src/lib/apiFetch.ts

key-decisions:
  - "debugMode replaced by 6 granular fields: devToolsEnabled, requestLogging, responseBodyCapture, operationProfiling, performanceWaterfall, retentionLimit"
  - "Migration v7->v8 carries forward debugMode=true into devToolsEnabled, requestLogging, responseBodyCapture"
  - "Operation profiler uses 2s inactivity timeout to finalize grouped fetches into operations"

patterns-established:
  - "Granular toggle gating: apiFetch reads individual boolean toggles, not a single master switch"
  - "Operation label pattern: 4th optional param on apiFetch groups related fetches"

requirements-completed: [DEVT-02, DEVT-03]

duration: 5min
completed: 2026-03-20
---

# Phase 29 Plan 01: Foundation Stores and apiFetch Summary

**Granular dev tools settings (v8) with operation profiler store and instrumented apiFetch accepting operation labels**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T09:27:59Z
- **Completed:** 2026-03-20T09:32:44Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- Migrated settings store from single debugMode boolean to 6 granular dev tools toggles with v7-to-v8 migration
- Created operation profiler store with Map-based activeOps, 2s timeout finalization, and retention limit
- Updated apiFetch to gate response body cloning, debug log appending, and operation profiling behind individual toggles
- Updated all debugMode consumers (Sidebar, DebugLogs, DebugModeSection, main.tsx, test mocks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Migrate settings store and create operation profiler store** - `f13156f` (feat)
2. **Task 2: Update apiFetch to use granular toggles and operation profiler** - `3104f1e` (feat)

## Files Created/Modified
- `taskflow/src/stores/settings.store.ts` - v8 with 6 granular dev tools fields replacing debugMode
- `taskflow/src/stores/debug-log.store.ts` - Added operation? field and configurable retention via settings
- `taskflow/src/stores/operation-profiler.store.ts` - New store for fetch grouping by operation label
- `taskflow/src/lib/apiFetch.ts` - 4th param, granular toggle gates, operation profiler integration
- `taskflow/src/components/app/Sidebar.tsx` - debugMode -> devToolsEnabled
- `taskflow/src/routes/debug-logs/DebugLogs.tsx` - debugMode -> devToolsEnabled
- `taskflow/src/routes/settings/DebugModeSection.tsx` - debugMode/setDebugMode -> devToolsEnabled/setDevToolsEnabled
- `taskflow/src/main.tsx` - debugMode -> devToolsEnabled for native menu toggle
- `taskflow/src/routes/settings/ConnectionsSection.test.tsx` - Mock updated
- `taskflow/src/routes/settings/Settings.test.tsx` - Mock updated

## Decisions Made
- debugMode replaced by 6 granular fields to support independent control of logging, body capture, profiling, and waterfall
- Migration carries forward debugMode=true into devToolsEnabled + requestLogging + responseBodyCapture (preserves existing user behavior)
- Operation profiler uses in-memory Map (no persist) with 2s inactivity timeout for grouping

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated all debugMode consumers across codebase**
- **Found during:** Task 1 (settings store migration)
- **Issue:** Removing debugMode from SettingsState breaks Sidebar, DebugLogs, DebugModeSection, main.tsx, and test mocks
- **Fix:** Updated all references from debugMode/setDebugMode to devToolsEnabled/setDevToolsEnabled
- **Files modified:** Sidebar.tsx, DebugLogs.tsx, DebugModeSection.tsx, main.tsx, ConnectionsSection.test.tsx, Settings.test.tsx
- **Verification:** tsc --noEmit passes, all 615 tests pass
- **Committed in:** f13156f (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary to maintain type safety after debugMode removal. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All stores and apiFetch ready for UI consumption in plans 02 and 03
- Operation labels can be added to call sites via the optional 4th parameter
- No blockers

## Self-Check: PASSED

All 4 key files exist. Both task commits (f13156f, 3104f1e) verified in git log.

---
*Phase: 29-developer-tools*
*Completed: 2026-03-20*
