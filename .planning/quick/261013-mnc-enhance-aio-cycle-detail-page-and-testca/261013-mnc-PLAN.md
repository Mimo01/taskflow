---
phase: quick-261013-mnc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/services/aio/types.ts
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/services/aio/cycles.test.ts
  - taskflow/src/services/aio/issue-steps.ts
  - taskflow/src/services/aio/issue-steps.test.ts
  - taskflow/src/services/aio/testcases.ts
  - taskflow/src/services/aio/testcases.test.ts
  - taskflow/src/services/aio/index.ts
  - taskflow/src/lib/statusStyles.ts
  - taskflow/src/lib/aioUtils.ts
  - taskflow/src/lib/aio-defect-sort.ts
  - taskflow/src/lib/aio-defect-sort.test.ts
  - taskflow/src/routes/dashboard/aio-cycle/useAioCycleData.ts
  - taskflow/src/routes/dashboard/aio-cycle/useCycleDefects.ts
  - taskflow/src/routes/dashboard/aio-cycle/AioTile.tsx
  - taskflow/src/routes/dashboard/aio-cycle/UserChip.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
  - taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx
  - taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx
  - taskflow/src/routes/dashboard/aio-cycle/RunStepCard.tsx
  - taskflow/src/routes/dashboard/aio-cycle/RunSidebar.tsx
  - taskflow/src/routes/dashboard/AioCyclesDashboard.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx
autonomous: true
requirements: [QUICK-261013-mnc]

must_haves:
  truths:
    - "Cycle header shows name, key, status pill and the Pin button, plus a metadata line with only the fields that are present: owner (avatar + name from the live-confirmed ownedByID), folder, date range, updated date or 'Closed {date}', and custom fields such as Device_Type: Web / Browser: Chrome. Missing fields never render as a dash. No objective or description, because the live /detail has neither (per D-header, D-probe)"
    - "The cycle page shows 4 KPI tiles (Pass rate, Executed n/total, Failing / Blocked, Open defects) built on Card + EpicStatCard, and below them a taller segmented progress bar with a tooltip of at most 4 rows on each segment and no legend (per D-kpi)"
    - "The Executions tab has a search box over test case key and title, single-select status chips with counts (All default; In progress chip only when its count > 0), sortable columns, and one-line flex rows with a status rail. Clicking a row opens the run detail. Rows without a run id are not clickable (per D-executions)"
    - "The Defects tab shows a summary strip with counts by status category and by severity, and keeps the existing sort, filter, chip and clear-all behaviour on one-line flex rows. Triggered-by test case chips navigate to that run. Priority sort follows the custom 9-level scheme (per D-defects)"
    - "The run detail header shows the test case key and title, which come from the cycle runs list and not from the run-detail response. It also shows the status pill and Prev/Next with a position like 4/56, and these work on a deep link with a cold cache (per D-run)"
    - "The run detail is two columns and stacks to one column in narrow containers. The main column has the test case description (from testcase /detail) above a step progress summary and step cards. The sidebar has run status, assignee, executed by, last updated, created, run count, test case type/status/folder/owner/version/custom fields (from testcase /detail), a link back to the cycle and defects (per D-run)"
    - "Every new normaliser fixture mirrors the live probe shapes in 261013-mnc-PROBE-RESULTS.md (customFields with both the {ID,value} object and the [{ID,value}] array shape, epoch-ms dates, no executedDate, no testCase on run detail)"
    - "The run detail status pill and the Executions row agree for In Progress (52) and N/A (901), because both map through the same status-ID table"
  artifacts:
    - path: "taskflow/src/routes/dashboard/aio-cycle/useAioCycleData.ts"
      provides: "Shared cycle queries (cycle-detail, project-numeric-id, status-map-init, cycle-summaries, runs) with the exact existing keys, plus derived counts"
      exports: ["useAioCycleData"]
    - path: "taskflow/src/lib/aio-defect-sort.ts"
      provides: "Custom-scheme priority rank"
      exports: ["priorityRank"]
    - path: "taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx"
      provides: "Executions toolbar + flex rows"
    - path: "taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx"
      provides: "Defects summary strip + filterable flex rows"
    - path: "taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx"
      provides: "Two-column run detail with Prev/Next"
    - path: "taskflow/src/services/aio/testcases.ts"
      provides: "Test case detail fetch (GET /project/{pk}/testcase/{tcKey}/detail)"
      exports: ["fetchAioTestCaseDetail"]
  key_links:
    - from: "taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx"
      to: "useAioCycleData"
      via: "runs list lookup by run id for title + Prev/Next"
      pattern: "useAioCycleData\\("
    - from: "taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx"
      to: "fetchAioTestCaseDetail"
      via: "['aio', jiraBaseUrl, 'testcase-detail', projectKey, tcKey] query"
      pattern: "testcase-detail"
    - from: "taskflow/src/services/aio/issue-steps.ts"
      to: "chipStatusFromId"
      via: "testRunStatus.ID mapped through the same table as the list"
      pattern: "chipStatusFromId"
    - from: "taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx"
      to: "priorityRank"
      via: "priority sort comparator"
      pattern: "priorityRank\\("
---

<objective>
Redesign the AIO cycle detail page (header and overview with KPI tiles, the Executions tab, the Defects tab) and the AIO test run detail page so they are polished, modern and information-rich. The work also fixes the pitfalls the research found: run detail title taken from a fabricated `testCase`, navigation to an empty run id, the In Progress / N/A status mismatch, and a priority sort that ignores the custom 9-level scheme.

Purpose: the user's locked decisions in 261013-mnc-CONTEXT.md. The decision tags in this plan map to those sections:
- D-header: Cycle header & overview, header + metadata line
- D-kpi: Cycle header & overview, KPI tiles + segmented bar
- D-probe: More info — probe the API
- D-executions: Executions tab
- D-run: Test run detail
- D-defects: Defects tab

Output: a shared data hook, `aio-cycle/` sub-components, a split `AioCycleDetailPage.tsx`, a rebuilt `AioTestRunDetailPage.tsx`, extended service normalisers, and updated tests.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/261013-mnc-CONTEXT.md
@.planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/261013-mnc-RESEARCH.md
@.planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/261013-mnc-PROBE-RESULTS.md (LIVE-CONFIRMED 2026-10-13; supersedes every UNVERIFIED marker in RESEARCH.md)

Source files to read (each once):
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
@taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
@taskflow/src/services/aio/cycles.ts
@taskflow/src/services/aio/issue-steps.ts
@taskflow/src/services/aio/types.ts
@taskflow/src/routes/dashboard/AioCyclesDashboard.tsx (lines 1-130: TileShell / Tile / TileSkeleton / AMBIENT_* pattern)
@taskflow/src/routes/dashboard/AioCycleList.tsx (lines 30-60 COL map + column drop, ~310-345 overlay button + pill-in-flex)
@taskflow/src/routes/dashboard/AioFolderPanel.tsx (lines 140-158 search input pattern)
@taskflow/src/routes/dashboard/issue-detail/EpicStatCard.tsx
@taskflow/src/lib/aio-cycle-list.ts (toDateKey, formatCycleDates, isOverdue, PROGRESS_SEGMENT_CLASS, progressTooltipRows, statusLabel, StatusKey)

Binding UI rules (CONTEXT specifics, prior UAT):
- Colour carries status only. No legends. Tooltips have at most 4 rows.
- One row = one line at every density. Drop columns with container queries (`hidden @[Npx]:flex`) instead of wrapping.
- Use div+flex rows: `flex-none` on variable cells, `flex-1 min-w-0 truncate` on the title. Never a `<table>`.
- `aioRunStatusPillClass` / `statusPillClass` / `aioCycleStatusPillClass` spans must sit inside a `<div className="flex">`. Never add geometry classes to the span.
- Full-row click uses an `absolute inset-0` overlay `<button>` as a SIBLING of inner links. Inner links get `relative z-10`. No `div[role=button]` with nested interactive elements.
- Italic text inside `truncate` needs `pr-0.5`. Hover affordances must not shift layout.
- Do NOT create files named `StatTile*` or `ChartWrapper*`. `widget-removal.guard.test.ts` must stay green.
- The pre-commit hook runs the full vitest suite + biome + tsc. Each task is ONE commit that contains its code and its test updates together. Biome gate: no NEW files flagged. Do not chase the baseline count.
- Do not use `git stash` to compare lint/test results.

API field honesty (live probe, PROBE-RESULTS.md is the source of truth):
- Cycle /detail (P1) CONFIRMED: ownedByID, startDate, endDate, createdDate, updatedDate, closedDate, closedByID, isClosed, folder{ID,name,parentID}, jiraProjectID, jiraReleaseID(s), jiraTaskIDs (strings), customFields[]{ID,name,value}. All dates are epoch ms. NOT present: objective, description, isArchived and a status name (status stays derived from isClosed via the existing fallback). Do not add those to types or UI.
- Runs list testcasewithrun/paged (P2) CONFIRMED: assignedToID, assignmentDate, runCount, latestTestRun{ID, createdDate, updatedDate, executedByID, testRunStatusID, allDefects}, test.detail{key, title, ownedByID}. There is NO executedDate field. The existing mapping of `latestTestRun.updatedDate` → `AioTestRun.executedDate` (ISO) stays and is the "last executed/updated" date. test.detail priority/type/description come back empty with the app's columns, so do not use them.
- Run detail (P3) CONFIRMED: executedByID, createdDate, updatedDate, jiraDefectIDs, testRunStatus{ID,name}, steps with stepOrder, per-step jiraDefectIDs, testStepType and testRunStepStatus. No testCase and no executed date (use updatedDate). Step `testData` and run `isAutomated` were NOT seen, so `testData` is optional and rendered only when present, and `isAutomated` is not mapped.
- Test case /detail (P4) WORKS: `GET /rest/aio-tcms-api/1.0/project/{pk}/testcase/{tcKey}/detail` → title, description, status{name} (e.g. "Published"), type{name} (e.g. "System Test"), folder{name}, ownedByID, createdDate, customFields[]{ID,name,value{ID,value}}, version. There is no precondition or priority, so do not add them.
- summary/paged (P5): only testRunDistribution + totalTests. No effort/assignee tiles.
- `customFields[].value` is polymorphic: an object `{ID, value}`, an array `[{ID, value}]`, or empty. Normalise to `{ name, value: string }`, joining array values with ", ", and skip entries whose value is empty. Never `String(obj)`.
- Test fixtures for new normaliser fields must mirror these live shapes. customFields fixtures must include BOTH the object and array value shapes plus one empty entry.
- No existing priority-rank helper exists in the codebase (grep confirmed: only the local `PRIORITY_RANK` in AioCycleDetailPage.tsx). Task 1 creates `lib/aio-defect-sort.ts` and it replaces that map.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Data layer: extended normalisers, status-ID parity, priority rank, shared useAioCycleData/useCycleDefects hooks (cycle page wired with no visual change)</name>
  <files>taskflow/src/services/aio/types.ts, taskflow/src/services/aio/cycles.ts, taskflow/src/services/aio/cycles.test.ts, taskflow/src/services/aio/issue-steps.ts, taskflow/src/services/aio/issue-steps.test.ts, taskflow/src/services/aio/testcases.ts, taskflow/src/services/aio/testcases.test.ts, taskflow/src/services/aio/index.ts, taskflow/src/lib/statusStyles.ts, taskflow/src/lib/aioUtils.ts, taskflow/src/lib/aio-defect-sort.ts, taskflow/src/lib/aio-defect-sort.test.ts, taskflow/src/routes/dashboard/aio-cycle/useAioCycleData.ts, taskflow/src/routes/dashboard/aio-cycle/useCycleDefects.ts, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx</files>
  <behavior>
    - normalizeCycle on the live P1 /detail shape returns ownedByID, startDate/endDate/createdDate/updatedDate/closedDate (raw epoch ms preserved), closedByID, jiraProjectID, jiraTaskIDs and jiraReleaseIDs. customFields become `{ name, value: string }[]`: the `Cycle-` prefix is stripped from the name, `{ID,value:'Web'}` gives 'Web', `[{ID,value:'Chrome'},{ID,value:'Firefox'}]` gives 'Chrome, Firefox', and empty entries (`[]`, null, empty string) are dropped. There is no objective, description or isArchived.
    - fetchAioCycleTestCasesWithRuns: status IN_PROGRESS for testRunStatusID 52 (unchanged). `executedDate` is still the ISO of `latestTestRun.updatedDate`. It newly maps `latestTestRun.executedByID` → `executedByID`, `latestTestRun.createdDate` → `createdDate` (ISO) and item `assignmentDate` → `assignmentDate` (ISO). An item without latestTestRun keeps `id: ''`.
    - fetchAioTestRunDetail maps status via `testRunStatus.ID` first: 52 → IN_PROGRESS and 901 → PASS. It falls back to the name only when the ID is absent. It returns `executedByID` and `createdDate` (ISO) on the run, with `executedDate` = ISO of `updatedDate`. Each step gets `jiraDefectIDs`, `stepOrder`, `testStepType` and optional `testData` (only when a non-empty string). Steps are sorted by `stepOrder` when present. It no longer reads a `testCase` field (P3: the endpoint never returns it), and `testCaseKey` is `''`.
    - fetchAioTestCaseDetail(base, token, projectKey, tcKey) GETs `/project/{pk}/testcase/{tcKey}/detail` (both URL-encoded). It returns `AioTestCaseDetail { key, title, description?, statusName?, typeName?, folderName?, ownedByID?, createdDate?, version?, customFields: {name,value}[] }`, returns null on 404 and throws ApiError on 401, mirroring fetchAioTestRunDetail. There is no precondition or priority.
    - priorityRank: Blocker < Must < Critical < Highest < Should < High < Medium < Low < Lowest < Minor. Unknown names rank after all known names, ordered by numeric `priority.id`. Null priority ranks last. High < Medium < Low still holds, so the existing defect sort test stays valid.
    - aioRunStatusPillClass('IN_PROGRESS') returns a blue pill, and normalizeStatusLabel('IN_PROGRESS') returns 'In progress'. normalizeStatus('IN_PROGRESS') returns 'inProgress'.
  </behavior>
  <action>
Service and type layer (per D-probe):
- In `services/aio/types.ts`, add `export interface AioCustomField { name: string; value: string }`.
- Extend `AioCycle` with these optional fields, each commented "live P1 CONFIRMED":
  - `ownedByID?: string`, `closedByID?: string`
  - `startDate?, endDate?, createdDate?, updatedDate?, closedDate?: number | string | null`
  - `jiraProjectID?: number`
  - `jiraTaskIDs?: string[]`, `jiraReleaseIDs?: number[]`
  - `customFields?: AioCustomField[]`
  - Do NOT add objective, description or isArchived.
- Extend `AioTestRun` with `executedByID?: string`, `createdDate?: string`, `assignmentDate?: string`. Re-comment `executedDate` as "ISO of latestTestRun.updatedDate / run updatedDate — the API has no executedDate (live P2/P3)".
- Extend `AioTestRunStep` with `jiraDefectIDs?: number[]`, `stepOrder?: number`, `testStepType?: string` (live P3) and `testData?: string` (optional, not seen live).
- Add `AioTestCaseDetail` (shape in behavior).
- Update the stale "verify field names" comments on `testCase` to say: present only from the testcasewithrun list, never on run detail (live P3).
- In `cycles.ts`:
  - Extend `RawCycle` and `normalizeCycle` with those fields.
  - Export `normalizeCustomFields(raw: unknown, stripPrefix?: string): AioCustomField[]`, which handles object, array and empty values and never calls `String()` on an object.
  - Export `chipStatusFromId` (currently module-private).
  - In the testcasewithrun mapping, add `latestTestRun.executedByID`, `latestTestRun.createdDate` and `assignmentDate`.
- Create `services/aio/testcases.ts` with `fetchAioTestCaseDetail`. Use `aioFetch` from `./client`, the same try/catch → `Cannot reach AIO` and 401/404 handling as `fetchAioTestRunDetail`, and `normalizeCustomFields` from `./cycles` with no prefix strip. Map `status?.name`, `type?.name`, `folder?.name`, `version` (number or string → string) and `createdDate` (epoch ms → ISO).
- Add `export * from './testcases';` to `services/aio/index.ts`.
- In `issue-steps.ts`:
  - Extend `RawRunDetail` with `executedByID, createdDate`.
  - Extend `RawStep` with `jiraDefectIDs, stepOrder, testStepType, testData`.
  - Import `chipStatusFromId` from `./cycles` and use it when `testRunStatus.ID` is a number. Keep `toRunChipStatus` as the fallback, and extend it so 'in progress' → IN_PROGRESS and 'n/a' → PASS, which mirrors the ID table.
  - Delete the `testCase` read from `RawRunDetail` and the run object.
  - Check `normalizeStep` callers (`fetchAioTestRunSteps`, used by issue-detail): adding optional fields must not change their output for existing keys.
- `lib/statusStyles.ts`: add `IN_PROGRESS: 'bg-blue-500/15 text-blue-600 dark:text-blue-400'` to `AIO_RUN_BADGE_STYLES`. Confirm `aioRunStatusPillClass` reads from it.
- `lib/aioUtils.ts`:
  - Add `IN_PROGRESS` → 'In progress' to `normalizeStatusLabel`.
  - Add `IN_PROGRESS` → 'inProgress' to `normalizeStatus` and widen its return type to include 'inProgress'.
  - Run tsc and fix any caller that indexes a 4-key record with the result. The cycle page's count accumulators already include `inProgress`.
- Create `lib/aio-defect-sort.ts` exporting `priorityRank(priority: { name?: string | null; id?: string | null } | null | undefined): number`, using the custom 9-level scheme from project memory (Blocker > Must > Critical > Should > High > Medium > Low > Lowest > Minor) with standard `Highest` placed between Critical and Should. Unknown names return `100 + Number(id)` when id is numeric, otherwise 999. Null returns 1000. Also export `compareDefectPriority(a, b)`.

Shared hooks:
- Create `routes/dashboard/aio-cycle/useAioCycleData.ts` exporting `useAioCycleData(projectKey, cycleKey)`.
  - Move the five queries from `AioCycleDetailPage.tsx` (~lines 393-470), keeping their exact query keys, enabled gates and staleTimes:
    - `cycle-detail`
    - `project-numeric-id`
    - `status-map-init`
    - `cycle-summaries`
    - `runs`
  - Move the count derivation that follows them (runsCounts / summaryCounts / counts / total fallback chain). Normalise runsCounts via `normalizeStatus`, so in-progress runs now count as inProgress.
  - Read `jiraBaseUrl` from `useAuthStore` and `{token, isLoading}` from `useAioCredentials` internally.
  - Return `{ cycleQuery, runsQuery, summaryQuery, aioStatusMapReady, jiraProjectId, cycleNumericId, runs, counts, total, credGate, token, tokenLoading, jiraBaseUrl }`.
  - Also return `navigableRuns` = runs with a non-empty `id`, in server order (the cycle rank order).
  - Also return `ownerID` = `cycleQuery.data?.ownedByID` (live-confirmed on /detail, so no list-cache fallback is needed).
- Create `routes/dashboard/aio-cycle/useCycleDefects.ts` exporting `useCycleDefects({ runs, jiraBaseUrl, token, tokenLoading })`.
  - Move the `allDefects` / `defectsWithTriggers` / `useQueries(issue-lightweight)` / `resolvedDefects` logic, keeping the same query key `['jira', base, 'issue-lightweight', defectId]`.
  - Change the trigger shape: build a `Map<defectId, AioTestRun[]>` once in a useMemo, and give each resolved defect `triggeredByRuns: AioTestRun[]` instead of a joined string.
  - Also return `openCount` = resolved issues whose `fields.status.statusCategory.key !== 'done'`, plus `isResolving`.
- Rewire `AioCycleDetailPage.tsx` to call both hooks in place of its inline queries.
  - Replace `PRIORITY_RANK` with `compareDefectPriority`.
  - Adapt `DefectRow` to render `triggeredByRuns.map(r => r.testCaseKey).join(', ')` for now. The UI rebuild is Task 2.
  - This task must produce NO visual change. Every existing `AioCycleDetailPage.test.tsx` test must pass unmodified, except any that asserted the old triggeredBy prop shape directly.

Tests (same commit):
- Add normalizeCycle cases to `cycles.test.ts` using a fixture shaped like live P1:
  - `ownedByID: 'ext94772'`, epoch-ms dates (`startDate: 1777759200000`), `isClosed`, `closedDate`, `closedByID`
  - `folder {ID:10763, name, parentID}`, `jiraTaskIDs` as strings
  - `customFields` containing `{name:'Cycle-Device_Type', value:{ID:1,value:'Web'}}`, `{name:'Cycle-Browser', value:[{ID:2,value:'Chrome'},{ID:3,value:'Firefox'}]}` and `{name:'Cycle-Environment', value:[]}`
  - Assert `[{name:'Device_Type',value:'Web'},{name:'Browser',value:'Chrome, Firefox'}]`.
- Add a testcasewithrun case: an item with latestTestRun{updatedDate, createdDate, executedByID} and assignmentDate, and NO executedDate key anywhere.
- Add run-detail cases to `issue-steps.test.ts` with live P3 keys (status ID 52/901, executedByID, createdDate, updatedDate, steps with stepOrder out of order, per-step jiraDefectIDs, testStepType 'TEXT', no testData, no testCase). Add one separate case where a step has testData, titled "optional-field".
- Create `testcases.test.ts` with a fixture shaped like live P4 (status{name:'Published'}, type{name:'System Test'}, folder{name}, ownedByID, epoch-ms createdDate, version, customFields with both value shapes, steps[] ignored), plus 404 → null and 401 → ApiError.
- Create `aio-defect-sort.test.ts`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/services/aio/ src/lib/aio-defect-sort.test.ts src/routes/dashboard/AioCycleDetailPage.test.tsx src/routes/dashboard/AioTestRunDetailPage.test.tsx && npx tsc --noEmit -p .</automated>
  </verify>
  <done>The live-confirmed normaliser fields, fetchAioTestCaseDetail, status-ID parity, priorityRank and both hooks exist with unit tests that mirror the live probe shapes. AioCycleDetailPage renders the same as before through the hooks, and all of its existing tests pass. tsc is clean. One commit passes the pre-commit hook.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Cycle detail redesign: header + metadata, KPI tiles + segmented bar, Executions list, Defects list (split into aio-cycle/ components)</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/AioTile.tsx, taskflow/src/routes/dashboard/aio-cycle/UserChip.tsx, taskflow/src/routes/dashboard/AioCyclesDashboard.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx, taskflow/src/routes/dashboard/aio-cycle/ExecutionsList.tsx, taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx</files>
  <behavior>
    - The header renders name, key and the cycle status pill (in a flex div), and keeps the `Pin cycle`/`Unpin cycle` aria-labels and togglePin/setPinnedCycleMeta behaviour. The metadata line renders, in order:
      - owner avatar+name (ownedByID, resolved through the same `user-by-username` query / AssigneeCell pattern)
      - folder
      - `formatCycleDates(start,end,today)` (overdue tone via `isOverdue` when the cycle is not closed)
      - "Closed {date}" when closed, otherwise "Updated {relative}" from updatedDate
      - customFields as `Name: value`
      - "Last run {date}" from the max run `executedDate` (= latestTestRun.updatedDate)
      Absent items produce no element and no separator. There is no objective/description block, because the live API has neither.
    - Tiles: testids `kpi-pass-rate` (pass/total %, sub "n passed"), `kpi-executed` ("n/total", sub "Last run …" or re-run count), `kpi-failing` (fail+blocked, sub "n without a defect" from FAIL/BLOCKED runs with no jiraDefectIDs), `kpi-open-defects` (openCount, sub "of N defects"). Each tile has a tooltip of at most 4 rows. Tiles show TileSkeleton while their source is loading.
    - The segmented bar is `h-2.5` rounded-full. Each non-zero segment has `data-testid="progress-seg-{statusKey}"`, its colour comes from `PROGRESS_SEGMENT_CLASS`, and its tooltip shows `statusLabel`, count and %. No legend text.
    - Executions toolbar: a search input (`aria-label="Search test cases"`) filtering on testCaseKey + testCase.title, case-insensitive. A `role="radiogroup"` (`aria-label="Filter by status"`) of `role="radio"` chips with `aria-checked`, labelled `All 56`, `Pass 46`, `Fail 3`, `Blocked 2`, `Not run 5`, plus `In progress N` only when N > 0. Single-select, All by default. Arrow keys move selection.
    - Executions header has sort buttons (`executions-sort-{key|status|defects|runs|assignee|executed}`) toggling asc/desc with an indicator. Default order is the server order.
    - Executions rows keep `data-testid="run-row-{id}"` on the row container. They are one line: left status rail (`absolute left-0 inset-y-0 w-1`, `PROGRESS_SEGMENT_CLASS[normalizeStatus]`), key `flex-none font-mono`, title `flex-1 min-w-0 truncate`, status pill in a flex div, defect count (Bug icon + n, only when > 0), `×N` run count (when > 1), assignee avatar+name, and executed date. Assignee, runs and date columns drop at narrow container widths.
    - The row overlay button has `aria-label="Open run for {key}"` and keeps the existing navigation + breadcrumb push. Rows with an empty id get no overlay button and are muted (`opacity-70`).
    - Empty states keep the texts 'No runs recorded' and 'No runs match the selected filters' (hint now mentions search). The skeleton testid `runs-table-skeleton` is kept.
    - Defects summary strip (`defects-summary`): pills for To Do / In Progress / Done counts (statusPillClass by category key; zero categories omitted) and a severity count group (`Sev: Critical 2 · Major 1`, plain text, no colour).
    - Defects rows keep every testid: `defect-row-{id}`, `defect-title-loading-{id}`, `defects-sort-header-{key}`, `defects-sort-indicator-{key}`, `defects-filter-{status,priority,severity,assignee}`, `defects-filter-chip-*`, `defects-filter-clear-all`. They keep the FilterPopover option buttons. The overlay button (`aria-label="Open {key}"`) opens the issue; the key NavLink is a `relative z-10` sibling that still pushes a breadcrumb.
    - Triggered-by is rendered as chips (`defect-trigger-{defectId}-{runId}`, `relative z-10` buttons showing testCaseKey). A click pushes the cycle breadcrumb and navigates to `/aio-cycle/{PK}/{CK}/run/{runId}`. Runs with an empty id render as plain text.
  </behavior>
  <action>
Implements D-header, D-kpi, D-executions and D-defects.

AioTile.tsx:
- Move `TileShell`, `TileLabel`, `TileSkeleton`, `Tile`, `AMBIENT_CLASS`, `AMBIENT_TINT`, `Tint`, `TITLE_CLASS` (and `VALUE_CLASS` if Tile uses it) out of `AioCyclesDashboard.tsx` into `routes/dashboard/aio-cycle/AioTile.tsx` as named exports, with no behaviour change.
- AioCyclesDashboard.tsx changes only its imports. `AioCyclesDashboard.test.tsx` must stay green untouched.

CycleHeader.tsx:
- Props: `{ cycle, cycleKey, ownerID, lastExecuted, pinned, onTogglePin }`.
- Resolve the owner via the shared `['jira', base, 'user-by-username', id]` query (`fetchJiraUserByUsername`), the same key as AioCycleList OwnerCell and AssigneeCell. Export a small `UserChip({ userId, size })` from `aio-cycle/UserChip.tsx`, which both ExecutionsList's assignee cell and Task 3's sidebar reuse.
- Join metadata items with a `·` separator rendered only between present items.
- `today` = `toDateKey(Date.now())`.

CycleKpiTiles.tsx:
- Props: `{ counts, total, runs, runsLoading, openDefects, totalDefects, defectsLoading }`.
- Wrap in `STAT_CONTAINER_CLASS` + `STAT_GRID_CLASS`. Tile icons are ambient only (e.g. CheckCircle2 / PlayCircle / XCircle / Bug).
- The progress bar sits under the grid in the same component. Use `progressTooltipRows(counts)` where a merged tooltip is needed. Each per-segment tooltip uses `TooltipBody`/`TooltipRow`, at most 4 rows.

ExecutionsList.tsx:
- Props: `{ runs, isLoading, isError, onRetry, onOpenRun(run) }`.
- Owns `query`, `statusFilter: 'ALL' | status`, `sortKey`/`sortDir`.
- Use one `COL` map shared by header and rows, with `@container` on the wrapper, modelled on `AioCycleList.tsx`.
- `AssigneeCell` is replaced by `UserChip` (size 18, `truncate`, no max-w hack).
- Date via `formatDateKey(toDateKey(executedDate))`, or the existing local formatter if it already matches.
- Copy the search box markup from `AioFolderPanel.tsx:140-158`.

DefectsList.tsx:
- Props: `{ defects (from useCycleDefects), isLoading, onOpenIssue(key), onOpenRun(run), cycleName }`.
- Moves in from the page: `SortableHeader`, `FilterPopover`, `DefectRow` and all defect sort/filter state, rebuilt as flex rows with the same COL approach.
- Severity comes from `fields.customfield_13415?.value ?? .name`, unchanged. Priority sort uses `compareDefectPriority`.
- Replace the duplicated local `IssueTypeIcon` with `IssueTypeIcon` from `@/components/ui/issue-type-icon`, and render priority with `PriorityIcon` + name. Check the shared IssueTypeIcon prop signature before use.

AioCycleDetailPage.tsx:
- Becomes composition only: breadcrumb (keep `aio-cycle-detail-breadcrumb` / `-current` testids and logic), CycleHeader, CycleKpiTiles, then Tabs with tab names exactly `Executions` and `Defects`.
- Target under ~300 lines. Keep the default export and the pinned-tab meta effects.
- `onOpenRun` pushes `{label: cycleName, path: location.pathname}` and navigates to `/aio-cycle/${PK}/${CK}/run/${run.id}`. Guard `if (!run.id) return`.

AioCycleDetailSkeleton.tsx:
- Default export unchanged in name. Draw a header line + metadata line, 4 tile skeletons using `STAT_CARD_CLASS` inside the same grid classes (no layout shift), a bar, a toolbar row, and 6 row skeletons.
- Add an exported `AioRunDetailSkeleton` (two-column: main step-card skeletons + 280px sidebar, stacking via the same container query as Task 3) for Task 3 to use.

Tests in AioCycleDetailPage.test.tsx (same commit):
- Rewrite the progress-legend assertions (`/Pass: 1/`, `/Fail: 2 \(50%\)/`, `/Not Run: 1/`) to assert on `kpi-pass-rate` / `kpi-failing` text and on the `progress-seg-*` presence.
- Rewrite the `switch` chip tests to radio: All is checked by default with all rows visible, and clicking `Fail 2` shows only FAIL rows. Add a search test (by key and by title).
- Add a sort test, plus a test that an empty-id row has no "Open run for" button.
- Retarget row click/Enter tests to the overlay button (`getByRole('button', {name: /Open run for PROJ-TC-1/})`).
- Replace `columnheader` queries with sort testids or text.
- Add a summary-strip count test and a triggered-by chip navigation test that expects `/aio-cycle/PROJ/PROJ-CY-2/run/run-2` in the router location.
- Add an owner test: the cycle-detail mock includes `ownedByID: 'ext94772'` and the user mock resolves a displayName, which appears in the header. With no ownedByID, no owner element and no stray separator render.
- Add `fetchJiraUserByUsername` to the mocks: add a `vi.mock('@/services/jira/users', ...)` factory returning `{ fetchJiraUserByUsername: vi.fn().mockResolvedValue(null) }` if not already mocked.
- Keep the status-map-init regression test, the pin tests and all `defects-*` testid tests passing.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx src/routes/dashboard/AioCyclesDashboard.test.tsx src/routes/dashboard/widget-removal.guard.test.ts && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/aio-cycle src/routes/dashboard/AioCycleDetailPage.tsx src/routes/dashboard/AioCycleDetailSkeleton.tsx</automated>
  </verify>
  <done>The cycle page is composed from aio-cycle/ components with the header, metadata, 4 KPI tiles, segmented bar, the redesigned Executions list (search, radio chips with counts, sort, flex rows with status rail) and the Defects list (summary strip, preserved filters/sort testids, triggered-by chips). The page file is under ~300 lines. The tests are updated and pass, the dashboard tests and guard test are green, and biome reports nothing on the new files. One commit passes the pre-commit hook.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Run detail redesign: key+title header from runs list, Prev/Next with position, two-column steps + sidebar</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/RunStepCard.tsx, taskflow/src/routes/dashboard/aio-cycle/RunSidebar.tsx, taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx, taskflow/src/routes/dashboard/AioTestRunDetailPage.test.tsx</files>
  <behavior>
    - On a deep link with a cold cache, the page calls `useAioCycleData(PK, CK)` and finds the run in `navigableRuns` by id. `aio-run-detail-title` shows `{testCaseKey} {title}` (key in font-mono). The title comes from the runs-list entry, falling back to the testcase-detail title when the list title is empty. It shows a Skeleton while runs load, and falls back to `Run {runId}` only when the run is not in the list.
    - Test case detail query: key `['aio', jiraBaseUrl, 'testcase-detail', projectKey, tcKey]`, `fetchAioTestCaseDetail`, enabled only when credentials are ready and `tcKey` (the list entry's testCaseKey) is non-empty, staleTime 5 min. Run detail has no testCase key, so the list entry is the only key source. A testcase-detail error never blocks the page: its sections are just omitted.
    - Description: when the test case description is non-empty, `aio-run-testcase-description` renders it in the main column ABOVE the step summary, through WikiRenderer.
    - `aio-run-detail-breadcrumb-current` shows the testCaseKey (fallback `Run {runId}`).
    - `aio-run-detail-position` shows `{idx+1}/{n}`. Buttons `aria-label="Previous run"` / `"Next run"` are disabled at the ends and navigate with `{ replace: true }` to the neighbour's `/aio-cycle/PK/CK/run/{id}` without pushing a breadcrumb. ArrowLeft/ArrowRight keydown on the page (ignored when focus is in an input/textarea) does the same.
    - `aio-run-detail-status-chip` uses the detail status (now ID-mapped), so IN_PROGRESS renders 'In progress' with a blue pill.
    - Step summary `aio-run-step-summary`: "Steps {passed}/{total} passed" plus a mini segmented bar (`PROGRESS_SEGMENT_CLASS` by normalized step status).
    - Steps container `aio-run-detail-step-table` (testid kept) holds cards `run-step-{index}` with sections Step / Expected / Actual (Actual only when present) and Test data (optional; only when the step has non-empty testData, through WikiRenderer). Per-step defect chips appear when `jiraDefectIDs` is non-empty. FAIL/BLOCKED cards get a status rail plus `ring-red-500/40` / `ring-orange-500/40`, and the step status pill sits in the card header inside a flex div.
    - Sidebar `aio-run-sidebar` has two groups:
      - **Run**: status pill, assignee (runs-list `assignedToID`), executed by (detail `executedByID`, only when present and different from the assignee), "Last updated" (detail `updatedDate`, labelled as such because there is no executed date), created (detail `createdDate`), run count (runs-list `runCount`).
      - **Test case** (`aio-run-testcase-meta`; each row only when present): type (`typeName`), status (`statusName`, neutral `tonePillClass('muted')` pill in a flex div, since test case status is not a run status and gets no colour), folder, owner (UserChip from `ownedByID`), version, and each custom field as `name: value`.
      Then the "Back to cycle" link to `/aio-cycle/PK/CK` and the compact defects list (`aio-run-defects-section`, present only when defects exist; defect click still pushes the breadcrumb and goes to `/issue/{key}`). There is no Automated badge, because isAutomated was not seen live.
    - Layout: the page body is `@container`. The grid is `grid gap-4 @[900px]:grid-cols-[minmax(0,1fr)_280px]`, so it is one column below 900px container width.
    - 'Run not found' (detail returns null) still renders.
  </behavior>
  <action>
Implements D-run.

RunStepCard.tsx:
- Props: `{ step, index }`. Uses `WikiRenderer` from `../WikiRenderer` for step/expected/actual/testData. Never use `dangerouslySetInnerHTML`.
- Per-step defect chips resolve their key through the same `['jira', base, 'issue-lightweight', id]` query (`fetchJiraIssueByKey`), so the cache is shared with the sidebar and cycle page. While loading, show the numeric id as muted text.

RunSidebar.tsx:
- Props: `{ run (detail), listRun (runs-list entry or undefined), testCase (AioTestCaseDetail or undefined), defects, onOpenDefect, cycleHref }`.
- User names come from the shared `user-by-username` query key with CachedAvatar size 20.
- Use a definition-list style (`dl` with label/value rows). Omit rows whose value is absent; no "—".

AioTestRunDetailPage.tsx:
- Keep the default export, the existing `run-detail` query key `['aio', base, 'run-detail', PK, CK, runId]`, the breadcrumb logic and testids, and the defect `issue-lightweight` useQueries.
- Call `useAioCycleData(projectKey, cycleKey)`. This also runs the status-map-init query, so the status-map rule is covered on this page too.
- Add the testcase-detail `useQuery` (key and gating as in behavior) and pass the result to RunSidebar. Render the description block above the steps.
- Derive `idx`/`prev`/`next` from `navigableRuns` (the server order, not any cycle-page filter state).
- Replace the local `IssueTypeIcon` copy with the shared `@/components/ui/issue-type-icon` export.
- Use `AioRunDetailSkeleton` (from Task 2) while the detail loads.
- Remove every read of `detail.run.testCase` and `testCaseKey` from the detail response. The title comes from the runs-list entry, with the testcase-detail title as fallback (live P3: run detail has no testCase).

Tests in AioTestRunDetailPage.test.tsx (same commit):
- Extend the `@/services/aio` mock with `fetchAioTestCaseDetail`. Its fixture is shaped like live P4: `{key, title, description:'h1. Goal', statusName:'Published', typeName:'System Test', folderName:'Checkout', ownedByID:'ext94772', version:'2', customFields:[{name:'Platform',value:'Web'},{name:'Browsers',value:'Chrome, Firefox'}]}`.
- Also extend it with `fetchAioCycleDetail` (returns `{ID: 99, key:'PROJ-CY-2', name:'Cycle', status:'Active', projectKey:'PROJ'}`), `fetchAioCycleSummaries` (returns []) and `fetchAioCycleTestCasesWithRuns` (returns 3 runs, the middle one being the route's runId, each with testCaseKey/testCase.title/assignedToID/runCount).
- Mock `@/services/jira/projects` `fetchJiraProjectNumericId` → 10134 and `@/services/jira/users` `fetchJiraUserByUsername` → null.
- Mock `@/lib/aioUtils` `initializeAioStatusMap` only if it hits the network (prefer mocking `@/services/aio/cycles` `fetchAioProjectConfig` as the cycle-page test does).
- Remove `testCase` from every `fetchAioTestRunDetail` mock (the live API never returns it), and give it `testRunStatus`-derived `status` per the new mapping.
- Update the title test to expect the key + title from the runs mock.
- Update the breadcrumb-current test to expect the testCaseKey.
- Replace the `tbody tr` count with `[data-testid^="run-step-"]` count.
- Add tests:
  - position `2/3`
  - Next navigates (replace) to the third run id and Previous is enabled
  - Previous is disabled on the first run
  - the title falls back to `Run {id}` when the run is absent from the list
  - a FAIL step card has its highlight class
  - the sidebar renders run count `×N`
  - the description renders above `aio-run-step-summary`
  - `aio-run-testcase-meta` shows 'System Test', 'Published' and 'Platform: Web'
  - when fetchAioTestCaseDetail rejects, the page still renders steps and no testcase-meta section
  - with no testData on the steps, no "Test data" label renders
- Keep the 'Run not found', status chip, defects-section presence/absence and defect-click breadcrumb tests.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/AioTestRunDetailPage.test.tsx src/routes/dashboard/AioCycleDetailPage.test.tsx && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/aio-cycle src/routes/dashboard/AioTestRunDetailPage.tsx</automated>
  </verify>
  <done>The run detail shows the key + title from the runs list (testcase-detail fallback), the test case description above the steps, and test case metadata in the sidebar, the status pill and Prev/Next with a position that works on a cold-cache deep link. It has a two-column layout that stacks under 900px container width, with step cards (failed highlighted, actual/test data/defects when present) and a sidebar. No code reads testCase from the run-detail response. The tests are updated with honest fixtures and pass. One commit passes the pre-commit hook.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AIO/Jira REST → UI | Server-supplied wiki text (step, expected, actual, optional testData, test case description) and custom-field values are rendered |
| URL params → navigation | `runId`/`cycleKey` from the route are used in queries and Prev/Next paths |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-mnc-01 | Tampering/XSS | RunStepCard testData, run page test case description | mitigate | Render only via `WikiRenderer` (rehype-sanitize). No `dangerouslySetInnerHTML`. customFields values rendered as React text |
| T-mnc-02 | Tampering | normalizeCustomFields | mitigate | Defensive shape checks. Non-string values dropped, never `String(obj)` |
| T-mnc-03 | Spoofing | navigation to `/run/` with empty id | mitigate | Empty-id rows get no overlay button and are excluded from navigableRuns. `onOpenRun` guards `!run.id` |
| T-mnc-04 | Information disclosure | PAT | accept | One new read-only GET (testcase /detail) through the existing aioFetch Bearer path. The token stays in Stronghold |
| T-mnc-SC | Tampering | npm installs | accept | No new packages |
</threat_model>

<verification>
- `npx vitest run src/services/aio/ src/lib/aio-defect-sort.test.ts src/routes/dashboard/` passes
- `npx tsc --noEmit -p .` is clean
- biome reports no NEW files flagged (new aio-cycle/ files are clean)
- `grep -rn "testCase" taskflow/src/services/aio/issue-steps.ts | grep -v '^\s*//'` has no read inside fetchAioTestRunDetail
- `ls taskflow/src/routes/dashboard | grep -E "StatTile|ChartWrapper"` returns nothing
- `grep -rnE "objective|isArchived|isAutomated|precondition" taskflow/src/routes/dashboard/aio-cycle taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` returns nothing (fields absent from the live API)
- `wc -l taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` is about 300 lines or fewer
</verification>

<success_criteria>
- Every D-section of CONTEXT is implemented: D-header, D-kpi, D-probe (only fields live-confirmed in PROBE-RESULTS.md are surfaced, including owner and the test case detail endpoint), D-executions, D-run, D-defects
- The research pitfalls in scope are fixed: fabricated testCase (1), status-map init on run page (2), empty run id (3), status mismatch (4), priority sort (5), one-line rows (6), nested interactive (7), O(runs×defects) trigger lookup (10), narrow stacking (11), skeleton geometry (12)
- Three code commits each pass the pre-commit hook
- Post-execution UAT (run by the orchestrator/user, not a plan task; the live probe is already done): in `npm run tauri dev` check the cycle owner + custom fields, the run page description and test case sidebar, the metadata line (no dashes), tiles and bar tooltips, one-line rows, search + chip counts, Prev/Next on a cold-cache deep link (pinned tab after restart), one-column stacking in the peek pane, the defect priority order and triggered-by chip navigation
</success_criteria>

<output>
Create `.planning/quick/261013-mnc-enhance-aio-cycle-detail-page-and-testca/261013-mnc-SUMMARY.md` when done
</output>
