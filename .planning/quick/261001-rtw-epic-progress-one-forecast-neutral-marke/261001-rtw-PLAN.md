---
phase: quick-261001-rtw
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/components/ui/tooltip-body.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.test.tsx
autonomous: true
requirements: [QUICK-261001-rtw]

must_haves:
  truths:
    - "There is one forecast. The CFD (Count and SP) and the Time chart both draw the averaged forecast (averageForecasts, the same result the Finish tile shows). Each chart projects from its own current remaining, in its own unit, down to 0 at the averaged likely date. The band reaches 0 at the averaged earliest and latest dates. No per-metric forecast is drawn anywhere (D: One forecast)"
    - "When the averaged state is not ok, no chart draws a projection. Each chart legend and the Finish tile show the same state text: Complete / Too early to tell / Stalled / Not converging"
    - "On a projected key date, the chart tooltip shows a Likely / Earliest / Latest row with exactly the same label, date text and 'N working days' as the Finish tooltip"
    - "Only statuses have colour in tooltips and charts. TooltipRow markers are status | line | dashed | band | icon. Every non-status marker is monochrome (foreground or muted-foreground). Non-status chart series are neutral: CFD Remaining, forecast line and band in both charts, Time Estimate / Logged / Remaining. The story mini bar's logged fill is neutral, while overrun keeps its red warning"
    - "The bar-to-legend gap is at least 12px for the hero, the status bar and the assignee rows. No hover trigger in the section has a negative margin"
    - "Count, SP and Time share one status-bands model (done / in progress / to do, weighted 1 / SP / estimate seconds). The hero %, hero bar, caption, status bar, assignee bars, assignee chips and band tooltips all read it, so in Time mode a person's bar and chips show the same three estimate-hour values. Logged vs estimate appears only as neutral tooltip rows"
    - "The Remaining tile has the same structure in every tab. Its Time value (open estimate − logged) equals the Time chart's Remaining for today"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "ProjectionSource, projectFinish, Bands/BANDS/bandTotal/bandPct/summaryBands, formatChip, FINISH_STATE_TEXT, finishDateRows, formatFinishDate"
      exports: ["projectFinish", "Bands", "BANDS", "bandTotal", "bandPct", "summaryBands", "formatChip", "FINISH_STATE_TEXT", "finishDateRows", "formatFinishDate"]
    - path: "taskflow/src/components/ui/tooltip-body.tsx"
      provides: "MarkerGlyph + TooltipRow with marker status|line|dashed|band|icon and tone strong|muted"
      contains: "data-marker"
    - path: "taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx"
      provides: "MARKER_ICON, METRIC_ICON, SERIES (neutral chart series styles)"
      exports: ["MARKER_ICON", "METRIC_ICON", "SERIES"]
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx"
      provides: "BandBar, BandChips, BandBreakdown shared by hero / assignee rows / tooltips"
      exports: ["BandBar", "BandChips", "BandBreakdown"]
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "projectFinish"
      via: "CFD projection from the averaged finish + CFD today remaining"
      pattern: "projectFinish\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx"
      to: "projectFinish"
      via: "finish prop + chart's own today remaining (hours)"
      pattern: "projectFinish\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      to: "finishDateRows"
      via: "Finish tooltip rows (shared with EpicChartTooltip)"
      pattern: "finishDateRows\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "BandChips"
      via: "assignee rows (bar + chips from the same bucket bands)"
      pattern: "<BandChips"
---

<objective>
This is the sixth iteration of the epic detail progress section. The visual language from 261001-ilq/-qvu stays: divider layout, hero + stat strip, TooltipBody/TooltipRow surface, STATUS_CATEGORY_COLOR for statuses. It addresses the user's 5 feedback points in 261001-rtw-CONTEXT.md:
1. One shared forecast in every chart.
2. Colour only for statuses; neutral glyphs/icons for everything else.
3. Legend spacing root-cause fix (Tailwind v4 space-y vs -my).
4. Time-mode person bars that agree with their chips.
5. Count / SP / Time unified through one generic bands model.

Output: one plan with 3 tasks. Each task is ONE commit (tests + impl together).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261001-rtw-epic-progress-one-forecast-neutral-marke/261001-rtw-CONTEXT.md
@.planning/quick/261001-qvu-epic-progress-forecast-averaging-holiday/261001-qvu-SUMMARY.md
@taskflow/src/lib/epic-progress.ts
@taskflow/src/components/ui/tooltip-body.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx

Repo layout: the app is in `taskflow/` and `.planning/` is at the repo root. Run all commands from `/Users/mimo/Documents/Projects/taskflow/taskflow`.

The pre-commit hook runs biome, `tsc` (including tests; no `Array.prototype.at`, use `arr[arr.length - 1]`) and the full vitest suite. Make ONE commit per task with tests and implementation together. Never use `--no-verify`. The Biome baseline drifts, so gate on "no NEW diagnostics in touched files". Do NOT fix the fetchAllSearchPages 200-step bug.

EpicDetailSheet.test text-collision rule (carried): no visible standalone text node may equal "Done" or "In Progress", and none may contain "Stories". Captions and legend texts are single template-literal nodes. Tooltip content renders only on hover.

One row = one line (user preference). Chips never wrap.

## Interfaces (Task 1 builds the lib items; Tasks 2-3 consume them exactly)

lib/epic-progress.ts (all new items exported):
- `type ProjectionSource = Pick<EpicForecast, 'state' | 'remaining' | 'nLikely' | 'nOpt' | 'nPess' | 'likely' | 'optimistic' | 'pessimistic'>`. `deriveProjection(forecast: ProjectionSource, today, historyStart, cal?)` changes only its parameter type, so existing EpicForecast callers and tests still compile.
- `projectFinish(finish: AveragedForecast, remaining: number, today: string, historyStart: string | null, cal?: WorkCalendar)` returns `deriveProjection({ ...finish, remaining }, today, historyStart, cal)`. It is empty unless finish.state is 'ok' and remaining > 0. These are the existing deriveProjection guards; AveragedForecast already carries state / nLikely / nOpt / nPess / likely / optimistic / pessimistic.
- `interface Bands { done: number; inProgress: number; todo: number }`
- `BANDS: readonly { key: keyof Bands; cat: Cat }[]` = done→'done', inProgress→'indeterminate', todo→'new' (display order)
- `bandTotal(b: Bands): number`
- `bandPct(b: Bands, key: keyof Bands): number` = Math.round(share × 100), 0 when the total is 0
- `summaryBands(s: EpicSummary): Bands` = { done: s.doneTotal, inProgress: s.inProgressTotal, todo: s.todoTotal }
- `formatChip(n: number, metric: Metric): string`: time uses formatDuration(n); count/sp use the integer or 1-decimal number with no unit. This is the old section `chipNumber` moved here.
- `FINISH_STATE_TEXT: Record<Exclude<ForecastState, 'ok'>, string>` = { done: 'Complete', 'too-early': 'Too early to tell', stalled: 'Stalled', 'not-converging': 'Not converging' }
- `formatFinishDate(key: string, today: string): string`. This is the Summary's private `dateText` moved here: formatDateKey, plus `, YYYY` when the year differs from today's.
- `finishDateRows(finish: AveragedForecast): { key: 'likely' | 'optimistic' | 'pessimistic'; label: 'Likely' | 'Earliest' | 'Latest'; date: string; n: number }[]`, in the order Likely, Earliest, Latest. It returns [] unless state is 'ok' and every date and n is non-null.

tooltip-body.tsx:
- `type TooltipMarker = 'status' | 'line' | 'dashed' | 'band' | 'icon'`
- `type MarkerTone = 'strong' | 'muted'`. strong = var(--color-foreground), muted = var(--color-muted-foreground).
- `MarkerGlyph({ marker, color?, tone?, icon? })` is ONE aria-hidden span carrying `data-marker={marker}` and, for neutral markers, `data-tone={tone}`. TooltipRow child[0] and the chart LegendItem both use it.
- `TooltipRow` props: `{ label; value; sub?; marker?; color?; tone?; icon? }`. The `dashed` prop is REMOVED (use marker 'dashed'). The default marker is 'icon' when `icon` is set, 'status' when `color` is set, and 'line' (muted) otherwise. `color` is used ONLY by 'status'; neutral markers ignore it.

epic-markers.tsx (new, issue-detail):
- `MARKER_ICON` (lucide components, all verified present in lucide-react 0.577) = { date: CalendarDays, fromToday: CalendarClock, count: Hash, sp: Weight, time: Clock, logged: Clock, estimate: Timer, remaining: Hourglass, person: User }
- `METRIC_ICON: Record<Metric, LucideIcon>` = { count: Hash, sp: Weight, time: Clock }
- `SERIES`, the neutral chart series styles. It is the single source for chart props, tooltip row markers and legend glyphs:
  - remaining: stroke var(--color-foreground), strokeWidth 1.5, solid. Marker line, tone strong.
  - forecast: stroke var(--color-foreground), strokeWidth 1.5, strokeDasharray '4 4'. Marker dashed, tone strong.
  - band: fill var(--color-muted-foreground), fillOpacity 0.15. Marker band, tone muted.
  - logged: stroke var(--color-muted-foreground), strokeWidth 2, solid. Marker line, tone muted.
  - estimate: Area fill var(--color-muted-foreground), fillOpacity 0.08, stroke var(--color-muted-foreground), strokeWidth 1. Marker band, tone muted.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib — one-forecast projection, generic status-bands model, shared finish/format helpers</name>
  <files>taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts</files>
  <behavior>
    Fixtures: reuse the test file's WED, `st()` helper and the `ok` EpicForecast fixture. Build an averaged finish with averageForecasts of two ok parts (nLikely 5/5, nOpt 4/4, nPess 8/8), so it is ok with nLikely 5, nOpt 4, nPess 8.
    - projectFinish(finish, 10, WED, '2026-09-01') and projectFinish(finish, 40, WED, '2026-09-01') give identical date lists and wd arrays. Every forecast and band value in the R=40 run is exactly 4× the R=10 run.
    - On the projection: the forecast is 0 at finish.likely. band[0] is 0 at finish.optimistic. band[1] is 0 at finish.pessimistic. points[0] is { forecast: R, band: [R, R], wd: 0 }.
    - Non-ok averaged states (done, stalled, too-early, not-converging, built via averageForecasts fallbacks) give points []. remaining 0 gives []. A holiday calendar passed through gives the same holiday flatness as deriveProjection.
    - Bands invariant: for each metric in count/sp/time, summing deriveAssigneeBuckets(stories, metric, SP) done/inProgress/todo per key equals summaryBands(deriveSummary(stories, metric, SP)). In time mode the values are estimateOf sums by category (e.g. done 3600, todo 7200), not logged seconds.
    - bandPct({done:1,inProgress:1,todo:2}, 'todo') === 50. Any key on an all-zero total gives 0. bandTotal sums the three.
    - formatChip(2, 'count') === '2'. formatChip(2.25, 'sp') === '2.3'. formatChip(5400, 'time') === '1h 30m'. formatChip(0, 'time') === '0m'.
    - finishDateRows(ok finish) gives labels ['Likely','Earliest','Latest'], dates [likely, optimistic, pessimistic] and n [5,4,8]. A non-ok finish gives [].
    - FINISH_STATE_TEXT values are exactly 'Complete', 'Too early to tell', 'Stalled' and 'Not converging'.
    - formatFinishDate('2026-10-07', WED) === 'Oct 7'. formatFinishDate('2027-01-04', WED) === 'Jan 4, 2027'.
    - Remaining consistency: a fixture with worklogs that reconcile, e.g. an open story est 2h with 3h logged (overrun), an open story est 4h with 1h logged, and a done story. The last deriveTimeBurnup point's (estimate − logged) equals deriveTimeTotals(stories).remaining.
  </behavior>
  <action>
In `taskflow/src/lib/epic-progress.ts`, add every lib item in the Interfaces block exactly as specified (per D "One forecast" and D "Unified tabs").
- Widen deriveProjection's first parameter to `ProjectionSource`. Do not change its body.
- Add projectFinish next to withProjection. Its doc comment says that every chart projects the ONE averaged forecast from its own remaining, in its own unit.
- Add the Bands section after deriveSummary.
- Move `chipNumber` semantics into formatChip, and move `dateText` semantics into formatFinishDate. Task 3 deletes the UI copies.
- Add FINISH_STATE_TEXT and finishDateRows after averageForecasts.
- Leave TimeTotals.pctLogged in place: lib tests assert it, and it is harmless data. Task 3 removes only its UI usage.
- No existing function changes behaviour.

Tests: add the describes 'projectFinish (261001-rtw)', 'status bands (261001-rtw)' and 'finish helpers (261001-rtw)' to `epic-progress.test.ts`, covering every behavior bullet. NO existing assertion in this file changes. If one fails, the implementation is wrong.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts && npx tsc --noEmit && npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts && test "$(grep -v '^\s*//' src/lib/epic-progress.ts src/lib/epic-progress.test.ts | grep -c '\.at(')" = "0"</automated>
  </verify>
  <done>All new lib tests pass and every pre-existing lib test passes unchanged. Committed as `feat(261001-rtw): one-forecast projection, status bands model, shared finish helpers`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: neutral markers + series, both charts draw the averaged forecast, story mini bar</name>
  <files>taskflow/src/components/ui/tooltip-body.tsx, taskflow/src/components/ui/tooltip-body.test.tsx, taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/IssueDetailContent.test.tsx</files>
  <behavior>
    - TooltipRow with color 'rgb(1, 2, 3)' and no marker: 4 direct children, child[0] has data-marker 'status' and background rgb(1, 2, 3) (the existing structure test is unchanged).
    - marker 'line' tone 'strong': child[0] has class h-0.5, data-tone 'strong' and background var(--color-foreground), even when a color prop is passed.
    - marker 'dashed': child[0] has class border-dashed and a neutral border colour.
    - marker 'band': child[0] has data-marker 'band' and a neutral translucent fill.
    - icon: child[0] has data-marker 'icon' and class text-muted-foreground, contains the svg, and has no inline color even when a color prop is passed. The row has 3 children.
    - No colour and no icon: data-marker 'line', tone muted.
    - No neutral marker ever renders a value from Object.values(STATUS_CATEGORY_COLOR).
    - EpicChartTooltip:
      - CFD status rows keep their status swatches (existing assertions hold).
      - Remaining is a strong line.
      - Forecast is a dashed row with border-dashed (existing assertion holds).
      - Range has data-marker 'band'.
      - 'From today' has data-marker 'icon'.
      - Time rows Estimate/Logged/Remaining are band-muted / line-muted / line-strong with no status colour (texts unchanged).
      - With `finish` + `today` props, a future datum dated finish.likely gets an extra row 'Likely' + formatFinishDate(likely, today) with sub '5 working days' and an icon marker. The text equals the Finish tooltip's Likely row. Earliest and Latest work the same way.
    - Section: in the ok fixture (fake time 2026-09-30, okList with `est: 3600` on the 5 open stories), the CFD legend shows 'Forecast' in Count mode and the Time chart legend shows 'Forecast' in Time mode. Both come from the same averaged finish.
    - Section: when the finish is not ok (the default `stories` fixture is too early), the CFD legend shows a node `epic-forecast-state` with text 'Forecast: Too early to tell' and no 'Forecast' item. The Finish tile shows 'Too early to tell'.
    - Story mini bar: a non-overrun fill has no status-colour class (`bg-muted-foreground`, not green). Overrun still has bg-red-500. Tooltip rows Estimate / Logged / Remaining each have data-marker 'icon'. rowTexts are unchanged.
  </behavior>
  <action>
(a) `tooltip-body.tsx`, per D "Colour = status only".
- Implement MarkerGlyph + the TooltipRow API from Interfaces. Glyph shapes:
  - status: `size-2 rounded-[2px]` with background = color.
  - line: `h-0.5 w-2.5 rounded-full` with background = the tone colour.
  - dashed: `h-0 w-2.5 border-t-2 border-dashed` with borderColor = the tone colour. The class list must keep the `border-dashed` token.
  - band: `h-2 w-2.5 rounded-[2px]` with background = the tone colour at ~0.3 opacity (via `opacity-30` on the glyph) plus a 1px border in the tone colour.
  - icon: `flex size-3 shrink-0 items-center justify-center text-muted-foreground` wrapping the icon.
- Remove the old 'swatch' / 'dot' names and the `dashed` prop.
- Update the doc comment: colour is for statuses only; everything else is monochrome.

(b) Create `epic-markers.tsx` with MARKER_ICON, METRIC_ICON and SERIES exactly as specified in Interfaces.

(c) `EpicChartTooltip.tsx`:
- ChartRowSpec becomes `{ key; label; value; marker: TooltipMarker; color?: string; tone?: MarkerTone }`.
- cfdRows: the status rows are marker 'status' with STATUS_CATEGORY_COLOR. Remaining uses SERIES.remaining (line strong).
- timeRows: Estimate band muted, Logged line muted, Remaining line strong. Read these from SERIES; no STATUS_CATEGORY_COLOR import is left in timeRows.
- Forecast row: marker 'dashed' tone strong. Range row: marker 'band' tone muted. 'From today' row: icon MARKER_ICON.fromToday.
- New optional props `finish?: AveragedForecast | null` and `today?: string`. For a future datum, append the finishDateRows entries whose date === datum.date as TooltipRow { icon: MARKER_ICON.date, label, value: formatFinishDate(date, today), sub: `${n} working days` }. This is identical to Task 3's Finish tooltip rows (D "Chart tooltip forecast rows and the Finish tooltip use identical labels and dates").
- Delete FORECAST_COLOR / REMAINING_COLOR and update their importers.

(d) Charts, per D "One forecast" and D "neutral chart series".
- EpicCfdChart:
  - Status Areas keep STATUS_CATEGORY_COLOR. The band Area, the Remaining Line and the forecast Line take their props from SERIES. The forecast activeDot fill is SERIES.forecast.stroke.
  - LegendItem becomes `{ label; marker; color?; tone? }` and renders MarkerGlyph, so legend glyphs match the tooltip glyphs.
  - New props `finish: AveragedForecast` and `today: string`, passed to EpicChartTooltip. hasProjection stays.
  - When finish.state !== 'ok', render `<span data-testid="epic-forecast-state">{`Forecast: ${FINISH_STATE_TEXT[finish.state]}`}</span>` in the legend in place of the Forecast item.
- EpicTimeBurnup:
  - Replace the `forecast: EpicForecast | null` prop with `finish: AveragedForecast`.
  - projection = projectFinish(finish, todayRemainingHours, today, base.length > 0 ? base[0].date : null, calendar), where todayRemainingHours = the last base point's `remaining` (already hours; 0 when base is empty).
  - Estimate Area, Logged Line, Remaining Line, band and forecast all use SERIES. No STATUS_CATEGORY_COLOR import remains.
  - The legend uses the SERIES markers and the same not-ok state node as the CFD.
  - Pass finish/today to the tooltip. Update the header comments: the chart draws the shared averaged forecast.
- EpicProgressSection (chart wiring only in this task):
  - Delete `metricForecast` and the `deriveProjection(...)` call.
  - projection = projectFinish(finish, cfdPoints.length > 0 ? (cfdPoints[cfdPoints.length - 1].remaining ?? 0) : 0, today, start, calendar). Check CfdPoint's remaining type and coerce if needed.
  - Pass `finish` + `today` to EpicCfdChart, and `finish` (instead of `forecast={timeForecast}`) to EpicTimeBurnup. timeForecast is still computed for averageForecasts.

(e) `IssueDetailContent.tsx` story mini bar, per D "Story mini bars":
- The non-overrun fill class becomes `bg-muted-foreground`. Overrun stays `bg-red-500` (a warning, not a status).
- Tooltip rows: Estimate uses icon MARKER_ICON.estimate, Logged uses MARKER_ICON.logged, Remaining uses MARKER_ICON.remaining (size-3). Remove the status colours there. Drop the now-unused imports (statusCategoryDotClass / STATUS_CATEGORY_COLOR) only if nothing else in the file uses them; grep first.
- EpicProgressCells.tsx rows are statuses and stay as they are (default 'status' via color). Its test must pass untouched.

INTENTIONAL existing-test changes (only these):
1. tooltip-body.test 'dashed gives a dashed-border swatch': rewritten to `marker="dashed"`. It asserts border-dashed plus a neutral borderColor (var(--color-muted-foreground) for the default tone), not the passed colour.
2. tooltip-body.test 'a row with no colour gets a visible neutral dot': becomes 'a row with no colour or icon gets a muted line glyph' (data-marker 'line', data-tone 'muted', background var(--color-muted-foreground)).
3. tooltip-body.test 'marker line gives a short horizontal bar in the colour': the background is the tone colour; it asserts the passed colour is ignored.
4. tooltip-body.test 'icon renders inside the marker slot, coloured': `style.color` toBe rgb → asserts class text-muted-foreground and an empty style.color. The no-text and 3-children assertions are kept.
5. EpicChartTooltip.test 'shows a From today row...': `toHaveClass('rounded-full')` becomes `toHaveAttribute('data-marker', 'icon')`.
Every other assertion passes untouched, including all section tests, the legend test ('Forecast' is absent when too early, because the state node text differs), the IssueDetailContent overrun test and EpicProgressCells.test.

New tests: the behavior bullets above, in tooltip-body.test, EpicChartTooltip.test, EpicProgressSection.test (new describe 'one forecast (261001-rtw)') and IssueDetailContent.test (neutral fill + icon markers).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/tooltip-body.test.tsx src/routes/dashboard/issue-detail src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/EpicProgressCells.test.tsx src/routes/dashboard/EpicDetailSheet.test.tsx && npx tsc --noEmit && npx biome check src/components/ui/tooltip-body.tsx src/routes/dashboard/issue-detail src/routes/dashboard/IssueDetailContent.tsx && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx | grep -c 'STATUS_CATEGORY_COLOR\|EpicForecast')" = "0" && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicProgressSection.tsx | grep -c 'deriveProjection(\|metricForecast')" = "0" && grep -q "projectFinish(" src/routes/dashboard/issue-detail/EpicProgressSection.tsx && grep -q "projectFinish(" src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx</automated>
  </verify>
  <done>Both charts project only the averaged finish. Non-status series, tooltip markers and legend glyphs are monochrome. The story mini bar's fill is neutral and overrun stays red. Only test changes 1–5 were made to existing tests. Committed as `feat(261001-rtw): one shared forecast in both charts, neutral markers and series`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: unified Count/SP/Time via shared band components, section tooltip markers, spacing root-cause fix</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicBands.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    - The hero in every tab: big % = summaryBands done share (`${summary.pctDone}%`, '—' when summary.total is 0). The bar has 3 `[data-segment]` spans keyed done/indeterminate/new. The caption is `${fmt(done)} of ${fmt(total)} done · ${fmt(inProgress)} in progress` with fmt = formatMetric(·, metric). Time in the g5q `timed` fixture: '33%' and '1h of 3h done · 0m in progress'.
    - Time-mode assignee row (g5q timed, Amy): chips have aria-labels 'done 1h', 'in progress 0m' and 'to do 2h', texts ['1h','0m','2h'], and data-cat ['done','indeterminate','new']. There is no 'logged …' chip. The row tooltip rows are still ['Done1h','In progress0m','To do2h','Logged1h 30m','Estimate3h']. Logged and Estimate have data-marker 'icon', and the band rows have data-marker 'status'.
    - Hero tooltip rows: in Count mode they are unchanged (['Done150%','In progress00%','To do150%']). In Time mode they are the same band rows in hours with share, then Logged and Estimate icon rows, plus the ESTIMATE_FORMULA_NOTE note.
    - Status-bar legend items read `${name} · ${formatMetric(value, metric)}`, so Count shows 'In Review · 1' and Time shows hours.
    - Finish tooltip: Likely / Earliest / Latest rows come from finishDateRows with the date icon, and their text is identical to the chart tooltip's key-date rows. The per-metric rows use METRIC_ICON. The Finish value for non-ok states comes from FINISH_STATE_TEXT.
    - The Remaining tooltip has the same rows and note in every tab: Items (Hash), Story points (Weight), Time (Clock). The note always contains "Replaces Jira's remaining estimate".
    - Risks tooltip rows have data-marker 'icon' and no amber inline colour. Chips keep their amber/muted tones.
    - Spacing: neither epic-status-bar nor any epic-assignee-trigger has a class token starting with '-m'. The status block (`data-testid="epic-status-block"`) is `flex flex-col gap-1.5` and the trigger has `py-1.5` (bar→legend = 12px). The hero caption has `mt-1.5` (hero gap-1.5 + mt-1.5 = 12px).
    - One tab stop per assignee row and zero buttons still hold.
  </behavior>
  <action>
(a) Create `EpicBands.tsx` (per D "Unified tabs"). It has no hooks and renders spans only, because the hero renders inside a button.
- `BandBar({ bands, scale, className, testId })`:
  - A `flex h-full w-full gap-px overflow-hidden rounded bg-muted` span (height comes from className: hero h-2, rows h-3).
  - One span per BANDS entry with value > 0, carrying data-segment = cat, class statusCategoryDotClass(cat) and width = value / (scale ?? bandTotal(bands)) × 100%.
- `BandChips({ bands, metric })`:
  - One role="img" span per BANDS entry with data-testid 'epic-assignee-chip', data-cat, aria-label `${CAT_LABEL[cat].toLowerCase()} ${formatChip(v, metric)}`, text formatChip(v, metric), statusCategoryBadgeClass(cat), and `opacity-40` when 0.
  - Chip class: `rounded px-1 text-center text-[11px] tabular-nums whitespace-nowrap` plus min-w-[2.25rem], or min-w-[3.5rem] when metric is 'time'.
- `BandBreakdown({ bands, metric, share })`: a fragment of 3 TooltipRows (marker status, STATUS_CATEGORY_COLOR[cat], label CAT_LABEL[cat], value formatMetric). When `share` is set, add sub `${bandPct}%`.

(b) `EpicProgressSummary.tsx`:
- Hero: delete the time branch entirely. bands = summaryBands(summary). Use the BandBar (data-testid epic-hero-bar, h-2) and the caption template. The caption gets `mt-1.5` and keeps data-testid epic-hero-caption.
- The hero tooltip is BandBreakdown with share. When metric is 'time', append TooltipRow icon MARKER_ICON.logged 'Logged' formatDuration(time.logged) and icon MARKER_ICON.estimate 'Estimate' formatDuration(time.estimated), with note ESTIMATE_FORMULA_NOTE.
- FinishTile:
  - The value comes from FINISH_STATE_TEXT for non-ok states, or formatFinishDate for ok.
  - Rows come from finishDateRows → { icon: MARKER_ICON.date, label, value: formatFinishDate(date, today), sub: `${n} working days` }.
  - The parts rows use icon METRIC_ICON[p.metric].
  - Delete the local dateText.
- Remaining tile: the rows get METRIC_ICON icons. The note is always present: "Time: open items' estimate minus logged, never below 0. Replaces Jira's remaining estimate so it matches the Time chart."
- Risks: tooltip rows use `icon` only (no color prop, so they render muted). Change the RISK_ICON stalled entry from Hourglass to CirclePause, because Hourglass now means Remaining. The 'No risks found' row keeps CircleCheck.

(c) `EpicProgressSection.tsx`:
- Delete AssigneeChips, chipNumber, CHIP_CLASS and TIME_CHIP_CLASS.
- Assignee rows: bands = { done: a.done, inProgress: a.inProgress, todo: a.todo }. These are already active-metric weighted; time weights = estimateOf, which fixes "do not agree with the data". Use the BandBar inside `epic-assignee-bar` (h-3, scale maxAssignee) and `<BandChips bands metric />`.
- assigneeTip = BandBreakdown (no share) plus, in Time, the Logged (MARKER_ICON.logged) and Estimate (MARKER_ICON.estimate) icon rows.
- The status bar tooltip rows stay status markers. The legend text becomes `${b.name} · ${formatMetric(b.value, metric)}`.
- Spacing root cause (D "Legend spacing — ROOT CAUSE"):
  - The status block becomes `<div data-testid="epic-status-block" className="flex flex-col gap-1.5">`. Its trigger className is `py-1.5` (drop `-my-1.5`).
  - The assignee list becomes `<div className="flex flex-col">`. Its trigger drops `-my-1.5` and uses `py-0.5`, keeping the hover/focus classes, so rows have no negative margins and keep their density.
  - Don't use space-y on any container whose child has its own vertical margin.

INTENTIONAL existing-test changes in EpicProgressSection.test.tsx (only these):
6. 'renders all panels': `getByText('In Review · 1 · 5 SP')` becomes `getByText('In Review · 1')`.
7. g5q 'Time mode hero shows % logged and the logged line...' is renamed 'Time mode hero shows the done share of the estimate...'. '50%' becomes '33%', and '1h 30m of 3h logged' becomes '1h of 3h done · 0m in progress'. The tile assertions are kept.
8. g5q 'Time mode assignee row shows logged / estimate chips' is renamed 'Time mode assignee chips show done / in progress / to do estimate'. The labels become 'done 1h', 'in progress 0m' and 'to do 2h', and queryByLabelText('logged 1h 30m') is null.
9. g5q 'hovering the assignee name or chips opens the row tooltip': the chip hover target `getByText('1h 30m')` becomes `getByLabelText('to do 2h')`. The expected rows are unchanged.
10. hsz 'hero uses the subtask-sum estimate...': `toContain('of 3h logged')` becomes `toContain('1h of 3h done')`.
11. qvu 'hero caption and legend have extra spacing' is renamed 'bar-to-legend spacing uses no negative margins'. 'mt-1' becomes 'mt-1.5'. `parentElement.className toContain 'space-y-3'` becomes epic-status-block having 'flex-col' and 'gap-1.5'. It adds the no-'-m' token assertions for epic-status-bar and every epic-assignee-trigger.
Grep before editing: `grep -n "logged\|· 5 SP\|space-y-3\|mt-1\|1h 30m" src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx`. Any other match must still pass untouched. If it doesn't, stop and record it as a deviation with a reason.

New tests: the behavior bullets above, in a new describe 'unified tabs (261001-rtw)'. They cover the Time chips/bar agreement (the bar segment widths equal the chip values / maxAssignee), the hero tooltip in Time, the Remaining tooltip note in Count, Finish row icon markers, and Risks tooltip icon markers without inline colour.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx src/routes/dashboard/IssueDetailPage.progressive.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicProgressSection.tsx | grep -c -- '-my-\|TIME_CHIP_CLASS\|chipNumber\|AssigneeChips')" = "0" && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicProgressSummary.tsx | grep -c 'pctLogged\|function dateText')" = "0" && grep -q "finishDateRows(" src/routes/dashboard/issue-detail/EpicProgressSummary.tsx</automated>
  </verify>
  <done>Count, SP and Time render through the same band components. In Time mode, person bars and chips show the same three estimate values. Every section tooltip uses the correct marker variant. Bar-to-legend gaps are ≥ 12px with no negative margins. Only test changes 6–11 were made to existing tests. Committed as `feat(261001-rtw): unified Count/SP/Time bands, neutral tooltip markers, legend spacing fix`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira data → UI | Status names, assignee names and issue keys render in legends, chips and tooltips |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-rtw-01 | Tampering / XSS | legend texts, BandChips aria-labels, tooltip rows | accept | Rendered as React text nodes / attributes only; no HTML injection path; data is the user's own Jira data |
| T-rtw-02 | Denial of service | projectFinish | mitigate | Delegates to deriveProjection, which keeps the PROJECTION_MAX_POINTS (260) cap and the clip logic unchanged |
</threat_model>

<verification>
- The full pre-commit hook (biome, tsc including tests, full vitest) passes on each of the 3 commits. No `--no-verify`.
- `grep -rn "\.at(" taskflow/src/lib/epic-progress.ts taskflow/src/routes/dashboard/issue-detail/` gives no new matches.
- Existing-test changes are limited to the numbered list 1–11, and the SUMMARY lists each one.
- `grep -rn "STATUS_CATEGORY_COLOR" taskflow/src/routes/dashboard/issue-detail/` shows uses only for status rows, status areas and band components. Nothing appears for Remaining, Forecast, Range, Logged or Estimate.
- `fetchAllSearchPages` is untouched.
</verification>

<success_criteria>
- All 5 user feedback points from CONTEXT are delivered: one forecast in every chart, colour only for statuses, the legend spacing root cause fixed, Time-mode person bars that agree with the chips, and the tabs unified through one bands model.
- Every locked decision in CONTEXT `<decisions>` is implemented as written:
  - Chart types stay per tab.
  - Each chart projects to the averaged dates from its own remaining.
  - The same state text appears everywhere.
  - Identical forecast labels and dates in the chart tooltip and the Finish tooltip.
  - The 5 marker variants, with neutral markers monochrome.
  - Neutral chart series.
  - The story mini bar is neutral and overrun is a warning.
  - Risk tooltip markers are icons.
  - No negative-margin hover hacks.
  - The bands model drives hero, status bar, rows, chips and tooltips.
  - The Remaining tile has the same structure in every tab.
- UAT (real Tauri app): forecast line/band contrast in light and dark mode, both charts ending at the same dates as the Finish tile, a visible bar→legend gap, and Time-mode person rows.
</success_criteria>

<output>
Create `.planning/quick/261001-rtw-epic-progress-one-forecast-neutral-marke/261001-rtw-SUMMARY.md` when done. List intentional test changes 1–11 and any deviations, including the stalled-risk icon change Hourglass → CirclePause.
</output>
