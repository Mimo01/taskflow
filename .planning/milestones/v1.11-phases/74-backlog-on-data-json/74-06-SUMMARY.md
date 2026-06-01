---
phase: 74-backlog-on-data-json
plan: 06
subsystem: services/jira (backlog cutover)
tags: [GH-CUT-01, D-09, D-09a, backlog, cleanup, lint-guard]
requirements:
  completed: [GH-BACKLOG-01, GH-BACKLOG-02, GH-CUT-01]
dependencies:
  requires: [74-01, 74-02, 74-03, 74-04, 74-05]
  provides: ["services/jira/backlog.ts trimmed to fetchSprintList", "services/jira.ts free of legacy backlog surface", "scripts/check-legacy-backlog-keys.mjs wired to npm run check:legacy-backlog"]
  affects: [services/jira/backlog.ts, services/jira/types.ts, services/jira.ts, services/jira/epics.ts, components/app/RecentItemsPopover.tsx, components/app/Sidebar.test.tsx, components/app/__tests__/Sidebar.prefetch.test.tsx, main.tsx, routes/dashboard/issue-detail/FieldsSection.tsx, routes/dashboard/issue-detail/useFieldMutation.ts, routes/dashboard/create-edit-issue/useIssueMutations.ts, services/jira/backlog.test.ts, package.json]
tech-stack:
  added: []
  patterns:
    - "Static grep guard wired via package.json script — locks legacy symbol deletion in (T-74-13 mitigation)"
    - "Synthetic JiraIssue adaptation from GhIssue { key, summary } for recent-items title resolution"
    - "invalidateGhBacklogData(qc[, boardId]) replaces six legacy ['jira-backlog-*'] invalidations across 5 mutation sites"
key-files:
  created:
    - .planning/phases/74-backlog-on-data-json/74-06-SUMMARY.md
    - .planning/phases/74-backlog-on-data-json/74-06-AUDIT.txt
    - .planning/phases/74-backlog-on-data-json/deferred-items.md
  modified:
    - taskflow/src/services/jira/backlog.ts (trimmed 305 lines → ~60; only fetchSprintList survives per D-09a)
    - taskflow/src/services/jira.ts (deleted fetchBacklogIssues, fetchBacklogView, BacklogViewData — 320 lines removed from dual surface)
    - taskflow/src/services/jira/types.ts (BacklogViewData declaration removed)
    - taskflow/src/services/jira/epics.ts (stale JSDoc reference scrubbed)
    - taskflow/src/services/jira/backlog.test.ts (dropped doomed-fetcher test blocks; only fetchSprintList tests remain)
    - taskflow/src/components/app/Sidebar.test.tsx (dead-mock cleanup)
    - taskflow/src/components/app/__tests__/Sidebar.prefetch.test.tsx (post-cutover contract — assertions against deleted symbols removed; static guard now enforces the "zero legacy calls" arm)
    - taskflow/src/components/app/RecentItemsPopover.tsx (cache-resolver swapped to ['gh-backlog'])
    - taskflow/src/main.tsx (title-resolver + handleCreateModalClose swapped to gh-backlog cache)
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx (transition + sprint-move mutations use invalidateGhBacklogData)
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts (field-update mutation uses invalidateGhBacklogData)
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts (create/edit submit uses invalidateGhBacklogData)
    - taskflow/package.json (added "check:legacy-backlog" script)
    - taskflow/src/routes/worklogs/WorklogCellPopover.tsx (Rule-3 unblocker: pre-existing formatter drift)
    - taskflow/src/services/jira/greenhopper/types.ts (Rule-3 unblocker: pre-existing formatter drift)
decisions:
  - "BacklogViewData declaration is in services/jira/types.ts (RESEARCH had said backlog.ts:8 — that was the IMPORT, not the declaration). Adjusted scope to also delete the types.ts interface — pure naming correction, no architectural change."
  - "Five extra production call sites still used the legacy ['jira-backlog-*'] cache keys (RecentItemsPopover, main.tsx ×2, FieldsSection ×2, useFieldMutation, useIssueMutations). RESEARCH only flagged the BacklogPage rewrite; these are Rule 1 fixes against stale invalidations that would silently no-op post-cutover."
  - "Pre-existing biome formatter drift in two unrelated files (WorklogCellPopover.tsx, greenhopper/types.ts) was Rule-3 unblocker — without restoring 0-errors baseline the plan's biome gate could not pass. Pure whitespace, no semantic impact."
metrics:
  duration: ~25min
  completed: 2026-05-29
  tasks: 4
  commits: 4
---

# Phase 74 Plan 06: Backlog Legacy REST Cutover Summary

Hard-deletes the four legacy Jira backlog REST symbols (`fetchBacklogIssues`, `fetchBacklogSprintStories`, `fetchBacklogView`, `BacklogViewData`) per GH-CUT-01 / D-09, swaps five remaining production cache-invalidation sites to `invalidateGhBacklogData`, and wires the Plan 01 static-grep guard into npm so the symbols cannot reappear.

## What Was Built

- **`services/jira/backlog.ts` reduced to one function.** Only `fetchSprintList` survives (D-09a — `FieldsSection.tsx` sprint picker still uses it). The other three legacy fetchers and their unused imports (`ApiError`, `fetchAllSearchPages`, `isResponseLikeError`, `JiraIssue`, `BacklogViewData`) are gone.
- **`services/jira.ts` dual-file surface stripped** of `fetchBacklogIssues`, `fetchBacklogView`, and the `BacklogViewData` interface (~320 lines deleted). `fetchSprintsForBoard`, `moveIssuesToBacklog`, and the new `useGhBacklogData` / `getGhBacklogData` / `invalidateGhBacklogData` re-exports are preserved untouched.
- **`services/jira/types.ts` declaration deleted.** No remaining importer once Plan 06 removed `services/jira/backlog.ts:8`.
- **Five production cache-invalidation sites migrated** from the legacy `['jira-backlog-issues']` / `['jira-backlog-sprint-stories']` keys to `invalidateGhBacklogData(queryClient[, boardId])`. Without this swap the mutations would have silently no-op'd against a stale legacy cache.
- **Two title-resolver caches (`main.tsx` + `RecentItemsPopover.tsx`) rewired** to read from the new `['gh-backlog', boardId]` envelope (`GhBacklogResponse.issues` → `GhIssue { key, summary }`). The recent-items popover now reconstructs a minimal `JiraIssue { fields: { summary } }` shim for its `.fields.summary` consumer.
- **Static-grep guard active.** `npm run check:legacy-backlog` walks `taskflow/src/**/*.{ts,tsx}` (excluding tests, `__tests__/`, `scripts/`) and exits 1 if any of the four banned tokens reappear. Plan 01's script unmodified; only `package.json` gained the entry.

## Why It Was Built

GH-CUT-01 ("Legacy code removed and unreachable") is the only Phase 74 requirement that is satisfied by deletion, not addition. Plans 03/04 swapped the live call sites; Plan 06 makes the cutover irreversible by deleting the surface and installing a CI-style tripwire.

The five additional invalidation swaps were Rule-1 fixes — RESEARCH had identified BacklogPage as the only legacy-key consumer, but the static-grep guard surfaced six more legacy-key references during Task 4 verification. Leaving them in place would have silently broken mutation freshness after Plan 03's data-source cutover (mutations would invalidate a cache key that no longer exists, so the new `['gh-backlog']` cache would stay stale until manual reload).

## Tasks Completed

| Task | What                                                                                                | Commit     | Files                                                                                                                                                                                                            |
| ---- | --------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Pre-delete grep audit confirming zero production callers; fetchSprintList still wired to FieldsSection | `ce787dd6` | `.planning/phases/74-backlog-on-data-json/74-06-AUDIT.txt`                                                                                                                                                       |
| 2    | Delete legacy fetchers from `services/jira/backlog.ts`; trim test file; clean dead mocks            | `81a506f4` | `services/jira/backlog.ts`, `services/jira/backlog.test.ts`, `components/app/Sidebar.test.tsx`, `components/app/__tests__/Sidebar.prefetch.test.tsx`                                                             |
| 3    | Delete legacy surface from `services/jira.ts`, `types.ts`; scrub JSDoc references                   | `0172e220` | `services/jira.ts`, `services/jira/types.ts`, `services/jira/epics.ts`                                                                                                                                           |
| 4    | Wire grep guard via `package.json`; swap five production cache-invalidation sites to gh-backlog     | `2c912186` | `package.json`, `main.tsx`, `RecentItemsPopover.tsx`, `FieldsSection.tsx`, `useFieldMutation.ts`, `useIssueMutations.ts`, `services/jira/backlog.ts` (comment), `WorklogCellPopover.tsx`, `greenhopper/types.ts` |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Stale cache keys] Five extra production sites referenced legacy backlog cache keys**

- **Found during:** Task 4 — running `check:legacy-backlog` against the freshly-trimmed tree surfaced 8 production hits the planner had not anticipated.
- **Issue:** RESEARCH only flagged BacklogPage as a legacy-key consumer, but `main.tsx` (handleCreateModalClose + title resolver), `RecentItemsPopover.tsx` (title resolver), `FieldsSection.tsx` (two mutation onSettled handlers), `useFieldMutation.ts` (mutation onSettled), and `useIssueMutations.ts` (create/edit onSuccess) all still invalidated the deleted `['jira-backlog-issues']` / `['jira-backlog-sprint-stories']` keys.
- **Fix:** Imported `invalidateGhBacklogData` from `@/services/jira` and replaced each invalidation block with a single call (passing `boardId` where in scope, otherwise the all-boards overload). For the two title-resolver paths, rewrote the cache lookup to read from `['gh-backlog']` envelopes and adapt the `GhIssue { key, summary }` shape into the minimal `JiraIssue { fields: { summary } }` the consumers want.
- **Files modified:** `main.tsx`, `RecentItemsPopover.tsx`, `FieldsSection.tsx`, `useFieldMutation.ts`, `useIssueMutations.ts`.
- **Commit:** `2c912186`.

**2. [Rule 1 — RESEARCH correction] BacklogViewData declaration lives in `services/jira/types.ts`, not `backlog.ts:8`**

- **Found during:** Task 1 grep audit.
- **Issue:** RESEARCH §"Common Pitfalls #3" said `BacklogViewData` was referenced only at `services/jira/backlog.ts:8` — true, but that's the IMPORT, not the declaration. The declaration is at `services/jira/types.ts:210`, with a duplicate in the dual-file `services/jira.ts:2149`.
- **Fix:** Extended deletion to also drop the `types.ts` declaration (no remaining importer). Pure naming correction, no architectural change.
- **Files modified:** `services/jira/types.ts`.
- **Commit:** `0172e220`.

**3. [Rule 3 — Pre-existing baseline drift unblocking `biome check .`] Two unrelated files had drifted formatter output**

- **Found during:** Task 4 acceptance verification.
- **Issue:** `WorklogCellPopover.tsx` and `services/jira/greenhopper/types.ts` had Prettier-style formatter drift that pre-dated Plan 06. The husky pre-commit hook only runs `biome check --staged`, so these slipped past every commit since the 2026-05-28 baseline. Plan 06's acceptance gate explicitly requires `biome check .` 0 errors.
- **Fix:** Ran `biome format --write` on the two files. Pure whitespace, no semantic change. Documented in `deferred-items.md`.
- **Files modified:** `WorklogCellPopover.tsx`, `services/jira/greenhopper/types.ts`.
- **Commit:** `2c912186`.

**4. [Rule 1 — Dead JSDoc references] Two JSDoc comments referenced the deleted `fetchBacklogView`**

- **Found during:** Task 3.
- **Issue:** `services/jira/epics.ts:84` and `services/jira.ts:2515` both contained `"Two-query pattern (mirrors fetchBacklogView):"` — dangling reference to a function that no longer exists.
- **Fix:** Reworded to `"Two-query pattern:"`.
- **Files modified:** `services/jira/epics.ts`, `services/jira.ts`.
- **Commit:** `0172e220`.

## Deferred Issues

Four pre-existing `useExhaustiveDependencies` biome warnings remain in files unrelated to GH-CUT-01 (per `<deviation_rules>` scope-boundary). Documented in `.planning/phases/74-backlog-on-data-json/deferred-items.md`:

- `src/routes/dashboard/SprintBoardTab.tsx:723`
- `src/services/jira/greenhopper/transitions.ts:315`
- `src/services/jira/greenhopper/useGhAllData.ts:48`
- `src/services/jira/greenhopper/useGhBacklogData.ts:56`

All four are biome-marked **Unsafe fix** — and `useGhBacklogData.ts:56` explicitly comments that `[jiraBaseUrl]` is INTENTIONAL (re-read the secret on instance change). Recommend addressing in a dedicated lint-clean follow-up plan rather than risking semantic breakage here. This means the plan's `biome check .` gate currently reports 4 warnings (errors=0 — clean). The plan baseline requirement was "0 errors / 0 warnings" — the warnings predate Plan 06 and are out of scope to fix, but flagging this drift explicitly.

## Verification Results

| Gate                                                                                       | Result        |
| ------------------------------------------------------------------------------------------ | ------------- |
| `grep -cE "^export (async )?function (fetchBacklogIssues\|fetchBacklogSprintStories\|fetchBacklogView)" src/services/jira/backlog.ts` | 0 ✓           |
| `grep -cE "^export (async )?function fetchSprintList" src/services/jira/backlog.ts`        | 1 ✓           |
| `grep -cE "fetchBacklogIssues\|fetchBacklogSprintStories\|fetchBacklogView\|BacklogViewData" src/services/jira.ts` | 0 ✓           |
| `grep -q "fetchSprintList" src/services/jira.ts`                                           | ✓ (kept)      |
| `grep -q "useGhBacklogData" src/services/jira.ts`                                          | ✓ (kept)      |
| `grep -cE "BacklogViewData" src/services/jira/types.ts`                                    | 0 ✓           |
| `grep -cE "check:legacy-backlog" taskflow/package.json`                                    | 1 ✓           |
| `npm run check:legacy-backlog`                                                             | exit 0 ✓ "OK" |
| `npx tsc --noEmit`                                                                         | exit 0 ✓      |
| `npm test` (full vitest suite)                                                             | 1656 passed / 2 skipped / 18 todo / 3 skipped files — 147 of 150 files pass ✓ |
| `npx biome check .`                                                                        | 0 errors / 4 warnings (deferred, see above) ⚠                                |

## Threat Model Mitigation

| Threat ID | Status   | Mitigation Evidence                                                                                                                       |
| --------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| T-74-13   | mitigated | `npm run check:legacy-backlog` exits 1 on any reintroduction of the four banned tokens; entry added to `package.json` for CI/local use.   |
| T-74-14   | mitigated | Task 3 grep gate `fetchBacklogIssues\|fetchBacklogSprintStories\|fetchBacklogView\|BacklogViewData` returns 0 against `services/jira.ts`. |
| T-74-15   | mitigated | Task 1 grep confirms `FieldsSection.tsx:32` still imports `fetchSprintList`; Task 2 grep gate confirms the declaration remains in `backlog.ts`. |
| T-74-SC   | mitigated | No new dependencies — the guard is a vanilla Node ESM script using only `node:fs/promises` and `node:path`. `package.json` script entry is a single-line addition.                                                                |

## Self-Check: PASSED

- File `.planning/phases/74-backlog-on-data-json/74-06-SUMMARY.md` — FOUND
- File `.planning/phases/74-backlog-on-data-json/74-06-AUDIT.txt` — FOUND
- File `.planning/phases/74-backlog-on-data-json/deferred-items.md` — FOUND
- Commit `ce787dd6` (Task 1 audit) — FOUND
- Commit `81a506f4` (Task 2 backlog.ts trim) — FOUND
- Commit `0172e220` (Task 3 jira.ts/types.ts trim) — FOUND
- Commit `2c912186` (Task 4 guard wiring + cache-key swap) — FOUND
- `fetchBacklogIssues` / `fetchBacklogSprintStories` / `fetchBacklogView` / `BacklogViewData` absent from `services/jira/backlog.ts`, `services/jira.ts`, `services/jira/types.ts` production source — VERIFIED
- `fetchSprintList` still imported by `routes/dashboard/issue-detail/FieldsSection.tsx:32` — VERIFIED
- `npm run check:legacy-backlog` exits 0 — VERIFIED
- Full vitest suite 1656 passing — VERIFIED
