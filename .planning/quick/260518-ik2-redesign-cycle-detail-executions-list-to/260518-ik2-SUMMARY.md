---
quick_id: 260518-ik2
slug: redesign-cycle-detail-executions-list-to
description: Redesign cycle detail executions list to use fast paged endpoint
date: 2026-05-18
commit: 060cbe0
status: complete
---

# Summary: 260518-ik2 — Redesign cycle detail executions list to use fast paged endpoint

## What changed

**`taskflow/src/services/aio/cycles.ts`** — Added `fetchAioCycleTestCasesWithRuns`:
- POSTs to `/rest/aio-tcms/1.0/project/{jiraProjectId}/testcycle/{cycleNumericId}/testcasewithrun/paged`
- Single-shot fetch (`maxResults: 500`) — no pagination loop
- Inline `TESTCASE_STATUS_MAP` maps numeric `testRunStatusID` (51-55, 901) to chip status strings
- Maps response items to `AioTestRun[]` (same shape as before — no consumer changes beyond the call site)

**`taskflow/src/routes/dashboard/AioCycleDetailPage.tsx`** — Updated `runsQuery`:
- Now calls `fetchAioCycleTestCasesWithRuns` instead of `fetchAioTestRunsForCycle`
- `enabled` changed from `credGate` to `aioGate && !!cycleNumericId` — both the numeric project ID and numeric cycle ID must be resolved first (both are fast and fire concurrently)

**`taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx`** — Updated mocks:
- `fetchAioTestRunsForCycle` replaced with `fetchAioCycleTestCasesWithRuns` throughout
- One `waitFor` assertion extended to include run data (necessary because runs now have an extra async dependency)

## Tests

25/25 pass. TypeScript: no errors.

## Notes

`fetchAioTestRunsForCycle` is retained in `issue-runs.ts` — still used by `AioTestRunsSection.tsx` for the issue-detail traceability path.
