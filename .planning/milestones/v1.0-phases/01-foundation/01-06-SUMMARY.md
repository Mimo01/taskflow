---
phase: 01-foundation
plan: 06
subsystem: testing
tags: [vitest, vi.mock, tauri-plugin-http, unit-testing]

# Dependency graph
requires:
  - phase: 01-foundation-05
    provides: jira.ts and gitlab.ts switched to named fetch import from @tauri-apps/plugin-http
provides:
  - Unit tests for jira.ts using vi.mock('@tauri-apps/plugin-http') — all 7 tests pass
  - Unit tests for gitlab.ts using vi.mock('@tauri-apps/plugin-http') — all 6 tests pass
  - Full test suite at 42 tests passing, 0 failing
affects: [future test files that mock @tauri-apps/plugin-http]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - vi.mock module-scope hoisting to intercept named ES module imports (not globalThis patching)
    - vi.mocked(mockFetch).mockReset() in beforeEach for clean mock state per test

key-files:
  created: []
  modified:
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/gitlab.test.ts

key-decisions:
  - "vi.mock('@tauri-apps/plugin-http') at module scope — only way to intercept named import binding used in production services"
  - "vi.mocked(mockFetch).mockReset() replaces vi.restoreAllMocks() — restoreAllMocks only resets spies, not module mocks"

patterns-established:
  - "Module mock pattern: vi.mock at top, import mocked ref, vi.mocked(ref).mockResolvedValue/mockRejectedValue per test"

requirements-completed: [AUTH-01, AUTH-02, AUTH-06]

# Metrics
duration: 1min
completed: 2026-03-11
---

# Phase 1 Plan 06: Fix Plugin-HTTP Mock Pattern in Service Tests Summary

**vi.mock('@tauri-apps/plugin-http') replaces vi.stubGlobal in jira.test.ts and gitlab.test.ts — 9 previously failing tests now pass, full suite at 42/42**

## Performance

- **Duration:** 1 min
- **Started:** 2026-03-11T10:05:25Z
- **Completed:** 2026-03-11T10:06:31Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Fixed 7 failing tests in jira.test.ts (AUTH-01 x5, AUTH-06 x2) by replacing vi.stubGlobal with vi.mock
- Fixed 4 failing tests in gitlab.test.ts (AUTH-02 x4) by replacing vi.stubGlobal with vi.mock
- Preserved 2 passing network-error tests in each file — they continue to pass under the new mock pattern
- Full vitest suite: 42 passed, 0 failed; tsc --noEmit exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix jira.test.ts — replace vi.stubGlobal with vi.mock for plugin-http fetch** - `5d6e691` (fix)
2. **Task 2: Fix gitlab.test.ts — replace vi.stubGlobal with vi.mock for plugin-http fetch** - `def8817` (fix)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `taskflow/src/services/jira.test.ts` — Replaced vi.stubGlobal with vi.mock('@tauri-apps/plugin-http'); all 7 tests pass
- `taskflow/src/services/gitlab.test.ts` — Replaced vi.stubGlobal with vi.mock('@tauri-apps/plugin-http'); all 6 tests pass

## Decisions Made
- Used `vi.mocked(mockFetch).mockReset()` in beforeEach instead of `vi.restoreAllMocks()` — restoreAllMocks only resets spies, not module mocks. mockReset clears call history and return values between tests.
- Added `as any` cast on mockResolvedValue arguments — the Response type from @tauri-apps/plugin-http is more specific than the test stub shapes, and the cast avoids fabricating full Response objects while keeping tests focused.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All 42 tests pass with clean TypeScript compile — Phase 1 foundation is fully verified
- AUTH-01, AUTH-02, and AUTH-06 requirements have complete automated test coverage
- Ready to proceed to Phase 2 (Dashboard)

---
*Phase: 01-foundation*
*Completed: 2026-03-11*
