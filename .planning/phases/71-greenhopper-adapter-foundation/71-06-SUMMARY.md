---
phase: 71-greenhopper-adapter-foundation
plan: 06
subsystem: services/jira/greenhopper
tags: [barrel, re-export, integration, wave-4]
requires:
  - 71-02 (client + types)
  - 71-03 (data endpoints)
  - 71-04 (entityMaps + resolvers)
  - 71-05 (adapter)
provides:
  - greenhopper barrel (no client re-export per D-06)
  - D-05 surface re-exported from services/jira.ts for Phases 72-75 consumers
affects:
  - All future GH consumers — they import via `import { ... } from '@/services/jira'`
tech-stack:
  added: []
  patterns:
    - aio/index.ts-style barrel (client kept internal)
    - legacy dual-file re-export (jira.ts at bottom, post `fetchEpicStories`)
key-files:
  created:
    - taskflow/src/services/jira/greenhopper/index.ts
  modified:
    - taskflow/src/services/jira.ts
decisions:
  - "D-06 honored: barrel re-exports 7 modules (adapter, allData, data, details, entityMaps, transitions, types); client.ts NOT re-exported"
  - "D-05 honored: both value + type blocks land in services/jira.ts (the legacy single file backing 60 imports), NOT services/jira/index.ts"
  - "Biome auto-fix reordered the appended blocks: `export type {...}` first, then `export {...}`, members alphabetical (organizeImports rule)"
metrics:
  duration: ~6 minutes
  completed: 2026-05-28
  tasks: 2
  files-touched: 2
  tests-passed: 1619
  tests-skipped: 4 (files) + 2 (in-file) + 35 (todo)
---

# Phase 71 Plan 06: GreenHopper Barrel + jira.ts Re-Export Summary

Wire the greenhopper adapter foundation into the project's import graph: ship the public barrel (D-06) and re-export the D-05 surface from the legacy `src/services/jira.ts` so Phases 72-75 can `import { fetchAllData, adaptIssue, ... } from '@/services/jira'` per the established 60-imports-via-jira.ts convention.

## What Shipped

### Task 1 — `src/services/jira/greenhopper/index.ts` (commit `6d2462d7`)

14-line barrel modeled verbatim on `src/services/aio/index.ts`:

```ts
export * from './adapter';
export * from './allData';
export * from './data';
export * from './details';
export * from './entityMaps';
export * from './transitions';
export * from './types';
```

- No `export ... from './client'` line — D-06 verified by `grep -cE "^export .* from '\\./client'" == 0`.
- Doc-comment text mentions `'./client'` (mirrors aio analog) but is not a code export.
- Alphabetical order matches aio/index.ts style.

### Task 2 — `src/services/jira.ts` re-export blocks (commit `89f4f201`)

Two appended blocks at the bottom of `services/jira.ts` (after `fetchEpicStories`, line 2729+):

**Value re-exports** (12 functions): `fetchAllData`, `fetchBacklogData`, `fetchIssueDetails`, `fetchGhTransitions`, `adaptIssue`, `createAdapter`, `buildEntityMaps`, `resolveStatus`, `resolvePriority`, `resolveType`, `resolveEpic`, `resolveParent`.

**Type re-exports** (12 types): `GhIssue`, `GhBoardIssue`, `GhAllDataResponse`, `GhBacklogResponse`, `GhDetailsResponse`, `GhTransitionsResponse`, `GhTransition`, `GhStatusEntity`, `GhPriorityEntity`, `GhTypeEntity`, `GhEpicEntity`, `EntityMaps`.

Biome's `assist/source/organizeImports` auto-formatted both blocks: `export type { ... }` block first, then `export { ... }`, members alphabetical. The 1-line `// GreenHopper (Phase 71) — re-exported here per D-05` header comment was reflowed to sit just above the value block.

Both blocks point at `'./jira/greenhopper'` — verified by `grep -c "from './jira/greenhopper'" == 2`.

## Verification

| Check | Result |
|---|---|
| `grep -c "from './client'" src/services/jira/greenhopper/index.ts` | `1` (doc-comment only — matches aio analog; `^export ... from './client'` count is `0`) |
| `grep -cE "^export \* from './<7-modules>'"` | `7` |
| `grep -c "from './jira/greenhopper'" src/services/jira.ts` | `2` (value block + type block) |
| `npx tsc --noEmit` | clean (exit 0) |
| `npx vitest run` | 136 files passed / 4 skipped; 1619 tests passed / 2 skipped / 35 todo |
| `npx biome check src/services/jira.ts` | clean (0/0) |
| `npx biome check src/services/jira/greenhopper/index.ts` | clean (0/0) |
| `npx biome check src/services/jira/greenhopper/` (full dir) | 8 errors / 1 warning — **all pre-existing from 71-02..71-05**; deferred (see deferred-items.md) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Biome organizeImports auto-fix] Reordered appended re-export blocks**
- **Found during:** Task 2 (`npx biome check src/services/jira.ts` reported `assist/source/organizeImports` after the append)
- **Issue:** Biome wants `export type {}` before `export {}` and alphabetical members
- **Fix:** Ran `npx biome check --write src/services/jira.ts` — Biome auto-sorted both blocks
- **Files modified:** `taskflow/src/services/jira.ts` (final committed state has type block first, then value block, both alphabetical)
- **Commit:** `89f4f201`
- **Functional impact:** None — re-export name set is identical to the spec; only the order in source changed

### Out-of-Scope (Deferred)

**Biome errors inside `src/services/jira/greenhopper/`** — 8 errors + 1 warning surfaced when running the plan's wider verify command. All originate from files committed by plans 71-02..71-05 (fixtures, adapter.ts, client.ts, adapter.test.ts, entityMaps.test.ts) — not touched by 71-06. Logged to `deferred-items.md` for a follow-up cleanup plan per the executor scope-boundary rule (only fix what the current task touched).

The plan's acceptance criterion `biome check src/services/jira.ts src/services/jira/greenhopper reports 0 errors and 0 warnings` is therefore **partially met**: the files this plan modified (jira.ts) and created (greenhopper/index.ts) are 0/0. The pre-existing regression inside greenhopper from prior waves is out of scope and tracked.

## Threat Register Disposition

| Threat ID | Mitigation Status |
|---|---|
| T-71-15 (client.ts re-export through barrel) | **mitigated** — no `^export ... from './client'` line in barrel |
| T-71-16 (name collision in jira.ts) | **mitigated** — pre-flight grep showed 0 hits for every D-05 name in jira.ts; tsc + vitest clean post-merge |
| T-71-17 (lint regression blocks CI) | **partially mitigated** — jira.ts and index.ts 0/0; pre-existing greenhopper/ regression deferred (introduced by 71-02..71-05, not 71-06) |
| T-71-18 (wrong barrel exports surface) | **mitigated** — re-exports landed in `services/jira.ts` (legacy dual-file) only; verified by file-specific grep |

## Self-Check

- [x] `taskflow/src/services/jira/greenhopper/index.ts` exists (file present)
- [x] `taskflow/src/services/jira.ts` modified with 2 `from './jira/greenhopper'` lines (`grep -c == 2`)
- [x] Commit `6d2462d7` exists (Task 1)
- [x] Commit `89f4f201` exists (Task 2)
- [x] `npx tsc --noEmit` clean
- [x] `npx vitest run` green (1619 passed)

## Self-Check: PASSED
