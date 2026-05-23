---
phase: 65-tech-debt-cleanup
plan: 02
subsystem: aio-status
tags: [clean, aio, runtime-map, tdd, CLEAN-06, CLEAN-07]

requires: []
provides:
  - TESTCASE_STATUS_MAP with explicit 51/52 entries (IN_PROGRESS renders correctly)
  - Runtime AIO status map built from live /config endpoint via initializeAioStatusMap
  - normalizeStatusById reads runtime cache (no static AIO_STATUS_MAP)
  - AioCycleDetailPage migrated to normalizeStatusById
  - AioProjectOverviewPage activation call site for initializeAioStatusMap
affects: [AioCycleDetailPage, AioProjectOverviewPage, aioUtils, cycles]

tech-stack:
  added: []
  patterns:
    - "Module-level runtime cache + STATUS_TYPE_MAP whitelist + async init: version-independent AIO status resolution"

key-files:
  created: []
  modified:
    - taskflow/src/services/aio/cycles.ts
    - taskflow/src/lib/aioUtils.ts
    - taskflow/src/lib/aioUtils.test.ts
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/services/aio/types.ts

key-decisions:
  - "Reuse existing fetchAioProjectConfig (not duplicated) — D-06 compliant"
  - "On /config failure: silently set runtimeAioStatusMap to {} and do not rethrow — degrades to all-notRun, no crash"
  - "Activation in AioProjectOverviewPage useEffect on configQuery.data — React Query dedupes /config so no extra HTTP call"

patterns-established:
  - "STATUS_TYPE_MAP + module-level cache + async init: analog to AioProjectOverviewPage buildStatusMap pattern"

requirements-completed: [CLEAN-06, CLEAN-07]

duration: 9min
completed: 2026-05-23
---

# Phase 65 Plan 02: AIO Status Map Summary

**Runtime AIO status map from live `/config` endpoint replaces hardcoded `AIO_STATUS_MAP`; TESTCASE_STATUS_MAP gains explicit 51/52 entries so in-progress runs render correctly**

## Performance

- **Duration:** ~9 min
- **Tasks:** 3 (4 commits including TDD RED)
- **Files modified:** 7

## Accomplishments
- CLEAN-06: `TESTCASE_STATUS_MAP` in `cycles.ts` gains `51: 'NOT_EXECUTED'` and `52: 'IN_PROGRESS'` — ID 52 no longer falls through the `?? 'NOT_EXECUTED'` default, in-progress runs render as IN_PROGRESS in the Executions tab
- CLEAN-07: Removed exported `AIO_STATUS_MAP` constant entirely; replaced with module-level `runtimeAioStatusMap` cache populated by `export async function initializeAioStatusMap(baseUrl, token, jiraProjectId)` — status resolution is now version-independent
- CLEAN-07: `AioCycleDetailPage` migrated from `AIO_STATUS_MAP[Number(idStr)]` to `normalizeStatusById(Number(idStr))`; `AioProjectOverviewPage` wired with activation `useEffect` on `configQuery.data`

## Task Commits

1. **Task 1: Add 51/52 to TESTCASE_STATUS_MAP (CLEAN-06)** — `fd052513` (fix)
2. **Task 2 RED: Failing tests for initializeAioStatusMap (CLEAN-07)** — `6cbf3f98` (test)
3. **Task 2 GREEN: Replace AIO_STATUS_MAP with runtime cache (CLEAN-07)** — `1cf34652` (feat)
4. **Task 3: Migrate consumer + wire activation call site (CLEAN-07)** — `3cb7c2ef` (feat)

## Files Created/Modified
- `taskflow/src/services/aio/cycles.ts` — Added 51/52 to TESTCASE_STATUS_MAP
- `taskflow/src/lib/aioUtils.ts` — Removed AIO_STATUS_MAP; added runtimeAioStatusMap, STATUS_TYPE_MAP, initializeAioStatusMap; normalizeStatusById reads cache
- `taskflow/src/lib/aioUtils.test.ts` — Rewrote AIO_STATUS_MAP tests → initializeAioStatusMap tests (success, unknown-ID, fetch-failure)
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — Drop AIO_STATUS_MAP import; use normalizeStatusById
- `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` — Mock cycles; init runtime map in beforeEach
- `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` — Import + call initializeAioStatusMap on configQuery.data
- `taskflow/src/services/aio/types.ts` — Updated stale JSDoc comment

## Decisions Made
- Reused `fetchAioProjectConfig` from cycles.ts rather than duplicating the HTTP call (D-06)
- `initializeAioStatusMap` silently swallows `/config` failures (sets map to `{}`, no rethrow) — degrades to all-`notRun` rendering
- Activation in `AioProjectOverviewPage` useEffect — React Query caches `/config` at same query key, so no duplicate HTTP round trip

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] AioTestRunStatusConfig missing `color` field in test mocks**
- **Found during:** Task 3 (TypeScript build check)
- **Issue:** Interface requires `color: string`; plan-provided mock shapes omitted it
- **Fix:** Added `color` field to all `AioTestRunStatusConfig` mocks in `aioUtils.test.ts` and `AioCycleDetailPage.test.tsx`
- **Commit:** 3cb7c2ef

**2. [Rule 1 - Bug] AioCycleDetailPage tests failed after CLEAN-07 — runtime map empty in test context**
- **Found during:** Task 3 (full test suite run)
- **Issue:** `normalizeStatusById` now reads `runtimeAioStatusMap` which is empty until `initializeAioStatusMap` runs; tests using numeric IDs broke
- **Fix:** Added `vi.mock('@/services/aio/cycles')` and `beforeEach` call to `initializeAioStatusMap` in `AioCycleDetailPage.test.tsx`
- **Commit:** 3cb7c2ef

**3. [Rule 1 - Bug] Stale JSDoc in types.ts referenced removed AIO_STATUS_MAP**
- **Found during:** Task 3 (grep scan for AIO_STATUS_MAP references)
- **Fix:** Updated to reference `normalizeStatusById`
- **Commit:** 3cb7c2ef

---
**Total deviations:** 3 auto-fixed
**Impact on plan:** All essential for correctness/TypeScript compliance. No scope creep.

## Issues Encountered
The executor committed code changes directly to main's working tree rather than its isolated worktree branch — code is correct and verified. SUMMARY.md written by orchestrator.

## Self-Check: PASSED

- `grep -c "52: 'IN_PROGRESS'" taskflow/src/services/aio/cycles.ts` → 1 ✓
- `grep -c "export const AIO_STATUS_MAP" taskflow/src/lib/aioUtils.ts` → 0 ✓
- `grep -c "export async function initializeAioStatusMap" taskflow/src/lib/aioUtils.ts` → 1 ✓
- `grep -rn "AIO_STATUS_MAP" taskflow/src/` → no results ✓
- aioUtils tests: 15/15 green ✓
- Full suite: 1356/1356 passing ✓
- Build: clean ✓

## Next Phase Readiness
- AIO status rendering is version-independent; instances with non-standard IDs degrade gracefully to `notRun`
- Phase 65-01 (WorklogsPage + DatePreset + Sidebar) ran in parallel and is complete

---
*Phase: 65-tech-debt-cleanup*
*Completed: 2026-05-23*
