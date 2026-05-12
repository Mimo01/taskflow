---
plan: 51-03
phase: 51-aio-service-layer
status: complete
date: 2026-05-12
subsystem: services/aio
tags: [aio, service-layer, typescript, vitest, tdd]
dependency_graph:
  requires:
    - 51-01  # probe findings: D-13 two base paths, D-15 no issueKey endpoint, D-16/D-17 types
    - 51-02  # aioEnabled toggle confirms the service layer will be gated
  provides:
    - aio/client.ts: AIO_PROJECTS_API_PATH, AIO_API_PATH constants, aioFetch() wrapper
    - aio/types.ts: AioProject, AioCycle, AioTestRun, AioPage<T> interfaces
    - aio/projects.ts: fetchAioProjects(baseUrl, token)
    - aio/issue-runs.ts: fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)
    - aio/index.ts: barrel (types, projects, issue-runs — NOT client)
  affects:
    - Phase 52+ can add cycles.ts, testcases.ts domain modules without renegotiating conventions
    - Phase 54 issue detail AIO section will use fetchAioTestRunsForCycle and filter client-side
tech_stack:
  added: []
  patterns:
    - aioFetch wrapper with optional apiPath param (defaults to AIO_API_PATH)
    - Two-constant base path split (AIO_PROJECTS_API_PATH vs AIO_API_PATH) per D-13 probe
    - AioPage<T> paginated wrapper guard (items fallback) per D-17 probe
    - vi.mock before module-under-test import pattern (mirroring jira/ test convention)
key_files:
  created:
    - taskflow/src/services/aio/client.ts
    - taskflow/src/services/aio/types.ts
    - taskflow/src/services/aio/projects.ts
    - taskflow/src/services/aio/issue-runs.ts
    - taskflow/src/services/aio/index.ts
    - taskflow/src/services/aio/client.test.ts
    - taskflow/src/services/aio/projects.test.ts
    - taskflow/src/services/aio/issue-runs.test.ts
  modified: []
decisions:
  - "Two AIO base path constants required (not one): AIO_PROJECTS_API_PATH for /project, AIO_API_PATH for everything else (D-13)"
  - "aioFetch accepts optional apiPath param defaulting to AIO_API_PATH; projects.ts passes AIO_PROJECTS_API_PATH explicitly"
  - "issue-runs.ts rescoped from fetchAioRunsForIssue(issueKey) to fetchAioTestRunsForCycle(projectKey, cycleKey) per D-15"
  - "AioPage<T> uses items[] field (not values[] or runs[]) per D-17 probe confirmation"
  - "client.ts NOT exported from index.ts barrel (matches jira/ convention)"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-05-12"
  tasks_completed: 2
  files_changed: 8
---

# Phase 51 Plan 03: AIO Service Module — Summary

## What Was Built

The complete `src/services/aio/` service module: client wrapper with two base path constants, type definitions, two domain functions, barrel export, and 15 unit tests — all passing. This is the foundational API layer for all AIO Test Management pages in Phases 52–54. It mirrors the `src/services/jira/` structure so later phases can add domain modules (cycles.ts, testcases.ts) without renegotiating conventions.

## Task Breakdown

### Task 1: aio/client.ts, types.ts, client.test.ts
**Commit:** `4584dfd`

Created `client.ts` with two exported constants (per D-13):
- `AIO_PROJECTS_API_PATH = '/rest/aio-tcms/1.0'` — project listing only
- `AIO_API_PATH = '/rest/aio-tcms-api/1.0'` — cycles, test runs, test cases

`aioFetch(baseUrl, token, path, apiPath?)` wraps `apiFetch('jira', url, { headers })` with `Authorization: Bearer` and `Content-Type: application/json`. The optional `apiPath` param defaults to `AIO_API_PATH`.

Created `types.ts` with four interfaces:
- `AioProject { id: number; projectKey: string; name: string }` — from D-16
- `AioCycle { key, name, status, projectKey }` — from D-17 + API docs
- `AioTestRun { id, status, testCaseKey, cycleKey }` — from D-17 + API docs
- `AioPage<T> { items, startAt, maxResults, isLast }` — from D-17 (paginated wrapper)

`client.test.ts`: 6 tests — URL construction, trailing slash stripping, source='jira', Authorization header, Content-Type header, AIO_PROJECTS_API_PATH override. All pass.

### Task 2: projects.ts, issue-runs.ts, index.ts, and tests
**Commit:** `1d4c3db`

Created `projects.ts` — `fetchAioProjects(baseUrl, token)` calls `aioFetch` with `AIO_PROJECTS_API_PATH`. Returns `AioProject[]` on 200, `[]` on 404, `ApiError('Invalid token or token has expired', 401, 'jira')` on 401, `Error('Cannot reach AIO at ...')` on network failure.

Created `issue-runs.ts` — **rescoped from the plan** (see Deviations). `fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)` fetches `/project/{projectKey}/testcycle/{cycleKey}/testrun`. Uses `AioPage<T>` unwrapping with `Array.isArray` guard. Same error contract as `projects.ts`.

Created `index.ts` barrel: `export * from './types'; export * from './projects'; export * from './issue-runs'`. `client.ts` intentionally NOT exported.

`projects.test.ts`: 4 tests — 200 returns typed array, 401 throws ApiError, 404 returns [], network throws 'Cannot reach AIO'.
`issue-runs.test.ts`: 5 tests — 200 with AioPage wrapper, 200 empty items, 401 ApiError, 404 returns [], network throws.

**Result: 15/15 tests pass.**

## Verification

```
✓ client.test.ts     — 6/6 (URL construction, headers, apiPath override)
✓ projects.test.ts   — 4/4 (200, 401, 404, network)
✓ issue-runs.test.ts — 5/5 (200 paginated, 200 empty, 401, 404, network)
Total: 15/15 tests
```

Pre-existing failure in `UpdateDialog.test.tsx` (1 test) confirmed unrelated to this plan — was already failing before these changes.

## Deviations from Plan

### Auto-applied (Rule 1/2)

**1. [Rule 2 - Two base path constants] aioFetch accepts optional apiPath parameter**
- **Found during:** Task 1 implementation — D-13 requires both `AIO_PROJECTS_API_PATH` and `AIO_API_PATH`
- **Issue:** The plan specified a single `AIO_API_PATH` in the `aioFetch` URL construction formula. But D-13 confirmed two purpose-split paths: projects endpoint uses `/rest/aio-tcms/1.0`, all other endpoints use `/rest/aio-tcms-api/1.0`. A single hard-coded path in `aioFetch` would force either projects or cycles/runs to use the wrong base path.
- **Fix:** Added optional `apiPath: string = AIO_API_PATH` parameter to `aioFetch`. The default is `AIO_API_PATH` (correct for cycles/runs). `projects.ts` passes `AIO_PROJECTS_API_PATH` explicitly.
- **Files modified:** `client.ts`, `client.test.ts` (added 6th test for apiPath override)
- **Commit:** `4584dfd`

**2. [Rule 1 - Probe deviation] issue-runs.ts rescoped from issueKey lookup to cycle-based runs**
- **Found during:** Task 2 — the plan specified `fetchAioRunsForIssue(baseUrl, token, issueKey)` using `GET /testrun?issueKey=`. D-15 confirmed this endpoint does NOT exist.
- **Issue:** The plan's `issue-runs.ts` was designed around an endpoint that was proven absent by the Phase 51 probe. Implementing it as-specified would create a service function that always 404s against the real API.
- **Fix:** Renamed the exported function to `fetchAioTestRunsForCycle(baseUrl, token, projectKey, cycleKey)`. Path is `/project/{projectKey}/testcycle/{cycleKey}/testrun`. Uses `AioPage<T>` unwrapping. Issue-level filtering deferred to Phase 54 (which will filter `AioTestRun[]` client-side by Jira issue key if the field is present).
- **Files modified:** `issue-runs.ts` (full rescope), `issue-runs.test.ts` (tests rewritten for cycle params)
- **Commit:** `1d4c3db`

**3. [Rule 2 - Type correctness] AioIssueRun removed; AioCycle and AioTestRun added**
- **Found during:** Task 1 — `types.ts` per the plan would export `AioIssueRun` (tied to the now-absent issueKey endpoint). The correct types per D-17 are `AioCycle` and `AioTestRun`, plus the `AioPage<T>` generic.
- **Fix:** `types.ts` exports `AioProject`, `AioCycle`, `AioTestRun`, `AioPage<T>`. No `AioIssueRun` (that concept tied to the nonexistent endpoint).
- **Files modified:** `types.ts`
- **Commit:** `4584dfd`

## Known Stubs

None — all exported functions make real API calls against the live AIO endpoints confirmed by the Phase 51 probe.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced beyond what the plan's threat model covers. All threats mitigated as specified:

- T-51A-01: PAT passed as parameter, never stored — confirmed, `aioFetch` receives `token` as param
- T-51A-02: `AIO_API_PATH` is a hard-coded constant, not interpolated from user input — confirmed
- T-51A-03: `encodeURIComponent(projectKey)` and `encodeURIComponent(cycleKey)` applied in `issue-runs.ts` path construction — confirmed
- T-51A-05: `client.ts` not exported from barrel — confirmed (`grep "export \* from './client'"` returns no output)

## Self-Check: PASSED

- [x] `taskflow/src/services/aio/client.ts` — exists, exports `AIO_PROJECTS_API_PATH`, `AIO_API_PATH`, `aioFetch`
- [x] `taskflow/src/services/aio/types.ts` — exists, exports `AioProject`, `AioCycle`, `AioTestRun`, `AioPage`
- [x] `taskflow/src/services/aio/projects.ts` — exists, exports `fetchAioProjects`
- [x] `taskflow/src/services/aio/issue-runs.ts` — exists, exports `fetchAioTestRunsForCycle`
- [x] `taskflow/src/services/aio/index.ts` — exists, 3 barrel exports, client NOT exported
- [x] `taskflow/src/services/aio/client.test.ts` — exists, 6 tests
- [x] `taskflow/src/services/aio/projects.test.ts` — exists, 4 tests
- [x] `taskflow/src/services/aio/issue-runs.test.ts` — exists, 5 tests
- [x] Commit `4584dfd` exists (Task 1)
- [x] Commit `1d4c3db` exists (Task 2)
- [x] All 15 tests pass
