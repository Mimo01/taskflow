---
phase: 58-redesign-data-fetch-of-aio-cycle-detail-executions-list-and-
plan: 03
subsystem: ui
tags: [aio, tanstack-query, react, cycle-detail, progress-bar, defects]

# Dependency graph
requires:
  - phase: 58-01
    provides: Probe findings — USE-DETAIL-ID, NONE-RETAIN-EXISTING, COMPONENT-LEVEL-USEQUERY decisions
  - phase: 58-02
    provides: issue-runs.ts runs[0].ID canonical runId fix

provides:
  - AioCycleDetailPage with summaryQuery driving progress bar independently of runsQuery
  - jiraProjectIdQuery resolving numeric Jira project ID for AIO paged endpoints
  - cycleNumericId read from cycleQuery.data.ID (no extra round trip)
  - DefectRow consuming jiraDefectIDs.map(String) instead of pre-resolved defects
  - 6 new component tests covering decoupled progress bar, fallback, and tokenLoading gate

affects: [aio-cycle-detail, aio-project-overview, wave2-uat]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "summaryQuery (fast POST) decoupled from runsQuery (slow paginated GET) — progress bar renders in <1s while runs load"
    - "USE-DETAIL-ID: cycleNumericId cast locally from cycleQuery.data as unknown as { ID?: number } — no extra round trip"
    - "credGate/aioGate two-tier gate pattern — mirrors AioProjectOverviewPage lines 277-290"
    - "AIO_STATUS_MAP[Number(idStr)] — Pitfall 5 guard for JSON string keys from testRunDistribution"
    - "DefectRow receives jiraDefectIDs.map(String) — component-level useQuery handles dedup via TanStack cache"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
    - taskflow/src/services/aio/issue-runs.ts
    - taskflow/src/services/aio/issue-runs.test.ts

key-decisions:
  - "CYCLE_NUMERIC_ID_DECISION: USE-DETAIL-ID — read ID directly from existing cycleQuery.data (P4 confirmed top-level ID: number in detail response), no extra paged round trip"
  - "RUNS_ENDPOINT_DECISION: NONE-RETAIN-EXISTING — no aio-tcms/1.0 run endpoint exists on this instance (P1/P2/P3 all 404/405)"
  - "DEFECT_RESOLUTION_DECISION: COMPONENT-LEVEL-USEQUERY — allDefects derived from jiraDefectIDs.map(String), DefectRow useQuery unchanged"
  - "AIO_STATUS_MAP Pitfall 5 guard: Number(idStr) required before lookup since testRunDistribution keys are JSON strings"
  - "summaryQuery enabled includes !tokenLoading as Pitfall 6 guard on top of aioGate"

patterns-established:
  - "Decoupled progress bar: summaryQuery (fast) renders immediately; runsQuery (slow) loads in background with runs-table-skeleton"
  - "Graceful degradation: summaryQuery error falls back to runsCounts so progress bar always renders when runs are available"
  - "readSecret never-resolve mock pattern for testing tokenLoading guard without vi.doMock module cache issues"

requirements-completed: [AIO58-01, AIO58-02, AIO58-04]

# Metrics
duration: 16min
completed: 2026-05-15
---

# Phase 58 Plan 03: AioCycleDetailPage Progress Bar Decoupling Summary

**Progress bar driven by fetchAioCycleSummaries (one POST, <1s) decoupled from runsQuery pagination — cycleNumericId read from existing detail response without extra round trip, defect resolution moved to component-level useQuery via jiraDefectIDs.map(String)**

## Performance

- **Duration:** 16 min
- **Started:** 2026-05-15T16:13:37Z
- **Completed:** 2026-05-15T16:29:39Z
- **Tasks:** 1 (comprehensive)
- **Files modified:** 4

## Accomplishments

- Progress bar now renders from `fetchAioCycleSummaries` (single fast POST) independently of `runsQuery` — for a 261-test cycle, progress info appears in <1s instead of waiting for N+1 sequential HTTP calls
- `cycleNumericId` read directly from `cycleQuery.data.ID` (cast locally) — probe P4 confirmed this field exists on the detail response, eliminating a second round trip
- `allDefects` derivation switched from `r.defects` (service-resolved strings) to `r.jiraDefectIDs.map(String)` — DefectRow's per-key `useQuery` now deduplicates via TanStack cache across identical defect IDs
- Credential gate hardened: `credGate` + `aioGate` two-tier pattern; every `useQuery.enabled` includes `!tokenLoading`
- Full-page skeleton now gates only on `cycleQuery.isLoading`; runs table shows inline skeleton while `runsQuery` loads
- 6 new tests added: decoupled progress bar, summary error fallback, jiraDefectIDs stringification, tokenLoading gate, Pitfall 5 guard

## Task Commits

1. **Task 1: Wire jiraProjectId + cycleNumericId resolution and decouple progress bar** — `1f8acba` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` — Added jiraProjectIdQuery, summaryQuery, summaryCounts computation, AIO_STATUS_MAP[Number()] guard, jiraDefectIDs-based allDefects, decoupled showSkeleton, runs-table-skeleton
- `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` — Updated all existing tests to mock fetchAioCycleSummaries + fetchJiraProjectNumericId; added 6 new test cases
- `taskflow/src/services/aio/issue-runs.ts` — Use runs[0].ID as canonical runId (pre-existing wave work)
- `taskflow/src/services/aio/issue-runs.test.ts` — Two tests verifying execution run ID vs assignment ID (pre-existing wave work)

## Decisions Made

- Used local cast `(cycleQuery.data as unknown as { ID?: number })?.ID ?? null` to avoid modifying `AioCycle` types.ts interface — keeps type file stable and avoids breaking other callers
- `summaryQuery.enabled` set to `aioGate && !!cycleNumericId && !tokenLoading` — the extra `!tokenLoading` is belt-and-suspenders since `aioGate` already gates on `credGate` which includes it, but explicit for clarity
- Progress bar renders as soon as `summaryQuery.data` has `totalTests > 0`; falls back to `runsCounts` (from runs-derived reduction) when summaryQuery errors — both paths tested
- `readSecret` mock pattern for tokenLoading gate test: mock to `new Promise(() => {})` (never resolves) and restore to `mockResolvedValue('fake-token')` within the same test — avoids vi.doMock cache issues

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test mock isolation: vi.doMock approach for useAioCredentials override failed**
- **Found during:** Task 1 (Step 8 — test writing)
- **Issue:** `vi.doMock('@/hooks/useAioCredentials', ...)` after module is already cached does not take effect in the same test file run; the summaryQuery tokenLoading test incorrectly observed calls to fetchAioCycleSummaries
- **Fix:** Switched to mocking `readSecret` (from `@/services/stronghold`) to return `new Promise(() => {})` — keeps `useAioCredentials` in `isLoading: true` state without needing module override. Restores mock at end of test.
- **Files modified:** `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx`
- **Verification:** Test passes and subsequent tests (which rely on readSecret resolving) still pass
- **Committed in:** `1f8acba` (part of task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — test isolation bug)
**Impact on plan:** Fix was necessary for correct test behavior. No scope creep.

## Issues Encountered

None — all plan steps executed as specified. The USE-DETAIL-ID branch was followed (as directed by probe findings). The NONE-RETAIN-EXISTING branch meant no changes to `runsQuery` data source.

## Known Stubs

None — all data paths are wired. Progress bar renders from real `summaryQuery` data (or graceful fallback). DefectRow receives real `jiraDefectIDs` from runs.

## Threat Flags

No new threat surface introduced. All mitigations in the plan's threat register were applied:
- T-58-03-01: `encodeURIComponent` in service functions — unchanged, not bypassed
- T-58-03-05: Every `useQuery.enabled` includes `!tokenLoading` — verified by grep gate (count: 4)

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `AioCycleDetailPage` refactor complete. Progress bar renders from summary endpoint independently.
- Ready for Wave 2 UAT: open a known cycle (ESHOP-CY-1011), observe progress bar appearing before run table populates.
- `fetchAioTestRunsForCycle` still calls `resolveDefectsForRuns` service-side — this is intentional (NONE-RETAIN-EXISTING probe decision). The component now sources defect keys from `jiraDefectIDs` instead, so `r.defects` is not used in the UI path. Service-level resolution can be removed in a future cleanup plan.

## Self-Check

- [x] `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` exists on disk
- [x] `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx` exists on disk
- [x] Commit `1f8acba` exists in git log
- [x] `npm test -- AioCycleDetailPage` exits 0 (25/25 tests)
- [x] `npm test` exits 0 (1135/1135 tests)
- [x] `tsc --noEmit` exits 0

## Self-Check: PASSED

---
*Phase: 58-redesign-data-fetch-of-aio-cycle-detail-executions-list-and-*
*Completed: 2026-05-15*
