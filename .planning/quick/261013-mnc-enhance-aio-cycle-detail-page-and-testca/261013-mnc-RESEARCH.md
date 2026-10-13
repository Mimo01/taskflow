# Quick 261013-mnc: AIO cycle detail + run detail redesign - Research

**Researched:** 2026-10-13
**Domain:** Tauri + React 19 + Tailwind v4 + TanStack Query v5 + Base UI; AIO TCMS REST (Jira DC plugin)
**Confidence:** HIGH for codebase/primitives/tests, MEDIUM for API fields (the live probe was not run this session, see below)

## Summary

**I could not run a live probe in this session.** The AIO PAT lives only in the app's encrypted Stronghold vault (`readSecret('jira-pat')`). No token is in the environment. Earlier phases probed by having the user run a `probe.sh` with env vars (Phases 85/88/89/90 pattern). I wrote a read-only script for that: `./probe.sh` in this directory. It uses GETs plus the two read-style POSTs the app already sends. The field table below comes from **live probe documents captured by earlier phases**: Phase 58 P4/P5 (2026-05-15), Phase 54 Probe B/C1 (2026-05-13) and Phase 57 API-EXAMPLES. I did not use fixtures or the code's own guesses. Each field is tagged CONFIRMED (seen in a live probe doc), IN-USE (the app already reads it in production with no reported breakage) or UNVERIFIED.

**Biggest finding:** the run-detail endpoint does **not return `testCase` at all.** Probe B lists all top-level keys and `testCase` is not among them. So `run.testCaseKey` is always `''` on the run page today, and that is why the header falls back to "Run 123". The test fixture includes `testCase.title`, which is a fabricated fixture of the kind that caused the Phase 71 problem. To show "key + title" in the header, the run page **must** load the cycle runs list (`testcasewithrun/paged`) and look the run up by `latestTestRun.ID`. Prev/Next needs exactly the same query, so one shared hook solves both.

**Primary recommendation:**
1. Extract a `useAioCycleData(projectKey, cycleKey)` hook. It owns cycle-detail, project-numeric-id, status-map-init, summary and runs, with the **exact existing query keys**. Both pages use it.
2. Extend `normalizeCycle` with the CONFIRMED `/detail` fields: dates, created/updated/closed, `jiraProjectID`, `customFields`, `jiraTaskIDs`, `jiraReleaseIDs`.
3. Extend the run-detail normaliser with `executedByID`, `createdDate`, `testData` and per-step `jiraDefectIDs`.
4. Render owner and objective only if a probe confirms them (conditional rendering keeps this safe).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Cycle header & overview**
- Header: cycle name + key + cycle status pill + Pin button (keep pin behaviour).
- Metadata line under title: folder, date range, owner, etc. — ONLY fields confirmed by live API probe (see below). Missing fields are omitted, never shown as "—" placeholders in the metadata line.
- Row of 4 KPI tiles: **Pass rate**, **Executed** (n/total), **Failing / Blocked**, **Open defects**. Build on existing `EpicStatCard` + `Card` primitives (StatTile/ChartWrapper were DELETED, a guard test enforces that).
- Taller segmented progress bar below tiles with hover tooltips (≤4 rows) per segment. No legend.

**More info — probe the API**
- Researcher probes the live AIO API (raw `/testcycle/{key}/detail`, testcasewithrun/paged, run detail) for unused fields: start/end dates, owner/created by, description/objective, created/updated, environment, etc.
- Planner only surfaces fields that are confirmed present in live responses. Extend `normalizeCycle` / `AioCycle` type accordingly.
- Also derive info from data already fetched (e.g. assignee breakdown, last executed date) where it adds value.

**Executions tab**
- Toolbar: search box (filters on test case key + title) + status chips WITH counts: `All 56 · Pass 46 · Fail 3 · Blocked 2 · Not run 5`. Single-select, "All" is the default (replaces the current multi-toggle chips).
- Sortable columns.
- Rows: one-line div+flex rows (NOT table), coloured status rail on the left edge, key + title, status pill, defect count, run count (×N), assignee avatar+name, executed date.
- Row click opens the run detail (keep existing navigation + breadcrumb push).

**Test run detail**
- Header shows test case key + title (NOT "Run 123"), status pill, and **Prev / Next with position (4/56)** to step through the cycle's runs in the cycle order.
- Two-column layout: main column + right sidebar.
  - Main: step progress summary ("Steps 3/5 passed" + mini bar), steps as cards (Step / Expected / Actual), failed steps visually highlighted, actual result shown when present.
  - Sidebar: status, assignee, executed date, run count, link back to cycle, defects list (compact).
- Must stack to a single column at narrow widths.

**Defects tab**
- Summary strip on top: counts by Jira status category (To Do / In Progress / Done) and by severity.
- Keep the sortable + filterable table behaviour (Status/Priority/Severity/Assignee filters, active chips, clear all) but restyle as one-line flex rows matching Executions.
- "Triggered by" becomes clickable test-case chips that open the corresponding run detail.

### Claude's Discretion
- Exact spacing, typography, icon choices, tile ordering details, empty/loading states, skeleton shapes.
- Whether to extract sub-components into new files (encouraged — AioCycleDetailPage.tsx is 1300 lines).

### Deferred Ideas (OUT OF SCOPE)
Out of scope: AIO Cycles list/dashboard page (just finished in 261013-l97), issue-detail AioTestRunsSection, any write operations to AIO.

### Binding UI rules (CONTEXT specifics)
Colour = status only, no legends, tooltips ≤4 rows; one row = one line (drop columns, density changes padding/font only); div+flex rows with `flex-none` cells + `flex-1 min-w-0` expander; status pills need a flex parent; overlay `absolute inset-0` sibling button for full-row click; `pr-0.5` on italic truncate; no hover layout shift; `<Card>` is `rounded-xl ring-1`; run page must not regress status-map init; Prev/Next must work on deep link; RED+GREEN in one commit; gate Biome on "no NEW files flagged".
</user_constraints>

## 1. API field inventory (what the app drops)

Sources: **P58** = `.planning/milestones/v1.8-phases/58-*/58-PROBE-FINDINGS.md` (live, SHOP-CY-1011, 2026-05-15). **P54B/C1** = `54-*/54-PROBE-FINDINGS.md` (live, 2026-05-13). **API-EX** = `57-*/API-EXAMPLES.md` (live DevTools capture, values anonymised).

### 1a. `GET /rest/aio-tcms-api/1.0/project/{PK}/testcycle/{CK}/detail` (feeds `fetchAioCycleDetail` -> `normalizeCycle`)

| Raw field | Live sample | App today | Status | Use |
|---|---|---|---|---|
| `ID` | `14041` | used (`AioCycle.ID`) | CONFIRMED P58 | — |
| `jiraProjectID` | `10134` | **dropped** | CONFIRMED P58 | Could seed numeric project ID (skip the Jira lookup); keep the existing query for cache parity |
| `key`, `title` | | used | CONFIRMED | — |
| `folder` | `{ID:10763, name:"Thanos Revamp 2026", parentID:10762}` | `.name` used | CONFIRMED P58 | Metadata line: folder name |
| `startDate`, `endDate` | `1777759200000` (epoch ms) | **dropped** | CONFIRMED P58 | Metadata line: date range via `formatCycleDates(start,end,today)` (`@/lib/aio-cycle-list`). Overdue tone via `isOverdue` |
| `createdDate`, `updatedDate` | epoch ms | **dropped** | CONFIRMED P58 | "Updated 3d ago" in metadata/tooltip |
| `closedDate` | epoch ms | **dropped** | CONFIRMED P58 | "Closed Oct 9" when `isClosed` |
| `isClosed` | `true` | used (status fallback) | CONFIRMED | Status pill |
| `isArchived`, `isLockedForEdit`, `isSystemDefined` | bools | dropped | CONFIRMED P58 | Optional "Archived"/"Locked" muted badge; low value |
| `jiraReleaseID` / `jiraReleaseIDs` | `17901` / `[17901]` | **dropped** | CONFIRMED P58 | Numeric Jira version IDs. Would need a Jira version lookup to show a name; skip unless cheap |
| `jiraTaskIDs` | `["347236","360523"]` (string issue IDs) | **dropped** | CONFIRMED P58 | Linked Jira tasks; resolvable via the existing `fetchJiraIssueByKey(id)` (it accepts numeric IDs, same as defects). Optional chip list |
| `jiraComponentIDs`, `tags` | `[]` | dropped | CONFIRMED (empty in sample) | Render only if non-empty |
| `customFields[]` | `{ID,name:"Cycle-Environment",value:[]}`, `{name:"Cycle-Device_Type",value:{ID,value:"Web"}}`, `{name:"Cycle-Browser",value:[{ID,value:"Chrome"}]}` | **dropped** | CONFIRMED P58 | Environment / device / browser. `value` is polymorphic: `[]`, `{value}`, `[{value}]`. Normalise to `string[]`, show `name` minus the `Cycle-` prefix, omit empty ones |
| `ownedByID` | — | — | **UNVERIFIED on /detail**. CONFIRMED on the `testcycle/paged` list (API-EX; the live owner chart was UAT-approved in l97) | Owner. Read optionally from raw `/detail`, and fall back to the cached `['aio', base, 'cycles-detail', PK, *]` list entry when present. Omit otherwise |
| `objective` | — | — | **UNVERIFIED on /detail**. Listed on `paged` (API-EX), null in all samples | Description block only if non-empty |
| `closedByID` | — | — | UNVERIFIED on /detail (API-EX `paged`, null) | skip |
| `status` | absent in P58 excerpt | `toStr(raw.status) ?? isClosed` | — | keep fallback |

### 1b. `POST /rest/aio-tcms/1.0/project/{pid}/testcycle/{cid}/testcasewithrun/paged` (feeds `fetchAioCycleTestCasesWithRuns`, the run order source)

| Raw field | App today | Status | Notes |
|---|---|---|---|
| `test.detail.key`, `test.detail.title` | used | IN-USE (since 260518-ik2) | — |
| `latestTestRun.ID` | used as `AioTestRun.id` | IN-USE | **Absent for cases never run?** UNVERIFIED. If absent, `id === ''` and the row navigates to `/run/`. Guard this (see Pitfall 3) |
| `latestTestRun.testRunStatusID` | used (static `TESTCASE_STATUS_MAP`) | IN-USE | 51 NotRun, 52 InProgress, 53 Pass, 54 Fail, 55 Blocked, 901 N/A→PASS |
| `latestTestRun.allDefects` | used (`jiraDefectIDs`) | IN-USE | — |
| `latestTestRun.updatedDate` | used as `executedDate` (epoch ms → ISO) | IN-USE | — |
| `assignedToID`, `runCount` | used | IN-USE | — |
| `latestTestRun.executedByID`, `latestTestRun.createdDate`, `testRunComments[]`, `testRunAttachments[]` | dropped | **LIKELY**: CONFIRMED on the sibling traceability item `latestTestRun` (P54-C1, same `test/latestTestRun` envelope), not on this endpoint | "Executed by" could differ from assignee. Add as optional, render only if present |
| `test.detail.priority / precondition / description / estimatedEffort` | — | **UNVERIFIED**. `columns` may gate which `test.detail` fields come back (`probe.sh` P2b tests this) | Do not build UI for these without probe output |

### 1c. `GET /rest/aio-tcms-api/1.0/project/{PK}/testcycle/{CK}/testrun/{runId}?assignSteps=true` (feeds `fetchAioTestRunDetail`)

Top-level keys (complete list, P54B): `ID, permission, testRunStatus{ID,name,description}, isAutomated, executedByID, createdDate, updatedDate, jiraDefectIDs, testRunStepsPermission, testRunSteps, dataSetExecutionsCount`. **No `testCase`.**

| Raw field | App today | Status | Use |
|---|---|---|---|
| `executedByID` | **dropped** | CONFIRMED P54B (also P58 P5 on `/testrun` list `runs[]`) | Sidebar "Executed by" with avatar (`fetchJiraUserByUsername`, key `['jira', base, 'user-by-username', id]`) |
| `createdDate` | **dropped** | CONFIRMED | Sidebar "Created" (run started) |
| `updatedDate` | used as executedDate | CONFIRMED | — |
| `isAutomated` | dropped | CONFIRMED | Small "Automated" badge when true |
| `testRunStatus.ID` | dropped (name mapped instead) | CONFIRMED | Map via the **same** ID table as the list (Pitfall 4) |
| `dataSetExecutionsCount` | dropped | CONFIRMED | skip (data-set testing, low value) |
| step `testData` | **dropped** | CONFIRMED P54B | Show a "Test data" block in the step card when non-empty (WikiRenderer) |
| step `jiraDefectIDs` | **dropped** | CONFIRMED P54B | Per-step defect chips. Highlights which step raised a defect |
| step `stepOrder`, `testStepType` | dropped | CONFIRMED | Sort by `stepOrder` defensively; `testStepType` is `"TEXT"`, ignore |
| step `actualResult` | used | CONFIRMED; **absent** when not filled | — |
| step attachments | — | CONFIRMED absent (26 runs) | do not build |

### 1d. `summary/paged`: `estimatedEffort`, `actualEffort`, `assignees`, `totalRuns` were **null in all 7 live samples** (API-EX). Do not build tiles on them. `formatEffort` exists if the probe proves otherwise.

### Derived from already-fetched data (no new API, HIGH value)
- **Last executed:** max `executedDate` over runs (cycle metadata or the Executed tile sub-line).
- **Assignee breakdown:** group runs by `assignedToID`. Reuse `user-by-username` queries (shared cache with the Executions rows).
- **Total executions:** Σ `runCount`. **Re-runs:** count with `runCount > 1`.
- **Fails without defect:** FAIL/BLOCKED runs with `jiraDefectIDs.length === 0` (good tile sub-line: "2 failing without a defect").
- **Open defects:** resolved issues with `statusCategory.key !== 'done'`, from the existing `useQueries` over `issue-lightweight`.

## 2. Reusable primitives (exact paths)

| Need | Import | Notes |
|---|---|---|
| KPI tile geometry | `STAT_CARD_CLASS`, `StatCardBody({label,value,sub})`, `STAT_GRID_CLASS`, `STAT_CONTAINER_CLASS` from `./issue-detail/EpicStatCard` | 72px 3-row tile. `STAT_GRID_CLASS` = 2×2 below 672px container, 4 cols above (needs `@container/epic` ancestor) |
| Tile shell | `Card`, `CardContent` (`@/components/ui/card`) with `size="sm"` | **Copy the `TileShell`/`Tile` pattern** from `AioCyclesDashboard.tsx:62-127` (ambient faint icon + Tooltip on `StatCardBody`). It is file-local there. Either export it or move it to a shared `routes/dashboard/aio/AioTile.tsx` and import it in both files |
| Tooltip | `Tooltip, TooltipTrigger, TooltipContent` (`@/components/ui/tooltip`); `TooltipBody({title,note})`, `TooltipRow({label,value,color})` (`@/components/ui/tooltip-body`) | Pattern: `<TooltipTrigger delay={0} render={<div/>} className=…>` |
| Segment colours, ≤4 rows | `PROGRESS_SEGMENT_CLASS`, `progressTooltipRows(counts)`, `statusLabel`, `type StatusKey` (`@/lib/aio-cycle-list`) | `progressTooltipRows` already merges to ≤4 rows |
| Dates | `toDateKey`, `formatCycleDates`, `isOverdue` (`@/lib/aio-cycle-list`); `formatDateKey`, `formatDateRange` (`@/lib/epic-progress`) | `toDateKey` handles epoch-ms and ISO |
| Pills | `aioRunStatusPillClass`, `aioCycleStatusPillClass`, `statusPillClass(categoryKey)`, `STATUS_PILL_LAYOUT_CLASS`, `tonePillClass(tone)` (`@/lib/statusStyles`) | Full className. Wrap in `<div className="flex">`. No IN_PROGRESS style exists (Pitfall 4) |
| Status labels | `normalizeStatusLabel`, `normalizeStatus`, `normalizeStatusById`, `initializeAioStatusMap` (`@/lib/aioUtils`) | |
| Avatar | `CachedAvatar({url,name,size: 16\|18\|20\|24\|32\|40})` (`@/components/ui/cached-avatar`) | |
| User lookup | `fetchJiraUserByUsername(base, token, id)` (`@/services/jira/users`), key `['jira', base, 'user-by-username', id]`, staleTime 5 min | Same key as `AioCycleList` `OwnerCell`, so the cache is shared |
| Empty/error | `EmptyState({icon,title,subtitle,action})`, `ErrorState({error,onRetry,viewName})` | |
| Tabs | `Tabs, TabsList, TabsTrigger, TabsContent` (`@/components/ui/tabs`) | Tests use `getByRole('tab', {name:'Defects'})` ×55. Keep the tab names |
| Search box | Copy `AioFolderPanel.tsx:140-158` (relative div, `Search` icon absolute, `<input>` + clear `X` button) | Only this hand-rolled pattern exists on AIO pages |
| Flex row columns | `AioCycleList.tsx:40-51` (`CELL_PADDING`, `COL` map with `hidden @[720px]:flex` column drop) + overlay button `:318-322` | Template for Executions/Defects rows: shared `COL` for header + rows, `@container` on the wrapper |
| Issue type / priority icons | `IssueTypeIcon` (`@/components/ui/issue-type-icon`), `PriorityIcon` (`@/components/ui/priority-icon`) | Replace the duplicated local `IssueTypeIcon` copies in both pages |
| Wiki | `WikiRenderer({wikiText})` (`./WikiRenderer`) | Mocked in run tests |

**Guard test:** `routes/dashboard/widget-removal.guard.test.ts` asserts with `fs.existsSync` that deleted widget files are gone. **Do not create** files named `StatTile*` or `ChartWrapper*`, and do not add widgets to `routes/dashboard/index.tsx`.

## 3. Prev/Next and title on deep link (run detail)

The runs query needs three inputs, each from its own query:

```ts
// all keys identical to AioCycleDetailPage.tsx:395-470, so the cache is shared
['aio', base, 'cycle-detail', PK, CK]            -> fetchAioCycleDetail   -> .ID = cycleNumericId
['jira', base, 'project-numeric-id', PK]         -> fetchJiraProjectNumericId (staleTime 1h)
['aio', base, 'status-map-init', PK]             -> initializeAioStatusMap (only needed for summary counts)
['aio', base, 'cycle-summaries', PK, String(cid)]-> fetchAioCycleSummaries
['aio', base, 'runs', PK, CK]                    -> fetchAioCycleTestCasesWithRuns(base, tok, jiraProjectId, cycleNumericId, CK)
                                                    enabled: credGate && !!jiraProjectId && !!cycleNumericId
```

- **Extract** `useAioCycleData(projectKey, cycleKey)` into e.g. `routes/dashboard/aio-cycle/useAioCycleData.ts`. Both pages call it. On the run page the hook is **independent of the cycle page having mounted**, which covers the deep-link and pinned-tab requirement. On navigation from the cycle page every query is a cache hit, so no extra network.
- **Order:** the `runs` array order is the server `rank ASC` (`TESTCASE_SORTING`), which is the cycle order. Compute `navigable = runs.filter(r => r.id)` and `idx = navigable.findIndex(r => r.id === runId)`, then position `${idx+1}/${navigable.length}`. Do not use the cycle page's filtered/sorted view: deep links have no such state.
- **Header title** = `navigable[idx].testCaseKey` + `.testCase.title`. While the runs query is pending, show a skeleton in the title. If the run is not in the list (stale cache), fall back to `Run {runId}` and refetch once.
- Prev/Next: `navigate('/aio-cycle/PK/CK/run/<id>', { replace: true })`. Use **replace** so stepping through 50 runs does not grow history or the breadcrumb trail. Do **not** push breadcrumbs on Prev/Next. Add `ArrowLeft`/`ArrowRight` or `j`/`k` keyboard shortcuts if desired.
- Assignee and run count for the sidebar come from the same runs-list entry (`assignedToID`, `runCount`), not from the run-detail response.

## 4. Tests: what breaks vs. what to keep

**`AioCycleDetailPage.test.tsx` (1593 lines, ~60 tests). Mocks:** `@/services/aio` {fetchAioCycles, fetchAioCycleTestCasesWithRuns, fetchAioCycleDetail, fetchAioCycleSummaries, fetchAioCyclesWithDetail}, `@/services/aio/cycles` {fetchAioProjectConfig}, `@/services/jira` {fetchJiraIssueByKey}, `@/services/jira/projects`, pinned-tabs store. **Any new service import must be added to these `vi.mock` factories.** For example `fetchJiraUserByUsername` from `@/services/jira/users` is currently unmocked and only works because the fixtures have no `assignedToID`.

| Assertion | Will need updating |
|---|---|
| `getByText(/Pass: 1/)`, `/Fail: 2 \(50%\)/`, `/Not Run: 1/` (progress legend) ×~10 | **Yes.** The legend is removed. Assert via tile testids (e.g. `kpi-pass-rate`) and segment `data-testid="progress-seg-pass"` plus tooltip |
| `'No runs recorded'` | keep the text in the empty state if possible |
| `getAllByRole('switch')` ×4 all active; `getByRole('switch',{name:'Fail'})` toggle | **Yes.** Single-select chips: use `role="radiogroup"` with `role="radio"` + `aria-checked`. Rewrite the tests ("All" default, "Fail" shows only FAIL) |
| `/No runs match the selected filters/` | keep the text (adjust the hint to also mention search) |
| `run-row-run-1` testid, click/Enter/Space navigation + breadcrumb push | **Keep** the testid on the row container. With the overlay-button pattern, Enter/Space come free from `<button>`. Put `aria-label="Open run for …"` on the overlay and update tests to target the button |
| `runs-table-skeleton` | keep the testid on the new list skeleton |
| `getByRole('columnheader', {name:'Title'\|'Status'\|'Severity'\|'Triggered By'})` | **Yes**, if the table becomes divs. Either add `role="columnheader"` on the header cells (inside `role="row"`/`role="table"` ARIA) or rewrite. Recommend rewrite to text/testid |
| `defect-row-{id}`, `defect-title-loading-{id}`, `defects-sort-header-{key}`, `defects-sort-indicator-{key}`, `defects-filter-{status,priority,severity,assignee}`, `defects-filter-chip-status-Open`, `defects-filter-clear-all` | **Keep all** (behaviour is locked) |
| `getAllByRole('button', {name: /^Open$/})` (filter popover option) | keep the FilterPopover |
| Defect row `role=button` + Enter/Space opens `onOpenIssue`; key NavLink pushes breadcrumb | keep behaviour. Switch to an overlay button with the NavLink as a sibling (`relative z-10`) |
| Triggered-by text `/PROJ-TC-2/` | text survives as chips. New test: chip click navigates to `/aio-cycle/PROJ/PROJ-CY-2/run/run-2` |
| `Pin cycle`/`Unpin cycle` aria-label, `togglePin` + `setPinnedCycleMeta` | keep |
| status-map init regression test (`initializes the AIO status map itself…`) | **keep**. The hook must still run the init query |

**`AioTestRunDetailPage.test.tsx` (319 lines, 9 tests).** Mocks only `@/services/aio` {fetchAioTestRunDetail} and `@/services/jira` {fetchJiraIssueByKey}. The new hook needs mocks for `fetchAioCycleDetail`, `fetchAioCycleTestCasesWithRuns`, `fetchAioCycleSummaries` (if used), `@/services/aio/cycles` {fetchAioProjectConfig}, `@/services/jira/projects` {fetchJiraProjectNumericId} and `@/services/jira/users`. A missing export in a `vi.mock` factory throws at import.
- `aio-run-detail-title` `toMatch(/263794/)`: **breaks**. It becomes the test case key + title.
- `aio-run-detail-breadcrumb-current` = "Run {runId}": test name says so. Recommend changing to the test case key and updating the test.
- `aio-run-detail-step-table` + `querySelectorAll('tbody tr').length === 2`: **breaks** (steps become cards). Keep the testid on the step list container and count `[data-testid^="run-step-"]`.
- `aio-run-detail-status-chip` text `'Pass'`, `aio-run-defects-section` presence/absence, `Run not found`, defect-click breadcrumb push: keep.
- **Fix the fixture:** remove `testCase` from the `fetchAioTestRunDetail` mock (the live API never returns it, P54B). Supply key and title through the runs mock. This keeps the test honest.

## 5. Pitfalls specific to this work

1. **Fabricated `testCase` on run detail.** Covered above. Any code reading `detail.run.testCaseKey`/`testCase.title` gets `''`/`undefined` live. Source the title from the runs list.
2. **Status-map init on the run page.** The run page does not need `normalizeStatusById` today (it maps by name). If the hook also loads the summary (e.g. a mini cycle bar in the sidebar), it must include the `status-map-init` query and gate on it. Copy `waitingForStatusMap` from `AioCycleDetailPage.tsx:796`.
3. **Empty run id.** `id: String(item.latestTestRun?.ID ?? '')`. A test case without a latest run gets `''`. Make such rows non-clickable (no overlay button), exclude them from Prev/Next, and never navigate to `/run/`.
4. **Status mapping mismatch list vs. detail.**
   - The list maps by ID: 52 → `IN_PROGRESS`, 901 (N/A) → `PASS`.
   - The detail maps by name (`toRunChipStatus`): "In Progress" and "N/A" → `NOT_EXECUTED`.
   - Result: the header pill can disagree with the row it came from.
   - Fix:
     - Export `chipStatusFromId` from `cycles.ts` and use `testRunStatus.ID` first in `fetchAioTestRunDetail`.
     - Add `IN_PROGRESS` to `AIO_RUN_BADGE_STYLES` (blue, matches `PROGRESS_SEGMENT_CLASS.inProgress`).
     - Add it to `normalizeStatusLabel` ("In progress").
   - The Executions chips must account for IN_PROGRESS. Show an "In progress N" chip only when N > 0, otherwise those rows are hidden by every chip except All.
5. **Priority sort is wrong for this Jira.** `PRIORITY_RANK` is Highest..Lowest, but the instance uses a custom 9-level scheme (Blocker > Must > … > Minor, memory), so every live priority sorts to ∞. Existing test 2 asserts High→Medium→Low. Out of scope to redesign. Keep the map and add a fallback that sorts unknown names by `priority.id` [ASSUMED: Jira priority IDs follow scheme order. Verify live] or leave it as is and flag it.
6. **One row = one line.** The current Executions cell stacks the key above the title (two lines). The new row must put key and title on one line: key `flex-none font-mono`, title `flex-1 min-w-0 truncate`. Drop the date, then run count, then assignee columns with `hidden @[Npx]:flex`.
7. **Table-to-flex conversion:** `DefectRow` is `<tr role="button">` with a nested `NavLink`, which is the nested-interactive anti-pattern. Use an overlay sibling button, and give the NavLink `relative z-10` (or `pointer-events-auto` on a `pointer-events-none` cell) so the key link still wins.
8. **Status rail colour = status only.** Use `PROGRESS_SEGMENT_CLASS[normalizeStatus(run.status)]` as a `w-0.5` (or `w-1`) absolute left rail. For not-run, `bg-muted` is near-invisible, which is fine (neutral).
9. **Pills in flex parents.** `aioRunStatusPillClass` spans inside `flex-none` cells need `<div className="flex">` wrappers, as in `AioCycleList.tsx:339`.
10. **`useQueries` defect resolution** uses `fetchJiraIssueByKey(numericId)`. The triggered-by chips need a run lookup by `testCaseKey` → `run.id`. Build a `Map<string, AioTestRun[]>` from `defectId → runs` once (it is O(runs×defects) today, inside render).
11. **Two-column layout must stack on narrow widths.** Use a container query on the page body (`@container` + `@[900px]:grid-cols-[minmax(0,1fr)_280px]`) rather than a viewport `lg:`. The peek/pinned panes are narrower than the window.
12. **Skeleton geometry.** `AioCycleDetailSkeleton` is reused by the run page today. Give the run page its own skeleton (two-column), or add a `variant` prop. Skeleton tiles must use `STAT_CARD_CLASS` so there is no layout shift (l97 precedent: `TileSkeleton`).
13. **Pre-commit** runs full vitest + biome + tsc. Combine test updates with the code change in the same commit (memory: RED commits are blocked).
14. **`customFields[].value` polymorphism.** Normalise defensively (`Array.isArray ? map(v=>v.value) : v?.value ? [v.value] : []`), and never `String(obj)`.

## 6. Recommended file split (discretion)

```
routes/dashboard/aio-cycle/
  useAioCycleData.ts        # shared queries (exact keys above) + derived counts
  CycleHeader.tsx           # title/key/pill/pin + metadata line
  CycleKpiTiles.tsx         # 4 tiles + segmented bar (tile shell moved from AioCyclesDashboard)
  ExecutionsList.tsx        # toolbar (search + radio chips) + sortable flex rows
  DefectsList.tsx           # summary strip + FilterPopover + flex rows + triggered-by chips
  RunStepCard.tsx, RunSidebar.tsx
services/aio/cycles.ts      # normalizeCycle: + startDate,endDate,createdDate,updatedDate,closedDate,jiraProjectID,customFields,jiraTaskIDs,(ownedByID?,objective? optional)
services/aio/issue-steps.ts # RawRunDetail/RawStep: + executedByID, createdDate, isAutomated, testRunStatus.ID, testData, step jiraDefectIDs, stepOrder
services/aio/types.ts       # AioCycle / AioTestRun / AioTestRunStep optional fields
```
Keep the route default exports in `AioCycleDetailPage.tsx`/`AioTestRunDetailPage.tsx` (lazy imports in `routes/routes.tsx:19-20,52-55`). Add unit tests in `services/aio/cycles.test.ts` for the new `normalizeCycle` fields, using the **P58 live JSON verbatim** as the fixture.

## Open Questions

1. **Owner and objective on `/detail`.** P58 shows a "highlights" excerpt without `ownedByID`/`objective`. Recommendation: have the user run `probe.sh` before (or as checkpoint task 0 of) execution. Until then, implement both as optional raw fields that render only when non-empty, plus the cached-list fallback for the owner. Under the omit-when-missing rule this is safe either way.
2. **Do never-run test cases have a `latestTestRun`?** The probe prints the count. The code must handle both cases regardless (Pitfall 3).
3. **Does `columns` gate `test.detail` fields** (priority/precondition)? `probe.sh` P2b answers this. Do not build test-case-priority UI without it.

## Environment Availability

| Dependency | Available | Note |
|---|---|---|
| curl, jq (for probe.sh) | ✓ `/usr/bin/curl`, `/usr/bin/jq` | |
| Live AIO PAT | ✗ for the agent | Stronghold only. The user runs `JIRA_BASE_URL=… JIRA_PAT=… PROJECT_KEY=SHOP CYCLE_KEY=SHOP-CY-1011 ./probe.sh` |
| New npm packages | none needed | No package legitimacy audit required |

## Validation Architecture

| Property | Value |
|---|---|
| Framework | vitest + @testing-library/react (existing) |
| Quick run | `cd taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx src/routes/dashboard/AioTestRunDetailPage.test.tsx src/services/aio/` |
| Full suite | pre-commit hook (vitest + biome + tsc) |

Coverage to add:
- `normalizeCycle` new fields, using the P58 fixture.
- Run-detail normaliser: `executedByID`, `testData`, step defects, status-by-ID.
- Executions:
  - Search filters by key and title.
  - Single-select chip counts.
  - Sort.
  - Empty-id row not clickable.
- Run page:
  - Title from the runs list.
  - Prev/Next position and navigation on deep link with a fresh cache.
- Defects:
  - Status-category/severity strip counts.
  - Triggered-by chip navigates to the run.
- `widget-removal.guard.test.ts` still green.

## Security Domain

Read-only UI. No new endpoints. The PAT stays in Stronghold → `aioFetch` Bearer (apiFetch strips auth from dev-tools logs). New wiki content (`testData`) must go through `WikiRenderer` (rehype-sanitize, P54 T-54-07-01), never `dangerouslySetInnerHTML`. `probe.sh` takes the PAT from env only and writes nothing outside `/tmp`.

## Sources

- `.planning/milestones/v1.8-phases/58-*/58-PROBE-FINDINGS.md`: live `/detail` + `/testrun` shapes (HIGH)
- `.planning/milestones/v1.8-phases/54-*/54-PROBE-FINDINGS.md`: live run-detail keys, step keys, traceability `latestTestRun` (HIGH)
- `.planning/milestones/v1.8-phases/57-*/API-EXAMPLES.md`: live paged/summary captures (HIGH; values anonymised)
- `.planning/quick/261013-jl3-*/261013-jl3-RESEARCH.md`, `261013-l97-*`: date/effort handling, UAT-approved owner chart
- Codebase: `services/aio/{cycles,issue-steps,types}.ts`, `routes/dashboard/{AioCycleDetailPage,AioTestRunDetailPage,AioCyclesDashboard,AioCycleList,AioFolderPanel}.tsx`, `lib/{aio-cycle-list,statusStyles,aioUtils}.ts`, `issue-detail/EpicStatCard.tsx`, both test files, `widget-removal.guard.test.ts`

## Metadata
- API fields: MEDIUM. Live docs are 5 months old and the agent could not re-probe (`probe.sh` provided).
- Primitives/tests/pitfalls: HIGH. Verified by reading the source.
- Valid until: the next AIO plugin upgrade, or until `probe.sh` output arrives.
