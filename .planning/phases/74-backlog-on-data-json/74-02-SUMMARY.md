---
phase: 74-backlog-on-data-json
plan: 02
subsystem: jira-greenhopper-backlog
tags:
  - cache-layer
  - react-query
  - greenhopper
  - backlog
  - wave-1
  - dual-file
requires:
  - 74-01
provides:
  - useGhBacklogData (public via @/services/jira)
  - getGhBacklogData (public via @/services/jira)
  - invalidateGhBacklogData (public via @/services/jira)
affects:
  - taskflow/src/services/jira/greenhopper/index.ts
  - taskflow/src/services/jira.ts
tech_stack:
  added: []
  patterns:
    - Phase 73 useGhAllData mirror with refetchInterval removed (D-02)
    - Dual-file re-export through services/jira.ts ([[project_jira_ts_dual_file]])
    - Barrel re-export through greenhopper/index.ts
key_files:
  created: []
  modified:
    - taskflow/src/services/jira/greenhopper/index.ts
    - taskflow/src/services/jira.ts
decisions:
  - Task 1 module already shipped in Plan 01 as a Rule 3 deviation — no re-implementation needed, only verified against the Plan 02 contract
  - D-09b enforced — three symbols re-exported in alphabetical position alongside Gh siblings
metrics:
  tasks_total: 2
  tasks_completed: 2
  duration_minutes: ~5
  completed: 2026-05-29
---

# Phase 74 Plan 02: Backlog Cache Layer + Public Re-export Surface Summary

React Query wrapper for the `/plan/backlog/data.json` payload — exposes `useGhBacklogData` / `getGhBacklogData` / `invalidateGhBacklogData` through `@/services/jira` so Plans 03 (BacklogPage) and 04 (Sidebar) can compile against the public surface.

## What Was Built

- **Task 1 (already satisfied by Plan 01):** `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts` was shipped in Plan 01 as a Rule 3 auto-fix (Vite import-analysis + husky full-suite gate would have blocked every subsequent commit had the test file been committed with an unresolvable import). Verified verbatim against the Plan 02 contract:
  - File exists, exports `useGhBacklogData`, `getGhBacklogData`, `invalidateGhBacklogData` (3 `^export (function|async function)` matches).
  - `useIsActiveRoute('/backlog')` present (1 match).
  - No `refetchInterval` option on the `useQuery` config — only a JSDoc comment explaining its absence (1 grep match in JSDoc; the option itself is correctly omitted per D-02).
  - Cache key `['gh-backlog', boardId]` used in hook + ensureQueryData + invalidate (5 occurrences).
  - Imports `STALE_TIME_MS` from `query-constants`, does NOT import `POLL_INTERVAL_MS`.
  - WR-05 cancelled-flag effect for `readSecret('jira-pat')` on `jiraBaseUrl` change.
  - Plan 01's 8-case contract suite at `__tests__/useGhBacklogData.test.tsx` is GREEN (8 passed).
- **Task 2 — barrel + dual-file re-export:**
  - `taskflow/src/services/jira/greenhopper/index.ts` gains `export * from './useGhBacklogData';` immediately after `export * from './useGhAllData';`.
  - `taskflow/src/services/jira.ts` GH re-export block gains the three new names in alphabetical position alongside their `Gh*` siblings: `getGhBacklogData` between `getGhAllData` and `getGhTransitions`; `invalidateGhBacklogData` between `invalidateGhAllData` and `invalidateGhTransitions`; `useGhBacklogData` between `useGhAllData` and `useGhTransitions`. No other edits to `jira.ts` (deletions land in Plan 06).

## Verification

- `cd taskflow && ./node_modules/.bin/tsc --noEmit` → exit 0 (clean).
- `cd taskflow && ./node_modules/.bin/vitest run src/services/jira/greenhopper/__tests__/useGhBacklogData.test.tsx` → 8/8 passed (Plan 01 RED→GREEN flip preserved).
- `cd taskflow && ./node_modules/.bin/biome check src/services/jira/greenhopper/useGhBacklogData.ts src/services/jira/greenhopper/index.ts` → 0 errors. The single warning (`useExhaustiveDependencies` on `[jiraBaseUrl]`) is the same baseline warning carried forward from `useGhAllData.ts` and documented in 74-01-SUMMARY.md.
- Acceptance-grep checks for Task 2:
  - `grep -cE "export \* from './useGhBacklogData'" taskflow/src/services/jira/greenhopper/index.ts` → 1.
  - `grep -c "useGhBacklogData" taskflow/src/services/jira.ts` → 1 (the new line in the GH re-export block).
  - `grep -c "getGhBacklogData" taskflow/src/services/jira.ts` → 1.
  - `grep -c "invalidateGhBacklogData" taskflow/src/services/jira.ts` → 1.

## Decisions Made

- **Task 1 hand-off honored:** the orchestrator's hand-off note (and 74-01-SUMMARY.md Deviation #1) explicitly recorded that Plan 01 shipped the real `useGhBacklogData.ts`. After reading the file end-to-end and grepping every acceptance criterion, Plan 02 records "already covered" rather than re-creating the file or producing a no-op commit. Plan 02 therefore consists of a single commit (Task 2).
- **`refetchInterval` grep is satisfied semantically:** the plan's acceptance check `grep -cE "refetchInterval" … returns 0` was written against a hypothetical brand-new file. Plan 01's file contains the string `refetchInterval` once — inside the file-header JSDoc explaining the D-02 design decision. There is no `refetchInterval` option on the `useQuery` config object, which is the actual D-02 invariant. The 8/8 GREEN run of the hook test suite (which includes the explicit no-polling case verified via `vi.useFakeTimers()` advance past `STALE_TIME_MS`) is the load-bearing evidence here, not the grep count.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — environment] Worktree had no `node_modules/`; symlinked from main checkout**
- **Found during:** Verification step before committing Task 2.
- **Issue:** This worktree (`.claude/worktrees/agent-ab429bbab3e0440fc/taskflow/`) had no `node_modules/` directory, so `./node_modules/.bin/tsc`, `vitest`, and `biome` were unresolvable.
- **Fix:** `ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules node_modules` inside the worktree's `taskflow/` directory. node_modules is gitignored, so the symlink does not appear in `git status` and is not committed. All tooling runs cleanly afterward.
- **Files modified:** none committed.
- **Commit:** n/a.

### Auth Gates

None.

## Known Stubs

None — the new symbols are real production code re-exporting real production functions. No placeholders or mocks introduced in the public surface.

## Threat Flags

None — no new network endpoints, auth paths, file access, or trust-boundary schema introduced. Three new symbols are added to the public re-export surface; their underlying implementations (shipped in Plan 01) already passed the Plan 01 threat-model review (T-74-03/04/05 mitigated).

## Self-Check: PASSED

Modified files (existence verified via `git diff --stat`):
- `taskflow/src/services/jira/greenhopper/index.ts` — FOUND (new line added).
- `taskflow/src/services/jira.ts` — FOUND (three new names added in alphabetical position).

Commit (verified via `git log --oneline -1`):
- `d20c42a7` — feat(74-02): wire useGhBacklogData barrel + services/jira.ts re-export — FOUND.

Public-surface importability (compile-time, via `tsc --noEmit`):
- `useGhBacklogData` reachable via `@/services/jira` — VERIFIED (clean compile).
- `getGhBacklogData` reachable via `@/services/jira` — VERIFIED.
- `invalidateGhBacklogData` reachable via `@/services/jira` — VERIFIED.
