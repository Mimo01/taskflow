---
plan: 57-01
phase: 57
status: complete
wave: 0
completed: 2026-05-14
---

# Plan 57-01 Summary — Probe Findings + RED Test Stubs

## What Was Built

Wave 0 produced two deliverables:
1. `57-PROBE-FINDINGS.md` — six confirmed endpoint findings (A1–A6) from live DevTools capture
2. RED test stubs across three test files covering seven missing exports (32 new failing assertions)

## Confirmed URLs from 57-PROBE-FINDINGS.md

### A1 — Folder tree (CONFIRMED)
`GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/folder`

### A2 — Folder cycle count (CONFIRMED)
`GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/folder/count?archive=false`
Deviation: endpoint is `/testcycle/folder/count`, not `/testcycle/count` as initially assumed.

### A3 — Cycle summaries (CONFIRMED)
`GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/summary/paged`
Deviation: no `ids` param — fetches all summaries for the project in one GET (not batch by IDs).

### A4 — Cycle list with detail (CONFIRMED)
`GET /rest/aio-tcms/1.0/project/{jiraProjectID}/testcycle/paged[?folderID={fid}]`

### A5 — Folder filter convention (CONFIRMED)
**Server-side filter via `?folderID={id}` param.** Evidence: response for folder 10763 returned exactly 7 cycles matching `count[10763] = 7`. `detail.folder` is always `null` on item records, making client-side filtering impossible.

### A6 — Jira user lookup (INFERRED)
`GET /rest/api/2/user?username={ownedByID}` — inferred from existing `fetchAssignableUsers` pattern on the same DC instance. Risk: some DC versions use `?name=` instead; D-08 null fallback covers the error path.

## Critical Cross-Cutting Finding

All four new AIO endpoints use:
- `AIO_PROJECTS_API_PATH` (`/rest/aio-tcms/1.0`) — NOT `AIO_API_PATH` (`/rest/aio-tcms-api/1.0`)
- Numeric **jiraProjectID** in the path — NOT the string project key

`AIO_PROJECTS_API_PATH` is already exported from `client.ts`. Plan 02 must use this constant and accept `jiraProjectID: number` (not `projectKey: string`) as the project identifier.

## Closed Assumptions

| ID | Status | Note |
|----|--------|------|
| A1 | CLOSED | Confirmed URL, uses AIO_PROJECTS_API_PATH |
| A2 | CLOSED | Confirmed — `/folder/count`, not `/count` |
| A3 | CLOSED | Confirmed — single GET, no ids param |
| A4 | CLOSED | Confirmed — `/testcycle/paged` |
| A5 | CLOSED | Server-side via `?folderID=` |
| A6 | CLOSED (inferred) | `?username=` — same as existing fetchAssignableUsers |

## RED Test Stub Files

| File | New describe blocks | New assertions | Existing tests |
|------|---------------------|----------------|----------------|
| `taskflow/src/lib/aioUtils.test.ts` | 2 (`AIO_STATUS_MAP`, `normalizeStatusById`) | 12 | 5 (passing) |
| `taskflow/src/services/jira/users.test.ts` | 1 (`fetchJiraUserByUsername`) | 5 | 0 (new file) |
| `taskflow/src/services/aio/cycles.test.ts` | 4 (`fetchAioFolderTree`, `fetchAioFolderCycleCounts`, `fetchAioCyclesWithDetail`, `fetchAioCycleSummaries`) | 15 | 12 (passing) |

**Total:** 32 failing (RED), 17 passing (existing regression guards intact)

## Wave 1 Dependencies Unblocked

- Plan 02: has confirmed URLs (A1–A5), knows to use `AIO_PROJECTS_API_PATH` + `jiraProjectID`; has RED stubs in `cycles.test.ts` and `aioUtils.test.ts` to turn GREEN
- Plan 03: has confirmed A6 param name (`username`); has RED stubs in `users.test.ts` to turn GREEN

## Self-Check

- [x] `57-PROBE-FINDINGS.md` exists with sections A1–A6
- [x] All six assumptions CLOSED (A6 inferred, low risk)
- [x] 32 RED stubs across 3 files — all failing because exports don't exist
- [x] 17 existing tests remain passing (regression guard intact)
- [x] Wave 1 has everything needed to proceed
