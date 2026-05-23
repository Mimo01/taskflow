# Phase 58 — Probe Findings

Executed against `https://jira.orange.sk` with a Bearer PAT (`jira-osk-token`) on 2026-05-15.
Probe target: cycle `ESHOP-CY-1011` (numeric ID `14041`) in project `ESHOP` (numeric ID `10134`).

## Probe Results

| ID | Method | URL | HTTP | Outcome |
|----|--------|-----|------|---------|
| P1 | GET    | `/rest/aio-tcms/1.0/project/10134/testcycle/14041/testrun` | **404** | `HTTP 404 Not Found` — endpoint does not exist on this AIO build (also confirmed with string keys `ESHOP/ESHOP-CY-1011`: 404). |
| P2 | POST   | `/rest/aio-tcms/1.0/project/10134/testcycle/14041/testrun/paged?c_pId=10134&t={ts}` | **500** (wraps **405**) | Server returned `javax.ws.rs.NotAllowedException: HTTP 405 Method Not Allowed`. GET fallback returned 500 wrapping a `PathParamException`. Endpoint not viable. |
| P3 | GET    | `/rest/aio-tcms/1.0/project/10134/testcycle/14041/testrun/summary/paged` | **404** | `HTTP 404 Not Found` — endpoint does not exist. |
| P4 | GET    | `/rest/aio-tcms-api/1.0/project/ESHOP/testcycle/ESHOP-CY-1011/detail` | **200** | Returns full cycle detail. Top-level `ID: 14041` (numeric) confirmed alongside `jiraProjectID: 10134`, `key: "ESHOP-CY-1011"`, `folder { ID, name, parentID }`, `jiraReleaseID`, dates, custom fields. |
| P5 | GET    | `/rest/aio-tcms-api/1.0/project/ESHOP/testcycle/ESHOP-CY-1011/testrun?startAt=0` | **200** | Existing endpoint works as expected. |

## P4 — Cycle Detail Field Highlights

The detail endpoint accepts **string keys** (`projectKey`/`cycleKey`) and returns the cycle's numeric ID at the top level:

```jsonc
{
  "ID": 14041,
  "jiraProjectID": 10134,
  "key": "ESHOP-CY-1011",
  "title": "Thanos B2B Voice Revamp 2026",
  "folder": { "ID": 10763, "name": "Thanos Revamp 2026", "parentID": 10762 },
  "jiraReleaseID": 17901,
  "jiraReleaseIDs": [17901],
  "jiraTaskIDs": ["347236", "360523"],
  "startDate": 1777759200000,
  "endDate": 1779141600000,
  "createdDate": 1777475614939,
  "updatedDate": 1778836593687,
  "closedDate": 1778836593663,
  "isClosed": true,
  "isArchived": false,
  "isSystemDefined": false,
  "isLockedForEdit": false,
  "tags": [],
  "jiraComponentIDs": [],
  "customFields": [
    { "ID": 323, "name": "Cycle-Environment", "value": [] },
    { "ID": 325, "name": "Cycle-Device_Type", "value": { "ID": 411, "value": "Web" } },
    { "ID": 201, "name": "Cycle-Browser", "value": [{ "ID": 341, "value": "Chrome" }] }
  ]
}
```

Top-level `ID: number` is present and stable — no need to resolve the numeric ID via a separate paged endpoint.

## P5 — Existing Runs Endpoint Shape (confirmation)

- **Pagination wrapper:** `{ items, startAt, maxResults, isLast }` (standard AIO shape).
- **Top-level run entry fields:** `ID`, `testCase { ID, key, title, … }`, `assignedToID`, `assignedByID`, `assignmentDate`, `assignSteps`, `runs[]`.
- **Nested `runs[N]` fields:** `ID`, `permission`, `testRunStatus { ID, name, description }`, `isAutomated`, `executedByID`, `createdDate`, `updatedDate`, `jiraDefectIDs: number[]`, `dataSetExecutionsCount`.
- Path param is the **string `cycleKey`** (e.g. `ESHOP-CY-1011`).

## Implications for Phase 58

- The `aio-tcms` (non-`-api`) namespace is not exposed on this instance — none of P1/P2/P3 are usable. The existing `aio-tcms-api` runs endpoint (P5) remains the only viable source for execution data.
- The `detail` endpoint (P4) already gives us the cycle's numeric `ID` directly, so any feature that needs the numeric cycle ID can read it from the existing detail fetch without a second round trip.
- Progress bar work continues to source from `fetchAioCycleSummaries` (the summaries endpoint that already powers the cycle list progress bars).
- Defect ID → Jira issue resolution stays at the row/component level via `useQuery`, since the runs endpoint returns only `jiraDefectIDs: number[]`.

---

Decision Summary

RUNS_ENDPOINT_DECISION: NONE-RETAIN-EXISTING
RUNS_ENDPOINT_PATH_PARAM: n/a
CYCLE_NUMERIC_ID_DECISION: USE-DETAIL-ID
PROGRESS_BAR_SOURCE: fetchAioCycleSummaries
DEFECT_RESOLUTION_DECISION: COMPONENT-LEVEL-USEQUERY
