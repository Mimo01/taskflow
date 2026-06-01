---
phase: 71-greenhopper-adapter-foundation
plan: 04
subsystem: services/jira/greenhopper
tags: [greenhopper, adapter, entity-maps, resolvers, pure-function, warn-once, tdd]
requires:
  - 71-01  # types.ts (EntityMaps, GhAllDataResponse, GhStatusEntity, GhPriorityEntity, GhTypeEntity, GhEpicEntity)
  - 71-02  # __fixtures__/allData.real.json (drives hit-path tests)
provides:
  - "buildEntityMaps(allData) → EntityMaps (pure, reference-equality, D-09)"
  - "resolveStatus / resolvePriority / resolveType — required-resolvers with Unknown shim + warnOnce (D-07)"
  - "resolveEpic / resolveParent — optional-resolvers returning undefined on miss, no warn (D-08)"
  - "__resetWarnOnce() test-only guard reset"
affects:
  - 71-05  # adapter.ts consumes all six resolvers
tech-stack:
  added: []
  patterns:
    - "Module-level Set<string> warn-once guard keyed by `${kind}:${id}`"
    - "Literal-union narrowing for statusCategory.key with 'indeterminate' fallback"
    - "TDD: console.warn spy with beforeEach mockImplementation + __resetWarnOnce"
key-files:
  created:
    - taskflow/src/services/jira/greenhopper/entityMaps.ts
    - taskflow/src/services/jira/greenhopper/entityMaps.test.ts
  modified: []
decisions:
  - "Followed RESEARCH §Entity Map Shape verbatim for buildEntityMaps body and warnOnce helper."
  - "Status-category narrowing falls back to 'indeterminate' (per plan behavior bullet) — never throws on unexpected raw values."
metrics:
  duration_minutes: ~7
  completed: 2026-05-28
  tasks_completed: 1
  files_changed: 2
  tests_passing: 10
---

# Phase 71 Plan 04: Entity Maps Summary

Shipped `entityMaps.ts` — the pure lookup substrate (`buildEntityMaps` + five resolvers) that the upcoming `adapter.ts` (plan 71-05) will call per-field to translate GreenHopper id refs into existing UI types.

## What Was Built

### `buildEntityMaps(allData: GhAllDataResponse): EntityMaps`

Returns the four sub-objects (`statuses`, `priorities`, `types`, `epics`) by reference. Same input → same output, no cloning, no side effects (D-09 purity). Test 1 asserts `maps.statuses === typed.entityData.statuses`.

### Required Resolvers (D-07)

| Function | Hit shape | Miss shape | Warns? |
|---|---|---|---|
| `resolveStatus(id, maps)` | `{ id, name, statusCategory: { key } }` (key narrowed to `'new'\|'indeterminate'\|'done'`, fallback `'indeterminate'`) | `{ id, name: 'Unknown', statusCategory: { key: 'indeterminate' } }` | once per id |
| `resolvePriority(id, maps)` | `{ id, name, iconUrl }` | `{ id, name: 'Unknown', iconUrl: '' }` | once per id |
| `resolveType(id, maps)` | `{ id, name }` | `{ id, name: 'Unknown' }` | once per id |

### Optional Resolvers (D-08)

| Function | Hit | Miss / undefined input | Warns? |
|---|---|---|---|
| `resolveEpic(id?, maps)` | `{ id, key, name, color }` | `undefined` | never |
| `resolveParent(parentId?, parentKey?)` | `{ id: String(parentId), key: parentKey }` (only when BOTH defined) | `undefined` | never |

### `warnOnce` Design

Module-private `Set<string>` keyed by `${kind}:${id}`. First hit adds to set and calls `console.warn`; subsequent calls with the same key short-circuit. Single shared set across all three required resolvers — kinds (`status` / `priority` / `type`) are namespaced into the key, so id collisions across kinds don't suppress each other's warns.

Test-only `__resetWarnOnce()` exported to let `beforeEach` produce deterministic warn counts across cases.

## Fixture Entries Used For Hit Tests

Pulled the first key of each entity-data map from `__fixtures__/allData.real.json`:

- Status `'3'` → `In Progress`, statusCategory `indeterminate`
- Priority `'2'`
- Type `'10001'`
- Epic `346064` → `PROJ-1` / `Epic 1` / `ghx-label-7`

Tests destructure `Object.keys(typed.entityData.statuses)[0]` etc. at module scope so they remain robust if the fixture is re-captured (any first key works as long as the entry exists).

## Test Coverage (10 cases, all green)

1. `buildEntityMaps` returns all four maps populated + reference equality
2. `resolveStatus` hit returns named status; no warn
3. `resolveStatus` miss returns Unknown shim + 1 warn
4. Two consecutive misses → 1 warn (warnOnce)
5. `resolvePriority` hit/miss/repeat-miss
6. `resolveType` hit/miss/repeat-miss
7. `resolveEpic(undefined)` → undefined, no warn
8. `resolveEpic(missing-id)` → undefined, no warn
9. `resolveEpic(known-id)` → populated shape from fixture
10. `resolveParent` partial / both-present / undefined permutations

```
Test Files  1 passed (1)
     Tests  10 passed (10)
```

## Acceptance Gate Results

| Gate | Required | Actual |
|---|---|---|
| Public exports count | 7 | 7 |
| `new Set<string>` (warnOnce guard) | ≥1 | 1 |
| `console.warn` references | ≥1 | 2 |
| `toHaveBeenCalledTimes(1)` assertions | ≥1 | 6 |
| Fixture import path | ≥1 | 1 |

## Deviations from RESEARCH §Entity Map Shape

None of substance. Implementation matches RESEARCH ll. 287-346 verbatim for:
- `buildEntityMaps` body
- `warnOnce` helper structure (module-level Set, `${kind}:${id}` key)
- Resolver signatures

Two minor refinements within the plan's `<behavior>` envelope (not deviations from the plan):
- Added a small `narrowStatusCategoryKey` helper for the literal-union fallback (plan called for this narrowing inline; extracting it keeps `resolveStatus` readable)
- Added JSDoc on `__resetWarnOnce` noting "internal — not part of the public adapter surface"

No Rule 1–4 deviations triggered.

## Environment Note

The worktree's `taskflow/node_modules` was missing — symlinked it to the main repo's `taskflow/node_modules` so `vitest` could resolve `@vitejs/plugin-react`. This is a worktree-setup convenience and is not committed (the symlink lives outside git).

## Self-Check: PASSED

- `taskflow/src/services/jira/greenhopper/entityMaps.ts` — FOUND
- `taskflow/src/services/jira/greenhopper/entityMaps.test.ts` — FOUND
- Commits in git log:
  - `85ff0fb4` `test(71-04): add failing tests for entityMaps resolvers` — FOUND (RED)
  - `f9a1aa96` `feat(71-04): implement entityMaps buildEntityMaps + resolvers` — FOUND (GREEN)
