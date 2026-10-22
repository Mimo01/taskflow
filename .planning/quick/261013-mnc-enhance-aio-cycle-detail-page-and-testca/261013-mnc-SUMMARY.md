---
quick_id: 261013-mnc
status: complete
date: 2026-10-13
commits: [019d80bd, 5dc7c9a0, e47b542b]
---

# Quick Task 261013-mnc: AIO cycle detail + run detail UX rework — Summary

Executed as three sequential executors (one per task, fresh context each, worktree-isolated, ff-merged).

| Task | Commit | Scope |
|---|---|---|
| 1 Data layer | 019d80bd | live-shape normalisers, status-ID parity (IN_PROGRESS), 9-level priority rank, test case detail service, shared hooks |
| 2 Cycle detail | 5dc7c9a0 | header metadata line, 4 KPI tiles + bar, Executions list, Defects list, skeletons |
| 3 Run detail | e47b542b | key+title header, Prev/Next (n/N), step cards, sidebar w/ test case meta |

Live probe (user-run) results: 261013-mnc-PROBE-RESULTS.md.

_Note: per-task executor note files were lost during assembly (orchestrator shell error); notes below are reconstructed from the executors' final reports._

## Task 1 — Data layer (019d80bd)
- types.ts: AioCustomField, AioTestCaseDetail; AioCycle/AioTestRun/AioTestRunStep extended with probe-confirmed fields only.
- cycles.ts: normalizeCycle maps P1 fields (owner, start/end/created/updated/closed dates, closedByID, isClosed, folder, release/task IDs); exported normalizeCustomFields (object/array/empty value shapes, strips `Cycle-` prefix); exported chipStatusFromId; runs list maps executedByID, createdDate, assignmentDate; executedDate = latestTestRun.updatedDate.
- issue-steps.ts: run status via chipStatusFromId (52→IN_PROGRESS, 901→PASS) with name fallback; steps sorted by stepOrder; testData only when non-empty; no longer reads testCase.
- testcases.ts (new): fetchAioTestCaseDetail (null on 404, ApiError on 401).
- statusStyles/aioUtils: IN_PROGRESS blue pill + "In progress" label; normalizeStatus returns 'inProgress'.
- lib/aio-defect-sort.ts: priorityRank / compareDefectPriority for the custom 9-level scheme.
- aio-cycle/useAioCycleData.ts + useCycleDefects.ts extracted (same query keys); page rewired with no visual change; existing page tests unmodified.
- Tests: 3316 passed.

## Task 2 — Cycle detail redesign (5dc7c9a0)
- AioCycleDetailPage.tsx reduced to ~228-line composition.
- New aio-cycle/: AioTile, UserChip, CycleHeader, CycleKpiTiles, ExecutionsList, DefectsList. AioCyclesDashboard import-only change.
- relativeTime moved to lib/relative-time.ts (re-exported from IssueDetailContent).
- Header metadata: owner, folder, dates (overdue red), Closed/Updated relative, custom fields, last run — missing items omitted.
- 4 KPI tiles + legend-free h-2.5 segmented bar with ≤2-row tooltips.
- Executions: search, single-select radio chips w/ counts (In progress only if >0), sortable headers, one-line flex rows w/ status rail, overlay "Open run for {key}" button; empty-id runs muted/non-clickable.
- Defects: summary strip; filters/sort preserved (compareDefectPriority); triggered-by chips open the run; overlay button pattern.
- Skeletons: AioCycleDetailSkeleton rebuilt; AioRunDetailSkeleton added.
- Deviations: UserChip takes jiraBaseUrl/token props (avoid per-row Stronghold reads); defect rows keep "—" for missing values (existing tests); row-click tests now drive the overlay button; columnheader assertions → text queries.
- Tests: 3328 passed.

## Task 3 — Run detail redesign (e47b542b)
- Header: test case key + title from runs list (fallback: test case detail title, then `Run {id}`).
- testcase-detail query enabled once tcKey known; failure only hides description/meta.
- Prev/Next with position n/N, replace navigation, ArrowLeft/Right keys (ignored in inputs), skips empty-id runs.
- @container two-column grid (280px sidebar ≥900px, stacked below).
- RunStepCard: status rail, FAIL/BLOCKED ring, Step/Expected/Actual/Test data, per-step defect chips.
- RunSidebar: run status, assignee, executed by (if differs), last updated, created, runs ×N, test case meta (type, neutral status pill, folder, owner, version, custom fields), back-to-cycle link, compact defects.
- Tests rewritten (24), fixtures mirror probe shapes. Full suite 3343 passed. Grep for objective|isArchived|isAutomated|precondition in UI files: none.
- Kept defect-click breadcrumb label `Run {runId}` (existing test depends on it).

## UAT polish rounds (2026-10-13) — APPROVED by user

Inline fixes after execution, each its own commit (all through the full pre-commit suite):

| Commit | Change |
|---|---|
| 28a57318 | Cycle page: single-page scroll (header/tiles scroll away), sticky tab bar + column headers; tighter header/tiles |
| 6bbdea1c | Run detail: back-to-cycle lives in the always-rendered breadcrumb (no duplicate header link); breadcrumb consumes the cycle entry (WR-01) |
| 3217b4f6 | Steps as one compact list; per-step defects clickable |
| bf591948 | Run + step defects consolidated into one main-column Defects section (assignee, linked steps) |
| aaa8a8ab / 615182db | Consistency pass; step defects as one-line strips with summary/priority/status/assignee |
| c534f97e → c576f05e | Dropped custom card panels for app detail-page conventions (h3 headings, border-l sidebar, MetaRow geometry), then middle ground: app's rounded-lg border frames + bg-muted/40 strips |
| bf86bc73 | Resizable sidebar (useResizable, persisted `settings.aioRunDetailPanelWidth`, default 320) |
| 8c0981b8 | Main column and sidebar scroll independently (sidebar stays put) |
| 79fe8faf / 28d21990 | Defects as a framed table (Key/Summary/Steps/Priority/Assignee/Status); roomier spacing |
| f6301da3 | Polish: '—' for missing Expected, aligned step number, wider Priority column, focus rings |
| 413e98e9 | Coloured AIO test case status pills (`aioTestCaseStatusTone`) |
| 3b6d1891 → afe70d5a | Tried full-width step layout — reverted at user request |
| d5969028, 09bbcc62 → cdb553d4 | Tried merging # and Status (badge, then icon) — reverted; separate columns kept |

Final approved state: commit cdb553d4.

## Open follow-ups (from 261013-mnc-REVIEW.md, not fixed)
- CR-01 cycle page blank when only runsQuery errors (pre-existing gating).
- CR-02 status-map init failure cached as success for 1h (pre-existing, 6ee7615e).
- WR-02..WR-07 (arrow-key modifiers, project-id error state, defect link on unresolved rows, vanished In-progress chip, unknown status-ID fallback / N/A→PASS decision, epoch date guards).
