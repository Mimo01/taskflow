---
phase: quick-261001-sqm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/epic-progress.ts
  - taskflow/src/lib/epic-progress.test.ts
  - taskflow/src/components/ui/tooltip-body.tsx
  - taskflow/src/components/ui/tooltip-body.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx
  - taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx
  - taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
  - taskflow/src/routes/dashboard/IssueDetailContent.tsx
autonomous: true
requirements: [QUICK-261001-sqm]

must_haves:
  truths:
    - "Risk issue keys are real buttons inside a click/focus-openable Risks popover (base-ui Popover). Clicking a key, or pressing Enter on it, calls onOpenIssue(key), the same handler the Stories list rows use. Each risk shows icon · label · count, a one-line explanation and up to 5 keys. A '+N more' button reveals the remaining keys inline. Warnings come first. The clean state still shows 'No risks' with a check (Risks decision)"
    - "No provenance note renders under or around either chart. The hero (progress) tooltip contains one 'Data sources' block whose rows sit in the same slot order in all three tabs: data source, scope/estimate rules, calendar. Approximate or loading CFD history shows only a small neutral info flag in the legend row, with the same text (Data-sources decision)"
    - "Count/SP and Time charts use the same x-domain: start = chartAxisStart (epic created when valid and <= today, else the earliest story created), end = max(today, clipped averaged latest date). Ticks come from one axisTicks helper, so switching tabs never shifts the axis (Consistent-range decision)"
    - "Both charts have a neutral recharts Brush strip and preset buttons All · 3M · 1M · 2W · Forecast. Zoom state lives in EpicProgressSection, so it is shared by both charts and survives tab switches. Presets clamp to the shared domain, the active preset is aria-pressed, and dragging the Brush clears the preset (Zoom decision)"
    - "Everywhere confidence appears (Finish tile, Finish tooltip, chart forecast tooltip, forecast legend), one ConfidenceMeter renders a 3-bar neutral signal glyph plus High/Medium/Low. Tooltips also show a plain-language reason from the pure lib helper confidenceReason (Confidence decision)"
    - "Time chart series take status colours by meaning: Logged = done, Remaining = indeterminate, Estimate = new (area). The CFD Remaining line uses the same indeterminate colour (one Remaining rule for both charts). Forecast line and band stay neutral. Tooltip and legend markers for these series are status-coloured (Time-colours decision)"
  artifacts:
    - path: "taskflow/src/lib/epic-progress.ts"
      provides: "chartAxisStart, historyDates, projectionCap, chartDomain, padToDomain, axisTicks, dateKeyMs, ZOOM_PRESETS, presetRange, clampRange, rangeIndexes, confidenceReason, dataSourceLines, calendarNote, HISTORY_SOURCE_TEXT, RISK_VISIBLE_KEYS"
      exports: ["chartAxisStart", "chartDomain", "axisTicks", "presetRange", "rangeIndexes", "confidenceReason", "dataSourceLines", "calendarNote", "RISK_VISIBLE_KEYS"]
    - path: "taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx"
      provides: "ConfidenceMeter (3-bar glyph + word, neutral)"
      exports: ["ConfidenceMeter"]
    - path: "taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx"
      provides: "ChartZoom type, ZoomPresets button group, brushIndexes helper shared by both charts"
      exports: ["ZoomPresets", "ChartZoom"]
    - path: "taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx"
      provides: "SERIES with status colours for logged/remaining/estimate"
      contains: "STATUS_CATEGORY_COLOR"
  key_links:
    - from: "taskflow/src/routes/dashboard/IssueDetailContent.tsx"
      to: "EpicProgressSection onOpenIssue"
      via: "prop threaded to EpicProgressSummary RisksTile key buttons"
      pattern: "onOpenIssue=\\{onOpenIssue\\}"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx"
      to: "chartDomain / presetRange"
      via: "one domain + one zoom state passed to EpicCfdChart and EpicTimeBurnup"
      pattern: "chartDomain\\("
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx"
      to: "recharts Brush"
      via: "controlled startIndex/endIndex from rangeIndexes"
      pattern: "<Brush"
    - from: "taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx"
      to: "dataSourceLines"
      via: "hero tooltip Data sources block"
      pattern: "tooltip-source"
---

<objective>
This is the seventh iteration of the epic progress section. It addresses the 6 feedback points in 261001-sqm-CONTEXT.md:
1. Refined Risks with clickable keys.
2. Provenance notes moved into the hero tooltip.
3. One shared chart x-domain.
4. Range brush and presets, shared by both charts.
5. ConfidenceMeter with a reason, wherever confidence appears.
6. Time chart coloured by status meaning.

The visual language of 261001-rtw stays: TooltipBody/TooltipRow surface, monochrome icon markers for non-status rows, and the divider layout.

Purpose: the user can act on risks directly. Provenance has one consistent home. Charts stay stable and are zoomable. Confidence is legible.
Output: one plan with 3 tasks, and ONE commit per task (tests and implementation together).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/quick/261001-sqm-epic-progress-risks-notes-shared-axis-zo/261001-sqm-CONTEXT.md
@.planning/quick/261001-rtw-epic-progress-one-forecast-neutral-marke/261001-rtw-SUMMARY.md
@taskflow/src/lib/epic-progress.ts
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx
@taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx
@taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx
@taskflow/src/components/ui/tooltip-body.tsx
@taskflow/src/components/ui/popover.tsx

Verified facts (planner checked these in node_modules / source):
- recharts 3.8 `Brush` (`recharts/types/cartesian/Brush.d.ts`) takes `dataKey`, `height`, `travellerWidth`, `startIndex`, `endIndex`, `onChange(({startIndex,endIndex}))`, `tickFormatter`, `stroke`, `fill`, `ariaLabel`. The prop-controlled start/end index is honoured on prop change (`startIndexControlledFromProps` in es6/cartesian/Brush.js, plus a useEffect dispatching setDataStartEndIndexes). Brush is index-based on the chart's own data array, so shared zoom state MUST be date-based (`{from,to}` date keys) and each chart maps it to its own indices. Nothing in src uses Brush yet.
- `@/components/ui/popover` wraps `@base-ui/react/popover`: Popover / PopoverTrigger / PopoverContent (portal, default `p-4 border`). `PopoverPrimitive.Trigger` supports `openOnHover` and `delay`. `cn` uses twMerge, so className overrides win.
- IssueDetailContent already has `onOpenIssue?: (key: string) => void` (line 54). It renders `<EpicProgressSection ...>` at ~line 313 without it. The Stories rows call `onOpenIssue?.(story.key)`.
- EpicDetailSheet.test asserts `getByText('PROJ-5')`, `getByText('In Progress')`, `getByText('Done')`, `getByText(/Stories/)` with stories rendered. Risk keys therefore MUST NOT be in the DOM until the Risks popover is opened (popover content is unmounted while closed). Nothing new visible may contain "Stories", or a node equal to "Done" / "In Progress".
- EpicProgressSection.test `rowTexts()` reads `[data-slot="tooltip-row"]`. Several tests assert EXACT hero rowTexts arrays (lines ~357, ~1223, ~1237), so the Data-sources rows MUST use a different slot (`data-slot="tooltip-source"`), never TooltipRow.
- Pre-commit hook: biome check + tsc (includes tests; no `Array.prototype.at`) + the full vitest suite. Never `--no-verify`. Use zsh arrays for file loops.
</context>

<interfaces>
New lib contracts (Task 1 creates them, Tasks 2 and 3 consume them). All take date keys `YYYY-MM-DD`:

- `chartAxisStart(stories: JiraIssue[], epicCreated: string | undefined, today: string): string | null`. The shared rule: the epic's created day when it is valid and <= today, else the earliest valid story created day (clamped to today), else null. This is deriveCfd's existing rule, now extracted.
- `historyDates(start: string, today: string): string[]`. deriveCfd's existing sampling, extracted: daily when the span is <= CFD_MAX_DAILY (120), else `ceil(span/120)`-day steps plus today.
- `projectionCap(today: string, historyStart: string | null): string`. `today + max(PROJECTION_MIN_CAP_DAYS, span)`. deriveProjection uses it internally (no behaviour change).
- `interface ChartRange { from: string; to: string }`
- `chartDomain(start: string | null, today: string, finish: AveragedForecast): (ChartRange & { clippedAfter: string | null }) | null`. Null when start is null. `to` = today, or `min(finish.pessimistic, projectionCap(today, start))` when finish.state is 'ok' with a pessimistic date after today. `clippedAfter` = cap when it clipped.
- `padToDomain<T extends { date: string; t: number }>(points: T[], to: string): T[]`. When the last point's date < to, append one row with every key null except `date`, `t` (and `label` when present). It mirrors the blank-row logic in withProjection, so each chart's data (and its Brush strip) spans the whole domain even when that chart has nothing to project.
- `dateKeyMs(key: string): number`. Exported alias of the internal `toMs`.
- `axisTicks(from: string, to: string, max = 6): number[]`. Day-aligned UTC ms ticks: every day when the span is <= max−1 days, else `from + k*ceil(span/(max−1))` while <= to. Always includes `from`.
- `type ZoomPreset = 'all' | '3m' | '1m' | '2w' | 'forecast'`. `ZOOM_PRESETS: readonly { key: ZoomPreset; label: string; days: number | null }[]` in the order All, 3M (91), 1M (30), 2W (14), Forecast.
- `presetRange(preset: ZoomPreset, domain: ChartRange, today: string): ChartRange | null`:
  - all → domain.
  - 3m / 1m / 2w → `{ from: max(domain.from, today − days), to: today }`.
  - forecast → `{ from: max(domain.from, today − 14), to: domain.to }`, or null (disabled) when `domain.to <= today`.
- `clampRange(range: ChartRange, domain: ChartRange): ChartRange`. Clamps both ends into the domain and guarantees from < to (falls back to the domain).
- `rangeIndexes(points: { date: string }[], range: ChartRange): { startIndex: number; endIndex: number }`. First index with date >= from, last index with date <= to, with fallbacks 0 / len−1, and startIndex < endIndex whenever len >= 2.
- `confidenceReason(finish: AveragedForecast): string | null`:
  - null unless the state is 'ok' with confidence set and at least one included part.
  - When disagree: `Views disagree by ${max(nLikely) − min(nLikely)} working days` (over the included parts).
  - Otherwise take the weakest included part (lowest confidence; ties go to the first in parts order) and use its forecast f (W = f.windowDays, c = f.completions). The noun is 'completions' (or 'completion' when c === 1) for count/sp, and 'days with logged work' for time.
    - high → `Steady pace over ${W} working days`
    - low → W < 10 ? `Only ${W} working days of history` : `Only ${c} ${noun} in the last ${W} working days`
    - medium → W < 20 ? the 'Only W working days of history' text : c < 8 ? the 'Only c noun' text : `Wide range: ${f.nOpt}–${f.nPess} working days`
  - These mirror the thresholds in forecastFromThroughput: high needs W >= 20, c >= 8 and spread <= 0.5; medium needs W >= 10 and c >= 4.
- `type HistorySource = 'real' | 'partial' | 'loading' | 'unavailable'`. `HISTORY_SOURCE_TEXT` maps them to the current exact strings: 'From Jira status history' / 'Approximate for some items' / 'Approximate — loading status history' / 'Approximate — status history unavailable'.
- `type WorklogSource = 'loaded' | 'loading' | 'unavailable'`.
- `interface SourceLine { key: 'history' | 'scope' | 'worklogs' | 'estimate' | 'collapse' | 'calendar'; text: string; approximate: boolean }`.
- `calendarNote(cal: WorkCalendar, today: string, until: string | null): string`. This moves FinishTile's calendarLine logic, including HOLIDAY_NOTE_LOOKBACK_DAYS = 42, into the lib. Text is unchanged: 'Excludes weekends and N holiday(s) (Tempo)' / 'Excludes weekends (holidays unavailable)'.
- `dataSourceLines(args: { metric: Metric; history: HistorySource; worklogs: WorklogSource; calendarLine: string }): SourceLine[]`. Fixed slot order:
  - Count/SP: history (HISTORY_SOURCE_TEXT; approximate unless 'real'), then scope ('Scope from when each item joined the epic' when 'real', else 'Scope by story creation date'), then calendar.
  - Time: worklogs ('Logged from Jira worklogs' / 'Approximate — loading worklogs' / 'Worklogs unavailable'), then estimate (exactly ESTIMATE_FORMULA_NOTE), then collapse ('Done stories collapse to their logged time.'), then calendar.
- Risks: `RISK_VISIBLE_KEYS = 5`. `EpicRisk.issueKeys` becomes the FULL numerically sorted key list, and `moreKeys` is removed. The UI slices to RISK_VISIBLE_KEYS. Ordering is unchanged: warnings (overdue, late, stalled, scope) before infos (scope, unestimated, unassigned).

UI contracts:
- `ConfidenceMeter({ level: Confidence | null; className?: string })`. Returns null for a null level. The wrapper is a `span` with `data-testid="confidence-meter"`, `data-level`, `role="img"`, and `aria-label` set to `${Word} confidence`. It holds 3 bars (`w-[3px]`; heights h-1.5 / h-2.5 / h-3.5; items-end; gap-px). Filled bars are `bg-foreground/70`; empty bars are `bg-muted-foreground/25`. Filled count: low 1, medium 2, high 3. Then the visible word High / Medium / Low (`text-xs`). Neutral only, with no status or amber colours.
- `ChartZoom` (EpicChartZoom.tsx): `{ domain: ChartRange; range: ChartRange; preset: ZoomPreset | null; forecastEnabled: boolean; onPreset(p: ZoomPreset): void; onRange(r: ChartRange): void }`.
- `ZoomPresets({ zoom })`: a `role="group"`, `aria-label="Chart range"`, `data-testid="epic-zoom-presets"` group of buttons in the metric-toggle style. Uses `aria-pressed` for the active preset and `disabled` for Forecast when not enabled.
- `brushIndexes(points, range)`: re-exports rangeIndexes for the chart.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Lib — shared axis/domain/ticks, zoom presets, confidence reason, data-source lines, risk key lists</name>
  <files>taskflow/src/lib/epic-progress.ts, taskflow/src/lib/epic-progress.test.ts, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx</files>
  <behavior>
    - chartAxisStart: an epic created before its stories → epic day; epic created in the future or missing → the earliest story created day; nothing valid → null.
    - deriveCfd and deriveTimeBurnup start at chartAxisStart for the same inputs, and both sample with historyDates (a span over 120 days gives identical date arrays for both).
    - deriveTimeBurnup: a worklog dated before the shared start is counted on the first point, and the estimate >= logged invariant holds.
    - chartDomain: an ok finish with pessimistic 2026-10-20 and today 2026-10-01 → to = 2026-10-20. A not-ok finish → to = today. A pessimistic date beyond projectionCap → to = cap and clippedAfter = cap. A null start → null.
    - padToDomain appends exactly one blank row at `to`, and is a no-op when the data already reaches it.
    - axisTicks: ticks are day-aligned ms, include from, never exceed to, and number at most max.
    - presetRange: '1m' on a 200-day domain → {today−30, today}. '3m' on a 20-day domain clamps `from` to domain.from. 'forecast' → {today−14, domain.to}, and null when domain.to === today. 'all' → domain.
    - rangeIndexes picks the first index >= from and the last <= to, and keeps startIndex < endIndex.
    - confidenceReason: each branch (disagree, low short history, low few completions, medium wide range, high steady, time noun, the 1-completion singular, not-ok → null) returns the exact strings in <interfaces>.
    - dataSourceLines: Count/SP gives keys [history, scope, calendar]; Time gives [worklogs, estimate, collapse, calendar]. The approximate flags are correct, and the estimate text === ESTIMATE_FORMULA_NOTE.
    - calendarNote returns the current tempo and default texts.
    - deriveRisks issueKeys holds all sorted keys (7 open overdue items → 7 keys); there is no moreKeys.
  </behavior>
  <action>
In taskflow/src/lib/epic-progress.ts, implement every lib contract in <interfaces>. Keep the existing section layout: new helpers go next to their related sections, and zoom/domain helpers go in a new "Chart axis and zoom" section after Projection.

1. Shared axis (Consistent-range decision):
   - Extract deriveCfd's start rule into `chartAxisStart`, and its date sampling into `historyDates`. deriveCfd calls both, with no behaviour change.
   - Rewrite deriveTimeBurnup's start to `chartAxisStart(stories, epicCreated, today)`, falling back to the old candidate logic (earliest story start / worklog) only when chartAxisStart returns null. Clamp each item's startDay and worklog entry days up to the axis start. Replace `buildAxis` with `historyDates`, then delete `buildAxis` (unused).
   - Extract `projectionCap` from deriveProjection.
   - Add chartDomain, padToDomain, dateKeyMs, axisTicks, ZOOM_PRESETS, presetRange, clampRange and rangeIndexes, all pure.
2. Confidence (Confidence decision): add `confidenceReason` exactly per <interfaces>. Use CONF_ORDER for "weakest". Import nothing new.
3. Data sources (Data-sources decision): add HistorySource, WorklogSource, HISTORY_SOURCE_TEXT, SourceLine, calendarNote (moved logic) and dataSourceLines. Do not remove the HOLIDAY lookback from EpicProgressSummary yet (Task 2 switches it to calendarNote).
4. Risks (Risks decision):
   - Add `RISK_VISIBLE_KEYS = 5`. Make `keysOf` return `{ issueKeys }` with all sorted keys, remove `moreKeys` from EpicRisk and from every push site, and remove RISK_MAX_KEYS.
   - Keep the compile green: in EpicProgressSummary.tsx's existing RisksTile tooltip, change only the key-list expression to show `r.issueKeys.slice(0, RISK_VISIBLE_KEYS)` joined with ', ', plus ` +${r.issueKeys.length − RISK_VISIBLE_KEYS}` when longer. Task 2 redesigns it.

Tests: add a `describe('261001-sqm lib', ...)` block to epic-progress.test.ts covering every <behavior> bullet.

INTENTIONAL existing-test changes (list them in the SUMMARY; change nothing else):
- (1) deriveRisks overdue key-list test (~line 1352): `issueKeys` now equals all 5 keys ['M-1'…'M-5'], and the `moreKeys` assertion is removed.
- (2) deriveTimeBurnup 'a log before creation starts the story at the log day' (~line 344): rename to 'a log before the shared axis start is counted on the first day'. pts[0].date is now '2026-09-30' (story created) and pts[0].logged === H. The invariant loop stays.
- (3) Any other deriveTimeBurnup test that fails only because the start moved to chartAxisStart or because sampling became daily/historyDates. Before changing a test, prove the failure is caused by one of those two intended changes, then list each test by name.

Do not touch fetchAllSearchPages.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail && npx tsc --noEmit && npx biome check src/lib/epic-progress.ts src/lib/epic-progress.test.ts src/routes/dashboard/issue-detail/EpicProgressSummary.tsx && test "$(grep -v '^\s*//' src/lib/epic-progress.ts src/lib/epic-progress.test.ts | grep -c '\.at(')" = "0" && test "$(grep -v '^\s*//' src/lib/epic-progress.ts | grep -c 'moreKeys\|function buildAxis\|RISK_MAX_KEYS')" = "0"</automated>
  </verify>
  <done>Every new helper is exported and tested. deriveCfd and deriveTimeBurnup share chartAxisStart and historyDates. Only intentional test changes (1)–(3) were made. Committed as `feat(261001-sqm): shared chart axis/domain, zoom presets, confidence reason, data-source lines`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Hero Data-sources block, ConfidenceMeter in Finish, Risks popover with clickable keys</name>
  <files>taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSummary.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/IssueDetailContent.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    - Hovering the hero in Count shows a 'Data sources' heading and the [data-slot="tooltip-source"] rows [history text, scope text, calendar text]. In Time they are [worklogs, ESTIMATE_FORMULA_NOTE, collapse, calendar]. The block sits in the same place (the TooltipBody note slot) in every tab.
    - Neither `epic-cfd-note` nor the Time chart's formula footer exists.
    - While history is pending or unavailable or partial, the CFD legend row shows `epic-source-flag` (role img) whose aria-label equals the HISTORY_SOURCE_TEXT value. With real history the flag is absent.
    - The Finish tile shows the range plus a ConfidenceMeter (data-level 'medium', text 'Medium') on one line. The Finish tooltip has a 'Confidence' row with the meter, and its note holds the forecast explanation plus the confidenceReason text. Each per-metric row's sub is a ConfidenceMeter instead of the raw word. The calendar line no longer appears in the Finish tooltip; it is in the hero Data sources block.
    - Risks: clicking the Risks tile opens a popover listing per risk a TooltipRow (icon · label · count), a detail line, and key buttons. Clicking key 'A-4' calls onOpenIssue('A-4'). Focusing a key and pressing Enter also calls it. With 7 keys, 5 key buttons show plus a '+2 more' button (aria-expanded=false); clicking it shows all 7. Warnings are listed before infos. The clean state still shows 'No risks' in the tile.
    - With the popover closed, no issue key text from risks is in the DOM.
  </behavior>
  <action>
1. ConfidenceMeter.tsx (new): implement it per the <interfaces> contract (Confidence decision). Neutral classes only.

2. EpicProgressSummary.tsx:
   (a) Hero (Data-sources decision): add a prop `sources: SourceLine[]`. The hero tooltip TooltipBody `note` becomes a `DataSources` block:
       - A small `font-medium` "Data sources" heading.
       - Per line, a `div` with `data-slot="tooltip-source"`, `data-approximate`, and `flex items-start gap-2`. It holds a neutral `text-muted-foreground` lucide icon from a local SOURCE_ICON map (history → History, scope → ListPlus, worklogs → Clock, estimate → Timer, collapse → CircleCheck, calendar → CalendarDays), then the text in its own span (wrapping allowed, `max-w-64`).
       - The DataSources block replaces the old ESTIMATE_FORMULA_NOTE note.
       - Hero band/Logged/Estimate TooltipRows stay unchanged.
   (b) FinishTile (Confidence decision):
       - Allow Tile `sub` to be a ReactNode rendered in a `flex min-w-0 items-center gap-1.5` line: the range text truncates and the meter is `flex-none` (one row = one line).
       - The tooltip gains a 'Confidence' TooltipRow (icon Gauge, value `<ConfidenceMeter level={finish.confidence}/>`) when finish.state is 'ok'.
       - The note shows `finish.explanation` and `confidenceReason(finish)`. The calendar line moves out (Section computes calendarNote for the sources).
       - Per-part rows use `sub={p.included ? <ConfidenceMeter level={p.forecast?.confidence ?? null}/> : undefined}`.
       - Remove the local HOLIDAY_NOTE_LOOKBACK_DAYS, the holidaysBetween import and the addCalendarDays import when they become unused.
   (c) RisksTile (Risks decision):
       - Replace the Tooltip-based Tile with a Popover from `@/components/ui/popover`. PopoverTrigger renders a button with the same tile classes and `data-testid="epic-stat-tile"`, plus `openOnHover` with `delay={150}`, so hover still previews while click/Enter opens it. The tile content (label 'Risks', chips or 'No risks') is unchanged.
       - PopoverContent uses `className={cn(TOOLTIP_SURFACE, 'w-80 p-2.5')}` and `data-testid="epic-risks-popover"`. Inside is a TooltipBody titled 'Risks'. For each risk, a `data-testid="epic-risk-row"` grid contains:
         - a TooltipRow (icon, label, count);
         - a muted `pl-5` detail line;
         - when there are keys, a `pl-5 flex flex-wrap gap-1` list of `button type="button"` key buttons. Each is `font-mono text-[11px] rounded px-1 py-0.5 hover:bg-accent focus-visible:ring-1 focus-visible:ring-ring cursor-pointer`, with the key as its text. Its onClick closes the popover (controlled `open` state) and then calls `onOpenIssue?.(key)`.
       - Show `issueKeys.slice(0, RISK_VISIBLE_KEYS)` unless that risk is expanded (local `Set<RiskKey>` state). When more exist, add a `+N more` button with `aria-expanded` that expands that risk inline.
       - The clean state shows the 'No risks found' row.
       - Add an `onOpenIssue?: (key: string) => void` prop to EpicProgressSummary and pass it to RisksTile.

3. EpicProgressSection.tsx:
   - Add the `onOpenIssue?` prop.
   - Compute `historySource: HistorySource` using the same branches as the current cfdNote: data && !approximate → 'real'; data && approximate → 'partial'; error or not fetching → 'unavailable'; else 'loading'.
   - Compute `worklogSource`: data → 'loaded'; timePending 'error' → 'unavailable'; else 'loading'.
   - Compute `calendarLine = calendarNote(calendar, today, finish.pessimistic)` and `sources = dataSourceLines({ metric, history: historySource, worklogs: worklogSource, calendarLine })`. Pass sources and onOpenIssue to EpicProgressSummary.
   - Delete cfdNote. Pass `sourceFlag={historySource === 'real' ? null : HISTORY_SOURCE_TEXT[historySource]}` to EpicCfdChart.

4. EpicCfdChart.tsx and EpicTimeBurnup.tsx (Data-sources decision):
   - Remove the `note` prop and the `epic-cfd-note` paragraph, and the Time chart's formula footer paragraph. Remove the now-unused ESTIMATE_FORMULA_NOTE import.
   - Add `sourceFlag?: string | null` to both. When set, render after the legend items, inside the legend row, a `span` with `data-testid="epic-source-flag"`, `role="img"`, `aria-label={sourceFlag}`, `title={sourceFlag}`, containing an `Info` icon (size-3, text-muted-foreground). EpicTimeBurnup receives null for now; keeping the same prop keeps the indicator consistent across charts.

5. IssueDetailContent.tsx: pass `onOpenIssue={onOpenIssue}` to EpicProgressSection.

Tests in EpicProgressSection.test.tsx: add a `describe('EpicProgressSection risks, sources, confidence (261001-sqm)', ...)` block covering every <behavior> bullet. Pass `onOpenIssue={vi.fn()}` where needed. Use `user.click` for the popover and `user.keyboard('{Enter}')` on a focused key button. For the 7-key case, use a past due date with 7 open stories.

INTENTIONAL existing-test changes (list them in the SUMMARY; change nothing else):
- (4) 'renders all panels' (~line 149): `getByTestId('epic-cfd-note')` → `expect(screen.queryByTestId('epic-cfd-note')).toBeNull()`.
- (5) 'keeps the chart wrapper in every history state, with the matching note' (~lines 816–858): rename it to '...with the matching data source'. Each `epic-cfd-note` textContent assertion becomes an `epic-source-flag` aria-label assertion with the same string for pending, rejected and partial. For real, assert the flag is null and that hovering the hero shows a tooltip-source row 'From Jira status history'. The `data-history` assertions stay.
- (6) 'Finish shows a date, range and confidence for an ok forecast' (~line 623) and the qvu averaged-Finish test (~lines 1017, 1020): `toContain('medium confidence')` → the tile contains a `confidence-meter` with data-level 'medium', and the tile text contains 'Medium'.
- (7) The qvu averaged-Finish test (~line 1028): the 'Excludes weekends (holidays unavailable)' assertion moves to after hovering `epic-hero` (Data sources block).
- (8) 'hovering Risks lists one row per risk with the affected issue keys' (~line 1044): rename to 'opening Risks lists...'. `user.hover` → `user.click` on the tile, and assert `getByRole('button', { name: 'A-4' })` exists. The rowTexts assertions stay.

Expected NOT to change, so verify they still pass:
- the hero formula tests that `findByText(ESTIMATE_FORMULA_NOTE)` (~lines 522, 1223), because the estimate source line renders that exact text in its own span;
- the exact hero rowTexts tests (~lines 357, 1223, 1237), because source rows are not tooltip-row;
- the Risks chip tests (~lines 664–700, 1031–1042);
- IssueDetailContent.test ESTIMATE_FORMULA_NOTE story-bar tests;
- EpicDetailSheet.test.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx && npx tsc --noEmit && npx biome check src/routes/dashboard/issue-detail src/routes/dashboard/IssueDetailContent.tsx && test "$(grep -rv '^\s*//' src/routes/dashboard/issue-detail/EpicCfdChart.tsx src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx | grep -c 'epic-cfd-note\|ESTIMATE_FORMULA_NOTE')" = "0" && grep -q "onOpenIssue={onOpenIssue}" src/routes/dashboard/IssueDetailContent.tsx && grep -q 'tooltip-source' src/routes/dashboard/issue-detail/EpicProgressSummary.tsx && grep -q 'ConfidenceMeter' src/routes/dashboard/issue-detail/EpicProgressSummary.tsx</automated>
  </verify>
  <done>No chart footer notes remain. One Data-sources block in the hero tooltip has the same slot order in all tabs. Finish uses ConfidenceMeter plus a reason. Risk keys are keyboard- and mouse-clickable buttons that open the issue, with an expandable '+N more'. Only intentional test changes (4)–(8) were made. Committed as `feat(261001-sqm): data sources in hero tooltip, confidence meter, clickable risk keys`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Charts — shared domain and ticks, lifted zoom (Brush + presets), status-coloured Time series, ConfidenceMeter in chart tooltip/legend</name>
  <files>taskflow/src/routes/dashboard/issue-detail/EpicChartZoom.tsx, taskflow/src/routes/dashboard/issue-detail/EpicCfdChart.tsx, taskflow/src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.tsx, taskflow/src/routes/dashboard/issue-detail/epic-markers.tsx, taskflow/src/components/ui/tooltip-body.tsx, taskflow/src/components/ui/tooltip-body.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicChartTooltip.test.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx, taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.test.tsx</files>
  <behavior>
    - With the okList fixture (fake Date 2026-09-30), the Count chart wrapper `epic-burnup` and the Time chart wrapper `epic-time-burnup` (after switching tabs) carry identical `data-x-from` / `data-x-to` values, equal to chartDomain's from/to.
    - Clicking preset '1M' sets it aria-pressed='true' (others false) and sets data-x-from = today−30 (clamped) and data-x-to = today. After switching to Time, '1M' is still pressed and the Time chart has the same data-x-from/to. Clicking 'All' restores the domain.
    - The 'Forecast' preset is disabled when finish is not ok (too-early fixture), and enabled with to = domain.to for okList.
    - The presets group is outside the legend container (the existing `within(legend).getByText('Forecast')` tests are unaffected).
    - MarkerGlyph 'status-line' and 'status-area' use the passed colour (style background) and are distinct from 'line'/'area'. The existing markers are unchanged.
    - SERIES.logged.stroke === STATUS_CATEGORY_COLOR.done, SERIES.remaining.stroke === STATUS_CATEGORY_COLOR.indeterminate, SERIES.estimate.fill === STATUS_CATEGORY_COLOR.new. Forecast and band stay neutral.
    - The Time legend markers are status-area / status-line / status-line coloured new / done / indeterminate. The CFD legend Remaining marker is status-line in the indeterminate colour.
    - The forecast legend shows a ConfidenceMeter next to 'Forecast' when a projection is drawn. A chart tooltip on a future ok datum shows a 'Confidence' row with the meter and the reason in its note.
  </behavior>
  <action>
1. tooltip-body.tsx (Time-colours decision):
   - Extend TooltipMarker with 'status-line' and 'status-area'. These render like 'line' / 'area' but use the passed `color` (`style.background`, `data-marker` set, no tone).
   - Update the header comment: colour still means status, and the status-line / status-area glyphs are for series that represent a status meaning.
   - Add tests to tooltip-body.test.tsx. Existing tests stay unchanged.

2. epic-markers.tsx (Time-colours decision):
   - SERIES.logged = { stroke: STATUS_CATEGORY_COLOR.done, strokeWidth: 2, marker: 'status-line', color: done }.
   - SERIES.remaining = { stroke: STATUS_CATEGORY_COLOR.indeterminate, strokeWidth: 2, marker: 'status-line', color: indeterminate }. This is used by BOTH charts, which is the one Remaining rule: Remaining = open work = in-progress meaning. The CFD Remaining line is 2px over 1px area strokes.
   - SERIES.estimate = { fill: new, fillOpacity: 0.15, stroke: new, strokeWidth: 1, marker: 'status-area', color: new }.
   - Forecast and band stay neutral FG/MUTED. Keep a `tone` on every entry so the `satisfies` type still holds (status markers ignore it).
   - Rewrite the doc comment to state the rule: colour = status meaning. Logged = Done, Remaining = In progress, Estimate = To do. Forecast line and band are neutral.
   - In EpicChartTooltip cfdRows/timeRows and in both chart legends, pass `color: SERIES.x.color` for these rows/items.

3. EpicChartZoom.tsx (new, Zoom decision): implement ChartZoom and ZoomPresets per <interfaces>. Iterate ZOOM_PRESETS; button classes match the metric toggle (`rounded-md px-2 py-0.5 text-xs ring-1 ring-foreground/10`, with the active preset `bg-primary text-primary-foreground`). Also export `BRUSH_STYLE` with neutral Brush props: `height: 20`, `travellerWidth: 6`, `stroke: 'var(--color-muted-foreground)'`, `fill: 'transparent'`.

4. EpicProgressSection.tsx (Consistent-range and Zoom decisions):
   - Add `const [zoom, setZoom] = useState<{ preset: ZoomPreset | null; range: ChartRange | null }>({ preset: 'all', range: null })` next to the existing useState (before the early returns).
   - After computing finish, derive:
     - `axisStart = chartAxisStart(stories, epicCreated, today)`;
     - `domain = chartDomain(axisStart, today, finish)`;
     - `range` = domain ? clampRange(zoom.preset ? (presetRange(zoom.preset, domain, today) ?? domain) : (zoom.range ?? domain), domain) : null;
     - `chartZoom: ChartZoom | null` with `forecastEnabled = presetRange('forecast', domain, today) !== null`, onPreset → setZoom({ preset, range: null }), and onRange → setZoom({ preset: null, range }).
   - Pass `historyStart = axisStart` to projectFinish. Build cfdData with `padToDomain(withProjection(...), domain.to)` when domain is set. Pass `zoom={chartZoom}` to both charts.

5. EpicCfdChart.tsx and EpicTimeBurnup.tsx (Consistent-range and Zoom decisions):
   - Add a `zoom: ChartZoom | null` prop.
   - EpicTimeBurnup uses `chartAxisStart` via the projectFinish historyStart = `zoom?.domain.from ?? base[0]?.date ?? null`, and pads its chartData with padToDomain(zoom.domain.to).
   - In both charts:
     - XAxis gets `domain={[dateKeyMs(range.from), dateKeyMs(range.to)]}`, `allowDataOverflow`, and `ticks={axisTicks(range.from, range.to)}` (replacing `['dataMin','dataMax']`).
     - The wrapper div carries `data-x-from` / `data-x-to` (range) and `data-domain-to`.
     - As the last chart child, only when chartData.length >= 3, render a `Brush` with `dataKey="t"`, the BRUSH_STYLE props, `tickFormatter={tickLabel}`, and `startIndex` / `endIndex` from `rangeIndexes(chartData, range)`. Its `onChange` maps the new indices back to dates via `zoom.onRange({ from: chartData[startIndex].date, to: chartData[endIndex].date })`. Guard the indices before indexing.
   - Raise the chart wrapper height from 220 to 252 (CHART_HEIGHT plus 32 for the strip) in both, and in the section skeleton (`h-[252px]`).
   - Below the chart, the footer row is `flex items-start justify-between gap-4`: the existing legend div (unchanged testids), then `<ZoomPresets zoom={zoom} />` when zoom is set. Presets stay outside the legend container.
   - ForecastLegend (Confidence decision): when hasProjection, render the LegendItem followed by `<ConfidenceMeter level={finish.confidence} />`.

6. EpicChartTooltip.tsx (Confidence decision):
   - When isFuture and finish?.state === 'ok', add after the key-date rows a TooltipRow with icon Gauge, label 'Confidence' and value `<ConfidenceMeter level={finish.confidence}/>`.
   - The TooltipBody note combines the existing clipped text and `confidenceReason(finish)` (separate divs).
   - Return null when a datum has neither history rows nor a forecast (padded blank rows).

Tests:
- Add a `describe('EpicProgressSection shared axis and zoom (261001-sqm)', ...)` block covering the section bullets. Mock worklogs as the existing Time tests do.
- Add a SERIES unit test and Time/CFD legend marker colour tests (compare `style.background` against STATUS_CATEGORY_COLOR values the way existing tests compare status markers).
- Add EpicChartTooltip tests for the Confidence row and the null-on-blank datum.

INTENTIONAL existing-test changes (list them in the SUMMARY; change nothing else):
- (9) EpicChartTooltip.test marker test (~lines 195–220):
  - The CFD Remaining row `data-marker` 'line' with tone 'strong' → 'status-line' with background = STATUS_CATEGORY_COLOR.indeterminate.
  - The Time markers ['area','line','line'] → ['status-area','status-line','status-line'].
  - The data-tone array assertion is replaced by background-colour assertions [new, done, indeterminate]. Keep the WR-02 comment updated: estimate still has a distinct area glyph.
- (10) EpicChartTooltip.test 'adds Likely / Earliest / Latest rows…' (~line 265), ONLY if it asserts an exact full row list: append the 'Confidence' row expectation. If it only checks the three rows, leave it unchanged.
- (11) Any existing assertion on chart wrapper height 220 or XAxis 'dataMin': grep `220\|dataMin` in the test files first. Change only those, and list each one.

Not expected to change: the legend `within(...).getByText('Forecast'|'Remaining'|'Estimate'|'Logged')` tests, the forecast-state tests, and tooltip-body.test's existing marker tests.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/components/ui/tooltip-body.test.tsx src/routes/dashboard/issue-detail src/routes/dashboard/EpicDetailSheet.test.tsx src/routes/dashboard/IssueDetailContent.test.tsx && npx tsc --noEmit && npx biome check src/components/ui/tooltip-body.tsx src/routes/dashboard/issue-detail && test "$(grep -v '^\s*//' src/routes/dashboard/issue-detail/EpicCfdChart.tsx src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx | grep -c "'dataMin'")" = "0" && grep -q "<Brush" src/routes/dashboard/issue-detail/EpicCfdChart.tsx && grep -q "<Brush" src/routes/dashboard/issue-detail/EpicTimeBurnup.tsx && grep -q "chartDomain(" src/routes/dashboard/issue-detail/EpicProgressSection.tsx && grep -q "STATUS_CATEGORY_COLOR" src/routes/dashboard/issue-detail/epic-markers.tsx</automated>
  </verify>
  <done>Both charts render the same date window from one domain and one zoom state. The Brush and presets are shared and persist across tabs. Time series are status-coloured by meaning, and the CFD Remaining line matches. ConfidenceMeter appears in the chart tooltip and forecast legend. Only intentional test changes (9)–(11) were made. Committed as `feat(261001-sqm): shared chart domain, brush + preset zoom, status-coloured time series`.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira API → UI | Issue keys, dates and worklogs from Jira are rendered as text and passed to onOpenIssue |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-sqm-01 | Tampering | Risk key buttons → onOpenIssue | accept | Keys come from already-fetched epic stories (the same source as the Stories list rows that call the same handler). They are rendered as React text, with no HTML injection. |
| T-sqm-02 | Denial of service | Brush onChange re-render of the whole section | mitigate | Data is capped (CFD history <= 121 points + projection <= PROJECTION_MAX_POINTS = 260). The Brush renders only when length >= 3. No new fetches are triggered by zoom. |
| T-sqm-03 | Information disclosure | Data-sources block | accept | It shows only provenance text derived locally. No secrets or URLs. |
</threat_model>

<verification>
- Full `npx vitest run`, `npx tsc --noEmit` and `npx biome check ./src` pass. The pre-commit hook runs them on each of the 3 commits; never use --no-verify.
- Search for leftover notes: `grep -rn "epic-cfd-note\|collapse to their logged" taskflow/src/routes` shows only the dataSourceLines-driven text in lib and its tests.
- Manual UAT (real Tauri app, light and dark), recorded in the SUMMARY as pending:
  - Brush handles drag, and the strip is neutral.
  - The status-coloured Time series are legible.
  - The CFD Remaining line (2px indeterminate) can be told apart from the in-progress area edge.
  - The Risks popover keys open issues.
</verification>

<success_criteria>
- All 6 CONTEXT decisions are implemented: Risks, Data sources, Consistent range, Zoom, Confidence, Time colours. No deferred or out-of-scope work, and fetchAllSearchPages is untouched.
- Every changed pre-existing assertion is one of the enumerated intentional changes (1)–(11), each listed in the SUMMARY with its reason.
- 3 commits, each with tests and implementation together.
</success_criteria>

<output>
Create `.planning/quick/261001-sqm-epic-progress-risks-notes-shared-axis-zo/261001-sqm-SUMMARY.md` when done. Include:
- the commits table;
- the intentional test changes (1)–(11), with the exact test names;
- any deviation, with a diff justification;
- the pending UAT items.
</output>
