---
phase: quick-261014-crk
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - taskflow/src/lib/aio-cycle-charts.ts
  - taskflow/src/lib/aio-cycle-charts.test.ts
  - taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx
  - taskflow/src/routes/dashboard/aio-cycle/ExecutionDonut.tsx
  - taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
  - taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx
  - taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
autonomous: true
requirements: [QUICK-261014-crk]

must_haves:
  truths:
    - "Cycle detail shows a 2x2 Cycle Statistics tile grid (Pass rate, Re-runs, Unlinked failures, Open defects) with an Execution Distribution donut beside it, and the donut stacks below the tiles when the container is narrow (per D-exec-layout)"
    - "The segmented progress bar (cycle-progress-bar / progress-seg-*) no longer exists"
    - "The donut uses status colours, has no legend, shows executed/total in the centre, and each slice tooltip has at most 4 rows"
    - "Each figure appears once: tiles do not repeat per-status counts, total, executed/total, or Last run (already in CycleHeader)"
    - "Pass rate = passed / executed (not / total), because the donut slice share already gives pass/total"
    - "The Defects tab shows a Defect Summary block with two titled donuts (Status by category, Priority by icon severity) in place of the status pills; there is no 'Show only latest run' toggle; the donuts have no centre open-count"
    - "While countsLoading or defects resolve, donuts render same-size ring skeletons (no single grey 'Not run' slice flash)"
  artifacts:
    - path: "taskflow/src/lib/aio-cycle-charts.ts"
      provides: "Pure slice/tooltip/colour helpers"
      exports: ["executionSlices", "defectStatusSlices", "defectPrioritySlices", "priorityChartColor"]
    - path: "taskflow/src/lib/aio-cycle-charts.test.ts"
      provides: "Unit tests for helpers"
    - path: "taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx"
      provides: "Shared fixed-size recharts donut + ring skeleton"
    - path: "taskflow/src/routes/dashboard/aio-cycle/ExecutionDonut.tsx"
      provides: "Execution Distribution donut"
    - path: "taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx"
      provides: "Defect Summary block (Status + Priority donuts)"
  key_links:
    - from: "CycleKpiTiles.tsx"
      to: "ExecutionDonut"
      via: "rendered beside the 2x2 tile grid"
      pattern: "<ExecutionDonut"
    - from: "DefectsList.tsx"
      to: "DefectSummary"
      via: "replaces SummaryStrip after the empty-state guard"
      pattern: "<DefectSummary"
    - from: "AioDonut.tsx"
      to: "recharts"
      via: "PieChart + Pie with shape prop (no Cell)"
      pattern: "from 'recharts'"
---

<objective>
Polish the AIO cycle detail page, inspired by the real AIO UI. Three changes:
1. Replace the segmented progress bar with an Execution Distribution donut placed beside a de-duplicated 2x2 Cycle Statistics tile grid.
2. Replace the defect status pills with a Defect Summary block that holds two pies (Status, Priority).

Purpose: give an AIO-like overview where every number appears exactly once (user constraint: "not too overcomplicated and no duplicate data").
Output: a new pure lib with tests, three new components in `aio-cycle/`, reworked `CycleKpiTiles` and `DefectsList`, and updated page tests.

Locked decisions honoured:
- D-exec-layout: the donut sits beside the tiles, replaces the bar, and stacks when narrow.
- D-exec-style: status colours, no legend, tooltip per slice (<=4 rows), centre shows executed/total.
- D-tiles: AIO-style tiles, each figure shown once, no effort tiles.
- D-defects: two pies, priority coloured by the icon-severity ramp, status coloured by category, open count in one place only.

Per RESEARCH:
- **No "Show only latest run" toggle.** The cycle's defects already come from `latestTestRun.allDefects`, so they are latest-run only (cycles.ts:588).
</objective>

<execution_context>
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/workflows/execute-plan.md
@/Users/mimo/Documents/Projects/taskflow/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261014-crk-polish-aio-cycle-detail-page-cycle-stati/261014-crk-CONTEXT.md
@/Users/mimo/Documents/Projects/taskflow/.planning/quick/261014-crk-polish-aio-cycle-detail-page-cycle-stati/261014-crk-RESEARCH.md
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/aio-cycle/AioTile.tsx
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx (SummaryStrip at ~337, render site ~551)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/lib/aio-cycle-list.ts (StatusKey, progressTooltipRows colours, statusLabel)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/lib/statusStyles.ts (statusCategoryColor)
@/Users/mimo/Documents/Projects/taskflow/taskflow/src/lib/aio-defect-sort.ts (priorityRank)

Key interfaces and facts:
- `AioStatusCounts` (from `useAioCycleData`) is `Record<StatusKey, number>`, where `StatusKey` is `pass | fail | blocked | inProgress | notRun`.
- executed = pass + fail + blocked. inProgress does NOT count as executed.
- `ResolvedDefect` (from `useCycleDefects`) is `{ issue: JiraIssue | null, ... }`. Skip entries where `issue` is null, which is the same rule `openCount` uses. Read these fields:
  - `issue.fields.status.{name, statusCategory.key}`
  - `issue.fields.priority.{name, iconUrl, id}`
- Colours must be literal `var(--color-*)` strings in source (Tailwind v4 JIT), never hex:
  - pass `var(--color-green-500)`
  - fail `var(--color-red-500)`
  - blocked `var(--color-orange-400)`
  - inProgress `var(--color-blue-500)`
  - notRun `var(--color-gray-300)`
- Do not name any file `StatTile*` or anything else listed in `widget-removal.guard.test.ts`.

Project gotchas:
- The pre-commit hook runs the full vitest suite, plus biome and tsc. Each task's commit must include its test updates (RED and GREEN go in one commit).
- The biome baseline drifts, so gate on "no NEW files flagged", not on an absolute diagnostic count.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure chart helpers (lib/aio-cycle-charts.ts) with unit tests</name>
  <files>taskflow/src/lib/aio-cycle-charts.ts, taskflow/src/lib/aio-cycle-charts.test.ts</files>
  <behavior>
    - executionSlices({pass:1,fail:1,blocked:0,inProgress:0,notRun:1}):
      - returns slices only for non-zero statuses, in the order pass, fail, blocked, inProgress, notRun
      - each slice is `{key, label, value, share, color}`; here the shares are 33/33/33
    - executionSlices with all zeros returns [].
    - executionSliceTooltipRows(slice) returns at most 4 rows: Runs = value, Share = `${share}%`.
    - defectStatusSlices(defects):
      - groups by statusCategory.key, ordered new, indeterminate, done
      - labels are "To Do", "In Progress", "Done"
      - colour comes from statusCategoryColor
      - skips null issues
      - each slice's `rows` lists the top status names by count, capped at 4 total rows; the 4th row merges the remainder as "Other"
    - defectPrioritySlices(defects):
      - groups by priority name and orders by priorityRank
      - colours via priorityChartColor
      - missing priority is grouped as "None"
    - priorityChartColor:
      - iconUrl ending `major.svg`, `blocker.svg`, `critical.svg` or `highest.svg` returns `var(--color-red-600)`
      - `high.svg` returns orange-500
      - `medium.svg` returns yellow-500
      - `low|minor|lowest|trivial.svg` returns gray-400
      - unknown or missing returns gray-300
      - matching is case-insensitive on the filename token
  </behavior>
  <action>
    Create `lib/aio-cycle-charts.ts` with the exported type `ChartSlice`:
    - key: string
    - label: string
    - value: number
    - share: integer percent of the slice total
    - color: CSS var string
    - rows: array of {label, value, color?} with at most 4 entries, used as tooltip rows

    Implement these functions:
    - `executionSlices(counts)`
    - `defectStatusSlices(defects: ResolvedDefect[])`
    - `defectPrioritySlices(defects: ResolvedDefect[])`
    - `priorityChartColor(priority)`

    Execution slice rows are Runs and Share. Re-create the priority colour ramp from the c45211c5 mapping in RESEARCH. Its documented limitation is that Critical and Should share highest.svg.

    Reuse `statusLabel` (aio-cycle-list), `statusCategoryColor` (statusStyles) and `priorityRank` (aio-defect-sort). Do not hand-roll replacements for them.

    For the defect status slice rows:
    - Use the per-status-name counts inside the category.
    - If more than 4 names exist, show the top 3 and merge the rest into "Other".

    For priority slice rows, use Defects = count and Share = %.

    Import the `ResolvedDefect` type from `routes/dashboard/aio-cycle/useCycleDefects`. If that creates a lib -> route import cycle that biome or project convention rejects, define a minimal structural type locally instead.

    Write the tests first, then the implementation. Use one commit.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/lib/aio-cycle-charts.test.ts && npx tsc --noEmit -p .</automated>
  </verify>
  <done>All helper tests pass, tsc is clean, and the work is committed as `feat(261014-crk): aio cycle chart helpers`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Execution Distribution donut beside de-duplicated 2x2 tiles (replaces progress bar)</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/AioDonut.tsx, taskflow/src/routes/dashboard/aio-cycle/ExecutionDonut.tsx, taskflow/src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx</files>
  <behavior>
    - The page renders `exec-donut` with centre text "2/3" and "executed" for the 1 pass / 1 fail / 1 notRun fixture.
    - `cycle-progress-bar` and `progress-seg-*` are absent.
    - `kpi-pass-rate` shows 50%, i.e. pass/executed. It was previously 33%.
    - `kpi-reruns`, `kpi-unlinked` and `kpi-open-defects` are present.
    - `kpi-executed` and `kpi-failing` are gone.
    - While countsLoading, an `exec-donut-skeleton` ring is shown.
    - When total is 0, the text "No runs recorded" is shown inside the donut slot.
  </behavior>
  <action>
    **AioDonut.tsx (shared, also used by Task 3).** Build a fixed-size recharts donut.

    Props:
    - slices: ChartSlice[]
    - size: number
    - testId
    - ariaLabel
    - title (used as the tooltip title fallback)
    - optional `center` ReactNode

    Rendering:
    - Render `PieChart` with explicit width/height equal to size. Do NOT use ResponsiveContainer or ChartContainer, which have WebKit 0-size and aspect-video issues.
    - Inside it, render a `Pie` with these settings:
      - dataKey="value", nameKey="label"
      - innerRadius about 0.33·size, outerRadius about 0.47·size
      - paddingAngle 1 only when slices.length > 1, otherwise 0
      - stroke="none"
      - isAnimationActive={false}
      - colour via the `shape` prop rendering `Sector` with fill = payload.color. Do NOT use `Cell`, which is deprecated in 3.x.
    - Render a recharts `Tooltip` whose `content` renders `TooltipBody` (title = slice label) mapping `slice.rows` to `TooltipRow`. That is at most 4 rows.
    - Put the centre label in an absolutely positioned pointer-events-none HTML overlay.
    - The wrapper is `relative flex-none` with an inline square size, `role="img"` and an aria-label.
    - No legend, no click handlers, no slice labels.

    Also export `AioDonutSkeleton({size, testId})`, a same-size muted ring (rounded-full border-[thickness] animate-pulse), so the geometry stays identical.

    **ExecutionDonut.tsx.**
    - Props: counts, total, loading.
    - When loading, render the skeleton (testid `exec-donut-skeleton`).
    - When total === 0, render a muted ring with the centre text "No runs recorded".
    - Otherwise render AioDonut (testid `exec-donut`, size 160) with:
      - centre: VALUE_CLASS `{executed}/{total}` over a small muted "executed" line
      - aria-label summarising the counts

    **CycleKpiTiles.tsx (per D-tiles and RESEARCH's tile table).**
    - Wrapper: `@container` with `flex flex-col @3xl:flex-row gap-6` (keep the existing px-6/pt-1/pb-3/border-b).
    - Left side: `grid grid-cols-2 gap-x-6 gap-y-4 flex-1 min-w-0`. Do NOT use STAT_GRID_CLASS, which goes to 4 columns.
    - Right side: `ExecutionDonut` with self-center.
    - Delete the progress-bar block and the SEGMENT_ORDER / PROGRESS_SEGMENT_CLASS imports. If PROGRESS_SEGMENT_CLASS becomes unused repo-wide, leave it in aio-cycle-list.ts, since the cycles list may use it. Check with grep and only remove it if it is truly orphaned.

    The four tiles:
    1. **Pass rate** (`kpi-pass-rate`, green)
       - Value: `pass/executed` %, or — when executed is 0.
       - Sub: "of executed".
       - Tip rows: Passed, Failed, Blocked.
    2. **Re-runs** (`kpi-reruns`, blue, icon RotateCcw)
       - Value: count of runs with runCount > 1.
       - Sub: "(xx%)" of total.
       - Tip rows: Re-run cases, Max runs (max runCount).
    3. **Unlinked failures** (`kpi-unlinked`, red, icon XCircle)
       - Value: fail+blocked runs without jiraDefectIDs. Red text when > 0.
       - Sub: "of N failing".
       - Tip rows: Failed w/o defect, Blocked w/o defect.
    4. **Open defects** (`kpi-open-defects`, amber)
       - Unchanged value.
       - Sub: "of N linked".
       - Tip rows: Open, Done.

    Tiles 2 and 3 need `runs`. Show their TileSkeleton until `runs` is defined. Tile 1 follows countsLoading. Keep the 72px tile geometry and the matching skeletons.

    **AioCycleDetailPage.tsx.** Remove the `lastExecuted` prop from the CycleKpiTiles call. Last run already lives in CycleHeader, so showing it in a tile would duplicate it. Keep the value only if other code still uses it.

    **AioCycleDetailPage.test.tsx.** Update the assertions RESEARCH flags:
    - Lines ~183-189, 267-271, 296-297, 316-318 and 388-391 assert progress-seg widths. Replace them with assertions on `exec-donut` presence and its centre text (segment math is now covered by the Task 1 helper tests).
    - Lines ~185, 269, 317 and 629 assert kpi-failing text. Move them to kpi-unlinked text.
    - Line ~627 asserts kpi-executed "2/3". Change it to the donut centre "2/3".
    - Change the pass rate expectation from 33% to 50%.

    Do not hover SVG sectors in jsdom.

    Commit code and tests together as `feat(261014-crk): execution distribution donut + de-duplicated cycle stats`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx src/lib/aio-cycle-charts.test.ts && npx tsc --noEmit -p . && grep -v '^\s*//' src/routes/dashboard/aio-cycle/CycleKpiTiles.tsx | grep -c 'progress-seg\|cycle-progress-bar\|lastExecuted' | grep -qx 0 && grep -v '^\s*//' src/routes/dashboard/aio-cycle/AioDonut.tsx | grep -c '\bCell\b' | grep -qx 0</automated>
  </verify>
  <done>The donut renders beside the 2x2 tiles and the bar is removed. Pass rate is pass/executed. There are no duplicate figures between the tiles, donut and header. Page tests pass and the work is committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Defect Summary (Status + Priority donuts) replaces status pills</name>
  <files>taskflow/src/routes/dashboard/aio-cycle/DefectSummary.tsx, taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx, taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx</files>
  <behavior>
    - The Defects tab renders `defects-summary` containing `defect-status-donut` and `defect-priority-donut`, with the card titles "Status" and "Priority".
    - The severity text line ("Sev: Critical 1") is still rendered inside `defects-summary`.
    - The status pill text "1 In Progress" is no longer rendered in the summary.
    - No donut centre shows the open-defect count.
    - There is no "latest run" toggle.
  </behavior>
  <action>
    **DefectSummary.tsx.**
    - Props: defects (ResolvedDefect[]).
    - Compute `defectStatusSlices` and `defectPrioritySlices` with useMemo.
    - Compute the severity counts with the same `severityOf` logic SummaryStrip uses. Export `severityOf` from DefectsList.tsx, or move it to the new component. Either way, keep a single definition.
    - Return null when there are no resolved issues.

    Render `data-testid="defects-summary"`:
    - A heading row with TITLE_CLASS text "Defect Summary".
    - A `flex flex-wrap gap-4` row holding two `Card size="sm"`, one titled "Status" and one titled "Priority" (TITLE_CLASS). Each card contains an AioDonut (size 128) with testids `defect-status-donut` and `defect-priority-donut`.
    - The cards carry NO centre content, per D-defects: the open count lives only in the kpi-open-defects tile.
    - Below the cards, the existing muted "Sev: ..." line as plain text.
    - Keep the existing strip padding and density classes (border-b px-4 py-2 with density variants).
    - No "Show only latest run" toggle. Per RESEARCH the data is already latest-run only.
    - Do not use per-detail-page card panels beyond these two chart cards.

    **DefectsList.tsx.**
    - Replace `<SummaryStrip defects={defects} />` with `<DefectSummary defects={defects} />` at the same position, after the empty-state guard.
    - Delete SummaryStrip and any now-unused imports (CATEGORY_LABEL only if it is unused elsewhere in the file; statusPillClass only if unused).

    **AioCycleDetailPage.test.tsx.**
    - Update the ~1124 assertion: keep "Sev: Critical 1" inside defects-summary. Replace the "1 In Progress" pill check with presence checks for both donut testids.

    Commit as `feat(261014-crk): defect summary status + priority pies`.
  </action>
  <verify>
    <automated>cd /Users/mimo/Documents/Projects/taskflow/taskflow && npx vitest run src/routes/dashboard/AioCycleDetailPage.test.tsx && npx tsc --noEmit -p . && npx biome check src/lib/aio-cycle-charts.ts src/lib/aio-cycle-charts.test.ts src/routes/dashboard/aio-cycle/ src/routes/dashboard/AioCycleDetailPage.tsx src/routes/dashboard/AioCycleDetailPage.test.tsx</automated>
  </verify>
  <done>The Defects tab shows two titled donuts plus the severity line, and the pills and SummaryStrip are gone. Tests, tsc and biome pass on the touched files. The work is committed.</done>
</task>


</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Jira/AIO API -> render | Already-fetched issue/run fields are rendered as text and SVG; no new input or network surface |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-crk-01 | Tampering/XSS | DefectSummary / AioDonut tooltip labels | mitigate | Render status and priority names as React text children only; never use dangerouslySetInnerHTML; colours come from a fixed var() allowlist, never from API values |
| T-crk-02 | Information disclosure | Charts | accept | Shows only data already visible on the same page |
| T-crk-SC | Tampering | package installs | accept | No new packages (recharts 3.8 already installed) |
</threat_model>

<verification>
- `cd taskflow && npx vitest run` passes (full suite, same as the pre-commit hook).
- `npx tsc --noEmit -p .` is clean.
- biome reports no NEW flagged files.
- No `progress-seg` or `cycle-progress-bar` remain in src, outside comments.

UAT notes to surface to the user (in SUMMARY, for the orchestrator's UAT step):
- FLAG: Pass rate is now passed/executed, not passed/total (de-duplication against the donut slice share). This is cheap to revert.
- Check that the not-run slice colour (gray-300) is readable against the card.
- A donut was rejected earlier on the cycles *list* dashboard (261013-l97). Confirm the donut is wanted here.
- The "Show only latest run" toggle is intentionally omitted, because the defect data is already latest-run only.
- There are no slice labels, only hover tooltips. Critical and Should share a colour (both use highest.svg).
- Narrow the window and confirm the donut stacks below the tiles.
</verification>

<success_criteria>
- The donut replaces the progress bar and sits beside the 2x2 tiles, stacking when narrow.
- Each figure is shown exactly once across the tiles, donut, header and Defect Summary.
- The Defect Summary has Status and Priority pies, no toggle and no centre open count.
- The pass-rate basis change is surfaced at UAT.
- All tests are green and each task is committed atomically.
</success_criteria>

<output>
Create `.planning/quick/261014-crk-polish-aio-cycle-detail-page-cycle-stati/261014-crk-SUMMARY.md` when done.
</output>
