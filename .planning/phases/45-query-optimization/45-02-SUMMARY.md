---
phase: 45-query-optimization
plan: "02"
subsystem: ui-components
tags: [query-optimization, sprint-board, backlog, sidebar-prefetch, concurrency, parallel-queries]
dependency_graph:
  requires:
    - 45-01 (concurrency.ts, useBoardId, fetchSprintStories, fetchSprintSubtasks, fetchBacklogView with boardId)
  provides:
    - SprintBoardTab with parallel stories/subtasks queries and progressive subtask rendering
    - BacklogPage with useBoardId and allEpics-based epic display
    - Sidebar hover/focus prefetch on 5 heavy routes
    - Dev tools concurrency limit selector persisted to settings store
  affects:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/BacklogPage.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/settings/DebugModeSection.tsx
    - taskflow/src/stores/settings.store.ts
tech_stack:
  added: []
  patterns:
    - Split query pattern (stories/subtasks as independent parallel queries)
    - Hover/focus prefetch with 100ms debounce and cleanup
    - Store-synchronized runtime concurrency limiter
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx (parallel queries, useBoardId, subtasksLoading)
    - taskflow/src/routes/dashboard/BacklogPage.tsx (useBoardId, split sprint queries, allEpics epic display)
    - taskflow/src/components/app/Sidebar.tsx (hover/focus prefetch on 5 heavy routes)
    - taskflow/src/routes/settings/DebugModeSection.tsx (jiraConcurrencyLimit Select control)
    - taskflow/src/stores/settings.store.ts (jiraConcurrencyLimit field, version 13)
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx (updated 20 tests for new query split)
    - taskflow/src/routes/dashboard/BacklogPage.test.tsx (added useBoardId, backlog module mocks)
decisions:
  - "p-limit installed here (was added to package.json in Plan 01 but not installed in this worktree)"
  - "storyIssues/subtaskIssues rename to avoid variable collision with stories query result"
  - "BacklogPage imports BacklogViewData from @/services/jira/types (not jira.ts) to match new optional epicNames/epicColors"
  - "BacklogPage imports fetchBacklogView from @/services/jira/backlog (new module) not @/services/jira"
metrics:
  duration: "~16 minutes"
  completed: "2026-03-30"
  tasks_completed: 2
  tasks_total: 3
  files_created: 0
  files_modified: 7
  tests_updated: 36
  tests_total_passing: 817
---

# Phase 45 Plan 02: UI Wiring for Query Parallelization Summary

**One-liner:** SprintBoardTab split into parallel stories/subtasks queries (progressive loading with `subtasksLoading` wired to VirtualizedSwimlanes), BacklogPage uses shared useBoardId hook and allEpics for epic display, Sidebar hover/focus prefetch (100ms debounce) on 5 heavy routes, dev tools concurrency limit selector (1-12, default 6) persisted to settings store and synchronized with the p-limit runtime.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire SprintBoardTab parallel queries and BacklogPage useBoardId | baad23e | SprintBoardTab.tsx, BacklogPage.tsx, package.json |
| 2 | Sidebar prefetch + dev tools concurrency toggle | 80060c0 | Sidebar.tsx, DebugModeSection.tsx, settings.store.ts, SprintBoardTab.test.tsx, BacklogPage.test.tsx |

## What Was Built

### Task 1: SprintBoardTab and BacklogPage

**SprintBoardTab.tsx:**
- Replaced single `fetchSprintIssues` query with two parallel queries:
  - `jira-sprint-stories`: fires immediately when tab active + credentials ready
  - `jira-sprint-subtasks`: enabled only when `parentKeys.length > 0` (after stories resolve)
- `parentKeys` sorted before use in queryKey (Pitfall 1 — stable key prevents cache thrash)
- Combined into `data = stories ? [...stories, ...(subtasksData ?? [])] : undefined` for existing consumers
- `subtasksLoading` wired to `VirtualizedSwimlanes` prop (previously hardcoded `false`) — LOAD-03 progressive rendering now active
- `boardId` from `useBoardId()` replaces `activeSprint?.originBoardId` for quickFilters query
- All `invalidateQueries` updated from old `['jira-issues', 'sprint-board']` to new `['jira-sprint-stories']` + `['jira-sprint-subtasks']`

**BacklogPage.tsx:**
- Added `useBoardId` hook; `boardId` passed to `fetchBacklogView` (not in queryKey — invariant per project/url)
- `enabled` guard on `boardId !== null` prevents query before board ID resolves
- Sprint issues replaced with split `jira-sprint-stories` + `jira-sprint-subtasks` queries (matches SprintBoardTab cache keys)
- Epic display: `epicNames`/`epicColors` built entirely from `allEpics` query (not `backlogView?.epicNames`) — `EpicEnriched.color` field used correctly
- Import updated to `fetchBacklogView` from `@/services/jira/backlog` (new module from Plan 01)
- `BacklogViewData` imported from `@/services/jira/types` to pick up optional `epicNames?`/`epicColors?`

### Task 2: Sidebar Prefetch and Concurrency Toggle

**Sidebar.tsx:**
- Added `useQueryClient`, `useAuthStore`, `useSettingsStore` for prefetch support
- `PREFETCH_ROUTES` set defines the 5 heavy routes: `/dashboard`, `/my-tasks`, `/sprint-board`, `/backlog`, `/epics`
- `prefetchForPath()` dispatches `queryClient.prefetchQuery()` per route with matching query keys
  - `/sprint-board`: jira-sprint-stories + jira-active-sprint + jira-epics-basic + project-statuses
  - `/backlog`: jira-backlog-view (NO boardId, matches BacklogPage key exactly) + jira-epics-basic
  - `/epics`: jira-epics-basic
  - `/my-tasks`: jira-issues/my-tasks
  - `/dashboard`: jira-sprint-stories
- `handleNavMouseEnter`: 100ms `setTimeout` debounce before prefetch fires
- `handleNavMouseLeave`: `clearTimeout` cleanup — no wasted prefetch on quick hover-through
- `handleNavFocus`: immediate prefetch (keyboard navigation)
- Handlers wired onto all nav `NavLink` elements

**settings.store.ts:**
- Added `jiraConcurrencyLimit: number` (default 6) to `SettingsState` and initial state
- `setJiraConcurrencyLimit(v)` action: updates store + calls `setConcurrencyRuntime(v)` from `concurrency.ts`
- Store import: `setJiraConcurrencyLimit as setConcurrencyRuntime` from `../lib/concurrency`
- Persist version bumped to 13 with migration: `jiraConcurrencyLimit = 6` for existing users

**DebugModeSection.tsx:**
- Added `CONCURRENCY_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12]` const
- Added `jiraConcurrencyLimit` / `setJiraConcurrencyLimit` from `useSettingsStore()`
- Added `<Select>` control for concurrency limit under the retention limit control inside developer tools section

## Test Updates

36 tests updated across 2 test files due to the query split refactoring:

**SprintBoardTab.test.tsx (20 tests updated):**
- Added global mocks for `@/services/jira/issues` (fetchSprintStories, fetchSprintSubtasks)
- Added global mock for `@/hooks/useBoardId` (returns `{ boardId: null }`)
- All 20 tests updated to use `fetchSprintStories`/`fetchSprintSubtasks` instead of `fetchSprintIssues`
- Stories and subtasks correctly separated in each test fixture

**BacklogPage.test.tsx (16 tests updated):**
- Added mocks for `@/services/jira/backlog` (fetchBacklogView), `@/services/jira/issues` (fetchSprintStories/Subtasks)
- Added mock for `@/hooks/useBoardId` returning `{ boardId: 1 }` (non-null to unblock query)
- All 16 tests updated to import `fetchBacklogView` from `@/services/jira/backlog`
- Added missing mocks for `fetchEpicsBasic` and `fetchProjectStatuses`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] p-limit not installed in worktree**
- **Found during:** Task 1 TypeScript check
- **Issue:** `concurrency.ts` imports `p-limit` but the package wasn't installed in this worktree (Plan 01 added it to package.json but `npm install` wasn't run)
- **Fix:** `npm install p-limit` in taskflow directory
- **Files modified:** package-lock.json (already in package.json from Plan 01)
- **Commit:** baad23e

**2. [Rule 1 - Bug] Variable name collision: `stories` query result vs `stories` filter variable**
- **Found during:** Task 1 TypeScript check (TS2451: Cannot redeclare block-scoped variable)
- **Issue:** Named the new query result `stories` but the component already had `const stories = localIssues.filter(...)` later in the same scope
- **Fix:** Renamed the local variable to `storyIssues` and `subtaskIssues` to avoid collision
- **Files modified:** SprintBoardTab.tsx
- **Commit:** baad23e

**3. [Rule 1 - Bug] BacklogViewData type mismatch between jira.ts and jira/types.ts**
- **Found during:** Task 1 TypeScript check
- **Issue:** `jira.ts` has `epicNames: Map<string, string>` (non-optional), `jira/types.ts` has `epicNames?: Map<string, string>` (optional). Using wrong type caused TS error
- **Fix:** Import `BacklogViewData` from `@/services/jira/types` (the correct new definition) instead of `@/services/jira`
- **Files modified:** BacklogPage.tsx
- **Commit:** baad23e

**4. [Rule 1 - Bug] `EpicEnriched.epicColor` property doesn't exist — correct name is `color`**
- **Found during:** Task 1 TypeScript check
- **Issue:** Plan spec used `e.epicColor` but `EpicEnriched` interface defines the field as `color`
- **Fix:** Updated to `e.color`
- **Files modified:** BacklogPage.tsx
- **Commit:** baad23e

**5. [Rule 1 - Bug] SprintBoardTab.test.tsx and BacklogPage.test.tsx broken by query split**
- **Found during:** Task 2 test run (test runner crash on issuetype undefined)
- **Issue:** All 20 SprintBoardTab tests and 16 BacklogPage tests used `fetchSprintIssues` mock. After the query split, the new `fetchSprintStories`/`fetchSprintSubtasks` functions were unmocked, causing the component to receive undefined/unresolvable query results
- **Fix:** Added global mocks for new modules; updated all individual tests to mock the split functions; BacklogPage tests also needed `useBoardId` mock returning `boardId: 1` (non-null to unblock query), and `fetchBacklogView` import updated to `@/services/jira/backlog`
- **Files modified:** SprintBoardTab.test.tsx, BacklogPage.test.tsx
- **Commit:** 80060c0

## Checkpoint: Human Verification Required

Task 3 requires browser verification. The following items need manual checking in the running app:

1. **Sprint board progressive loading** — open Network tab, navigate to Sprint Board, verify multiple API calls fire simultaneously and story headers appear before subtask cards
2. **Backlog epic display** — verify epic column shows colored badges from `allEpics` (not blank)
3. **Sidebar prefetch** — hover Sprint Board link ~200ms, verify Network requests fire; click link — page should show cached data immediately
4. **Concurrency selector** — Settings > Advanced > Developer Tools: verify "Jira concurrency limit" select shows "6", persists on change

## Known Stubs

None — no stub patterns or placeholder data in this plan's changes.

## Self-Check: PASSED

- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx contains `queryKey: ['jira-sprint-stories'`
- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx contains `queryKey: ['jira-sprint-subtasks'`
- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx contains `useBoardId(`
- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx contains `subtasksLoading={subtasksLoading}` (not false)
- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx does NOT contain `fetchSprintIssues` import
- [x] taskflow/src/routes/dashboard/SprintBoardTab.tsx contains `.sort()` on parentKeys
- [x] taskflow/src/routes/dashboard/BacklogPage.tsx contains `useBoardId(`
- [x] taskflow/src/routes/dashboard/BacklogPage.tsx contains `boardId` in fetchBacklogView call
- [x] taskflow/src/routes/dashboard/BacklogPage.tsx queryKey is `['jira-backlog-view', activeJiraProject, jiraBaseUrl]` (no boardId)
- [x] taskflow/src/routes/dashboard/BacklogPage.tsx does NOT reference `backlogView?.epicNames`
- [x] taskflow/src/components/app/Sidebar.tsx contains `useQueryClient()` call
- [x] taskflow/src/components/app/Sidebar.tsx contains `onMouseEnter` handler
- [x] taskflow/src/components/app/Sidebar.tsx contains `clearTimeout` cleanup
- [x] taskflow/src/components/app/Sidebar.tsx contains `onFocus` handler
- [x] taskflow/src/components/app/Sidebar.tsx contains `setTimeout(` with `, 100)`
- [x] taskflow/src/components/app/Sidebar.tsx contains `prefetchQuery` calls
- [x] taskflow/src/routes/settings/DebugModeSection.tsx contains `jiraConcurrencyLimit` and `<Select` element
- [x] taskflow/src/stores/settings.store.ts contains `jiraConcurrencyLimit: 6` (default)
- [x] taskflow/src/stores/settings.store.ts contains `setJiraConcurrencyLimit` action
- [x] commit baad23e exists (Task 1)
- [x] commit 80060c0 exists (Task 2)
- [x] 817 tests passing, 0 failures, TypeScript compiles clean
