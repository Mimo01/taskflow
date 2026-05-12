---
plan: 51-01
phase: 51-aio-service-layer
status: complete
date: 2026-05-12
key-files:
  created: []
  modified:
    - .planning/phases/51-aio-service-layer/51-CONTEXT.md
---

# Plan 51-01: AIO Instance Probe — Summary

## What Was Built

Ran the live AIO instance curl probe and recorded all findings as Key Decisions D-13–D-17 in CONTEXT.md.

## Key Findings

**Two base paths confirmed (not one):**
- `/rest/aio-tcms/1.0` — project listing only (`GET /project`, `GET /project/{id}`)
- `/rest/aio-tcms-api/1.0` — everything else (cycles, test runs, test cases)

**Auth confirmed:** `Authorization: Bearer <jiraPat>` works on all endpoints. Same Stronghold key `'jira-pat'`.

**No `?issueKey=` test run endpoint:** D-11's assumption was wrong. Test runs are accessed via cycle key:
`GET /rest/aio-tcms-api/1.0/project/{projectKey}/testcycle/{cycleKey}/testrun`

**Pagination:** All list endpoints under `aio-tcms-api/1.0` use `{ items, startAt, maxResults, isLast }` wrapper.

**Key formats:** Cycle = `{PROJ}-CY-N`, Test case = `{PROJ}-TC-N`.

## Deviations from Plan

- D-13 expected one winning base path; probe found two purpose-split paths. Both are needed — exported as separate constants (`AIO_PROJECTS_API_PATH`, `AIO_API_PATH`) in `aio/client.ts`.
- D-15: `GET /testrun?issueKey=` does not exist. `issue-runs.ts` scope in Plan 03 narrowed to cycle-scoped run listing; issue-level filtering deferred to Phase 54.

## Self-Check: PASSED

- [x] D-13 through D-17 present in CONTEXT.md with non-placeholder values
- [x] grep confirms 6 matches for D-13/D-17 and 4 for KEY DECISION/Probe run
- [x] Working base paths, auth scheme, endpoint structure, pagination wrapper, key formats all documented
- [x] Architectural implication of missing `?issueKey=` endpoint recorded with fallback path for Phase 54
