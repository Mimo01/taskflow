---
phase: 71-greenhopper-adapter-foundation
plan: 02
subsystem: services/jira/greenhopper
tags: [greenhopper, jira, types, fetch-wrapper, foundation]
requires:
  - 71-01 (CONTEXT/RESEARCH/PATTERNS)
provides:
  - greenhopperFetch wrapper over apiFetch('jira', ...)
  - GREENHOPPER_API_PATH constant ('/rest/greenhopper/1.0/xboard')
  - 12 GreenHopper response interfaces + EntityMaps
affects:
  - Phase 71-03 (four typed fetchers consume greenhopperFetch + response types)
  - Phase 71-04 (buildEntityMaps + resolvers consume EntityMaps + entity types)
  - Phase 71-05 (adaptIssue consumes GhIssue/GhBoardIssue + EntityMaps)
tech-stack:
  added: []
  patterns:
    - private client.ts not re-exported from barrel (mirrors tempo/aio)
    - apiFetch source-union reuse ('jira') instead of widening
    - types-only module (no runtime imports)
key-files:
  created:
    - taskflow/src/services/jira/greenhopper/client.ts
    - taskflow/src/services/jira/greenhopper/client.test.ts
    - taskflow/src/services/jira/greenhopper/types.ts
  modified: []
decisions:
  - "greenhopperFetch passes literal 'jira' to apiFetch — never 'greenhopper' (D-04 + Pitfall 8)"
  - "GREENHOPPER_API_PATH = '/rest/greenhopper/1.0/xboard' (canonical xboard prefix)"
  - "types.ts contains zero imports — pure type module"
  - "tabs.defaultTabs kept loose (RESEARCH Assumption A3 — Phase 75 narrows)"
metrics:
  duration: "~3 min"
  completed: "2026-05-28"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
  tests_passing: 12
---

# Phase 71 Plan 02: GreenHopper Client + Types Foundation Summary

One-liner: Landed the private `greenhopperFetch` wrapper and the 12-interface `types.ts` substrate that Phases 71-03/04/05 consume to build the typed fetchers, entity-map resolvers, and `adaptIssue`.

## What Was Built

### `taskflow/src/services/jira/greenhopper/client.ts`

Private HTTP wrapper mirroring `services/tempo/client.ts` line-for-line, with two substitutions:
- Source argument: `'jira'` (NOT `'greenhopper'`) per D-04 + RESEARCH Pitfall 8 — GH shares the Jira host + PAT, so 401 must trigger `setJiraConnected(false)` identically.
- Base-path constant: `GREENHOPPER_API_PATH = '/rest/greenhopper/1.0/xboard'`.

**Signature:**
```ts
export async function greenhopperFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,
  apiPath: string = GREENHOPPER_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response>
```

Behavior: strips trailing slash from `baseUrl`, joins `apiPath + path`, sets `Authorization: Bearer ${token}` + `Content-Type: application/json`, defaults method to GET, conditionally spreads `body` when present, forwards `operation` to apiFetch.

NOT re-exported from `greenhopper/index.ts` (D-06).

### `taskflow/src/services/jira/greenhopper/client.test.ts`

12 vitest cases mirroring `tempo/client.test.ts`. Mocks `../../../lib/apiFetch` (three-level path matches the deeper greenhopper/ nesting). The load-bearing assertion `expect(vi.mocked(apiFetch)).toHaveBeenCalledWith('jira', ...)` appears on every test that touches the call signature. Covers:

1. URL construction (baseUrl + GREENHOPPER_API_PATH + path)
2. Trailing-slash strip on baseUrl
3. Source = `'jira'` (D-04 + Pitfall 8 — load-bearing)
4. `Authorization: Bearer <token>` header
5. `Content-Type: application/json` header
6. operation forwarded as 4th arg
7. Method defaults to GET
8. Custom method honored
9. body omitted when absent
10. body included when present
11. Custom apiPath override
12. GREENHOPPER_API_PATH value assertion

### `taskflow/src/services/jira/greenhopper/types.ts`

Types-only module (zero imports). All 12 exported interfaces:

| Interface | Provenance |
|-----------|------------|
| `GhIssue` | base — every issuesData/data.json entry |
| `GhBoardIssue extends GhIssue` | adds `timeInColumn` (board-only) |
| `GhStatusEntity` | allData.entityData.statuses values |
| `GhPriorityEntity` | allData.entityData.priorities values |
| `GhTypeEntity` | allData.entityData.types values |
| `GhEpicEntity` | allData.entityData.epics values (with `epicField`) |
| `GhAllDataResponse` | GET /work/allData.json |
| `GhBacklogResponse` | GET /plan/backlog/data.json |
| `GhTransition` | one entry of workflowToTransitions |
| `GhTransitionsResponse` | GET /work/transitions.json |
| `GhDetailsResponse` | GET /issue/details.json (tabs.defaultTabs kept loose — Phase 75 narrows) |
| `EntityMaps` | D-09 aggregator: `{ statuses, priorities, types, epics }` |

All shapes lifted verbatim from `71-RESEARCH.md §"API Response Shapes (TypeScript Types)"`. JSDoc on each interface cites the originating endpoint and RESEARCH section.

## Verification

| Check | Result |
|-------|--------|
| `npx vitest run src/services/jira/greenhopper/client.test.ts` | 12/12 pass |
| `npx tsc --noEmit` (full project) | exit 0 |
| `grep -c "apiFetch('jira'" client.ts` | 1 ✓ |
| `grep -c "/rest/greenhopper/1.0/xboard" client.ts` | 1 ✓ |
| `grep -c "apiFetch('greenhopper'" client.ts` | 0 ✓ (source-union NOT widened) |
| `grep -cE "^export interface (...)\b" types.ts` | 12 ✓ |
| `grep -c "timeInColumn" types.ts` | 1 (only on GhBoardIssue) ✓ |
| `grep -c "statusCategory" types.ts` | 1 (inside GhStatusEntity) ✓ |
| `grep -c "^import" types.ts` | 0 ✓ |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `e46594ee` | test | add failing test for greenhopperFetch (RED) |
| `11fc2960` | feat | implement greenhopperFetch over apiFetch('jira',...) (GREEN) |
| `1f6e68d6` | feat | add GreenHopper response types + EntityMaps |

## Deviations from Plan

None — plan executed exactly as written. The TDD cycle for Task 1 produced a clean RED→GREEN with no refactor needed (the implementation matched the test on first pass). One minor formatting adjustment: the `apiFetch('jira', ...)` call was written single-line (rather than tempo's multi-line) so the acceptance grep `grep -c "apiFetch('jira'"` returns exactly 1 as the plan requires.

## TDD Gate Compliance

- RED commit: `e46594ee` (test added, vitest run shows "Failed to resolve import './client'" — test correctly fails)
- GREEN commit: `11fc2960` (12/12 vitest cases pass)
- REFACTOR: skipped — implementation was minimal and clean on first pass.

## Threat Flags

None — surface area added (greenhopperFetch) is fully covered by the plan's `<threat_model>` T-71-04 mitigation (source-union NOT widened). Types module is type-only and introduces no runtime surface.

## Known Stubs

None.

## Notes for Downstream Plans

- **71-03 (typed fetchers):** Import `greenhopperFetch` from `'./client'`, response types from `'./types'`. Example pattern in RESEARCH §"Common Operation 1".
- **71-04 (entityMaps + resolvers):** Import `EntityMaps`, `GhStatusEntity`, `GhPriorityEntity`, `GhTypeEntity`, `GhEpicEntity` from `'./types'`. Build helpers consume `GhAllDataResponse`.
- **71-05 (adapter):** Import `GhIssue`, `GhBoardIssue`, `EntityMaps` from `'./types'`. Adapter remains pure — receives `storyPointsFieldKey` as an argument, does NOT call `discoverCustomFields`.

## Self-Check: PASSED

- File `taskflow/src/services/jira/greenhopper/client.ts` — FOUND
- File `taskflow/src/services/jira/greenhopper/client.test.ts` — FOUND
- File `taskflow/src/services/jira/greenhopper/types.ts` — FOUND
- Commit `e46594ee` — FOUND
- Commit `11fc2960` — FOUND
- Commit `1f6e68d6` — FOUND
