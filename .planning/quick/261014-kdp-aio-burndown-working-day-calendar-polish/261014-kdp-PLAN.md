---
phase: quick-261014-kdp
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/aio-cycle-charts.ts
  - taskflow/src/lib/aio-cycle-charts.test.ts
  - taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
autonomous: true
requirements: [QUICK-261014-kdp]

must_haves:
  truths:
    - "The ideal line stays flat across weekends and Tempo holidays and only drops during working days (flat segments, not one straight diagonal)"
    - "Non-working days show as subtle shaded bands (consecutive days merged into one band) when each day is at least 4px wide on the plot; no bands otherwise"
    - "Executions on non-working days are still plotted at their real timestamp"
    - "The burndown sits in a rounded ring-1 Card surface with a solid 2px full-opacity foreground step line, a faint area fill, light horizontal gridlines, and a dashed ideal line that is readable but clearly secondary"
    - "On a stats container >= 1408px the block is one row: Cycle Statistics | Burndown | Execution Distribution | Defect Summary, and the burndown adds no height (siblings set the row height; the plot fills it)"
    - "From 896px to 1407px the block is two rows: [Cycle Statistics | Burndown] then [Execution Distribution | Defect Summary], with the plot filling the tiles' height. Below 896px everything stacks and the plot is 140px"
    - "The separate bottom 'Burndown' strip with border-t is gone"
  artifacts:
    - path: "taskflow/src/lib/aio-cycle-charts.ts"
      provides: "cycleBurndownSeries with injected isWorkingDay, working-day ideal, nonWorking ranges"
      contains: "nonWorking"
    - path: "taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx"
      provides: "Card-surfaced burndown with ReferenceArea bands, CartesianGrid, Area fill"
      contains: "ReferenceArea"
    - path: "taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx"
      provides: "Burndown column inside the top row; three container-width layouts"
  key_links:
    - from: "taskflow/src/routes/dashboard/AioCycleDetailPage.tsx"
      to: "useEpicWorkCalendar"
      via: "hook call; calendar passed as a prop to CycleKpiTiles"
      pattern: "useEpicWorkCalendar\\("
    - from: "taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx"
      to: "cycleBurndownSeries"
      via: "useMemo passing calendar.isWorkingDay"
      pattern: "isWorkingDay"
---

<objective>
Rework the AIO cycle burndown from quick 261014-jzn. Three changes:
(1) Measure the ideal line in working days using the epic-detail Tempo calendar (useEpicWorkCalendar / WorkCalendar), and shade non-working days.
(2) Restyle the chart so it reads as its own chart on a Card surface.
(3) Move it into the existing top stats row as a column, so the block is no taller than it was before 261014-jzn whenever the container fits four columns.

Purpose: the current burndown ignores weekends and holidays, blends into the page, and adds a whole extra row.
Output: series builder and tests, a restyled CycleBurndown, a re-laid-out CycleKpiTiles, the calendar wired in from AioCycleDetailPage, and rendered screenshots inspected by the executor.

Layout choice (per the user's instruction to state it in the plan):
- The four columns need about 1408px of stats container. Execution 192+pl-8, Defect Summary w-112 = 448, the 2x2 tiles about 300 minimum, the burndown about 280, plus gaps and dividers.
- A 1280-1440px window minus sidebar and page padding gives only about 980-1150px. So the one-row layout appears on wide/external displays only.
- On laptops the block uses an intermediate two-row layout: [Cycle Statistics | Burndown] / [Execution Distribution | Defect Summary]. Each row keeps the plot filling the height set by its siblings, and nothing is a fixed-height strip.
- Below 896px everything stacks and the plot is 140px.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261014-jzn-aio-testcase-detail-burndown-chart/261014-jzn-SUMMARY.md
@taskflow/src/lib/aio-cycle-charts.ts
@taskflow/src/lib/aio-cycle-charts.test.ts
@taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx
@taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx
@taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
@taskflow/src/routes/dashboard/aio-cycle/AioTile.tsx
@taskflow/src/routes/dashboard/AioCycleDetailPage.tsx

Facts already established (do not re-explore):
- `WorkCalendar { isWorkingDay(key): boolean; holidays: readonly string[]; source }` and `DEFAULT_CALENDAR` (Mon-Fri) live in taskflow/src/lib/epic-progress.ts (~line 316). Also there: `addCalendarDays`, `formatDateKey`, `timeTicks`.
- `useEpicWorkCalendar(today: string)` is in taskflow/src/routes/dashboard/issue-detail/useEpicProgressQueries.ts:88 and returns `{ calendar }`. It is enabled only with Tempo on and Jira connected; otherwise it returns DEFAULT_CALENDAR. Its window is today -120 / +365 days. EpicProgressSection.tsx:207 calls it with `toLocalDateString(new Date())` from `@/lib/local-date`.
- When Tempo data exists, `buildWorkCalendar` returns a NEW calendar object on every render. Memo deps must be `calendar.source` plus `calendar.holidays.join(',')`, never the object.
- `toDateKey` (lib/aio-cycle-list.ts) maps epoch numbers to LOCAL date keys. Day boundaries in this plan are local midnights.
- Tiles are `<Card size="sm">` from `@/components/ui/card`: rounded-xl, ring-1 ring-foreground/10, p-3, a role-less div. Each tile is 72px + 24px padding, so the 2x2 grid plus its heading is about 240px tall. Execution is 192px (HERO_DONUT_SIZE). Do NOT use the deleted StatTile/ChartWrapper.
- `EXECUTION_COLOR.inProgress` is `var(--color-blue-500)`, so blue is a STATUS colour on this page. The remaining line must be neutral-strong (`var(--color-foreground)` at full opacity), not blue.
- AioCycleDetailPage.test.tsx mocks the settings and auth stores without tempoEnabled/jiraUserKey. The Tempo query stays disabled, so no new mocks are expected.
- No Playwright is installed. Google Chrome is at /Applications/Google Chrome.app. The vite dev server is `npm run dev --prefix taskflow` on port 1420 (.claude/launch.json). Real cycle data needs Tauri credentials, so render a fixture harness instead (Task 3).
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Working-day ideal line and non-working ranges in cycleBurndownSeries</name>
  <files>taskflow/src/lib/aio-cycle-charts.ts, taskflow/src/lib/aio-cycle-charts.test.ts, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx</files>
  <behavior>
    - All-days calendar (isWorkingDay always true): ideal equals the old straight line total*(1-(t-from)/span), rounded to 0.1.
    - DEFAULT_CALENDAR, local Fri 00:00 to Tue 00:00, total 10: ideal at Sat 00:00 equals ideal at Mon 00:00 (the weekend is flat). The value drops 5 across Fri and 5 across Mon, giving 10, 5, 5, 5, 0 at Fri/Sat/Sun/Mon/Tue midnights.
    - Ideal-only boundary points exist at every local midnight strictly inside (from, to). An execution exactly on a boundary merges into one point with no duplicate t. Points stay sorted by t.
    - A boundary point at or before the tail (min(now, to)) carries the step value in effect as `remaining`, with executed 0 and marker null. After the tail it carries remaining null, so the step line never breaks before the tail.
    - `nonWorking` holds merged ranges of consecutive non-working days, clipped to [from, to]. Example: Fri-Tue with Mon a holiday gives exactly one range, Sat 00:00 to Tue 00:00.
    - Span that is entirely non-working (Sat to Mon 00:00): ideal falls back to the calendar-linear line, with no division by zero. Zero span (from === to): ideal stays null (existing behaviour).
    - An execution on a Saturday is still a point at its exact timestamp, with its marker.
    - Existing behaviour is unchanged: null for no runs, null when nothing was executed, marker severity fail > blocked > pass, tail point, end point. Change existing assertions only where ideal values legitimately move.
  </behavior>
  <action>
    Change the signature to `cycleBurndownSeries(runs, cycle, now, isWorkingDay: (key: string) => boolean)`. The 4th parameter is required and injected, so the function stays pure and testable. Add `nonWorking: { from: number; to: number }[]` to `BurndownSeries`.

    Add a private helper that walks local days from from's local midnight to to. Build day starts with the `new Date(y, m, d)` constructor and step with setDate(+1) so DST days stay correct. Get each day's key with `toLocalDateString` from `@/lib/local-date`.

    Working time W(t) is the sum, over working days, of the overlap of [dayStart, nextDayStart) with [from, t]. Set ideal(t) = total * (1 - W(t)/W(to)), clamped to [0, total] and rounded to 0.1. If W(to) is 0, use the old linear formula.

    Insert the midnight boundary points and the merged, clipped nonWorking ranges as described in the behavior block.

    Update the doc comments on BurndownPoint.ideal and on the function to say "working-day ideal".

    In the tests:
    - Build every fixture with local-time constructors (e.g. new Date(2026, 9, 9).getTime()), never with UTC ISO strings, so results do not depend on the timezone.
    - Pass DEFAULT_CALENDAR.isWorkingDay or an all-days stub to each existing call, whichever keeps that test's original intent.
    - Add the new cases from the behavior block.

    CycleKpiTiles currently calls the 3-argument form, so tsc would fail. In the same commit, pass `DEFAULT_CALENDAR.isWorkingDay` there temporarily; Task 2 replaces it with the real calendar.

    The pre-commit hook runs the full vitest suite, so tests, implementation and the CycleKpiTiles fix go in ONE commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/aio-cycle-charts.test.ts src/routes/dashboard/aio-cycle && npx tsc --noEmit -p . && npx biome check src/lib/aio-cycle-charts.ts src/lib/aio-cycle-charts.test.ts src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx</automated>
  </verify>
  <done>All cycleBurndownSeries tests pass, including the new weekend, holiday, boundary, band and fallback cases. tsc is clean and biome is clean on the touched files. One commit.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Card-surfaced chart redesign, in-row layout, calendar wiring</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx</files>
  <behavior>
    - The CycleBurndown root (data-testid="cycle-burndown") is a Card (data-slot="card") with `absolute inset-0`. The loading Skeleton (data-testid="cycle-burndown-skeleton") is `absolute inset-0 rounded-xl`. Height comes from the parent, so the old "140px inline style" assertion is replaced by class assertions.
    - In CycleKpiTiles the Burndown heading sits inside the top row. Heading order (getAllByRole('heading')) is Cycle Statistics, Burndown, Execution Distribution, Defect Summary. No "Burndown" section carries the old bottom-strip `border-t border-border pt-4` classes.
    - The Burndown heading shows while runs load and when something was executed, and is hidden when nothing was executed (existing tests kept).
    - CycleKpiTiles takes a `calendar: WorkCalendar` prop and its isWorkingDay reaches cycleBurndownSeries.
  </behavior>
  <action>
    CycleKpiTiles layout (user decision: the burndown goes inside the top row; the stated breakpoint choice is in the objective):

    Keep STAT_CONTAINER_CLASS on the outer div; container variants only style descendants. Replace the single row with:
    - Outer row wrapper: `flex flex-col gap-6 {WIDE}:flex-row {WIDE}:gap-8`.
    - Group A, which holds the Cycle Statistics Section (unchanged, `min-w-0 flex-1`) and the Burndown Section: `flex min-w-0 flex-col gap-6 @4xl/epic:flex-row @4xl/epic:gap-8 {WIDE}:flex-1`.
    - Burndown Section: `min-w-0 flex-1 border-t border-border pt-6 @4xl/epic:border-t-0 @4xl/epic:border-l @4xl/epic:pt-0 @4xl/epic:pl-8`.
    - Group B, which holds Execution Distribution and Defect Summary: `flex flex-none flex-col gap-6 border-t border-border pt-6 @4xl/epic:flex-row @4xl/epic:gap-8 {WIDE}:border-t-0 {WIDE}:pt-0`.
    - Execution's Section class: `flex-none {WIDE}:border-l {WIDE}:pl-8`. It is first in Group B, so it gets no left rule at the intermediate size, and Group B's border-t replaces Execution's old narrow border-t.
    - Defect Summary keeps `DIVIDED_CLASS` plus `@4xl/epic:w-112 @4xl/epic:pr-4`.

    {WIDE} is the 88rem (1408px) named-container variant. In Tailwind v4 this is expected to be `@min-[88rem]/epic`. Before writing it, check that syntax against the installed tailwindcss: grep node_modules/tailwindcss/dist for `@min-` handling, or find an existing arbitrary container variant in src. Use whichever form v4 actually generates. Task 3 confirms it renders.

    Give the local Section an optional `bodyClassName`, merged into its body div with cn. The Burndown Section passes `relative min-h-[140px] items-stretch`. min-h gives 140px when stacked. In the rows, the absolute chart adds no intrinsic height, so the sibling columns set the row height and the plot fills it.

    Delete the old bottom block (`<Section title="Burndown" className="border-t border-border pt-4">`) and the now-unneeded inner `flex flex-col gap-4` wrapper if it only existed for it. Render the in-row Burndown Section under the same `!runs || burndown` condition.

    Rewrite the component doc comment to describe the three layouts:
    - <896px: stacked, plot 140px.
    - 896-1407px: [tiles | burndown] / [execution | defect].
    - >=1408px: one row of four.

    Keep HEADING_CLASS. No figure is shown twice: the chart adds no number outside its tooltip.

    Calendar wiring: in AioCycleDetailPage, call `useEpicWorkCalendar(toLocalDateString(new Date()))` alongside the other hooks, before any early return, and pass `calendar` to CycleKpiTiles. In CycleKpiTiles, replace Task 1's temporary DEFAULT_CALENDAR with `calendar.isWorkingDay`. useMemo deps: `[runs, cycle, calendar.source, calendar.holidays.join(',')]`. Hoist the join into a const if the lint requires it, and add a biome-ignore with a reason only if the exhaustive-deps rule still objects. Keep the hook out of CycleKpiTiles so it and its tests need no QueryClient.

    CycleBurndown design:
    - Surface: `<Card size="sm" data-testid="cycle-burndown" className="absolute inset-0 gap-0 p-2">`. The plot div (plotRef) inside is `h-full w-full min-w-0`. Remove PLOT_H and every inline height.
    - Add `<CartesianGrid vertical={false} stroke="var(--color-border)" />`.
    - Both axes: `tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}`.
    - YAxis: keep `allowDecimals={false}` and add `tickCount={4}`.
    - Non-working bands go first so they sit beneath the series. Render one `ReferenceArea` per `series.nonWorking` range with x1/x2 from the range, `fill="var(--color-muted-foreground)"`, `fillOpacity={0.08}`, `stroke="none"`, `ifOverflow="hidden"`. Render them only when plotWidth / spanDays >= 4, where spanDays = (to - from) / 86_400_000. Otherwise render none.
    - Ideal: Line, type linear, `stroke="var(--color-muted-foreground)"`, strokeWidth 1.5, `strokeDasharray="5 4"`, full opacity, connectNulls, no dots, no activeDot, no animation.
    - Remaining: replace the Line with an `Area`, type stepAfter, dataKey remaining. Style: `stroke="var(--color-foreground)"` at full opacity, `strokeWidth={2}`, `fill="var(--color-foreground)"`, `fillOpacity={0.06}`, `connectNulls={false}`, no animation. Keep `dot={renderDot}` and `activeDot={renderActiveDot}`.
    - The diamonds keep status colours and are the only status colour in the chart.
    - The tooltip stays at max 3 rows with wrapperStyle zIndex 50. No Legend.

    Tests: update CycleBurndown.test.tsx for the behavior block, passing `calendar={DEFAULT_CALENDAR}` in every CycleKpiTiles render. Also run AioCycleDetailPage.test.tsx.

    Code and tests go in one commit. Run biome only on these four files, never `biome --write` on src. After any scripted or bulk edit, grep that every target site actually changed.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/aio-cycle src/routes/dashboard/AioCycleDetailPage.test.tsx src/lib/aio-cycle-charts.test.ts && npx tsc --noEmit -p . && npx biome check src/routes/dashboard/aio-cycle/CycleBurndown.tsx src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx src/routes/dashboard/aio-cycle/CycleBurndown.test.tsx src/routes/dashboard/AioCycleDetailPage.tsx && grep -c "useEpicWorkCalendar(" src/routes/dashboard/AioCycleDetailPage.tsx && grep -c "ReferenceArea" src/routes/dashboard/aio-cycle/CycleBurndown.tsx && test "$(grep -c 'PLOT_H' src/routes/dashboard/aio-cycle/CycleBurndown.tsx)" = "0"</automated>
  </verify>
  <done>The burndown is a Card column inside the top row and the bottom strip is gone. The working calendar flows from AioCycleDetailPage. The chart has gridlines, area fill, a 2px foreground step line, a secondary dashed ideal and non-working bands. All listed tests, tsc and biome pass. One commit.</done>
</task>

<task type="auto">
  <name>Task 3: Render and inspect at three container widths, then fix what looks wrong</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/CycleBurndown.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx</files>
  <action>
    Build a throwaway preview. It must NOT be committed: delete it before the final commit and confirm with git status.

    Harness:
    - Create `taskflow/burndown-preview.html` and `taskflow/src/burndown-preview.tsx`.
    - The tsx imports `./index.css` (or the app's global stylesheet; check main.tsx for its path) and renders CycleKpiTiles three times. Wrap each copy in a fixed-width div of 760px, 1100px and 1500px. Each wrapper also gets `bg-background text-foreground`.
    - Fixture: a cycle running Fri 2026-10-02 to Fri 2026-10-23; 30 runs, about 20 executed and spread over working days with one Saturday execution; a mix of PASS/FAIL/BLOCKED; `calendar` = a buildWorkCalendar with Mon 2026-10-12 as a HOLIDAY; a few defects as `[]`; `countsLoading` and `defectsLoading` false.

    Capture:
    - Start `npx vite --port 1499 --strictPort` in the background from taskflow/.
    - Screenshot with `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1600,1600 --screenshot=<scratchpad>/burndown.png http://localhost:1499/burndown-preview.html`. Add `--virtual-time-budget=3000` so recharts finishes measuring.
    - Save PNGs to the session scratchpad directory, not the repo.
    - Read the PNG with the Read tool. Crop or zoom (e.g. `sips` or a second narrower screenshot) if detail is too small to judge.
    - Repeat in dark mode by adding the `dark` class to <html> in the preview html.

    Check and fix in the real components (not the harness):
    - The 1500px copy is ONE row of four. The burndown column is no taller than the tiles/donut columns, and the overall block height matches a render without the burndown (temporarily pass runs that executed nothing to compare).
    - The 1100px copy is two rows, [tiles | burndown] / [execution | defect], with the plot filling the tiles' height.
    - The 760px copy is stacked with a 140px plot.
    - Weekend and holiday bands are visible but subtle. The ideal line is flat across them. The Saturday diamond is at its real position.
    - The line reads clearly against the area fill. The diamonds are not swallowed by the 2px line (if they are, bump to r 4.5/5.5). Axis ticks are legible and do not overlap. The ideal line is clearly secondary.
    - Gridlines are light. The Card ring matches the tiles. Nothing is clipped at the Card edges, including the top tick label (adjust PLOT_MARGIN locally via a spread if needed).
    - If the 88rem variant is not generated (the 1500px copy is still two rows), fix the variant syntax.

    Iterate until all of these hold. Then stop vite, delete both harness files, and confirm `git status` shows neither.

    Commit any component fixes with the related test updates in one commit (pre-commit runs the full suite). Run biome on the touched files only. In the SUMMARY, record what the screenshots showed and every visual fix made.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow && test ! -e taskflow/burndown-preview.html && test ! -e taskflow/src/burndown-preview.tsx && cd taskflow && npx vitest run src/routes/dashboard/aio-cycle src/routes/dashboard/AioCycleDetailPage.test.tsx src/lib/aio-cycle-charts.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>Screenshots at 760, 1100 and 1500px, light and dark, were inspected, and every check above holds. The harness files are gone and the tree is clean apart from the committed component fixes. The SUMMARY describes the rendered result.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AIO API -> chart | executedDate and cycle dates come from the AIO server and are already parsed defensively by aioDateMs |
| Tempo schedule -> calendar | holiday map is validated by the existing buildWorkCalendar |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-kdp-01 | DoS | cycleBurndownSeries day walk | mitigate | The day loop is bounded by from..to. If the span exceeds 731 days (corrupt dates), skip boundary points and bands and use the linear ideal |
| T-kdp-02 | Tampering | Tempo holiday data | accept | buildWorkCalendar already whitelists keys and types; display-only impact |
</threat_model>

<verification>
- `npx vitest run` on aio-cycle-charts, the aio-cycle folder and AioCycleDetailPage passes. tsc is clean. biome is clean on touched files only.
- Screenshots confirm the three layouts, the flat ideal over weekends and holidays, the bands, and the Card surface styling.
- There is no bottom Burndown strip. On wide containers, the block's height equals that of the tiles/donut row.
</verification>

<success_criteria>
- The ideal is measured in working days from the Tempo calendar, falling back to Mon-Fri. Non-working days are shaded when legible.
- The chart sits on its own Card with a strong neutral line, area fill, gridlines and a secondary ideal line. Status colour appears only on the diamonds. Tooltip has at most 3 rows with z-index 50 and there is no legend.
- The burndown is a column of the top row at >= 1408px; the intermediate layout is two rows; narrow is stacked at 140px.
- Each task is one commit, with tests updated alongside the code.
</success_criteria>

<output>
Create `.planning/quick/261014-kdp-aio-burndown-working-day-calendar-polish/261014-kdp-SUMMARY.md` when done
</output>
