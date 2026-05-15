---
plan: 58-01
phase: 58
status: complete
completed: 2026-05-15
---

# Plan 58-01 Summary — AIO Endpoint Probe

## What Was Done

Developer-driven live probe against `https://jira.orange.sk` using Bearer PAT (`jira-osk-token`). Probed 5 candidate endpoints for cycle `ESHOP-CY-1011` (numeric ID `14041`, project `ESHOP` / numeric `10134`).

## Findings

| ID | Method | URL | Status | Outcome |
|----|--------|-----|--------|---------|
| P1 | GET | `/rest/aio-tcms/1.0/project/10134/testcycle/14041/testrun` | 404 | Does not exist |
| P2 | POST | `/rest/aio-tcms/1.0/.../testrun/paged` | 500 (wraps 405) | Not viable |
| P3 | GET | `/rest/aio-tcms/1.0/.../testrun/summary/paged` | 404 | Does not exist |
| P4 | GET | `/rest/aio-tcms-api/1.0/project/ESHOP/testcycle/ESHOP-CY-1011/detail` | 200 | Top-level `ID: 14041` confirmed |
| P5 | GET | `/rest/aio-tcms-api/1.0/project/ESHOP/testcycle/ESHOP-CY-1011/testrun?startAt=0` | 200 | Existing endpoint confirmed |

## Decisions

```
RUNS_ENDPOINT_DECISION: NONE-RETAIN-EXISTING
RUNS_ENDPOINT_PATH_PARAM: n/a
CYCLE_NUMERIC_ID_DECISION: USE-DETAIL-ID
PROGRESS_BAR_SOURCE: fetchAioCycleSummaries
DEFECT_RESOLUTION_DECISION: COMPONENT-LEVEL-USEQUERY
```

## Impact on Wave 1

- **58-02**: No new fetch function needed in `cycles.ts`. Focus is on removing `fetchJiraIssueByKey` from `fetchAioTestRunsForCycle` — service returns `defects: []` and `jiraDefectIDs: number[]` only. The cycle numeric ID (`ID: 14041`) is already available from `fetchAioCycleDetail`.
- **58-03**: `AioCycleDetailPage` reads `cycle.ID` from the existing detail query; progress bar sources from `fetchAioCycleSummaries`; defect resolution moves to component-level `useQuery` per unique defect ID.

## Artifacts

- `58-PROBE-FINDINGS.md` — committed in `e14c375`
