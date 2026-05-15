---
plan: 57-02
phase: 57
status: complete
wave: 1
completed: 2026-05-15
subsystem: aio-service-layer
tags: [aio, types, service-functions, status-map, tdd-green]
requires: [57-01]
provides: [fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries, AIO_STATUS_MAP, normalizeStatusById, AioFolder, AioCycleDetailItem, AioCycleSummaryItem, AioCycleDetailPagedResponse]
affects: [57-03, 57-04]
tech_stack_patterns: [aioFetch-with-AIO_PROJECTS_API_PATH, numeric-jiraProjectID-in-path, 401-404-network-error-contract]
key_files_modified:
  - taskflow/src/services/aio/types.ts
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/lib/aioUtils.ts
decisions:
  - "New fetch functions use jiraProjectID (number) not projectKey (string) — per A1-A5 probe findings"
  - "A5 branch taken: server-side folder filter via ?folderID={id} query param"
  - "A3 branch taken: GET /testcycle/summary/paged with no ids param — fetches all summaries in one call"
  - "AIO_PROJECTS_API_PATH passed explicitly as 4th arg to aioFetch for all 4 new endpoints"
---

# Phase 57 Plan 02: AIO Service Layer Foundation — Summary

## One-liner

Four new AIO service functions + 4 types + AIO_STATUS_MAP turning all 32 RED Wave-0 stubs GREEN using confirmed probe URLs (AIO_PROJECTS_API_PATH + numeric jiraProjectID).

## What Was Built

### Task 1 — Types (commit `3015a1b`)

Added 4 new exported interfaces to `taskflow/src/services/aio/types.ts`:

| Interface | Source | Key field |
|-----------|--------|-----------|
| `AioFolder` | API-EXAMPLES folder, A1 | Recursive `children: AioFolder[]` |
| `AioCycleDetailItem` | API-EXAMPLES paged, A4 | `detail.folder: null` always (A5 note) |
| `AioCycleSummaryItem` | API-EXAMPLES paged2, A3 | `testRunDistribution: Record<string, number>` (string keys — Pitfall 3) |
| `AioCycleDetailPagedResponse` | API-EXAMPLES paged | `allIDs: number[]` (key addition over AioPage) |

File now exports 13 `export interface Aio*` (9 existing + 4 new). TypeScript compiles clean.

### Task 2 — Service functions + utilities (commit `275d36c`)

**`taskflow/src/services/aio/cycles.ts`** — 4 new exported async functions:

| Function | URL Path (relative to AIO_PROJECTS_API_PATH) | Return type |
|----------|----------------------------------------------|-------------|
| `fetchAioFolderTree(baseUrl, token, jiraProjectID)` | `/project/{id}/testcycle/folder` (A1) | `AioFolder[]` |
| `fetchAioFolderCycleCounts(baseUrl, token, jiraProjectID)` | `/project/{id}/testcycle/folder/count?archive=false` (A2) | `Record<string, number>` |
| `fetchAioCyclesWithDetail(baseUrl, token, jiraProjectID, folderID?)` | `/project/{id}/testcycle/paged[?folderID={fid}]` (A4/A5) | `AioCycleDetailPagedResponse` |
| `fetchAioCycleSummaries(baseUrl, token, jiraProjectID)` | `/project/{id}/testcycle/summary/paged` (A3) | `AioCycleSummaryItem[]` |

**`taskflow/src/lib/aioUtils.ts`** — 2 new exports appended after existing functions:
- `AIO_STATUS_MAP`: `Record<number, status>` with 5 entries: `{901:'pass', 51:'fail', 55:'blocked', 53:'notRun', 54:'inProgress'}`
- `normalizeStatusById(id: number)`: returns `AIO_STATUS_MAP[id] ?? 'notRun'`

**`taskflow/src/services/aio/index.ts`** — No changes needed; existing `export * from './cycles'` and `export * from './types'` already barrel-export all new symbols.

## Probe Finding Branches Taken

### A5 — Folder filter convention
**Branch taken: server-side filter.** When `folderID` is provided, `fetchAioCyclesWithDetail` appends `?folderID={folderID}` to the path before calling `aioFetch`. No client-side filtering. The test asserts `calledUrl.toContain('folderID=10763')` against the `apiFetch` mock's second argument (the full URL built by `aioFetch`).

### A3 — Cycle summary batch
**Branch taken: single GET, no ids param.** `fetchAioCycleSummaries` takes `(baseUrl, token, jiraProjectID)` — no `ids` array parameter. The endpoint returns ALL summaries for the project in one call. The early-return guard for empty `ids[]` is not applicable since the function signature does not accept IDs. The plan's `ids`-optional design was superseded by the confirmed probe findings.

## URL Constants Used

All 4 new AIO endpoints use `AIO_PROJECTS_API_PATH` (`/rest/aio-tcms/1.0`) — imported from `./client` and passed as the 4th argument to `aioFetch`. NOT `AIO_API_PATH` (`/rest/aio-tcms-api/1.0`).

Path parameter is numeric `jiraProjectID` (e.g. `10134`), not the string `projectKey`. Function signatures accept `jiraProjectID: number`.

## Test Results

| File | Pre-existing tests | New tests (RED→GREEN) | Total |
|------|--------------------|-----------------------|-------|
| `src/lib/aioUtils.test.ts` | 12 passing | 12 new | 24 |
| `src/services/aio/cycles.test.ts` | 5 passing | 15 new | 20 |
| **Total** | **17** | **27** | **44** |

All 44 tests pass. Zero regressions. `tsc --noEmit` clean.

## New Exports Added

| Category | Count | Symbols |
|----------|-------|---------|
| Types (types.ts) | 4 | AioFolder, AioCycleDetailItem, AioCycleSummaryItem, AioCycleDetailPagedResponse |
| Service functions (cycles.ts) | 4 | fetchAioFolderTree, fetchAioFolderCycleCounts, fetchAioCyclesWithDetail, fetchAioCycleSummaries |
| Constants (aioUtils.ts) | 1 | AIO_STATUS_MAP |
| Functions (aioUtils.ts) | 1 | normalizeStatusById |
| **Total new exports** | **10** | |

## Deviations from Plan

### Auto-applied corrections from probe findings

**1. [Probe correction] Function signatures use `jiraProjectID: number` not `projectKey: string`**
- The plan's interface section showed `projectKey: string` signatures as "assumed"
- 57-PROBE-FINDINGS.md A1–A4 confirmed numeric `jiraProjectID` in all URL paths
- 57-01-SUMMARY.md explicitly called this out as critical
- The RED test stubs (Plan 01 Wave 0) were written with `PROJECT_ID = 10134` (number)
- Implementation matches the RED stubs: all 4 new functions accept `jiraProjectID: number`

**2. [Probe correction] fetchAioCycleSummaries has no ids parameter**
- Plan text described an optional `ids: number[]` parameter
- A3 confirmed: endpoint is GET `/testcycle/summary/paged` with no ids param
- The RED test stubs call `fetchAioCycleSummaries(BASE, TOKEN, PROJECT_ID)` with no ids
- Implementation matches: `fetchAioCycleSummaries(baseUrl, token, jiraProjectID: number)`

## Known Stubs

None. All 4 service functions make real HTTP calls via `aioFetch`. All types match confirmed API shapes.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes beyond what the plan's threat model documented. All 4 new fetch functions route through the existing `aioFetch` helper (Bearer token via header — T-57-02-03 mitigated). Numeric `jiraProjectID` paths require no `encodeURIComponent` — numeric values cannot contain path-injection characters (T-57-02-06 not applicable to numeric IDs).

## Self-Check

- [x] `taskflow/src/services/aio/types.ts` contains `export interface AioFolder` — FOUND
- [x] `taskflow/src/services/aio/types.ts` contains `export interface AioCycleDetailItem` — FOUND
- [x] `taskflow/src/services/aio/types.ts` contains `export interface AioCycleSummaryItem` — FOUND
- [x] `taskflow/src/services/aio/types.ts` contains `export interface AioCycleDetailPagedResponse` — FOUND
- [x] `taskflow/src/services/aio/cycles.ts` contains `export async function fetchAioFolderTree(` — FOUND
- [x] `taskflow/src/services/aio/cycles.ts` contains `export async function fetchAioFolderCycleCounts(` — FOUND
- [x] `taskflow/src/services/aio/cycles.ts` contains `export async function fetchAioCyclesWithDetail(` — FOUND
- [x] `taskflow/src/services/aio/cycles.ts` contains `export async function fetchAioCycleSummaries(` — FOUND
- [x] `taskflow/src/lib/aioUtils.ts` contains `export const AIO_STATUS_MAP` — FOUND
- [x] `taskflow/src/lib/aioUtils.ts` contains `export function normalizeStatusById(` — FOUND
- [x] All 44 tests pass (vitest run — confirmed)
- [x] `tsc --noEmit` clean (confirmed)
- [x] Commits exist: `3015a1b` (types), `275d36c` (implementation)
- [x] Existing fetchAioCycles + fetchAioCycleDetail unmodified
- [x] Existing normalizeStatus + normalizeStatusLabel unmodified

## Self-Check: PASSED
