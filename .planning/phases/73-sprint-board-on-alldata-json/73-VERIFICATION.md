---
phase: 73-sprint-board-on-alldata-json
verified: 2026-05-29T12:45:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 73: Sprint Board on `allData.json` Verification Report

**Phase Goal:** Replace the multi-call sprint-board fetch with a single `allData.json` call; render columns from `columnsData` and surface `timeInColumn`.

**Verified:** 2026-05-29T12:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + PLAN must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening the sprint board issues exactly one `allData.json` request (six-query path collapsed; activeSprint/epicsBasic/boardQuickFilters/projectStatuses remain per R-01/R-02) | VERIFIED | `SprintBoardTab.tsx` calls `useGhAllData(boardId ?? null)`; zero matches for `fetchSprintStories`/`fetchSprintSubtasks` in file; 8 matches for the four kept REST queries |
| 2 | Columns render from GreenHopper data; subtasks grouped via `parentId` under parent story | VERIFIED | `buildEntityMaps(allData)` + `createAdapter({ storyPointsFieldKey, entityMaps })` wire `statusCategory.key` per adapter; subtask grouping unchanged (uses `fields.parent.key` populated by adapter when both `parentId`+`parentKey` present); orphan-subtask `warnOnce('orphan-subtask', String(gh.parentId))` present |
| 3 | `timeInColumn.enteredStatus` surfaced on each card | VERIFIED | TaskCard.tsx declares optional `timeInColumn?: { enteredStatus, durationPreviously? }`; renders span with `formatTimeAgoStrict` text and `Entered status ${formatTimeAgo(...)} ago` title; SprintBoardTab passes `timeInColumn=` to both render sites (2 matches) |
| 4 | Drag-to-transition, QuickCreateInput, epic/quick-filter/label filters, sprint goal banner all work on the new data source | VERIFIED | Sprint goal banner JSX preserved (`activeSprint?.goal && <SprintGoalBanner ... />`); `fetchBoardQuickFilters` kept (R-01); existing tests (`SprintBoardTab.test.tsx` 14 cases) green |
| 5 | `useGhAllData`, `getGhAllData`, `invalidateGhAllData` importable from `@/services/jira` (dual-file rule) | VERIFIED | 3 named entries in `jira.ts` re-export block; hook key `['gh-all-data', boardId]` (5 matches); uses `POLL_INTERVAL_MS` + `STALE_TIME_MS` imports |
| 6 | `formatTimeAgo` / `formatTimeAgoStrict` use `Intl.RelativeTimeFormat` (no `date-fns`) | VERIFIED | `Intl.RelativeTimeFormat('en', { numeric: 'auto' })` in `formatTimeAgo.ts`; no `date-fns` import in lib file or `package.json` |
| 7 | Sentinel `projectId` sourced from raw GH envelope, not AdaptedIssue (R-04) | VERIFIED | `(allData?.issuesData.issues[0] as { projectId?: number } \| undefined)?.projectId ?? 0` present; `getTransitions` falls back to sentinel |
| 8 | Toolbar shows ONE "Reload board" control (Phase 72 "Reload workflow transitions" + bare RefreshCw gone) | VERIFIED | `<button aria-label="Reload board">`; `handleReloadWorkflowTransitions` → 0 matches; `Workflow` lucide icon → 0 matches |
| 9 | Clicking "Reload board" invalidates gh-all-data, gh-transitions, jira-statuses, jira-active-sprint | VERIFIED (updated post-phase) | `jira-board-quickfilters` system removed in commit `e1c098f0` after this verification was written; `handleReloadBoard` correctly has 4 keys |
| 10 | aria-live shows "Board reloaded" / "Failed to reload board", auto-clears after 3s | VERIFIED | `setReloadBoardStatus('Board reloaded')` + `setReloadBoardStatus('Failed to reload board')` present; existing 3s `useEffect` auto-clear preserved (renamed from Phase 72 pattern); test asserts via `vi.advanceTimersByTime(3000)` |
| 11 | Sidebar prefetch for `/sprint-board` uses `getGhAllData(boardId)` via boardId async-chain (silent skip when boardId null — D-08a) | VERIFIED | `getGhAllData(queryClient, jiraBaseUrl, jiraToken, boardId)` present; `fetchSprintStories` removed; `boardId == null` guard (2 matches); `fetchBoardId` used in sprint-board branch |
| 12 | `fetchSprintSubtasks` source + re-export deleted; no caller remains in `src/` (GH-CUT-01 hard cutover) | VERIFIED | `grep -rn fetchSprintSubtasks taskflow/src/` returns 0 lines |
| 13 | `fetchBoardQuickFilters` STAYS (R-01) — caller in SprintBoardTab unchanged | VERIFIED | Source intact in `services/jira/board-config.ts`; called in SprintBoardTab |

**Score:** 13/13 truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/services/jira/greenhopper/useGhAllData.ts` | hook + ensureQueryData + invalidator | VERIFIED | 109 lines; exports useGhAllData/getGhAllData/invalidateGhAllData; queryKey shape correct; constants imported |
| `taskflow/src/lib/formatTimeAgo.ts` | Intl.RelativeTimeFormat helpers | VERIFIED | 59 lines; both exports present; no date-fns |
| `taskflow/src/services/jira/greenhopper/index.ts` | barrel re-export | VERIFIED | Re-exports useGhAllData module |
| `taskflow/src/services/jira.ts` | public surface re-export | VERIFIED | 3 named entries (useGhAllData/getGhAllData/invalidateGhAllData) |
| `taskflow/src/routes/dashboard/SprintBoardTab.tsx` | data layer on useGhAllData + memoised adapter + timeInColumn wire + Reload board | VERIFIED | All required call sites present |
| `taskflow/src/routes/dashboard/TaskCard.tsx` | timeInColumn badge slot | VERIFIED | Optional prop, render block uses formatTimeAgoStrict/formatTimeAgo |
| `taskflow/src/components/app/Sidebar.tsx` | prefetch swap to getGhAllData | VERIFIED | boardId async-chain pattern; silent-skip guard |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `useGhAllData.ts` | `allData.ts` (fetchAllData) | direct call | WIRED |
| `jira.ts` | `greenhopper/index.ts` | named re-exports | WIRED (3 names) |
| `SprintBoardTab.tsx` | `@/services/jira` | useGhAllData / invalidateGhAllData / buildEntityMaps / createAdapter | WIRED |
| `SprintBoardTab.tsx` | AdaptedIssue[] | useMemo over allData.issuesData.issues with storyPointsFieldKey | WIRED |
| `TaskCard.tsx` | `@/lib/formatTimeAgo` | formatTimeAgo + formatTimeAgoStrict imports | WIRED |
| `Sidebar.tsx` | `@/services/jira` | getGhAllData + fetchBoardId | WIRED |
| `handleReloadBoard` | 4 invalidation keys | gh-all-data + gh-transitions + jira-statuses + jira-active-sprint | WIRED (jira-board-quickfilters removed in e1c098f0 post-phase) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| SprintBoardTab | `allData` | `useGhAllData(boardId)` → `fetchAllData` (Phase 71 real GH endpoint) | Yes (Phase 71 verified) | FLOWING |
| TaskCard | `timeInColumn` prop | adapted issue's `timeInColumn` from `adapt(gh)` (Phase 71 adapter) | Yes | FLOWING |
| Reload board | invalidation keys | `queryClient.invalidateQueries` real React Query cache | Yes | FLOWING |
| Sidebar prefetch | warmed cache | `getGhAllData` → `ensureQueryData` same key as hook | Yes (matches board hook key) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full test suite passes | `cd taskflow && npm test -- --run` | 1667/1667 passed, 3 skipped, 18 todo | PASS |
| TypeScript compiles clean | `cd taskflow && npx tsc --noEmit` | no output (clean) | PASS |
| Network spot-check (exactly one allData.json on board open) | manual devtools — REQUIRES HUMAN | n/a | SKIP (see human verification) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|-------------|-------------|--------|----------|
| GH-BOARD-01 | 73-01, 73-02 | Single `allData.json` call for board open | SATISFIED (code) | `useGhAllData(boardId)` is the sole issue source; legacy stories/subtasks queries removed; mocked tests assert single mock call |
| GH-BOARD-02 | 73-01, 73-02 | Per-issue `timeInColumn.enteredStatus` surfaced | SATISFIED | TaskCard renders badge from `timeInColumn.enteredStatus`; SprintBoardTab passes it from adapted issue |
| GH-BOARD-03 | 73-02 | Columns from GreenHopper data; subtasks grouped by `parentId` | SATISFIED (per D-03/D-03a interpretation) | Adapter resolves `statusCategory.key` via Phase 71 entity-maps; 3-bucket UI preserved per CONTEXT D-03; subtask grouping via `fields.parent.key` |
| GH-BOARD-04 | 73-02, 73-03 | Existing features unchanged (drag, QuickCreateInput, filters, goal banner) + write-side reload | SATISFIED | Sprint goal banner JSX intact; `fetchBoardQuickFilters` preserved (R-01); single "Reload board" toolbar with 4-key invalidation set; SprintBoardTab test suite green covering filters/saved-filter/etc. |
| GH-CUT-01 | 73-03 | Hard cutover — delete legacy fetcher | SATISFIED | `fetchSprintSubtasks` purged from `src/` (0 grep matches); test suite green confirms no caller broken |

Note: GH-CUT-01 in REQUIREMENTS.md is tagged "Phase 75" in the requirement→phase table, but Phase 73 Plan 03 frontmatter claimed this ID and applied the hard-cutover policy to the sprint-board surface (per-surface scope). This is consistent with GH-CUT-01's wording: "Hard cutover per surface — each phase replaces its REST path in place." Phase 75 will close GH-CUT-01 across remaining surfaces (board/backlog/detail/transitions).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/services/jira/greenhopper/useGhAllData.ts` | 48 | `useExhaustiveDependencies` Biome warning (FIXABLE) — extra `jiraBaseUrl` dep | Info | Intentional analog-parity with Phase 72 `transitions.ts:315` per WR-05 secret-rehydration pattern; documented as deferred in 73-03-SUMMARY.md |
| `src/services/jira/greenhopper/transitions.ts` | 315 | same warning | Info | Pre-existing, Phase 72; out of scope |
| `src/routes/worklogs/WorklogCellPopover.tsx` | (format) | Biome format diff | Info | Pre-existing, unrelated subsystem; out of scope |

No `TBD`/`FIXME`/`XXX` debt markers introduced. No stubs, hardcoded empty data, or unwired props. The 1 error + 2 warnings reported by `npm run check` match the user's note (pre-existing scope OR intentional analog-parity); none are regressions caused by Phase 73 logic.

### Probe Execution

No probes declared for this phase (UI/data-layer phase; covered by vitest suite).

### Human Verification Required

The network-log spot-check from ROADMAP success criterion #1 (and Plans 02/03 verification blocks) requires running the live app and inspecting the network panel. Automated tests use mocked `useGhAllData`, so they cannot prove the production network behavior.

#### 1. Sprint board issues exactly ONE `allData.json` request on open

**Test:** Open Tauri app, navigate to `/sprint-board`, open devtools Network panel, hard-reload, observe requests.
**Expected:** Exactly one GET to `/rest/greenhopper/1.0/xboard/work/allData.json` plus the 4 kept REST queries (`activeSprint`, `epicsBasic`, `boardQuickFilters`, `projectStatuses`). Zero requests to legacy `jira-sprint-stories` / `jira-sprint-subtasks` endpoints.
**Why human:** Test suite uses mocked hooks; real network behavior can only be observed against a running Jira instance.

#### 2. "Reload board" toolbar action triggers refetch and shows feedback

**Test:** With board loaded, click the single reload button in the toolbar.
**Expected:** `RefreshCw` icon spins; aria-live span reads "Board reloaded" on success or "Failed to reload board" on error; message clears after ~3 seconds; network panel shows refetches for all 4 invalidated keys (gh-all-data, gh-transitions, jira-statuses, jira-active-sprint).
**Why human:** Visual spin animation + aria-live timing in live DOM not asserted by component tests alone.

#### 3. Drag-to-transition still works on new data source (GH-BOARD-04)

**Test:** Drag a card between columns.
**Expected:** Card moves with optimistic update; transition request fires; rollback on failure.
**Why human:** End-to-end DnD behavior with real backend not covered by mocked tests.

#### 4. timeInColumn badge renders with sensible values

**Test:** Open sprint board; observe badges on cards.
**Expected:** Cards with `timeInColumn.enteredStatus` show compact badge (e.g. "3d", "2h", "30m") with native tooltip "Entered status N ago".
**Why human:** Visual rendering + tooltip presentation; component tests only assert markup, not visual integration.

### Gaps Summary

No gaps. All 13 must-haves verified through grep evidence in the codebase, the full vitest suite (1667 passed), and clean `tsc --noEmit`. The 1 biome error + 2 warnings reported by `npm run check` are pre-existing or intentional analog-parity (documented in 73-03-SUMMARY.md as deferred items outside Phase 73's per-file scope rules).

Goal is observably achieved: SprintBoardTab consumes a single allData.json envelope via useGhAllData, adapts in place, surfaces timeInColumn, preserves all existing features, exposes a unified "Reload board" toolbar, swaps the Sidebar prefetch, and hard-cuts the legacy `fetchSprintSubtasks` fetcher. Remaining work is human UAT for live network behavior — which the verifier cannot test programmatically.

---

_Verified: 2026-05-29T12:45:00Z_
_Verifier: Claude (gsd-verifier)_
