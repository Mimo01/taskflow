---
phase: quick-261014-jzn
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/aio-cycle-charts.ts
  - taskflow/src/lib/aio-cycle-charts.test.ts
  - taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
autonomous: true
requirements: [QUICK-261014-jzn]

must_haves:
  truths:
    - "The AIO cycle detail page shows a Burndown section in the cycle stats block, below the Cycle Statistics / Execution Distribution / Defect Summary row and above the Executions/Defects tabs"
    - "The chart draws remaining cases (Not Run + In Progress) as a step line over a date x axis, starting at the total case count at the cycle start, with a diamond at each execution coloured by that execution's status"
    - "A thin muted dashed ideal line runs straight from total at cycle start to 0 at cycle end (first/last execution date when start/end missing)"
    - "The chart plot is 140px tall, full width; the page grows by roughly 190px at most"
    - "With runs still loading a 140px skeleton holds the space; with no executed runs the Burndown section is not rendered at all"
    - "Hover tooltip shows at most 3 rows (Remaining, Executed, Ideal) and sits above everything (z-index 50); no legend"
  artifacts:
    - path: "taskflow/src/lib/aio-cycle-charts.ts"
      provides: "cycleBurndownSeries + aioDateMs pure builders"
      exports: ["cycleBurndownSeries", "aioDateMs", "burndownMarkerColor"]
    - path: "taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx"
      provides: "recharts burndown component"
      exports: ["CycleBurndown"]
  key_links:
    - from: "taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx"
      to: "cycleBurndownSeries"
      via: "useMemo over runs + cycle"
      pattern: "cycleBurndownSeries\\("
    - from: "taskflow/src/routes/dashboard/AioCycleDetailPage.tsx"
      to: "CycleKpiTiles"
      via: "cycle prop"
      pattern: "cycle=\\{cycleQuery\\.data\\}"
---

<objective>
Add a compact AIO-style burndown chart to the AIO cycle detail page (AioCycleDetailPage, the page listing the cycle's test cases / executions; a single test case has no time series, so the cycle page is the target). Modelled on AIO's "Burndown" (step line of remaining cases, diamond per execution, straight grey ideal line, date x axis), restyled to Taskflow's chart look (EpicTimeBurnup conventions: ChartContainer, no axis lines, muted ticks, no legend).

Purpose: show test-execution progress against the plan at a glance without making the page much taller.
Output: pure series builder with unit tests, a CycleBurndown component, wired into the cycle stats block.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@./CLAUDE.md
@taskflow/src/lib/aio-cycle-charts.ts
@taskflow/src/lib/aio-cycle-charts.test.ts
@taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
@taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx

Reference only (read the cited lines, not whole files):
- taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx lines 158-270: ChartContainer + ComposedChart + XAxis(type number, scale time) + YAxis + ChartTooltip + stepAfter Line styling to copy.
- taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx exports PLOT_MARGIN, Y_AXIS_WIDTH (=40), useElementWidth(ref).
- taskflow/src/lib/epic-progress.ts: timeTicks(fromDateKey, toDateKey, widthPx) returns AxisTick[] ({ t, label }); formatDateKey(key).
- taskflow/src/lib/aio-cycle-list.ts: toDateKey(raw) (epoch-ms or ISO -> local YYYY-MM-DD), StatusKey.
- taskflow/src/lib/aioUtils.ts: normalizeStatus(raw) mapping to mirror (do not import: module pulls in services).
- taskflow/src/components/ui/tooltip-body.tsx: TOOLTIP_SURFACE, TooltipBody, TooltipRow.

Data facts (verified in services/aio):
- AioTestRun.executedDate = ISO of latestTestRun.updatedDate (the API has no real executed date); status is a chip status string ('PASS' | 'FAIL' | 'BLOCKED' | 'IN_PROGRESS' | other = not run). One row per test case, latest run only.
- AioCycle.startDate / endDate are epoch ms (number) but typed number | string | null.
- Use runs.length as the burndown total (same source as the executed set, so remaining never goes negative — cf. the "N of M failing" rule in CycleKpiTiles).

<interfaces>
New exports in taskflow/src/lib/aio-cycle-charts.ts (shapes the executor must create; prose, not code):
- aioDateMs(raw: unknown): number | null — finite number -> itself; all-digit string -> Number(string); other string -> Date.parse; anything else or NaN -> null.
- BurndownPoint: { t: number (epoch ms); remaining: number | null; ideal: number | null; executed: number; marker: StatusKey | null }
- BurndownSeries: { points: BurndownPoint[]; total: number; from: number; to: number }
- cycleBurndownSeries(runs: { status: string; executedDate?: string }[], cycle: { startDate?: unknown; endDate?: unknown } | undefined, now: number): BurndownSeries | null
- burndownMarkerColor(marker: StatusKey): string — returns the existing EXECUTION_COLOR token for that status.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: cycleBurndownSeries builder + tests</name>
  <files>taskflow/src/lib/aio-cycle-charts.ts, taskflow/src/lib/aio-cycle-charts.test.ts</files>
  <behavior>
    - aioDateMs: 1759312800000 -> same number; '1759312800000' -> number; '2026-10-01T10:00:00Z' -> Date.parse value; null / undefined / 'garbage' / NaN -> null.
    - Returns null for empty runs, and for runs where none is pass/fail/blocked with a parseable executedDate (all NOT_EXECUTED, or IN_PROGRESS with executedDate -> still null: in-progress counts as remaining).
    - Basic: 4 runs (2 PASS at t1, 1 FAIL at t2, 1 NOT_EXECUTED), cycle start s < t1, end e > t2, now > e: points = [s rem 4 ideal 4 marker null], [t1 rem 2 executed 2 marker 'pass'], [t2 rem 1 executed 1 marker 'fail'], [e rem 1 ideal 0 marker null]; from = s, to = e; total = 4.
    - Same-timestamp group with PASS + FAIL + BLOCKED -> one point, executed 3, marker 'fail' (worst: fail > blocked > pass).
    - Active cycle (t2 < now < e): trailing point at now with rem 1 marker null, then an end point at e with remaining null and ideal 0.
    - Missing start and end: from = first execution ms, to = last execution ms; ideal goes total -> 0 across them; no duplicate start point when from equals the first execution (start point is still emitted first with remaining = total so the step drops at that timestamp).
    - Execution earlier than cycle start: from = that execution's ms. Execution later than cycle end: to = that execution's ms.
    - Ideal is linear: ideal(t) = total * (1 - (t - from) / (to - from)), clamped to [0, total], rounded to 1 decimal; when to === from every ideal is null.
    - Points are sorted ascending by t; result with fewer than 2 points returns null.
  </behavior>
  <action>
In aio-cycle-charts.ts add aioDateMs, the BurndownPoint / BurndownSeries types, burndownMarkerColor and cycleBurndownSeries with the exact signatures in the interfaces block. Do NOT import normalizeStatus from '@/lib/aioUtils' (that module imports '@/services/aio/cycles' at top level); add a small private status mapper in aio-cycle-charts.ts with the same mapping (upper-cased 'PASS' -> pass, 'FAIL' -> fail, 'BLOCKED' -> blocked, 'IN_PROGRESS' -> inProgress, anything else -> notRun).

Algorithm for cycleBurndownSeries: total = runs.length; executed set = runs whose normalized status is pass, fail or blocked and whose aioDateMs(executedDate) is non-null (inProgress and notRun count as remaining). Return null when total is 0 or the executed set is empty. Group executed runs by exact ms, sort ascending, and for each group emit a point with executed = group size, marker = worst status in the group (fail over blocked over pass), remaining = total minus the running cumulative executed count. from = min(aioDateMs(cycle.startDate) ?? first execution ms, first execution ms); to = max(aioDateMs(cycle.endDate) ?? last execution ms, last execution ms). Prepend a start point at from with remaining = total, executed 0, marker null. If min(now, to) is later than the last execution, append a trailing point there with the last remaining value and marker null (extends the step to today, or to the end for a closed/overdue cycle). If no point sits at to yet, append an end point at to with remaining null (so the step line stops at today) and marker null. Finally compute ideal for every point (linear formula from behavior, 1-decimal rounding, null when to === from). Return null if fewer than 2 points.

Write the tests from <behavior> as a new describe('cycleBurndownSeries') and describe('aioDateMs') in aio-cycle-charts.test.ts, using fixed epoch timestamps (no Date.now in tests; pass now explicitly). Pre-commit runs the full vitest suite, so write tests and implementation in ONE commit (no separate RED commit).
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/aio-cycle-charts.test.ts</automated>
  </verify>
  <done>All existing and new aio-cycle-charts tests pass; cycleBurndownSeries, aioDateMs, burndownMarkerColor exported; lib file imports nothing from src/routes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: CycleBurndown component wired into the cycle stats block</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx</files>
  <behavior>
    - CycleBurndown with loading=true renders a Skeleton with data-testid="cycle-burndown-skeleton" and height 140px.
    - CycleBurndown with a series renders a wrapper data-testid="cycle-burndown" (role="img" not needed; ChartContainer gets aria-label "Cycle burndown chart").
    - CycleKpiTiles renders the "Burndown" heading while runs is undefined (skeleton) and when the series is non-null; renders no "Burndown" heading when runs exist but none are executed.
  </behavior>
  <action>
Create CycleBurndown.tsx exporting CycleBurndown({ series, loading }: { series: BurndownSeries | null; loading: boolean }). Loading -> Skeleton (from '@/components/ui/skeleton') className "w-full" style height 140, testid cycle-burndown-skeleton. Null series -> return null. Otherwise a div testid cycle-burndown with a ref'd plot div of fixed height 140 (const PLOT_H = 140), width measured with useElementWidth from '../issue-detail/EpicChartZoom', containing ChartContainer (config {} , className "aspect-auto h-full w-full", aria-label "Cycle burndown chart") > ComposedChart (data = series.points, responsive, margin = PLOT_MARGIN). Copy the EpicTimeBurnup axis styling: XAxis type number dataKey "t" scale "time" domain [series.from, series.to] allowDataOverflow, ticks from timeTicks(toDateKey(from), toDateKey(to), width) (guard null keys -> no ticks), tickFormatter using the AxisTick label, tickLine and axisLine false. YAxis domain [0, series.total], allowDecimals false, width Y_AXIS_WIDTH, tickLine/axisLine false, no unit suffix and no axis title (the section heading names it; AIO's "Case count" label is dropped to save space).

Two Lines, both isAnimationActive false, no Legend: (1) ideal: dataKey "ideal", type linear, stroke var(--color-muted-foreground), strokeOpacity 0.6, strokeWidth 1, strokeDasharray "4 3", dot false, activeDot false, connectNulls. (2) remaining: dataKey "remaining", type stepAfter, stroke var(--color-foreground) with strokeOpacity 0.7, strokeWidth 1.5, connectNulls false, dot = a custom renderer that draws a diamond path (half-diagonal 4px, centred on cx/cy) only when payload.marker is non-null, filled with burndownMarkerColor(marker) and stroked var(--color-background) width 1, returning an empty keyed g element otherwise; activeDot = same diamond with half-diagonal 5 (fall back to a small foreground circle when the hovered point has no marker). Line colour stays neutral and the diamonds carry the status colour (dashboard rule: colour = status only).

Tooltip: ChartTooltip (from '@/components/ui/chart') with cursor { stroke: 'var(--color-muted-foreground)', strokeDasharray: '3 3' }, wrapperStyle zIndex 50 (recharts tooltip must sit above overlays), custom content rendering a TOOLTIP_SURFACE div > TooltipBody titled with the point date and time (formatDateKey(toDateKey(t)) plus HH:mm via toLocaleTimeString with hour/minute 2-digit, omit time for the start/end/trailing points where executed is 0) and at most 3 TooltipRows: "Remaining" (when non-null), "Executed" (when executed > 0, color = burndownMarkerColor(marker)), "Ideal" (when non-null, rounded to integer).

CycleKpiTiles: add prop cycle: Pick<AioCycle, 'startDate' | 'endDate'> | undefined (import AioCycle type from '@/services/aio'). Compute series with useMemo(() => (runs ? cycleBurndownSeries(runs, cycle, Date.now()) : null), [runs, cycle]). Restructure the outer return so the existing row div (flex flex-col gap-6 @4xl/epic:flex-row ...) stays unchanged and is followed, inside a new wrapping div "flex flex-col gap-4", by a Section titled "Burndown" with className "border-t border-border pt-4" rendered only when !runs or series is non-null; its body is CycleBurndown series={series} loading={!runs}. The Section body wrapper is flex items-center, so give CycleBurndown's root "w-full min-w-0". Update the block's doc comment to mention the burndown strip. Do not touch the four tiles, the donuts, or DIVIDED_CLASS (261014-crk tile set stays fixed).

AioCycleDetailPage: pass cycle={cycleQuery.data} to CycleKpiTiles. No other changes.

Tests (CycleBurndown.test.tsx): the three behaviours above; build the series via cycleBurndownSeries in the test, render CycleKpiTiles with minimal props (counts zeroed, defects []) wrapped in the same TooltipProvider the existing DefectSummary.test.tsx uses if Tile needs one (check that test's render helper and copy it). Assert on testids/headings only; recharts paints nothing at 0 size in jsdom, so do not assert on SVG paths. Then run the existing AioCycleDetailPage.test.tsx; if a test counted headings/sections, update it minimally and explain in the SUMMARY. Run biome check only on the six touched files (never biome --write over all of src). Verify any scripted edit by grepping the target strings afterwards.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/aio-cycle src/routes/dashboard/AioCycleDetailPage.test.tsx src/lib/aio-cycle-charts.test.ts && npx tsc --noEmit && npx biome check src/lib/aio-cycle-charts.ts src/lib/aio-cycle-charts.test.ts src/routes/dashboard/aio-cycle/CycleBurndown.tsx src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx src/routes/dashboard/AioCycleDetailPage.tsx</automated>
    <human-check>Open an AIO cycle with executions in the Tauri app: Burndown strip appears below the stats row, 140px plot, grey dashed ideal line from total to 0, neutral step line dropping at each coloured diamond, hover tooltip shows up to 3 rows above everything; a cycle with no executions shows no Burndown section; narrow window still renders the chart full width.</human-check>
  </verify>
  <done>Tests, tsc and scoped biome check pass; cycle detail page renders the Burndown section between the stats row and the tabs; no legend; no new figure duplicates an existing tile.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AIO API -> client | Run dates/status from the AIO REST API are rendered in a chart |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-jzn-01 | Tampering | aioDateMs / cycleBurndownSeries | mitigate | Unparseable dates return null and are excluded; non-finite values never reach the chart domain |
| T-jzn-02 | Denial of Service | CycleBurndown render | accept | Points are bounded by the cycle's case count (already rendered as a list); grouping by timestamp keeps it no larger |
</threat_model>

<verification>
- npx vitest run on aio-cycle-charts, aio-cycle folder and AioCycleDetailPage tests passes
- npx tsc --noEmit passes
- biome check on the six touched files reports no new diagnostics
- grep -n "cycleBurndownSeries(" taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx returns a match
- grep -n "cycle={cycleQuery.data}" taskflow/src/routes/dashboard/AioCycleDetailPage.tsx returns a match
</verification>

<success_criteria>
- Burndown chart visible on the AIO cycle detail page, AIO-style (step remaining line, status-coloured diamonds, straight dashed ideal), Taskflow-styled
- Page height grows by about 190px at most (140px plot + heading + divider)
- Hidden when nothing has been executed; skeleton while runs load
- Pure builder fully unit-tested
</success_criteria>

<output>
Create `.planning/quick/261014-jzn-aio-testcase-detail-burndown-chart/261014-jzn-SUMMARY.md` when done
</output>
