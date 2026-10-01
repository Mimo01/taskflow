---
phase: quick-261001-ilq
plan: 01
subsystem: epic-progress
tags: [cfd, forecast, recharts, tooltips, jira-changelog]
requires: [261001-hsz]
provides:
  - adaptive working-day forecast (done / too-early / stalled / not-converging / ok) with analytic range + confidence
  - cumulative flow diagram from Jira status history, with Remaining and forecast + range band
  - hero + Finish/Remaining/Risks strip, Jira-like assignee rows with status-coloured chips
  - one tooltip surface (TOOLTIP_SURFACE / TooltipBody / TooltipRow) and one status colour source
affects: [EpicProgressSection, EpicTimeBurnup, EpicProgressCells, IssueDetailContent]
key-files:
  created:
    - taskflow/src/lib/statusStyles.test.ts
    - taskflow/src/components/ui/tooltip-body.tsx
    - taskflow/src/components/ui/tooltip-body.test.tsx
    - taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
  modified:
    - taskflow/src/lib/epic-progress.ts
    - taskflow/src/lib/statusStyles.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira-changelog.ts
    - taskflow/src/components/ui/tooltip.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
    - taskflow/src/routes/dashboard/EpicProgressCells.tsx
    - taskflow/src/routes/dashboard/IssueDetailContent.tsx
decisions:
  - "Forecast core is pure (forecastFromThroughput) with named constants; no thresholds were tuned - all 8 pinned cases passed on first run."
  - "optimistic/pessimistic day counts are clamped to bracket the likely count after ceil (nOpt <= nLikely <= nPess)."
  - "ratePerWeek is the gross done rate (mu_d * 5); scopeRatePerWeek is mu_s * 5; the net mu drives the date."
  - "clippedAfter is the axis cap date; the tooltip reads 'pessimistic after {cap}'."
metrics:
  tasks: 3
  completed: 2026-10-01
---

# Phase quick-261001-ilq Plan 01: Epic progress CFD, adaptive forecast, hero, unified tooltips Summary

Fourth iteration of the epic progress section: working-day EWMA forecast with explicit states and an analytic 80% range, a status-history cumulative flow diagram with Remaining and a forecast band, a hero + 3-cell strip, Jira-style assignee rows with status-coloured chips, and a single tooltip surface and status colour source.

## Commits (branch worktree-agent-ac4aedf350f60b602)

| Task | Hash | Message |
| ---- | ---- | ------- |
| 1 | d6075fc6 | feat(261001-ilq): adaptive forecast, CFD derivation, status-history fetcher, status colour map |
| 2 | dd2dfc4a | feat(261001-ilq): hero + stat strip, Jira-like assignee rows, unified tooltips and status colours |
| 3 | 2a3db14c | feat(261001-ilq): cumulative flow diagram and time chart with remaining and forecast band |

Each commit ran the pre-commit hook (biome, tsc incl. tests, full vitest): final run 203 files passed, 2988 tests passed, 2 skipped, 7 todo.

## What was built

- **Task 1 (lib/services):** `STATUS_CATEGORY_COLOR` / `statusCategoryColor`; working-day helpers; `forecastFromThroughput`, `deriveAdaptiveForecast`, `deriveTimeForecast`; `deriveSummary`; `buildStatusCategoryLookup`; `deriveCfd`, `deriveProjection`, `withProjection`; `AssigneeBucket.avatarUrl`; `fetchEpicStatusHistory` (25-key chunks, bounded pool, sorted ascending, truncated-history top-up via `/issue/{key}?expand=changelog`, `Epic Link` joinedAt).
- **Task 2 (UI):** `tooltip-body.tsx` (surface + body + row), `TooltipContent` uses `TOOLTIP_SURFACE`; hero + Finish/Remaining/Risks strip; assignee rows with `CachedAvatar` 20px and fixed-width numeric chips (`role="img"`, aria-label carries the category word, zeros `opacity-40`); worklog query lifted to `useEpicWorklogs` (Time only); quick-peek and story mini bar converted; old `Forecast`/`deriveForecast` removed.
- **Task 3 (charts):** `useEpicStatusHistory` (Count/SP only) and `useJiraStatusList` (`['jira-statuses']`); `EpicCfdChart` (stacked step areas, Remaining line, dashed forecast, non-stacked `[low, high]` band, numeric time axis, custom legend and note, wrapper `data-history`); `EpicTimeBurnup` with Estimate/Logged/Remaining + forecast/band; `EpicChartTooltip` (+ `cfdRows`, `timeRows`); `deriveBurnup`/`BurnupPoint` removed.

## Intentional test changes (1-18)

1. epic-progress.test.ts: whole `describe('deriveForecast')` block (4 tests) deleted, import removed. Intent ported to `deriveSummary` + forecast case table (Task 1).
2. EpicProgressSection.test.tsx 'renders all panels': `epic-stat-tile` length 4 -> 3, added `getByTestId('epic-hero')`.
3. 'shows "Not enough data" for insufficient throughput' renamed 'shows "Too early to tell" ...', asserts `getByText('Too early to tell')`.
4. 'shows Complete and no projected date at 100%': `queryByText('Not enough data')` -> `queryByText('Too early to tell')`.
5. 'Time mode shows Estimated / Logged / Remaining / % logged tiles' rewritten as 'Time mode hero shows % logged and the logged line; strip shows Finish / Remaining / Risks': hero contains `50%` and `1h 30m of 3h logged`; 3 tiles; tiles[1] starts with `Remaining2h`.
6. 'Time mode assignee row shows logged / estimate': `getByText('1h 30m / 3h')` -> `getByLabelText('logged 1h 30m')` and `getByLabelText('estimate 3h')` within the row.
7. 'keyboard focus on a tile shows the raw counts' -> 'keyboard focus on the hero shows the category rows': 4th Tab lands on `epic-hero`; rowTexts equal `['Done150%', 'In progress00%', 'To do150%']` (replaces `findByText('1 of 2 done')`).
8. 'hovering the assignee bar ...': tooltip title 'Amy' plus rowTexts `['Done1h', 'In progress0m', 'To do2h', 'Logged1h 30m', 'Estimate3h']` (replaces `done: 1h` / `to do: 2h` / `1h 30m logged of 3h`).
9. Time loading-skeleton and error/Retry tests: `epic-stat-tile` length 4 -> 3 (fetch/Retry assertions unchanged).
10. 'Estimated tile uses the subtask-sum formula ...' -> 'hero uses the subtask-sum estimate and its tooltip explains the formula': hero contains `of 3h logged`; hovers `epic-hero` to find `ESTIMATE_FORMULA_NOTE`.
11. 'Remaining tile tooltip says it replaces the Jira remaining estimate': hovers tile `[1]` instead of `[2]`.
12. Harness: all bare renders of EpicProgressSection go through `renderSection` (QueryClientProvider); the '@/services/jira' partial mock gained `fetchEpicStatusHistory` and `fetchAllJiraStatuses`. Assertions unchanged.
13. EpicProgressCells.test.tsx EPIC-05: `5 Done` / `3 In Progress` / `2 To Do` -> rowTexts `['Done5', 'In progress3', 'To do2']`; `8 of 20 SP done` kept.
14. EpicsPage.test.tsx: same conversion as 13 (`5/10` and the hover step unchanged; added the `8 of 20 SP done` note wait).
15. IssueDetailContent.test.tsx mini bar: `Logged 30m`, `Estimate 2h`, `Remaining 1h 30m`, `Remaining 0m` -> rowTexts `Logged30m`, `['Estimate2h','Logged30m','Remaining1h 30m']`, `Remaining0m`. `No estimate` and the formula-note assertions unchanged.
16. epic-progress.test.ts: `describe('deriveBurnup')` deleted, the time-metric `deriveBurnup` test deleted, import removed. In 'review fixes (261001-fmk)' the clamp test keeps its `doneDateKey` assertion (burnup assertion dropped); the 'counts a story created past local today' test was NOT deleted but ported to `deriveCfd` (see Deviations).
17. EpicProgressSection.test.tsx 'renders all panels': `getByText('Scope by story creation date')` -> `getByTestId('epic-cfd-note')` present and `getByText('Completed')` within `epic-cfd-legend`. `getByTestId('epic-burnup')` unchanged.
18. 'shows "No timeline data" ...' unchanged, passes with the CFD.

Unchanged and green: EpicDetailSheet assertions (/Stories/, 'In Progress', 'Done'), status-bar hover test, legend 'In Review · 1 · 5 SP' and `/Done · 1/`, one-tab-stop-per-row, '25%'/'10%' toggle, 'Count and SP never fetch worklogs', skeleton/no-Card.

## Deviations from Plan

1. **[Setup] Base reset.** The worktree HEAD was 7f156622, not 6269fc28; reset --hard to 6269fc28 per the base check.
2. **[Test port, within change 16]** The 'counts a story created past local today at today' test was converted to `deriveCfd` instead of being deleted (same intent, keeps coverage). Not in the plan's exact list; flagged for review.
3. **Neighbour mock additions (planned in Task 3 g, not a deviation in kind):** `IssueDetailContent.test.tsx`, `IssueDetailPage.progressive.test.tsx` and `EpicDetailSheet.test.tsx` gained `fetchEpicStatusHistory` / `fetchAllJiraStatuses` mocks. These suites also passed before the mocks (queries error silently into the fallback), so the additions are defensive. Those files also gained the `rowTexts` helper where needed (changes 13-15).
4. **Forecast clamping detail.** After `ceil`, `nPess = max(nLikely, ceil(s+^2))` and `nOpt = min(nLikely, ceil(s-^2))` so the rounded triple is always ordered. This is not a threshold change.
5. **Extra tests added** beyond the plan's list: EpicChartTooltip time rows and SP formatting; status-history note tests for all four states.
6. Biome `--write` reformatted an unrelated hunk in `IssueDetailPage.progressive.test.tsx` (pre-existing drift); that hunk was reverted so the file only carries the mock addition.

No auth gates. No stubs: every UI element is wired to data. No new threat surface beyond the plan's threat model (keys are regex-filtered and URL-encoded in `fetchEpicStatusHistory`; Jira strings render as React text only).

## Forecast threshold observations

All eight pinned cases passed on the first run with the RESEARCH constants (MIN_WINDOW 3, MAX_WINDOW 30, STALL 10 wd, Z 1.28, MIN_EVENTS 2, sigma floor 0.15 mu, inflation 1 + 2/W). Case 1 gives `nLikely = 27` (W = 5, mu ~ 0.377/wd), case 3 is `high` confidence with `(nPess - nOpt)/nLikely = 0.05`. One behaviour worth knowing: a 1-completion epic with age >= 10 working days skips "too early" and forecasts from a very low rate (wide band, `low` confidence), because "too early" requires `age < 10`.

## UAT items (real Tauri / WKWebView app)

- Hover tooltips on hero, strip cells, status/assignee bars, chart (recharts tooltip hover is untestable in jsdom).
- CFD shapes against a real Data Center changelog (history order, `from`/`to` ids, truncation top-up path).
- Assumption A3: whether DC `Epic Link` changelog `toString` carries the epic key (joinedAt is skipped harmlessly if not).
- Numeric time axis tick labels and the forecast band rendering in WebKit.
- Time-mode forecast start point: the forecast line starts at the chart's Remaining and projects from `deriveTimeTotals().remaining` (equal by the existing invariant).

## Self-Check: PASSED

- Commits d6075fc6, dd2dfc4a, 2a3db14c exist on branch worktree-agent-ac4aedf350f60b602.
- Created files verified on disk; `.at(` count in epic-progress.ts = 0; `fetchEpicStories` untouched; no `color-gray-400` / `color-green-500` left in `issue-detail/*.tsx`.
