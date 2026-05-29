---
phase: 73-sprint-board-on-alldata-json
plan: 02
subsystem: dashboard/sprint-board + jira/greenhopper consumer
tags: [greenhopper, sprint-board, useGhAllData, timeInColumn, statusCategory, react-query]
requires:
  - taskflow/src/services/jira/greenhopper/useGhAllData.ts (Plan 01)
  - taskflow/src/lib/formatTimeAgo.ts (Plan 01)
  - taskflow/src/services/jira/greenhopper/adapter.ts (Phase 71)
  - taskflow/src/services/jira/greenhopper/entityMaps.ts (Phase 71)
  - taskflow/src/services/jira/greenhopper/warnOnce.ts (Phase 71)
provides:
  - TaskCard timeInColumn badge slot (UI-SPEC §1)
  - SprintBoardTab single-envelope data layer (useGhAllData + memoised createAdapter)
affects:
  - Plan 03 (toolbar collapse + Sidebar prefetch swap + legacy fetcher deletion)
  - Phase 74 (data.json adoption — pattern set here for memoised adapter)
tech_stack:
  added: []
  patterns:
    - "Caller-side adapter useMemo over allData.issuesData.issues (D-01)"
    - "Sentinel projectId from raw GH envelope, not AdaptedIssue (R-04)"
    - "Orphan-subtask warnOnce observability (D-04b)"
    - "Mocked-identity createAdapter test pattern"
key_files:
  created:
    - taskflow/src/routes/dashboard/TaskCard.test.tsx
  modified:
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
decisions:
  - "TaskCard takes a separate `timeInColumn` prop instead of widening the `issue` type — backward-compat for non-board callers (UI-SPEC option b)"
  - "Adapter pass lives inside SprintBoardTab via useMemo (D-01); hook stays raw"
  - "Sentinel projectId sourced from raw envelope `allData.issuesData.issues[0].projectId` (R-04) — AdaptedIssue does not populate fields.project"
  - "Post-transition + retry-path invalidations also call invalidateGhAllData (Rule 2 — legacy keys would silently no-op otherwise); legacy keys kept until Plan 03 sweeps the toolbar"
  - "Test mocks `@/services/jira/greenhopper/warnOnce` directly so the orphan-subtask call is assertable; the symbol is internal to the GH folder and not re-exported through the jira.ts public surface"
metrics:
  duration: ~20 minutes
  completed: 2026-05-29
  tasks_completed: 2
  files_created: 1
  files_modified: 3
  tests_added: 15
---

# Phase 73 Plan 02: SprintBoardTab onto useGhAllData Summary

**One-liner:** Sprint board now reads a single `allData.json` envelope via `useGhAllData`, adapts in-place via a memoised `createAdapter`, surfaces `timeInColumn` on each card, and preserves every existing feature — the read-side of GH-BOARD-01/02/03/04.

## What shipped

### TaskCard `timeInColumn` badge (UI-SPEC §1 / D-05 / R-03)
- New optional prop `timeInColumn?: { enteredStatus: number; durationPreviously?: number }` — separate from `issue` so non-board callers (backlog, story headers) compile unchanged.
- Badge slot lives inside the existing `shrink-0` row, **after** the story-points chip, **before** the `showStatus` badge — same className as the story-points chip (`text-[11px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 font-mono leading-none`).
- Native `title="Entered status N ago"` tooltip; no Radix Tooltip wrapper (D-05a).
- Uses `formatTimeAgoStrict` (badge text) + `formatTimeAgo` (title) from `@/lib/formatTimeAgo` (Plan 01); no `date-fns` (R-03).
- New `TaskCard.test.tsx` — 3 cases (undefined → no badge, present → strict-format text + title prefix, DOM order story-points → badge → status).

### SprintBoardTab data layer rewrite (D-01/D-03/D-04/D-04b/R-01/R-02/R-04)
- Legacy `useQuery(['jira-sprint-stories', …])` + `useQuery(['jira-sprint-subtasks', …])` removed; replaced with `const { data: allData, … } = useGhAllData(boardId ?? null)`.
- `entityMaps = useMemo(() => allData ? buildEntityMaps(allData) : null, [allData])`.
- `adapt = useMemo(() => entityMaps ? createAdapter({ storyPointsFieldKey, entityMaps }) : null, [storyPointsFieldKey, entityMaps])` — threads `storyPointsFieldKey` per Pitfall 6.
- `adaptedIssues = useMemo(() => allData.issuesData.issues.map(gh => { /* D-04b warnOnce */; return adapt(gh); }))`.
- `data` is `adaptedIssues` whenever `allData` resolved (empty array is the empty-board state).
- **Sentinel projectId** sourced from raw envelope (R-04): `allData?.issuesData.issues[0]?.projectId`. `getTransitions` and `handleReloadWorkflowTransitions` use this — `localIssues[0]?.fields.project?.id` would be `undefined` because `AdaptedIssue` doesn't populate `fields.project`.
- `timeInColumn={card.timeInColumn}` wired through both TaskCard render sites (virtualized + fallback).
- `activeSprint`, `boardQuickFilters`, `epicsBasic`, `projectStatuses` REST queries **kept verbatim** per R-01/R-02/D-09a.
- Toolbar buttons (Refresh + Reload workflow transitions) **untouched** — Plan 03 collapses them into "Reload board".
- Post-transition + retry-path `invalidateQueries({ queryKey: ['jira-sprint-stories' | 'jira-sprint-subtasks'] })` calls augmented with `invalidateGhAllData(queryClient, boardId)` — without this, the new data source would silently no-op on refresh. Legacy keys retained until Plan 03 sweeps them.

### Imports cleanup
- Removed: `fetchSprintStories`, `fetchSprintSubtasks` (from `@/services/jira` import); `STALE_TIME_MS`, `POLL_INTERVAL_MS` (no longer used in-file — `useGhAllData` owns them); `useIsActiveRoute` (the hook handles active-route gating internally).
- Added: `useGhAllData`, `invalidateGhAllData`, `buildEntityMaps`, `createAdapter` (from `@/services/jira`); `warnOnce` (from `@/services/jira/greenhopper/warnOnce` — internal import, GH folder is its own boundary).

### SprintBoardTab.test.tsx
- Test file fully rewritten onto the new mock surface (`useGhAllData` + `buildEntityMaps` + `createAdapter` identity-passthrough + `fetchActiveSprint` + `fetchBoardQuickFilters` + `warnOnce`).
- 12 cases covering: infrastructure (loading/error/empty), statusCategory bucketing across all three buckets, subtask grouping via `fields.parent.key`, orphan-subtask warnOnce assertion (D-04b), timeInColumn badge wired through, legacy fetchers gone (import-time assertion), `useGhTransitions` called with sentinel projectId from raw envelope (R-04), toolbar Reload-workflow click path (Phase 72 carry-forward), BOARD-05 card click.

## Commits

| Task | Type | Hash | Subject |
|------|------|------|---------|
| 1 | test | 9c361e2e | add failing tests for TaskCard timeInColumn badge |
| 1 | feat | 86e4530b | render timeInColumn badge in TaskCard |
| 2 | test | b044c05b | rewrite SprintBoardTab tests onto useGhAllData mock |
| 2 | feat | 37c3e50e | rewrite SprintBoardTab data layer onto useGhAllData |

(SUMMARY.md is intentionally left uncommitted in the worktree per the orchestrator merge contract.)

## Verification

- `npx vitest run src/routes/dashboard/TaskCard.test.tsx src/routes/dashboard/SprintBoardTab.test.tsx --reporter=dot` → **15/15 pass** (3 TaskCard + 12 SprintBoardTab).
- `npx tsc --noEmit` → **clean** across `taskflow/src`.
- `npx biome check src/routes/dashboard/SprintBoardTab.tsx src/routes/dashboard/SprintBoardTab.test.tsx src/routes/dashboard/TaskCard.tsx src/routes/dashboard/TaskCard.test.tsx` → **0 errors, 0 warnings** (project_biome_state 0/0 baseline preserved for these files).

### Acceptance criteria

**Task 1:**
- [x] `grep -E "timeInColumn\??:" taskflow/src/routes/dashboard/TaskCard.tsx` ≥ 1 (prop declared, 1 match)
- [x] `grep -F "formatTimeAgoStrict" taskflow/src/routes/dashboard/TaskCard.tsx` ≥ 1 (2 matches)
- [x] No `date-fns` import in TaskCard.tsx (grep returns 0)
- [x] Three TaskCard test cases (undefined / present / DOM position) green
- [x] tsc clean for TaskCard.tsx + test

**Task 2:**
- [x] `grep -F "useGhAllData(" taskflow/src/routes/dashboard/SprintBoardTab.tsx` ≥ 1 (1 match)
- [x] No code references to `fetchSprintStories` / `fetchSprintSubtasks` in SprintBoardTab (1 match — a comment in a header explaining the removal; no import or call)
- [x] `grep -E "fetchActiveSprint|fetchBoardQuickFilters|fetchEpicsBasic|fetchProjectStatuses"` ≥ 4 (8 matches — R-01/R-02/D-09a kept)
- [x] R-04 sentinel: `allData?.issuesData.issues[0]?.projectId` referenced (2 matches incl. sentinelIssueTypeId fallback)
- [x] `grep -F "warnOnce(" taskflow/src/routes/dashboard/SprintBoardTab.tsx` ≥ 1 (1 match — orphan-subtask call)
- [x] `grep -F "createAdapter(" taskflow/src/routes/dashboard/SprintBoardTab.tsx` ≥ 1 (1 match)
- [x] `grep -F "timeInColumn=" taskflow/src/routes/dashboard/SprintBoardTab.tsx` ≥ 1 (2 matches — both TaskCard render sites)
- [x] Existing + new SprintBoardTab tests green; tsc clean

### Plan-level success criteria

- [x] GH-BOARD-01: legacy `['jira-sprint-stories', …]` + `['jira-sprint-subtasks', …]` useQuery blocks removed; `useGhAllData` is the sole issue source. Legacy `invalidateQueries(['jira-sprint-stories'])` calls remain — they no-op (no consumers) and will be swept in Plan 03 alongside the toolbar.
- [x] GH-BOARD-02: TaskCard renders the `timeInColumn` badge for every adapted issue with `timeInColumn.enteredStatus` (test `forwards timeInColumn from adapted issue into TaskCard`).
- [x] GH-BOARD-03 (per D-03/D-03a): 3-bucket UI preserved; bucketing driven by `statusCategory.key` resolved through Phase 71 entity-maps (the adapter populates `fields.status.statusCategory.key`).
- [x] GH-BOARD-04: filters, saved-filter intersect, `allDoneFingerprint`, sprint goal banner, board-level error state all continue to work — the `localIssues` consumer signature is unchanged (`AdaptedIssue extends JiraIssue`).
- [x] `[[project_biome_state]]` 0/0 baseline preserved on the four edited files.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Symlinked worktree `node_modules` to main repo**
- **Found during:** Pre-Task 1 vitest invocation
- **Issue:** Worktree has no `node_modules` directory; `npx vitest` failed at config load.
- **Fix:** `ln -s /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules <worktree>/taskflow/node_modules`. Symlink is worktree-local and not staged (gitignored in practice).
- **Files modified:** none committed.

**2. [Rule 2 - Missing critical functionality] Augmented post-transition + retry invalidations with `invalidateGhAllData`**
- **Found during:** Post-Task 2 grep audit
- **Issue:** PLAN.md focused on the query swap but said "subtask grouping NO CHANGE." It did not specify that the 4 sites which still invalidate the legacy `['jira-sprint-stories' | 'jira-sprint-subtasks']` keys (post-transition success path, post-flag success path, top toolbar Refresh button, ErrorState/StaleDataBanner Retry paths) would silently no-op against the new data source.
- **Fix:** Added `invalidateGhAllData(queryClient, boardId ?? undefined)` alongside each legacy invalidation. Legacy keys retained so Plan 03's toolbar sweep can remove both in one diff. This is a correctness requirement — without it, drag-to-transition followed by re-render would show stale data until the next 60s poll.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- **Commit:** included in 37c3e50e

**3. [Rule 1 - Bug] Removed `isActive` + `useIsActiveRoute` from SprintBoardTab**
- **Found during:** Post-rewrite tsc check
- **Issue:** PLAN.md left them in but they became dead code after the query swap (`useGhAllData` owns active-route gating internally — same hook used inside `useGhAllData.ts`). tsc raised TS6133 "declared but never read."
- **Fix:** Deleted the import + the `const isActive` line. Behavior unchanged — `useGhAllData` already calls `useIsActiveRoute('/sprint-board')` internally per the Plan 01 hook contract.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- **Commit:** included in 37c3e50e

**4. [Rule 1 - Bug] Removed `STALE_TIME_MS` + `POLL_INTERVAL_MS` imports from SprintBoardTab**
- **Found during:** Same tsc pass
- **Issue:** With the inline useQuery blocks gone, these constants are no longer referenced in-file (`useGhAllData` consumes them internally). Unused-import warnings broke the 0/0 biome baseline.
- **Fix:** Dropped the import. `useGhAllData.ts` (Plan 01) owns the values.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- **Commit:** included in 37c3e50e

**5. [Rule 1 - Bug] Adapted `buildEntityMaps` call shape**
- **Found during:** First post-edit tsc run
- **Issue:** PATTERNS.md and PLAN action steps called `buildEntityMaps(allData.entityData)` — but the actual Phase 71 signature is `buildEntityMaps(allData: GhAllDataResponse)` (full envelope, not just the entityData sub-object).
- **Fix:** Call with `allData` directly. The function's docs confirm it reads `allData.entityData` internally.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- **Commit:** included in 37c3e50e

**6. [Rule 1 - Bug] Updated `getTransitions` to fall back to sentinel projectId**
- **Found during:** Post-rewrite reasoning about non-test-covered paths
- **Issue:** PLAN.md's R-04 note covered the sentinel hook call and the reload handler. `getTransitions(issue)` also reads `issue.fields.project?.id` — that property is also missing from `AdaptedIssue`, so context-menu transitions would silently use projectId 0 for every card.
- **Fix:** `const projectId = Number(issue.fields.project?.id ?? 0) || sentinelProjectId;` — falls back to the raw-envelope sentinel when the adapter didn't populate it.
- **Files modified:** `taskflow/src/routes/dashboard/SprintBoardTab.tsx`
- **Commit:** included in 37c3e50e

**7. [Rule 1 - Bug] Test file `noNonNullAssertion` lint fixes**
- **Found during:** Post-Task 1 biome run
- **Issue:** Initial DOM-order test used `storyPointsChip!.compareDocumentPosition(...)` — biome's `lint/style/noNonNullAssertion` rule flagged it.
- **Fix:** Replaced bang assertions with a typed runtime check (`if (!storyPointsChip || !statusBadge) throw …`).
- **Files modified:** `taskflow/src/routes/dashboard/TaskCard.test.tsx`
- **Commit:** included in 86e4530b

No Rule 4 (architectural) deviations. No checkpoint hits. No auth gates.

## Known Stubs

None. The badge wiring is data-driven — when `timeInColumn` is absent (e.g. the data/backlog adapter, which doesn't carry `timeInColumn`), the badge is silently suppressed per UI-SPEC §1 render condition. That's intentional, not a stub.

## Self-Check

- `taskflow/src/routes/dashboard/TaskCard.test.tsx` → FOUND
- `taskflow/src/routes/dashboard/TaskCard.tsx` → FOUND (modified)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` → FOUND (modified)
- `taskflow/src/routes/dashboard/SprintBoardTab.test.tsx` → FOUND (modified)
- Commit 9c361e2e → FOUND in git log
- Commit 86e4530b → FOUND in git log
- Commit b044c05b → FOUND in git log
- Commit 37c3e50e → FOUND in git log

## Self-Check: PASSED
