---
phase: quick-261002-enj
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
autonomous: true
requirements: [QUICK-261002-enj]

must_haves:
  truths:
    - "Confidence is visible only on hover: the Finish card shows no ConfidenceMeter and no confidence word; its tooltip keeps the Confidence row (meter + word) and the one-line reason note (D-1)"
    - "The Risks card shows readable short labels (icon + phrase such as 'Overdue 3 days', '1 unassigned', '4 days late') on one line, at most 2 visible plus a '+N' control for the rest, card height unchanged (D-2)"
    - "Hovering or focusing a risk label shows a 2-row tooltip (risk text + detail, no issue list); clicking or pressing Enter/Space opens the existing issue popover, and the tooltip is closed while the popover is open (D-2)"
    - "The hero Completed bar is capped (w-3/4, max-w-40), h-2, left-aligned, identical in every tab (D-3)"
    - "The stat-card grid and the chart block are separated by more space than before (section space-y-5 plus pt-3 on the chart block, no negative margins) (D-4)"
    - "Neither chart renders a legend row; no 'Forecast: <state>' text appears anywhere; series meaning remains in the chart hover tooltip (D-5)"
    - "Zoom presets and the source flag sit in one fixed-height toolbar row above the chart (flag left of presets, right-aligned), presets only when zoom is usable; the navigator has mt-2 spacing below the plot and nothing sits under it (D-5)"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "EpicRisk.short readable label (replaces chip)"
      contains: "short: string"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      provides: "Finish card without meter, RiskItem tooltip+popover composition, '+N' overflow, capped hero bar"
      contains: "render={<PopoverTrigger"
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx"
      provides: "ChartToolbar (SourceFlag + ZoomPresets), NAVIGATOR_HEIGHT 56, TOOLBAR_HEIGHT"
      exports: ["ChartToolbar", "SourceFlag", "ZoomPresets", "TOOLBAR_HEIGHT"]
  key_links:
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "ChartToolbar"
      via: "rendered as first child of the epic-chart-block, above the chart / empty-estimate / loading states"
      pattern: "<ChartToolbar"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      to: "EpicRisk.short"
      via: "visible risk label text"
      pattern: "risk\\.short"
---

<objective>
Follow-up polish on the epic progress section after 261002-0xf, implementing the five user feedback points
locked in 261002-enj-CONTEXT.md: D-1 confidence only in hover, D-2 readable and hoverable risks, D-3 narrower
Completed bar, D-4 more card-to-chart spacing, D-5 remove both chart legend rows (presets + source flag move to
a toolbar above the chart; forecast-state legend text dropped).

Purpose: the cards and chart read at a glance without clicking, with less visual noise.
Output: two commits (cards; charts), each with its tests, full vitest + tsc via the pre-commit hook.
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/quick/261002-enj-epic-progress-confidence-in-hover-readab/261002-enj-CONTEXT.md
@.planning/quick/261002-0xf-epic-progress-polish-zoom-slider-consist/261002-0xf-SUMMARY.md
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicStatCard.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx

Key facts (verified while planning):
- `EpicRisk` (lib/epic-progress.ts ~1418) has `text`, `chip: string | null`, `detail`, `issues`. `chip` is consumed only by
  EpicProgressSummary.tsx (`risk.chip`) and lib tests (epic-progress.test.ts ~1349 `chip: '10d'`, ~1361 `chip: '+4d'`).
  `deriveRisks` emits at most 4 risks, warnings first. `daysText(n)` gives '1 day' / 'N days'.
- `RiskItem` is a `Popover` + `PopoverTrigger` (data-testid epic-risk-item, aria-label = risk.text, data-severity) with a
  popover body (header icon+text, detail, `epic-risk-issues` list with ArrowUp/Down/Home/End handling and `initialFocus`).
- `FinishTile` (ok state) renders the range plus `<ConfidenceMeter>` in the card sub-line; ConfidenceMeter renders
  data-testid confidence-meter and the visible word (e.g. 'Medium').
- Hero `BandBar` gets `className="h-2"`; BandBar base class has `w-full` merged through `cn` (tailwind-merge), so `w-3/4`
  overrides it.
- `SECTION_CLASS` = 'border-t border-b border-border py-5 my-6 space-y-5'; the chart block is `<div className="flex flex-col">`
  right after `<EpicProgressSummary>`. Tailwind v4 (space-y = margin on siblings), so add padding, not margin.
- Legend rows: EpicCfdChart ~296-317 (`epic-cfd-legend`), EpicTimeBurnup ~290-310 (`epic-time-legend`), both containing
  LegendItem x3-4, ForecastLegend (which also renders a visible ConfidenceMeter), SourceFlag, and `ZoomPresets` to the right.
  `LegendItem`, `ForecastLegend`, `SourceFlag` are exported from EpicCfdChart; EpicTimeBurnup imports them;
  EpicChartTooltip.test imports `ForecastLegend` (describe 'ForecastLegend review fixes (261001-rtw)' ~331-356).
- `NAVIGATOR_HEIGHT` = 48 documented as '28px track + 4px gap (mt-1) + 16px label row'; EpicRangeNavigator root is
  `mt-1 flex flex-col gap-1` (~line 135). Tests use imported CHART_HEIGHT / PLOT_HEIGHT, not literals.
- base-ui 1.2 (`@base-ui/react`): no existing Tooltip+Popover composition in the repo. Compose as Tooltip.Root wrapping
  Popover.Root, with `<TooltipTrigger render={<PopoverTrigger ... />}>` so ONE button carries both behaviours. Confirm with
  ctx7 docs ("base-ui tooltip popover same trigger render") before writing; if render composition misbehaves in jsdom, the
  fallback is a controlled Tooltip (`open`) on the same PopoverTrigger via `render` in the other direction — keep one button.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Cards — confidence only in hover, readable hoverable risks, narrower hero bar, card-to-chart spacing</name>
  <files>taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    - lib: every risk has a `short` label of at most 16 chars that is a substring of `text` (label-in-name): overdue 'Overdue 10 days'; late text 'Finishes 4 days late', short '4 days late'; stalled 'Stalled'; scope 'Scope growing'; unestimated 'N unestimated'; unassigned 'N unassigned'.
    - Finish card (ok forecast): textContent contains the date and range, contains no 'Medium'/'Low'/'High' word and no confidence-meter element; hovering it still shows a Confidence row containing 'Medium', exactly one meter in the tooltip, and one confidence-reason note.
    - Risks card: each visible risk button shows its short label as text (e.g. getByText('1 unassigned') inside the risk button), keeps aria-label = risk.text and data-severity; with 3+ risks only 2 epic-risk-item buttons render plus an epic-risk-more button whose text is '+N'.
    - Hovering a risk button shows a tooltip with the risk text and its detail (no tooltip-row with an issue key, at most 2 text lines); clicking it opens epic-risk-popover with the issue rows and the tooltip content is gone while the popover is open.
    - '+N' click opens a popover listing the hidden risks (header + detail + their issue rows); keyboard model the same as a single risk popover.
    - Hero bar: epic-hero-bar className contains 'w-3/4' and 'max-w-40' and 'h-2' in Count, SP and Time.
    - Chart block: element data-testid epic-chart-block has class 'pt-3'; no class in it or the summary matches /(^|\s)-m/.
  </behavior>
  <action>
    D-2 lib: in `EpicRisk` replace `chip: string | null` with `short: string` (doc: 'Readable card label, <= 16 chars, a substring of text'). Set short per behavior above in `deriveRisks`; change the late risk `text` to `Finishes ${daysText(n)} late` so short is contained in it. Update the two lib assertions (chip '10d' -> short 'Overdue 10 days'; late text/short) and add one test asserting for all risks of a fixture producing overdue, scope/stalled, unestimated and unassigned that `short.length <= 16` and `text.includes(short)`.

    D-1: in `FinishTile` ok branch, the sub-line becomes only the range span (`min-w-0 truncate`); remove the ConfidenceMeter from `sub`. Leave the tooltip untouched (Likely, Range, Confidence row with meter, Based on, reason note). Update the file header comment (no meter on the card).

    D-2 card: extract the popover body of `RiskItem` into a `RiskPanel` component (header icon + text, detail line, issue list with the existing onListKeyDown and row buttons / plain rows when `onOpenIssue` is absent; accepts a `firstRow` ref and `onPick` that closes the owning popover). `RiskItem` keeps controlled `open` for the popover and adds controlled tooltip state: render `Tooltip` (open = tipOpen && !open, onOpenChange sets tipOpen) wrapping `Popover`, and a single `TooltipTrigger` rendered as the `PopoverTrigger` via base-ui `render` (confirm the composition with ctx7 first). When the popover opens, set tipOpen false. The trigger keeps data-testid epic-risk-item, data-severity, aria-label = risk.text, the icon (severity colour classes unchanged, no inline colour), and now shows `<span className="min-w-0 truncate">{risk.short}</span>`; trigger class becomes `inline-flex h-4 min-w-0 cursor-pointer items-center gap-1 rounded-sm` plus focus ring and CHIP_TEXT (drop `flex-none` so the label can truncate). Tooltip content: `TooltipBody` with title = risk.text and one muted child line = risk.detail (no TooltipRow, no note, no issue list). `RisksTile`: render the first 2 risks (`VISIBLE_RISKS = 2`) as RiskItems separated by a muted ' · ' span (aria-hidden), then, when more remain, a `RiskOverflow` button (data-testid epic-risk-more, flex-none, text `+${hidden.length}`, aria-label `${hidden.length} more risks`) composed the same way: tooltip lists the hidden risks' `text` one per line; click opens a popover (same surface classes as the risk popover, data-testid epic-risk-popover) stacking a `RiskPanel` per hidden risk with a thin border-t between them; initialFocus = first issue row of the first panel when it has rows and onOpenIssue exists, else true. The sub-line stays one line (StatCardBody already whitespace-nowrap; card shape untouched). Value stays 'N risks' / 'No risks'.

    D-3: hero `BandBar` className becomes 'h-2 w-3/4 max-w-40' (left-aligned by default; same in every tab).

    D-4: in EpicProgressSection give the chart block wrapper `data-testid="epic-chart-block"` and class `flex flex-col pt-3` (20px space-y + 12px). No negative margins.

    Tests (EpicProgressSection.test.tsx) — intentional changes, list them in the SUMMARY:
    - 'Finish shows a date, range and confidence for an ok forecast' (~595): rename to '... range, confidence only in the tooltip'; assert no confidence-meter in the card and textContent lacks 'Medium'.
    - 'shows the same averaged Finish in Count and SP mode...' (~1041-1051): replace the in-card meter / 'Medium' assertions with absence assertions (date 'Oct 7' assertions kept).
    - 'Finish pairs the range with a confidence meter; the tooltip adds a Confidence row and reason' (~1440): rename; card has no meter; tooltip assertions kept; replace the meter whitespace-nowrap check with the range span's parent containing 'whitespace-nowrap'.
    - Unchanged but re-verified: name-based risk queries ('1 unestimated', '1 unassigned', 'Overdue 3 days'), risk svg colour test (~1335), WR-01 plain-row test (~1827), popover keyboard tests (~1465-1540), 'shows the same risks in Count, SP and Time' (aria-label).
    - New tests for every behavior bullet above (risk short text visible, 2 + '+N' overflow with a 4-risk fixture: past due date + unassigned + unestimated + scope or stalled, risk hover tooltip <= 2 lines and no issue keys, tooltip closed while popover open, '+N' popover lists hidden risks, hero bar classes per tab, chart block pt-3).
    Keep all strings as single template-literal nodes; no visible text equal to 'Done' / 'In Progress' or containing 'Stories' (EpicDetailSheet.test rule). Do not use Array.prototype.at (tsc target). Commit tests + implementation together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx && npx tsc --noEmit && npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/EpicProgressSummary.tsx src/routes/dashboard/issue-detail/EpicProgressSection.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx && test "$(grep -c 'risk\.chip' src/routes/dashboard/issue-detail/EpicProgressSummary.tsx)" = 0</automated>
  </verify>
  <done>Finish card shows date + range only and confidence only in its tooltip; risk labels readable with hover tooltip and click popover (no fight), 2 visible + '+N'; hero bar capped; chart block has pt-3; targeted tests, tsc and biome clean; committed (hook runs full vitest).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Charts — remove legend rows, toolbar above the chart (source flag + presets), navigator spacing</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx, taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx</files>
  <behavior>
    - No element with data-testid epic-cfd-legend, epic-time-legend or epic-forecast-state exists in Count, SP or Time; no text matching /^Forecast: / anywhere; no confidence-meter outside an open tooltip anywhere in the section (both tabs, ok forecast).
    - epic-chart-toolbar renders above the chart in every state (chart, Time loading, Time error, empty-estimate) with fixed height (class h-6) and comes before the chart in document order; it contains epic-source-flag (when approximate) and epic-zoom-presets (only for zoomable domains), presets right-aligned (toolbar justify-end).
    - The source flag is still a BUTTON with the source text as aria-label; it follows the active tab (history flag on Count/SP, worklog flag on Time) and is absent in the empty-estimate state.
    - Presets behave exactly as before (clamp, persist across tabs, All restores, Forecast preset, hidden for short domains).
    - Navigator root has 'mt-2'; NAVIGATOR_HEIGHT is 56 and CHART_HEIGHT = PLOT_HEIGHT + 56.
  </behavior>
  <action>
    D-5 toolbar: move `SourceFlag` from EpicCfdChart into EpicChartZoom (same markup, export). Add `TOOLBAR_HEIGHT = 24` and an exported `ChartToolbar({ zoom, sourceFlag }: { zoom: ChartZoom | null; sourceFlag?: string | null })` rendering a div data-testid epic-chart-toolbar, class 'flex h-6 flex-none items-center justify-end gap-3', containing SourceFlag then `{zoom ? <ZoomPresets zoom={zoom} /> : null}` (ZoomPresets already returns null when not usable). It renders even when empty so the slot height never changes.
    Navigator spacing: EpicRangeNavigator root `mt-1` -> `mt-2`; NAVIGATOR_HEIGHT 48 -> 56 with the comment updated (28 track + 4 inner gap-1 + 16 labels + 8 mt-2). [Orchestrator fix: plan-checker W2 — the previous 48 already under-counted the inner gap.]

    D-5 charts: in EpicCfdChart delete the legend row div, `LegendItem`, `ForecastLegend` (drops the visible ConfidenceMeter and 'Forecast: <state>' text; per D-5 the Finish card already shows the state, and per D-1 confidence stays only in hovers), the `SourceFlag` export, the `sourceFlag` and `hasProjection` props, and now-unused imports (Info, MarkerGlyph/types, ConfidenceMeter, FINISH_STATE_TEXT, Tooltip, STATUS_CATEGORY_COLOR if unused, ZoomPresets) — let biome/tsc confirm. The outer wrapper reduces to the `epic-burnup` div (keep all data-* attributes, chartHeight, plot, navigator). Update the header comment: no legend; series meaning lives in the hover tooltip. Same in EpicTimeBurnup: delete the `epic-time-legend` row, the import of LegendItem/ForecastLegend/SourceFlag, the `sourceFlag` prop, `hasProjection` local if unused, ZoomPresets import.

    Section: in EpicProgressSection render `<ChartToolbar>` as the first child of the epic-chart-block (added in Task 1; give the block `gap-2`). Props: empty-estimate state -> zoom null, sourceFlag null; Time tab -> zoom chartZoom, sourceFlag = worklogSource === 'loaded' ? null : WORKLOG_SOURCE_TEXT[worklogSource]; Count/SP -> zoom chartZoom, sourceFlag = historySource === 'real' ? null : HISTORY_SOURCE_TEXT[historySource]. Stop passing sourceFlag/hasProjection to the charts. If the section skeleton reserves chart height, add TOOLBAR_HEIGHT + the gap there so the skeleton-to-chart jump does not grow.

    Tests — intentional changes, list them in the SUMMARY:
    - EpicProgressSection.test ~153: replace the epic-cfd-legend 'Completed' assertion with `queryByTestId('epic-cfd-legend')` null.
    - ~885 'legend lists Completed / In progress / To do / Remaining, plus Forecast only when ok': rewrite to 'no legend row; no Forecast state text' (ok and too-early fixtures).
    - ~921 'Time mode renders the chart with Estimate / Logged / Remaining in its legend': keep the chart render assertions, replace the legend checks with epic-time-legend absent.
    - ~1163 'draws the shared Forecast in the CFD (Count) and in the Time chart': drop the legend 'Forecast' checks; assert no epic-forecast-state and the Finish card date in both tabs.
    - ~1175 'shows the same state text in the legend and Finish tile when not ok': rename to 'shows the state only in the Finish tile when not ok'; assert no /Forecast: / text and Finish contains 'Too early'.
    - ~1781 'presets sit outside the legend container': replace with 'presets and source flag sit in the toolbar above the chart' (toolbar contains both; toolbar precedes epic-burnup via compareDocumentPosition).
    - ~1796 'legend markers carry the status colours in both charts and the forecast meter appears': rewrite as 'no visible confidence meter outside tooltips in either tab' (querySelectorAll confidence-meter inside the section is empty when no tooltip is open).
    - Source flag tests (~826-884, ~1433) and preset tests (~1587-1784) keep passing unchanged (they query by test id at screen level); confirm.
    - EpicChartTooltip.test: remove the `ForecastLegend` import and the 'ForecastLegend review fixes (261001-rtw)' describe (component deleted).
    - New: toolbar present with h-6 in chart, Time loading, Time error and empty-estimate states; flag switches with the tab; navigator root has mt-2.
    Commit tests + implementation together.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail/EpicChartZoom.tsx src/routes/dashboard/issue-detail/EpicCfdChart.tsx src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx src/routes/dashboard/issue-detail/EpicRangeNavigator.tsx src/routes/dashboard/issue-detail/EpicProgressSection.tsx src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx && test "$(grep -rlE 'epic-(cfd|time)-legend|ForecastLegend|LegendItem' src --include='*.tsx' --exclude='*.test.tsx' | wc -l | tr -d ' ')" = 0</automated>
  </verify>
  <done>Both legend rows, LegendItem and ForecastLegend are gone; a fixed-height toolbar above the chart holds the source flag and presets in every state; navigator has mt-2 / NAVIGATOR_HEIGHT 56; no visible confidence or forecast-state text outside hovers; targeted tests, tsc and biome clean; committed (hook runs full vitest).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API -> UI | Issue keys and summaries in risk tooltips/popovers are rendered as React text |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-enj-01 | Tampering | RiskPanel / risk tooltip | accept | Rendered as React text nodes only (no dangerouslySetInnerHTML), same as before; no new data sources |
| T-enj-02 | Denial of Service | risk popover lists | accept | Existing max-h-48 scroll list retained; at most 4 risks by construction |
</threat_model>

<verification>
- Full vitest via the pre-commit hook on both commits (never --no-verify); `npx tsc --noEmit` (includes tests) clean.
- `npx biome check` on every touched file from taskflow/ (the hook does not lint); gate on no new findings in touched files.
- Greps: no `risk.chip`, no `epic-cfd-legend` / `epic-time-legend` / `ForecastLegend` / `LegendItem` left in non-test src (tests may assert their absence).
- UAT (Tauri, after execution): Finish card without meter; risk labels readable in the 480px peek and the main pane; hover a risk then click it (no flicker); '+N' on a 4-risk epic; hero bar width; spacing above the toolbar; presets above the chart, navigator spacing, no legend.
</verification>

<success_criteria>
All 7 must_haves truths hold; D-1..D-5 implemented as locked in CONTEXT.md; two commits, each with its tests; intentional test changes listed in the SUMMARY.
</success_criteria>

<output>
Create `.planning/quick/261002-enj-epic-progress-confidence-in-hover-readab/261002-enj-SUMMARY.md` when done
</output>
