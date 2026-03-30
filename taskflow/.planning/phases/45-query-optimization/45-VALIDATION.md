# Phase 45: Query Optimization - Validation Architecture

**Generated:** 2026-03-30
**Phase Goal:** Sprint board and backlog load faster by eliminating sequential API call chains, and sidebar navigation pre-warms the cache

---

## How to Read This Document

Each verification item specifies:
- **What to verify** — the observable behavior or structural property
- **How to verify** — the exact command or grep pattern to run
- **Expected evidence** — what a passing result looks like
- **Failure signal** — what a failing result looks like

All grep commands run from `taskflow/` unless otherwise noted.

---

## Requirement Validations

### QOPT-01: Sprint Board Parallel Queries

**Requirement:** Sprint board loads faster by parallelizing independent API calls (sprint metadata + quick filters fetched simultaneously).

---

#### V-01.1 — `fetchSprintStories` function exists in issues.ts

**What to verify:** The stories-only service function was created (D-01 split).

```bash
grep -n "fetchSprintStories" src/services/jira/issues.ts
```

**Expected evidence:** At least one line showing the function declaration, e.g.:
```
42:export async function fetchSprintStories(
```

**Failure signal:** No output — function was not created or was named differently.

---

#### V-01.2 — `fetchSprintSubtasks` function exists in issues.ts

**What to verify:** The subtasks-only service function was created (D-01 split).

```bash
grep -n "fetchSprintSubtasks" src/services/jira/issues.ts
```

**Expected evidence:** At least one line showing the function declaration.

**Failure signal:** No output.

---

#### V-01.3 — `fetchSprintStories` uses `fetchAllSearchPages` (not a single maxResults call)

**What to verify:** D-10 pagination safety — stories function calls the paginated helper.

```bash
grep -A 30 "function fetchSprintStories" src/services/jira/issues.ts | grep "fetchAllSearchPages"
```

**Expected evidence:** The string `fetchAllSearchPages` appears within the function body.

**Failure signal:** No output — function bypasses pagination, risking dropped results on large sprints.

---

#### V-01.4 — `fetchSprintSubtasks` uses `fetchAllSearchPages` (not a single maxResults call)

**What to verify:** D-10 pagination safety — subtasks function calls the paginated helper.

```bash
grep -A 30 "function fetchSprintSubtasks" src/services/jira/issues.ts | grep "fetchAllSearchPages"
```

**Expected evidence:** The string `fetchAllSearchPages` appears within the function body.

**Failure signal:** No output.

---

#### V-01.5 — SprintBoardTab has two separate query calls for stories and subtasks

**What to verify:** The split queries are wired into the component (D-01, D-02).

```bash
grep -n "jira-sprint-stories\|jira-sprint-subtasks" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** Two lines — one for each query key.

**Failure signal:** Zero lines (split not wired) or only one line (only one side of the split present).

---

#### V-01.6 — Stories query has no dependency on subtasks resolution

**What to verify:** Stories query fires immediately — its `enabled` condition does not reference subtask state (D-02 parallel fire).

```bash
grep -A 10 "jira-sprint-stories" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** The `enabled` condition references only credentials and `activeJiraProject` — no reference to `subtasks`, `parentKeys`, or `boardId`.

**Failure signal:** `enabled` contains a reference to subtask-related state, serializing what should be parallel.

---

#### V-01.7 — Subtasks query is enabled by stories resolution, not by paint

**What to verify:** D-01 specifies "subtask chunk queries fire immediately after stories resolve (not after paint)." The `enabled` flag checks `parentKeys.length > 0` derived from stories data.

```bash
grep -B 5 -A 15 "jira-sprint-subtasks" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** The query's `enabled` condition includes `parentKeys.length > 0` (or equivalent), and `parentKeys` is derived from the resolved `stories` data — not from a `useEffect` or `setTimeout`.

**Failure signal:** `enabled: true` unconditionally, or enabled via a `useEffect` callback (which would delay until after paint).

---

#### V-01.8 — `subtasksLoading` boolean is passed to VirtualizedSwimlanes

**What to verify:** The skeleton infrastructure from Phase 44 is now connected to a real loading state (D-01 LOAD-03 activation).

```bash
grep -n "subtasksLoading" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** At least two lines — one where `subtasksLoading` is assigned from the subtasks `useQuery` result, and one where it is passed as a prop to `VirtualizedSwimlanes`.

**Failure signal:** Zero lines (prop never wired) or only one line (assigned but not passed, or passed but not assigned from query).

---

#### V-01.9 — `fetchBoardQuickFilters` depends on `useBoardId()` result, not `activeSprint?.originBoardId`

**What to verify:** Quick filters unblock earlier because they wait only for board discovery, not for the full sprint fetch (D-02, D-03).

```bash
grep -B 2 -A 8 "jira-board-quickfilters" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** The `boardId` in the `enabled` condition and `queryFn` comes from `useBoardId()` or a variable derived from it — not from `activeSprint?.originBoardId`.

**Failure signal:** `boardId` is still `activeSprint?.originBoardId`, meaning quick filters remain blocked until the full `fetchActiveSprint` resolves.

---

#### V-01.10 — `useBoardId` hook file exists

**What to verify:** The shared hook was created as a standalone file (D-03).

```bash
ls src/hooks/useBoardId.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Expected evidence:** `EXISTS`

**Failure signal:** `MISSING`

---

#### V-01.11 — `useBoardId` uses `staleTime: Infinity`

**What to verify:** Board ID is cached forever per session (D-03).

```bash
grep -n "staleTime.*Infinity\|Infinity.*staleTime" src/hooks/useBoardId.ts
```

**Expected evidence:** One line showing `staleTime: Infinity`.

**Failure signal:** No output — board ID will re-fetch unnecessarily on every navigation.

---

#### V-01.12 — `useBoardId` query key includes `projectKey` and `jiraBaseUrl`

**What to verify:** Per-project scoping is correct — project switch invalidates the cached board ID (Pitfall 4 prevention).

```bash
grep -n "queryKey" src/hooks/useBoardId.ts
```

**Expected evidence:** The query key array contains both `projectKey` (or `activeJiraProject`) and `jiraBaseUrl`.

**Failure signal:** Query key is `['jira-board-id']` alone — a project switch would serve the wrong board ID from cache.

---

#### V-01.13 — Unit tests exist for `fetchSprintStories` and `fetchSprintSubtasks`

**What to verify:** Wave 0 gap was filled — service functions have test coverage.

```bash
grep -n "fetchSprintStories\|fetchSprintSubtasks" src/services/jira/issues.test.ts
```

**Expected evidence:** At least two `describe` or `it` blocks covering each function.

**Failure signal:** No output — tests were not added.

---

#### V-01.14 — Unit tests exist for `useBoardId`

**What to verify:** Wave 0 gap was filled — hook has test coverage including staleTime behavior.

```bash
ls src/hooks/useBoardId.test.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Expected evidence:** `EXISTS`

**Failure signal:** `MISSING`

---

#### V-01.15 — Vitest passes for sprint issues service

**What to verify:** The split did not break existing tests and new tests pass.

```bash
cd taskflow && npx vitest run src/services/jira/issues.test.ts --reporter=verbose 2>&1 | tail -20
```

**Expected evidence:** All tests pass. No `FAIL` lines. The summary shows `0 failed`.

**Failure signal:** Any `FAIL` line — existing tests may have broken when `fetchSprintIssues` was renamed/split.

---

### QOPT-02: Backlog Parallel Queries

**Requirement:** Backlog loads faster by parallelizing independent queries where dependency chains allow.

---

#### V-02.1 — `fetchBacklogView` signature accepts a `boardId` parameter

**What to verify:** D-05 — board discovery is extracted; the function receives `boardId` from the shared hook rather than fetching it internally.

```bash
grep -n "function fetchBacklogView\|fetchBacklogView(" src/services/jira/backlog.ts | head -5
```

**Expected evidence:** The function signature includes a `boardId` or `boardId: number` parameter.

**Failure signal:** The signature matches the old form with no `boardId` parameter — board discovery is still internal.

---

#### V-02.2 — `fetchBacklogView` does NOT contain an internal board discovery `apiFetch` call

**What to verify:** D-05 — the sequential Step 1 (board discovery) was removed from the service function.

```bash
grep -n "agile/1.0/board" src/services/jira/backlog.ts
```

**Expected evidence:** No output (the board API call is gone from backlog.ts).

**Failure signal:** Output showing the board discovery URL is still present — Step 1 was not removed.

---

#### V-02.3 — `fetchBacklogView` does NOT call `fetchAllSearchPages` for epics

**What to verify:** D-04 — Step 4 (internal epic batch fetch) was removed from `fetchBacklogView`.

```bash
grep -c "fetchAllSearchPages" src/services/jira/backlog.ts
```

**Expected evidence:** A count of 1 or 2 (for backlog JQL + possibly sprint issue JQL) — not 3+ which would indicate the epic batch call remains.

**Failure signal:** Count of 3 or more — the epic batch step was not removed.

Manual cross-check — confirm the remaining calls are for backlog/sprint issues, not epics:

```bash
grep -B 2 "fetchAllSearchPages" src/services/jira/backlog.ts
```

**Expected evidence:** Context lines show JQL strings for backlog or sprint issues, not `issuetype = Epic`.

---

#### V-02.4 — `BacklogPage` passes `boardId` from `useBoardId()` to `fetchBacklogView`

**What to verify:** D-05 wiring — BacklogPage consumes the shared hook and passes the result downstream.

```bash
grep -n "useBoardId\|boardId" src/routes/dashboard/BacklogPage.tsx | head -15
```

**Expected evidence:** Lines showing `useBoardId()` is called, `boardId` is destructured from it, and `boardId` appears in the `fetchBacklogView` call or `queryFn`.

**Failure signal:** `useBoardId` is not called in BacklogPage — board discovery is still duplicated.

---

#### V-02.5 — `BacklogViewData` type no longer requires `epicNames` and `epicColors` fields (or they are optional)

**What to verify:** D-04 removes these fields from the return type since `BacklogPage` builds them from `fetchEpicsBasic` cache instead.

```bash
grep -n "epicNames\|epicColors" src/services/jira/backlog.ts
```

**Expected evidence:** Zero lines (fields removed entirely) or lines showing `epicNames?: ...` / `epicColors?: ...` (fields made optional). A non-optional required field here indicates Step 4 was not fully removed.

**Failure signal:** Lines like `epicNames: Record<string, string>` (non-optional required field) — the type still demands the epic batch step.

---

#### V-02.6 — `BacklogPage` builds epicNames and epicColors from `allEpics` query (not from backlogView)

**What to verify:** D-04 consequence — BacklogPage was updated to source epic display data from the `jira-epics-basic` cache rather than the removed Step 4 data.

```bash
grep -n "epicNames\|epicColors\|allEpics" src/routes/dashboard/BacklogPage.tsx | head -15
```

**Expected evidence:** `epicNames` and `epicColors` are built from `allEpics` (the `jira-epics-basic` query result) using a `.reduce()` or similar map-building expression. The `backlogView` variable is NOT referenced for these maps.

**Failure signal:** `epicNames` still assigned from `backlogView.epicNames` — epic column will be permanently blank after Step 4 removal (Pitfall 3).

---

#### V-02.7 — Epic column does not show permanent blank after Step 4 removal

**What to verify:** Pitfall 3 prevention — the epic column in backlog shows epics once the `jira-epics-basic` query resolves, even on cold load.

Manual verification: Load the backlog on cold cache. Observe:
1. Epic column cells show `<Skeleton>` while `allEpics` is loading.
2. Epic column cells populate with correct epic names and colors once `allEpics` resolves.
3. Epic column does NOT remain blank after the page has fully loaded.

**Expected evidence:** Epic badges appear in the backlog's epic column within a few seconds of page load.

**Failure signal:** Epic column remains blank indefinitely — `BacklogPage` is reading from `backlogView.epicNames` which is now empty.

---

#### V-02.8 — `fetchBacklogView` in `backlog.ts` still uses `fetchAllSearchPages` for sprint and backlog issues

**What to verify:** D-10 — pagination was preserved for the remaining queries in `fetchBacklogView`.

```bash
grep -n "fetchAllSearchPages" src/services/jira/backlog.ts
```

**Expected evidence:** At least one (ideally two) calls to `fetchAllSearchPages` remain — one for backlog JQL and one for sprint issue fetching (inside `Promise.all`).

**Failure signal:** Zero calls — pagination was accidentally removed during Step 4 removal.

---

#### V-02.9 — Backlog tests pass after type and signature changes

**What to verify:** Existing tests were updated for the `boardId` parameter and Step 4 removal.

```bash
cd taskflow && npx vitest run src/services/jira/backlog.test.ts --reporter=verbose 2>&1 | tail -20
```

**Expected evidence:** All tests pass. `0 failed`.

**Failure signal:** Any `FAIL` line — tests still reference the old signature or expect `epicNames` in the return value.

---

### QOPT-03: Sidebar Prefetch

**Requirement:** User experiences pre-warmed cache when clicking sidebar navigation (data prefetched on hover/focus).

---

#### V-03.1 — `Sidebar.tsx` calls `useQueryClient()`

**What to verify:** D-06 — the sidebar has access to the query client for prefetching.

```bash
grep -n "useQueryClient" src/components/app/Sidebar.tsx
```

**Expected evidence:** One line importing and one line calling `useQueryClient()`.

**Failure signal:** No output — prefetch cannot work without query client access.

---

#### V-03.2 — `Sidebar.tsx` has `onMouseEnter` handlers on nav links

**What to verify:** D-06 — hover prefetch is wired to nav links.

```bash
grep -n "onMouseEnter" src/components/app/Sidebar.tsx
```

**Expected evidence:** One or more lines showing `onMouseEnter` attached to nav link elements or a wrapper function.

**Failure signal:** No output — hover prefetch was not implemented.

---

#### V-03.3 — `Sidebar.tsx` has `onMouseLeave` cleanup handler

**What to verify:** The hover debounce timer is cancelled on mouse leave (Don't Hand-Roll rule — must use `useRef` + `clearTimeout`).

```bash
grep -n "onMouseLeave\|clearTimeout" src/components/app/Sidebar.tsx
```

**Expected evidence:** Both `onMouseLeave` and `clearTimeout` appear — the timer ref is cleaned up.

**Failure signal:** `onMouseLeave` absent — fast mouse-overs will trigger stale prefetches after the cursor has left (Pitfall: hover debounce without cleanup).

---

#### V-03.4 — `Sidebar.tsx` has `onFocus` handlers for keyboard accessibility

**What to verify:** D-06 — focus-based prefetch fires immediately (no debounce) for keyboard navigation.

```bash
grep -n "onFocus" src/components/app/Sidebar.tsx
```

**Expected evidence:** One or more `onFocus` handlers present on nav links.

**Failure signal:** No output — keyboard users get no prefetch benefit.

---

#### V-03.5 — Hover debounce is 100ms

**What to verify:** D-06 specifies 100ms debounce for hover.

```bash
grep -n "100" src/components/app/Sidebar.tsx
```

**Expected evidence:** A `setTimeout(..., 100)` call in the hover handler.

**Failure signal:** No `100` found — debounce may be absent or set to a different value. (Cross-check: 0ms means every hover fires immediately, which adds unnecessary load.)

---

#### V-03.6 — Prefetch only targets heavy routes (not settings, notifications, or lightweight pages)

**What to verify:** D-07 — prefetch scope is limited to the five heavy routes: sprint board, backlog, epics, my tasks, dashboard.

```bash
grep -n "prefetchQuery\|prefetchForPath" src/components/app/Sidebar.tsx
```

**Expected evidence:** `prefetchQuery` or `prefetchForPath` calls map to route paths that correspond to sprint board, backlog, epics, my tasks, and dashboard only.

Manual cross-check — confirm settings and notifications routes do NOT trigger prefetch:

```bash
grep -n "settings\|notifications" src/components/app/Sidebar.tsx | grep -i "prefetch\|onMouseEnter"
```

**Expected evidence:** No output — settings and notifications nav items have no prefetch handlers.

---

#### V-03.7 — Prefetch uses the same query keys as the destination views

**What to verify:** D-07 / Pitfall 7 — if query keys differ between prefetch and view, the prefetched data is unused and the view re-fetches on navigation.

```bash
grep -n "jira-sprint-stories\|jira-active-sprint\|jira-epics-basic\|project-statuses\|jira-backlog-view" src/components/app/Sidebar.tsx
```

**Expected evidence:** Query keys referenced in `Sidebar.tsx` match the keys used in `SprintBoardTab.tsx` and `BacklogPage.tsx`.

Cross-verify against the destination components:

```bash
grep -n "queryKey.*jira-sprint-stories\|queryKey.*jira-active-sprint\|queryKey.*jira-epics-basic" src/routes/dashboard/SprintBoardTab.tsx
```

**Expected evidence:** The same key strings appear in both files.

**Failure signal:** Key in Sidebar does not match key in destination — prefetch is a no-op (data fetched under a different key is not served to the view).

---

#### V-03.8 — Prefetch staleTime matches destination view staleTime

**What to verify:** Pitfall 7 — if prefetch staleTime is shorter than the destination's staleTime, the prefetched data may be treated as stale and re-fetched on navigation.

```bash
grep -n "STALE_TIME_MS\|staleTime" src/components/app/Sidebar.tsx
```

**Expected evidence:** `STALE_TIME_MS` constant (imported from `query-constants.ts`) is used for prefetch options, not a hardcoded value.

**Failure signal:** A hardcoded shorter staleTime (e.g., `1000`) — prefetched data expires before the user clicks.

---

## Decision Validations

### D-01: Sprint Query Split

#### V-D01.1 — `fetchSprintIssues` is either removed or deprecated (no new callers)

**What to verify:** The old combined function is no longer the primary code path — the split functions replace it.

```bash
grep -rn "fetchSprintIssues" src/
```

**Expected evidence:** Zero lines, OR only lines in the old implementation file itself (if kept for backward compatibility), OR only lines in test files with a deprecation comment. No caller in `SprintBoardTab.tsx`.

**Failure signal:** Active call site in `SprintBoardTab.tsx` or `BacklogPage.tsx` — the split was not wired.

---

#### V-D01.2 — VirtualizedSwimlanes receives a real `subtasksLoading` boolean (not always false)

**What to verify:** LOAD-03 is now active — the skeleton placeholder in subtask cells actually displays.

```bash
grep -n "subtasksLoading" src/components/board/VirtualizedSwimlanes.tsx 2>/dev/null || grep -rn "subtasksLoading" src/
```

**Expected evidence:** `subtasksLoading` prop is accepted by the component AND the value passed from `SprintBoardTab` is derived from the subtasks `useQuery` `isLoading` field — not a hardcoded `false`.

**Failure signal:** `subtasksLoading={false}` hardcoded at the call site, or no reference to `subtasksLoading` in the board component.

---

### D-02: Sprint Board Parallel Fire

#### V-D02.1 — All five sprint board queries have compatible `enabled` conditions (no unnecessary serialization)

**What to verify:** Stories, `fetchActiveSprint`, `fetchEpicsBasic`, and `fetchProjectStatuses` all fire simultaneously on credentials available.

```bash
grep -B 2 -A 12 "useQuery" src/routes/dashboard/SprintBoardTab.tsx | grep -A 10 "queryKey"
```

Review each query's `enabled` condition manually. Expected conditions:
- `jira-sprint-stories`: `isActive && !!activeJiraProject && !!jiraBaseUrl && !!jiraToken`
- `jira-active-sprint`: credentials only
- `jira-epics-basic`: credentials only
- `project-statuses`: credentials only
- `jira-board-quickfilters`: credentials + `boardId` from `useBoardId()`

**Failure signal:** Any of the first four queries has an `enabled` condition referencing another query's data field.

---

### D-03: Shared `useBoardId()` Hook

#### V-D03.1 — `useBoardId` is called in both SprintBoardTab and BacklogPage

**What to verify:** Both views share the same board ID cache, eliminating duplicate board discovery calls.

```bash
grep -rn "useBoardId" src/routes/dashboard/
```

**Expected evidence:** At least two files — `SprintBoardTab.tsx` and `BacklogPage.tsx` — both import and call `useBoardId`.

**Failure signal:** Only one file found — the other view still does board discovery internally or via a different mechanism.

---

#### V-D03.2 — `fetchBoardId` service function extracted from `sprints.ts` or `backlog.ts`

**What to verify:** The board discovery logic is a reusable service function (not inlined in each hook caller).

```bash
grep -rn "fetchBoardId" src/services/jira/
```

**Expected evidence:** The function is defined in a service file and not duplicated.

**Failure signal:** No results — board discovery may still be duplicated inline in the hook.

---

### D-04: Epic Batch Removal from fetchBacklogView

#### V-D04.1 — No `issuetype = Epic` JQL inside `backlog.ts`

**What to verify:** The epic fetch was removed, not just refactored — backlog.ts no longer queries for epics.

```bash
grep -in "epic\|issuetype.*epic" src/services/jira/backlog.ts
```

**Expected evidence:** No JQL strings referencing `issuetype = Epic` or `issuetype in (Epic)`. (Field name strings like `epicLink` are acceptable — they are field references, not queries.)

**Failure signal:** A JQL string with `issuetype = Epic` appears — Step 4 was not removed, or was partially replaced.

---

### D-05: Board Discovery Extracted from fetchBacklogView

(Covered by V-02.1 through V-02.4 above.)

---

### D-06 and D-07: Sidebar Prefetch

(Covered by V-03.1 through V-03.8 above.)

---

### D-08: Global Concurrency Limiter

#### V-D08.1 — `src/lib/concurrency.ts` file exists

**What to verify:** The concurrency module was created.

```bash
ls src/lib/concurrency.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Expected evidence:** `EXISTS`

**Failure signal:** `MISSING`

---

#### V-D08.2 — `concurrency.ts` exports `getJiraLimit` and `setJiraConcurrencyLimit`

**What to verify:** The module API matches what `client.ts` and the dev tools toggle will call.

```bash
grep -n "export function\|export const" src/lib/concurrency.ts
```

**Expected evidence:** Both `getJiraLimit` and `setJiraConcurrencyLimit` are exported.

**Failure signal:** Only one export, or exports have different names — callers will fail to compile.

---

#### V-D08.3 — Default concurrency limit is 6

**What to verify:** D-08 specifies 6 as the default.

```bash
grep -n "pLimit(6)\|pLimit( 6 )" src/lib/concurrency.ts
```

**Expected evidence:** `pLimit(6)` in the module initialization.

**Failure signal:** A different initial value (e.g., `pLimit(10)`) — the default is not as specified.

---

#### V-D08.4 — `fetchAllSearchPages` in `client.ts` wraps `apiFetch` with the limiter

**What to verify:** D-08 — the single control point for Jira API concurrency is in the pagination helper.

```bash
grep -n "getJiraLimit\|jiraConcurrencyLimit" src/services/jira/client.ts
```

**Expected evidence:** `getJiraLimit()` is called inside `fetchAllSearchPages`, and the `apiFetch` call is wrapped with the limiter.

**Failure signal:** No output — the limiter was not wired into the actual HTTP call path. Parallel queries will be unlimited.

---

#### V-D08.5 — p-limit is listed in package.json dependencies

**What to verify:** D-08 / Standard Stack — `p-limit` was installed.

```bash
grep "p-limit" package.json
```

**Expected evidence:** `"p-limit": "^7.3.0"` (or similar) in the `dependencies` section.

**Failure signal:** Not found — `npm install p-limit` was not run. Build will fail at import.

---

#### V-D08.6 — Unit tests exist for concurrency module

**What to verify:** Wave 0 gap was filled — semaphore behavior has test coverage.

```bash
ls src/lib/concurrency.test.ts 2>/dev/null && echo "EXISTS" || echo "MISSING"
```

**Expected evidence:** `EXISTS`

**Failure signal:** `MISSING`

---

#### V-D08.7 — Concurrency tests cover limiting behavior and `setJiraConcurrencyLimit`

**What to verify:** Tests verify that the semaphore actually caps concurrency and that the setter creates a new limiter only when the value changes.

```bash
grep -n "setJiraConcurrencyLimit\|concurrent\|in-flight\|inflight" src/lib/concurrency.test.ts
```

**Expected evidence:** Test descriptions or assertions referencing concurrency limiting behavior and the setter function.

**Failure signal:** Tests exist but only import/export checks — actual limiting behavior is untested.

---

### D-09: Dev Tools Concurrency Toggle

#### V-D09.1 — Concurrency limit control is visible in Settings dev tools

**What to verify:** D-09 — a UI control exists for adjusting the concurrency limit at runtime.

```bash
grep -rn "concurrencyLimit\|setJiraConcurrencyLimit\|concurrency.*limit\|limit.*concurrency" src/routes/settings/
```

**Expected evidence:** At least one settings component references `setJiraConcurrencyLimit` or a store value that feeds into it.

**Failure signal:** No output — dev tools toggle was not added.

---

#### V-D09.2 — Concurrency toggle follows the existing dev tools pattern (Select, not checkbox)

**What to verify:** D-09 references the granular toggle pattern from Phase 42. The research specifies a `<Select>` for numeric values (like `retentionLimit`).

```bash
grep -B 5 -A 10 "setJiraConcurrencyLimit\|concurrencyLimit" src/routes/settings/DebugModeSection.tsx 2>/dev/null || grep -rn "concurrencyLimit" src/routes/settings/
```

**Expected evidence:** A `<Select>` or `<input type="number">` element (not `<input type="checkbox">`) controls the concurrency value.

**Failure signal:** A checkbox is used — inappropriate for a numeric value.

---

#### V-D09.3 — Concurrency limit setting persists to settings store

**What to verify:** The dev tools concurrency value is stored and read from the settings store (consistent with how other dev tool toggles work).

```bash
grep -rn "concurrencyLimit\|jiraConcurrencyLimit" src/stores/ 2>/dev/null || grep -rn "concurrencyLimit" src/
```

**Expected evidence:** The value is read from and written to a settings/debug store, not held only in component state.

**Failure signal:** Value is in-memory component state only — resets to default on settings page remount.

---

### D-10: Pagination Safety

#### V-D10.1 — No direct `apiFetch` with `maxResults` parameter without `fetchAllSearchPages` in modified service files

**What to verify:** D-10 non-negotiable constraint — all search queries use the pagination helper.

```bash
grep -n "maxResults" src/services/jira/issues.ts src/services/jira/backlog.ts src/services/jira/sprints.ts
```

**Expected evidence:** Any `maxResults` references appear only inside the `fetchAllSearchPages` helper itself (in `client.ts`) or as constants passed INTO it — not as the sole pagination mechanism in service functions.

Cross-check that `client.ts` still contains the pagination loop:

```bash
grep -n "startAt\|total\|while\|fetchAll" src/services/jira/client.ts | head -20
```

**Expected evidence:** The pagination loop (`while` or equivalent, checking `total`) remains intact.

**Failure signal:** A service function directly calls `apiFetch` with `maxResults=200` and no loop — results will be silently truncated for projects with more than 200 issues in a sprint or backlog.

---

#### V-D10.2 — `fetchSprintSubtasks` uses chunk-based fetching (not a single flat JQL for all subtasks)

**What to verify:** Subtask fetching remains chunked (inherited from the `SUBTASK_CHUNK_SIZE = 50` constant in `client.ts`) to avoid JQL `IN` clause length limits.

```bash
grep -n "SUBTASK_CHUNK_SIZE\|chunk\|slice" src/services/jira/issues.ts
```

**Expected evidence:** `SUBTASK_CHUNK_SIZE` is referenced, or the function slices `parentKeys` into chunks before firing queries.

**Failure signal:** No chunking logic — a single `parentKey IN (key1, key2, ..., keyN)` JQL with 200+ keys will exceed Jira's URL length limit and fail silently.

---

## Integration Validations

### IV-01: Full Test Suite Green

**What to verify:** All changes integrate without breaking existing tests.

```bash
cd taskflow && npx vitest run 2>&1 | tail -15
```

**Expected evidence:** `0 failed` in the summary line. If any tests reference the old `fetchSprintIssues` signature or the old `fetchBacklogView` return type, they should have been updated.

**Failure signal:** Any `FAIL` line — integration has a regression.

---

### IV-02: TypeScript Compilation Succeeds

**What to verify:** All type changes (BacklogViewData, function signatures, new hooks) are consistent — no implicit `any` or type mismatch errors.

```bash
cd taskflow && npx tsc --noEmit 2>&1 | head -30
```

**Expected evidence:** No output (zero errors).

**Failure signal:** Any TypeScript error — likely candidates are:
- `BacklogPage` still accessing `backlogView.epicNames` after the field was removed
- `fetchBacklogView` call sites missing the new `boardId` parameter
- `VirtualizedSwimlanes` `subtasksLoading` prop type mismatch

---

### IV-03: BacklogPage does not reference the old `['jira-issues', 'sprint-board', ...]` query key

**What to verify:** Pitfall 5 — BacklogPage was updated to read from the new split query keys after the sprint query split.

```bash
grep -n "jira-issues.*sprint-board\|sprint-board.*jira-issues" src/routes/dashboard/BacklogPage.tsx
```

**Expected evidence:** No output — the old combined key is no longer referenced in BacklogPage.

**Failure signal:** The old key is still referenced — status filter in BacklogPage will stop showing subtask statuses after the split.

---

### IV-04: No module-level `pLimit` instantiation outside `concurrency.ts`

**What to verify:** Pitfall 2 prevention — only the singleton module creates `pLimit` instances. Component-level or hook-level instantiation would recreate the limiter on every render.

```bash
grep -rn "pLimit\|p-limit" src/ | grep -v "concurrency.ts\|concurrency.test.ts\|package.json\|node_modules"
```

**Expected evidence:** Zero results — all `pLimit` usage is in `src/lib/concurrency.ts` only.

**Failure signal:** `pLimit(` appears in a component or hook file — concurrency tracking is broken per-instance.

---

### IV-05: Sidebar prefetch is inside `QueryClientProvider` context

**What to verify:** Pitfall 6 — `useQueryClient()` must be called inside the component body, not at module level.

```bash
grep -n "useQueryClient\|queryClient" src/components/app/Sidebar.tsx | head -10
```

**Expected evidence:** `useQueryClient()` is called inside the component function body (line numbers should be within a function block, not at the top of the module).

**Failure signal:** `useQueryClient` is called at module level — this throws at runtime because it is outside the React context tree.

---

### IV-06: Subtask query key uses sorted `parentKeys` to prevent unnecessary refetches

**What to verify:** Pitfall 1 prevention — key stability ensures the same parent set always maps to the same query key.

```bash
grep -n "sort\|\.sort(" src/routes/dashboard/SprintBoardTab.tsx | grep -i "parent\|key"
```

**Expected evidence:** `parentKeys` is sorted before being placed into the query key array.

**Failure signal:** No sort found — `['PROJ-2', 'PROJ-1']` and `['PROJ-1', 'PROJ-2']` would be treated as different cache keys, causing unnecessary re-fetches when story order changes but content does not.

---

### IV-07: Phase gate — full suite passes before verify-work

**What to verify:** The phase is ready for `gsd:verify-work`.

```bash
cd taskflow && npx vitest run 2>&1 | grep -E "Tests|pass|fail" | tail -5
```

**Expected evidence:** `X passed, 0 failed` (where X is the full count).

**Failure signal:** Any failures — phase is not complete.

---

## Verification Summary

| ID | Area | Type | Automated |
|----|------|------|-----------|
| V-01.1 | `fetchSprintStories` exists | Structural | grep |
| V-01.2 | `fetchSprintSubtasks` exists | Structural | grep |
| V-01.3 | Stories uses `fetchAllSearchPages` | Safety (D-10) | grep |
| V-01.4 | Subtasks uses `fetchAllSearchPages` | Safety (D-10) | grep |
| V-01.5 | SprintBoardTab has two query calls | Behavioral | grep |
| V-01.6 | Stories query fires independently | Behavioral | grep + review |
| V-01.7 | Subtasks enabled by stories resolve | Behavioral | grep + review |
| V-01.8 | `subtasksLoading` passed to VirtualizedSwimlanes | Behavioral (LOAD-03) | grep |
| V-01.9 | QuickFilters depends on `useBoardId()` not `activeSprint` | Behavioral | grep |
| V-01.10 | `useBoardId.ts` file exists | Structural | ls |
| V-01.11 | `useBoardId` uses `staleTime: Infinity` | Structural | grep |
| V-01.12 | `useBoardId` query key scoped to project | Safety (Pitfall 4) | grep |
| V-01.13 | Tests for `fetchSprintStories`/`fetchSprintSubtasks` | Coverage | grep |
| V-01.14 | `useBoardId.test.ts` exists | Coverage | ls |
| V-01.15 | Vitest passes for issues.test.ts | Regression | vitest |
| V-02.1 | `fetchBacklogView` accepts `boardId` param | Structural | grep |
| V-02.2 | Board discovery removed from backlog.ts | Behavioral | grep |
| V-02.3 | Epic batch removed from backlog.ts | Behavioral | grep count |
| V-02.4 | BacklogPage passes `boardId` from `useBoardId()` | Behavioral | grep |
| V-02.5 | `BacklogViewData` epic fields removed/optional | Type safety | grep |
| V-02.6 | BacklogPage builds epicNames from `allEpics` | Behavioral | grep |
| V-02.7 | Epic column populates after cold load | Behavioral | manual |
| V-02.8 | Pagination preserved in backlog.ts | Safety (D-10) | grep |
| V-02.9 | Backlog tests pass | Regression | vitest |
| V-03.1 | Sidebar calls `useQueryClient()` | Structural | grep |
| V-03.2 | Sidebar has `onMouseEnter` handlers | Behavioral | grep |
| V-03.3 | `onMouseLeave` cleanup present | Safety (Pitfall) | grep |
| V-03.4 | Sidebar has `onFocus` handlers | Accessibility | grep |
| V-03.5 | Hover debounce is 100ms | Behavioral | grep |
| V-03.6 | Prefetch limited to heavy routes | Scope | grep |
| V-03.7 | Prefetch query keys match destination keys | Correctness | grep + review |
| V-03.8 | Prefetch uses `STALE_TIME_MS` constant | Correctness | grep |
| V-D01.1 | `fetchSprintIssues` no longer called | Structural | grep |
| V-D01.2 | `subtasksLoading` not hardcoded false | Behavioral (LOAD-03) | grep |
| V-D02.1 | All 5 sprint queries have compatible enabled conditions | Behavioral | grep + review |
| V-D03.1 | `useBoardId` called in both SprintBoardTab and BacklogPage | Structural | grep |
| V-D03.2 | `fetchBoardId` service function extracted | Structural | grep |
| V-D04.1 | No epic JQL inside backlog.ts | Behavioral | grep |
| V-D08.1 | `concurrency.ts` exists | Structural | ls |
| V-D08.2 | `concurrency.ts` exports both functions | Structural | grep |
| V-D08.3 | Default limit is 6 | Behavioral | grep |
| V-D08.4 | `fetchAllSearchPages` wraps `apiFetch` with limiter | Behavioral | grep |
| V-D08.5 | `p-limit` in package.json | Structural | grep |
| V-D08.6 | `concurrency.test.ts` exists | Coverage | ls |
| V-D08.7 | Concurrency tests cover limiting behavior | Coverage | grep |
| V-D09.1 | Concurrency toggle in Settings | Structural | grep |
| V-D09.2 | Toggle uses Select not checkbox | Structural | grep |
| V-D09.3 | Toggle persists to settings store | Behavioral | grep |
| V-D10.1 | No bare `maxResults` bypass in service files | Safety (D-10) | grep |
| V-D10.2 | Subtask fetching is chunked | Safety | grep |
| IV-01 | Full vitest suite passes | Integration | vitest |
| IV-02 | TypeScript compilation clean | Type safety | tsc |
| IV-03 | BacklogPage updated to new sprint query keys | Correctness (Pitfall 5) | grep |
| IV-04 | No `pLimit` outside `concurrency.ts` | Safety (Pitfall 2) | grep |
| IV-05 | `useQueryClient` called inside component body | Correctness (Pitfall 6) | grep + review |
| IV-06 | `parentKeys` sorted in query key | Correctness (Pitfall 1) | grep |
| IV-07 | Full suite green (phase gate) | Gate | vitest |

**Manual-only verifications:** V-02.7 (epic column populates on cold load), V-01.6 (review enabled conditions), V-D02.1 (review enabled conditions), V-D09.2 (review Select element).

---

*Phase 45 — Query Optimization*
*Validation architecture generated: 2026-03-30*
