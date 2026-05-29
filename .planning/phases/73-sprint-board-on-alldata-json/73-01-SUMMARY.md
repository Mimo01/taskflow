---
phase: 73-sprint-board-on-alldata-json
plan: 01
subsystem: jira/greenhopper + lib/time
tags: [greenhopper, react-query, intl, sprint-board, foundation]
requires:
  - taskflow/src/services/jira/greenhopper/allData.ts (Phase 71 fetchAllData)
  - taskflow/src/lib/query-constants.ts (POLL_INTERVAL_MS, STALE_TIME_MS)
  - taskflow/src/hooks/useIsActiveRoute.ts
  - taskflow/src/stores/auth.store.ts
  - taskflow/src/services/stronghold.ts (readSecret)
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx:37-45 (Intl.RelativeTimeFormat analog)
  - taskflow/src/services/jira/greenhopper/transitions.ts:307-358 (useGhTransitions analog)
provides:
  - useGhAllData(boardId) — polling React Query hook over fetchAllData
  - getGhAllData(qc, baseUrl, token, boardId) — imperative ensureQueryData twin
  - invalidateGhAllData(qc, boardId?) — single board or all
  - formatTimeAgoStrict(ms) — compact "30s/1m/1h/1d" badge text
  - formatTimeAgo(ms) — Intl.RelativeTimeFormat natural-language phrasing
affects:
  - Plan 02 (SprintBoardTab rewrite — consumes useGhAllData + formatTimeAgo helpers)
  - Plan 03 (Sidebar prefetch via getGhAllData; Reload-board via invalidateGhAllData)
tech_stack:
  added: []
  patterns:
    - "Cache key shape ['gh-<resource>', primaryKey] (Phase 72 carry-forward)"
    - "Auth-secret read on jiraBaseUrl change (WR-05 pattern from transitions.ts)"
    - "ensureQueryData for prefetch warm matching hook key (Phase 72 pattern)"
    - "Intl.RelativeTimeFormat for time-ago (IssueDetailContent analog, R-03)"
key_files:
  created:
    - taskflow/src/services/jira/greenhopper/useGhAllData.ts
    - taskflow/src/services/jira/greenhopper/useGhAllData.test.ts
    - taskflow/src/lib/formatTimeAgo.ts
    - taskflow/src/lib/formatTimeAgo.test.ts
  modified:
    - taskflow/src/services/jira/greenhopper/index.ts (barrel append)
    - taskflow/src/services/jira.ts (re-export block)
decisions:
  - "Hook returns the raw GhAllDataResponse envelope; adaptation deferred to SprintBoardTab useMemo (D-01)"
  - "STALE_TIME_MS (30s), NOT Infinity, to match the board polling cadence; differs from transitions.ts analog"
  - "Used Intl.RelativeTimeFormat instead of date-fns (R-03 — date-fns not in package.json)"
  - "Did not delete fetchSprintSubtasks re-export in Plan 01 — deferred to Plan 03 (D-09)"
  - "Kept fetchBoardQuickFilters as-is (R-01 — allData has no structured quick filters)"
metrics:
  duration: ~10 minutes
  completed: 2026-05-29
  tasks_completed: 3
  files_created: 4
  files_modified: 2
  tests_added: 21
---

# Phase 73 Plan 01: Data-layer foundation Summary

**One-liner:** Polling React Query hook `useGhAllData` + imperative/invalidator twins + Intl.RelativeTimeFormat time-ago helpers — the public surface Plans 02/03 consume.

## What shipped

### `useGhAllData(boardId)` — React Query hook
- `queryKey: ['gh-all-data', boardId]`, polls every `POLL_INTERVAL_MS` while `/sprint-board` route is active, `staleTime: STALE_TIME_MS` (30s).
- Reads `jiraBaseUrl` from `useAuthStore`; reads `'jira-pat'` token via `readSecret` (cancelled-flag pattern); re-reads when `jiraBaseUrl` changes (WR-05).
- Returns the **raw** `GhAllDataResponse` envelope — adaptation happens caller-side in Plan 02 via `useMemo` (D-01 / Discretion). Hook does NOT call `adaptIssue` / `buildEntityMaps` / `createAdapter`.

### `getGhAllData(qc, baseUrl, token, boardId)` — imperative twin
- Uses `queryClient.ensureQueryData` with the matching key + `staleTime` so the warmed cache is readable by the hook (Plan 03 Sidebar prefetch consumes this — D-08).

### `invalidateGhAllData(qc, boardId?)` — invalidator
- `boardId === undefined` → invalidates `['gh-all-data']` (all boards).
- `boardId === N` → invalidates `['gh-all-data', N]` only.

### `formatTimeAgo` / `formatTimeAgoStrict` (R-03)
- `formatTimeAgoStrict`: `"30s" / "5m" / "3h" / "7d"` badge text.
- `formatTimeAgo`: natural-language phrasing via `Intl.RelativeTimeFormat('en', { numeric: 'auto' })`.
- Both clamp future timestamps (`"0s"` / `"now"`) — T-73-02 mitigation against clock skew producing NaN UI.
- No third-party time-format dependency added (date-fns absent from `package.json` — confirmed).

### Public surface wiring (memory `[[project_jira_ts_dual_file]]`)
- `services/jira/greenhopper/index.ts`: appended `export * from './useGhAllData'`.
- `services/jira.ts`: added `useGhAllData`, `getGhAllData`, `invalidateGhAllData` to the Phase 72 GH re-export block (lines ~2688-2706).

## Commits

| Task | Type | Hash | Subject |
|------|------|------|---------|
| 1 | feat | 37e2dd34 | add useGhAllData hook + getGhAllData + invalidateGhAllData |
| 2 | feat | 2e512cb0 | add Intl.RelativeTimeFormat-based time-ago helpers |
| 3 | feat | ad84573f | expose useGhAllData public surface via greenhopper barrel + jira.ts |
| post | style | 8f7ae1ee | biome auto-format useGhAllData; align WR-05 comment to analog |

## Verification

- `npx vitest run src/services/jira/greenhopper/useGhAllData.test.ts src/lib/formatTimeAgo.test.ts --reporter=dot` → **21/21 pass**
  - useGhAllData: 4 hook assertions (null/inactive/no-token disabled + enabled exact-args + single call + raw return)
  - getGhAllData: 1 ensureQueryData warm assertion (cache key persisted)
  - invalidateGhAllData: 2 invalidation pattern assertions (all boards + single board)
  - formatTimeAgo + formatTimeAgoStrict: 14 assertions covering all 4 buckets + boundary inputs + future-timestamp clamps
- `npx tsc --noEmit` → **clean** across `taskflow/src`
- `npx biome check src/services/jira.ts src/services/jira/greenhopper/ src/lib/formatTimeAgo.ts` → 0 errors, 1 warning (identical `useExhaustiveDependencies` warning on `transitions.ts:315` — analog-parity, not a regression)

## Acceptance criteria

- [x] `useGhAllData.ts` exports exactly: `useGhAllData`, `getGhAllData`, `invalidateGhAllData`
- [x] Hook key shape `['gh-all-data', boardId]` (grep confirms 5 matches)
- [x] Uses imported `POLL_INTERVAL_MS` + `STALE_TIME_MS` constants
- [x] Hook does not contain `Infinity`, `adaptIssue`, `buildEntityMaps`, `createAdapter` (only `Infinity` mention is a doc comment explaining why we don't use it like transitions does)
- [x] `useGhAllData.test.ts` 7/7 passes; all 4 behavior cases asserted with exact mock call counts
- [x] `formatTimeAgo` + `formatTimeAgoStrict` exported from `@/lib/formatTimeAgo`
- [x] No `date-fns` import (grep clean on source file; only in doc-comment of one variable name has been removed)
- [x] `formatTimeAgoStrict(now)` returns `"0s"`; `formatTimeAgoStrict(now - 90 * 86_400_000)` returns `"90d"` (asserted in tests)
- [x] `Intl.RelativeTimeFormat` used (5 matches in `formatTimeAgo.ts`)
- [x] Barrel append + `jira.ts` re-export — grep confirms 1 barrel match + ≥3 `*GhAllData` matches in `jira.ts`
- [x] `fetchSprintSubtasks` re-export preserved (Plan 03 will delete)
- [x] `fetchAllData` re-export unchanged
- [x] tsc clean, biome clean (0 errors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Symlinked worktree `node_modules` to main repo**
- **Found during:** Task 1 RED phase verification
- **Issue:** The worktree had an empty `node_modules` directory; `vitest`, `@vitejs/plugin-react`, and other test deps were missing, so `npx vitest` failed at config load.
- **Fix:** Symlinked `taskflow/node_modules` in the worktree to `/Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`. This is environment-only — symlink lives inside the worktree filesystem and is not staged.
- **Files modified:** none committed (symlink is a worktree-local artifact and is gitignored in practice — `git status --short` does not flag it)

**2. [Rule 1 - Bug] Removed literal string `"date-fns"` from a comment**
- **Found during:** Task 2 acceptance-criteria verification
- **Issue:** The PLAN acceptance test `grep -r "date-fns" taskflow/src/lib/formatTimeAgo.ts` must return nothing. The doc comment used the literal package name explaining why we don't depend on it, which failed the strict grep.
- **Fix:** Rephrased the comment to "third-party time-format libraries are not project dependencies" — semantically identical, passes the grep gate.
- **Files modified:** `taskflow/src/lib/formatTimeAgo.ts`
- **Commit:** included in 2e512cb0

**3. [Rule 1 - Bug] Reverted ineffective `biome-ignore` comment placement**
- **Found during:** Final verification
- **Issue:** Initially added a `biome-ignore lint/correctness/useExhaustiveDependencies` block above the `useEffect`, which biome flagged as `suppressions/unused` (the ignore must be immediately adjacent to the source line containing the violation, but biome's rule attribution is line-level).
- **Fix:** Removed the suppression and restored the inline WR-05 comment style. The warning now matches the pre-existing analog on `transitions.ts:315` exactly — no new warning category introduced.
- **Files modified:** `taskflow/src/services/jira/greenhopper/useGhAllData.ts`
- **Commit:** 8f7ae1ee

No Rule 4 (architectural) deviations. No checkpoint hits.

## Self-Check

- `taskflow/src/services/jira/greenhopper/useGhAllData.ts` → FOUND
- `taskflow/src/services/jira/greenhopper/useGhAllData.test.ts` → FOUND
- `taskflow/src/lib/formatTimeAgo.ts` → FOUND
- `taskflow/src/lib/formatTimeAgo.test.ts` → FOUND
- Commit 37e2dd34 → FOUND in git log
- Commit 2e512cb0 → FOUND in git log
- Commit ad84573f → FOUND in git log
- Commit 8f7ae1ee → FOUND in git log

## Self-Check: PASSED
