---
phase: 78-drag-to-rank-on-backlog
plan: "03"
subsystem: services/jira
tags: [rank, jira-agile, tdd, service-function]
dependency_graph:
  requires:
    - plan: 78-01
      provides: rank-api.test.ts Wave-0 RED scaffold
  provides:
    - rankIssueApi service function (PUT /rest/agile/1.0/issue/rank)
    - rank-api.test.ts GREEN (all 5 cases)
  affects:
    - plan: 78-04
      reason: BacklogPage drag wiring calls rankIssueApi from barrel
tech_stack:
  added: []
  patterns:
    - "apiFetch + 204 + ApiError(401/403) service function convention"
    - "integer rankCustomFieldId from cached GhBacklogResponse — never hardcoded"
key_files:
  created:
    - taskflow/src/services/jira/rank-api.ts
  modified:
    - taskflow/src/services/jira.ts
decisions:
  - "rankCustomFieldId typed as number (not string) in function signature — matches integer from GhBacklogResponse fixture 10105"
  - "position param typed as union: { rankBeforeIssue: string } | { rankAfterIssue: string } | Record<string, never> — spread into body"
  - "ApiError thrown on 401/403 for Plan-04 onError rollback; generic Error on other non-ok status codes (same pattern as addIssuesToSprint)"
metrics:
  duration: "3 minutes"
  completed: "2026-06-03"
  tasks: 1
  files_changed: 2
---

# Phase 78 Plan 03: rankIssueApi Service Function Summary

**`rankIssueApi` implemented at `rank-api.ts`: integer `rankCustomFieldId` PUT to `/rest/agile/1.0/issue/rank`, mirroring the `addIssuesToSprint` apiFetch/ApiError convention; barrel-exported from `services/jira.ts`; all 5 Wave-0 RED tests GREEN**

## Performance

- **Duration:** ~3 min
- **Completed:** 2026-06-03
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `rank-api.ts` exporting `rankIssueApi(baseUrl, token, issueKey, rankCustomFieldId: number, position)` — uses `apiFetch('jira', url, { method: 'PUT', ... }, 'Rank Issue')`, handles 204 as success, throws `ApiError` on 401/403, generic `Error` on other failures
- Added `export { rankIssueApi } from './jira/rank-api';` to `services/jira.ts` barrel adjacent to `addIssuesToSprint`
- Turned the Plan-01 Wave-0 RED scaffold `rank-api.test.ts` fully GREEN (5/5 cases including `typeof body.rankCustomFieldId === 'number'` and fixture value `10105`)
- TypeScript clean (`npx tsc --noEmit` no errors)

## Task Commits

1. **Task 1: Implement rankIssueApi and barrel-export it (RANK-03)** - `ef001068` (feat)

## Files Created/Modified

- `taskflow/src/services/jira/rank-api.ts` - NEW: `rankIssueApi` service function
- `taskflow/src/services/jira.ts` - Added barrel export for `rankIssueApi`

## Decisions Made

- `rankCustomFieldId` typed as `number` (integer) in function signature; the `typeof body.rankCustomFieldId === 'number'` assertion in the test is the authoritative guard
- `position` uses a discriminated union type so TypeScript prevents conflating `rankBeforeIssue` and `rankAfterIssue`; spread operator merges it into the body object cleanly
- Followed `addIssuesToSprint` exactly: same import paths (`../../lib/api-error`, `../../lib/apiFetch`), same 204 acceptance, same 401/403→ApiError pattern

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (Wave-0 scaffold, plan 01) | `985f2848` | ✓ — module-not-found at collection time |
| GREEN (`feat(78-03)`) | `ef001068` | ✓ — all 5 tests pass |
| REFACTOR | (none needed) | n/a |

## Deviations from Plan

None — plan executed exactly as written.

## Threat Surface Scan

No new threat surface beyond what the plan's threat model covers. `rankIssueApi` reuses the existing `apiFetch('jira', ...)` authenticated path; no new secrets, tokens, or endpoints are introduced. T-78-03A mitigated (Bearer PAT via existing apiFetch path). T-78-03C mitigated (401/403 surfaces as ApiError for Plan-04 rollback).

## Known Stubs

None.

## Self-Check: PASSED

- `taskflow/src/services/jira/rank-api.ts` — FOUND ✓
- `taskflow/src/services/jira.ts` barrel contains `rankIssueApi` — FOUND ✓
- Commit `ef001068` — FOUND ✓
- `npm test -- --run src/services/jira/rank-api.test.ts` → 5 passed ✓
- `npx tsc --noEmit` → clean ✓
