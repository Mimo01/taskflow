# Quick 261014-crk: AIO cycle detail polish - Research

**Researched:** 2026-10-14
**Domain:** recharts 3.8 donut/pie inside the existing Card/EpicStatCard tile system
**Confidence:** HIGH (all data/code facts verified in the codebase; recharts API checked in installed `node_modules/recharts` types and the official Cell migration guide)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Execution Distribution**
- Donut chart placed BESIDE the KPI tiles (tiles left, donut right, like AIO), REPLACING the segmented progress bar.
- Status colours (existing status palette), no legend: direct labels on slices / tooltip per slice (<=4 rows),
  centre shows executed/total. Responsive: donut stacks below the tiles when narrow.

**KPI tiles**
- Claude's discretion, with the user constraint: "not too overcomplicated and no duplicate data".
- Guidance: AIO-style presentation (centred big number, small "(xx%)" sub-line) but every figure shown ONCE
  across tiles + donut. Don't repeat in tiles what the donut already shows per status (no per-status
  Passed/Failed/Blocked tiles if the donut carries them). Only data computable from probed API fields
  (no effort tiles unless API returns effort).

**Defect Summary charts**
- Claude's discretion, with the user constraint: user likes PIE graphs, "not too complicated and no duplicate data".
- Guidance: two pies/donuts (Status distribution, Priority distribution) in a "Defect Summary" block with the
  "Show only latest run" toggle only if latest-run data is already available; priority colours follow the
  existing 9-level scheme (icon severity); status colours by status category. No duplicate numbers vs. the
  defects list / tiles (e.g. open-defect count lives in ONE place).

### Claude's Discretion
- Exact tile set/count, chart library usage (recharts ^3.8 already a dependency), layout breakpoints, empty/loading states.

### Saved prefs (CONTEXT specifics)
- colour = status only, <=4-row tooltips, no legends, identical cards across tabs, one row = one line.

### Deferred Ideas
- None listed.
</user_constraints>

## Summary

Everything needed is already loaded on the page, so no new API calls are required. `useAioCycleData` gives `counts` (pass/fail/blocked/inProgress/notRun) and `total`. `runs` gives `runCount` and `jiraDefectIDs`. `useCycleDefects` gives resolved Jira issues with `status.statusCategory`, `priority{name, iconUrl}` and severity (`customfield_13415`). [VERIFIED: codebase]

**There is no all-runs vs latest-run split.** `cycles.ts:588` maps `jiraDefectIDs: item.latestTestRun?.allDefects ?? []`, so the cycle's defects already are the latest-run defects only. Historical runs are never fetched. Per CONTEXT, **omit the "Show only latest run" toggle**. A real "all runs" set would need one run-history call per case (a new N+1 API call), which is out of scope. [VERIFIED: codebase + 261013-mnc PROBE-RESULTS P2]

Use recharts `PieChart` + `Pie` at a **fixed pixel size** (no `ChartContainer`/`ResponsiveContainer`). Colour slices via the `shape` prop or a per-datum `fill`, not `Cell`, which is deprecated in 3.x. Put the centre label in an HTML overlay. Keep all slice/tooltip math in pure helpers in `lib/` so it can be unit-tested; jsdom hover on SVG sectors is unreliable.

**Primary recommendation:** create `aio-cycle/ExecutionDonut.tsx` (beside a 2x2 tile grid in `CycleKpiTiles`) and `aio-cycle/DefectSummary.tsx` (2 donuts replacing the pills in `DefectsList`'s `SummaryStrip`). Add pure helpers `executionSlices(counts)`, `defectStatusSlices(defects)` and `defectPrioritySlices(defects)` in a new `lib/aio-cycle-charts.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|---|---|---|---|
| Status counts / defects | Browser (existing TanStack queries) | — | Already fetched and cached. No new endpoints. |
| Slice/tile derivation | Browser, pure `lib/` helpers | — | Testable without rendering recharts. |
| Donut rendering | Browser, recharts SVG | — | Read-only, hover tooltips only (no click). The user rejected interactive dashboards in 261013-l97. |

## Data availability (focus 1)

| Figure | Source | Notes |
|---|---|---|
| Per-status counts, total | `useAioCycleData().counts/total` | Summary-driven, with a runs fallback. Must honour `countsLoading` (status-map race, see the module-map memory). |
| Executed | `pass+fail+blocked` (current definition in `CycleKpiTiles`) | inProgress is NOT counted as executed. Keep that. |
| Re-runs | `runs.filter(r => (r.runCount ?? 0) > 1)` | Needs `runs` (not summary). Show a skeleton until `runs` is loaded. |
| Failing without a defect | fail/blocked runs with empty `jiraDefectIDs` | Already computed in `CycleKpiTiles`. |
| Defect status | `issue.fields.status.{name, statusCategory.key}` | `fetchJiraIssueByKey` requests `status,priority,customfield_13415,...` |
| Defect priority | `issue.fields.priority.{name, iconUrl}` | Sort with `priorityRank` (`lib/aio-defect-sort.ts`). |
| Effort | — | P5: summary has no effort. Do NOT add effort tiles. |
| Latest-run vs all defects | — | Not distinguishable (see Summary). No toggle. |
| Last executed date | Already shown in `CycleHeader` (`lastExecuted` prop, line 52) | Drop it from the tile sub-line to avoid duplication. |

## Recommended tile set (focus 3): one figure, one place

The donut shows each status count (slice tooltip: count + share%) and executed/total in the centre. The tiles show only what the donut cannot:

| Tile (testid) | Value | Sub-line | Tooltip (<=4 rows) |
|---|---|---|---|
| Pass rate (`kpi-pass-rate`) | `pass/executed` % (quality of what was run) | `of executed` | Passed, Failed, Blocked (counts from executed only) |
| Re-runs (`kpi-reruns`) | count of cases with runCount>1 | `(xx%)` of total | Re-run cases, Max runs |
| Unlinked failures (`kpi-unlinked`) | fail+blocked without a defect | `of N failing` | Failed w/o defect, Blocked w/o defect |
| Open defects (`kpi-open-defects`) | `openCount` | `of N linked` | Open, Done |

- **Pass-rate basis change.** Today's tile is `pass/total`, which would duplicate the pass slice's share%. Switching to `pass/executed` makes it a distinct figure. This is `[ASSUMED]` acceptable: flag it to the user at UAT. The fallback is to keep `pass/total` and leave share% out of the slice tooltips.
- **Open-defect count lives only in this tile.** The defect donuts must not print the open count again: no centre number on the status donut, or show only the total linked count.
- **Visual style:** AIO-style means a centred big number with a small "(xx%)" sub-line. The current `StatCardBody` is left-aligned. Either add `text-center` within `STAT_CARD_CLASS`, or keep it as is for consistency with the epic tiles. Keep the 72px geometry and the matching skeletons.

## Architecture Patterns

### Layout
```
<div @container>  flex flex-col @3xl:flex-row gap-6
  ├── grid grid-cols-2 gap-x-6 gap-y-4 flex-1 min-w-0   <- 4 tiles (2x2: 72+16+72 = 160px tall)
  └── ExecutionDonut  flex-none size-40 (160px) self-center   <- height matches the 2x2 stack
```
- Do NOT use `STAT_GRID_CLASS` here. It switches to 4 columns at `@2xl/epic`, which breaks the tiles-left / donut-right layout. Use a fixed `grid-cols-2` instead.
- Defects tab: `DefectSummary` replaces the status pills in `SummaryStrip`. It holds two titled sm Cards ("Status", "Priority"), each with a 120-140px donut, side by side, wrapping when narrow. The severity text line (`Sev: ...`) can stay as plain text because it isn't shown anywhere else.

### Donut pattern (recharts 3.8)
```tsx
// Cell is @deprecated in 3.x (types/component/Cell.d.ts); use per-datum fill / shape.
// Source: https://recharts.github.io/en-US/guide/cell/
import { Pie, PieChart, Sector, type PieSectorShapeProps, Tooltip } from 'recharts';

const SliceShape = (p: PieSectorShapeProps) => <Sector {...p} fill={(p.payload as Slice).color} />;

<div className="relative size-40" data-testid="exec-donut" role="img" aria-label={ariaSummary}>
  <PieChart width={160} height={160}>
    <Pie data={slices} dataKey="value" nameKey="label" innerRadius={52} outerRadius={76}
         paddingAngle={slices.length > 1 ? 1 : 0} stroke="none"
         isAnimationActive={false} shape={SliceShape} />
    <Tooltip content={({ active, payload }) => active && payload?.[0]
      ? <TooltipBody title={payload[0].name}>…≤4 TooltipRow…</TooltipBody> : null} />
  </PieChart>
  <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
    <span className={VALUE_CLASS}>{executed}/{total}</span>
    <span className="text-xs text-muted-foreground">executed</span>
  </div>
</div>
```
- **Fixed width/height**, not `responsive`/`ResponsiveContainer`. This avoids 0-size measurement issues in WebKit/Tauri and in jsdom. The `ChartContainer` in `components/ui/chart.tsx` has `aspect-video` by default, which is wrong for a square donut. If you do use it, override with `aspect-square`.
- **Colours:** existing CSS-var strings, never hex.
  - Execution status: green-500 = pass, red-500 = fail, orange-400 = blocked, blue-500 = in progress (same as `progressTooltipRows` in `lib/aio-cycle-list.ts`).
  - Not run: `var(--color-muted)` (the bar uses `bg-muted`). It may be too faint against the card, so consider `var(--color-gray-300)`/dark `gray-600` and check this at UAT.
  - Defect status category: `STATUS_CATEGORY_COLOR` / `statusCategoryColor()` from `lib/statusStyles.ts` (gray-400 / blue-500 / green-500).
- **Status donut granularity:** 3 slices by status category, matching the pills it replaces and colour-by-status. The slice tooltip lists the top status names in that category, up to 4 rows (merge the rest into "Other").
- **Priority donut:** slices ordered by `priorityRank`. Colour by icon severity. The old `prioritySeverityFromIcon` / `ICON_SEVERITY_STRIPE` ramp was **deleted** in 1a6daa24 (260607-ixt-03), so the memory note is stale. Re-create a small `priorityChartColor(priority)` in the new lib from the original c45211c5 mapping:
  - blocker, critical, highest, major -> red-600
  - high -> orange-500
  - medium -> yellow-500
  - low, minor, lowest, trivial -> gray-400
  - unknown -> gray-300

  The icon filename token comes from `iconUrl`. Known limitation: Critical and Should share `highest.svg`, so they get the same colour. This is the one place where colour does not mean status; CONTEXT explicitly asks for it.
- **No legend; tooltip per slice.** Skip direct slice labels at this size: at 120-160px, small slices collide and labels clip. Hover covers it. This is a discretion call; the user may ask for labels at UAT.

### Anti-patterns
- Clickable slices/tiles (the user rejected interactive dashboards in 261013-l97; recharts 3.8 has no keyboard activation anyway).
- Showing the same number twice:
  - total in both a tile and the centre
  - open defects in both the tile and the donut centre
  - "Last run" in both the tile and the header
- Creating `routes/dashboard/StatTile.tsx` or any other name listed in `widget-removal.guard.test.ts`. Name new files with an `Aio`/`Execution`/`Defect` prefix inside `aio-cycle/`.

## Don't Hand-Roll
| Problem | Don't build | Use instead |
|---|---|---|
| Donut arcs | SVG path math / conic-gradient | recharts `Pie` (already installed, 3.8.0) |
| Tooltip body | new markup | `TooltipBody`/`TooltipRow` (`components/ui/tooltip-body`) |
| Tile shell | new card | `Tile`/`TileSkeleton`/`TileShell` (`aio-cycle/AioTile.tsx`) |
| Priority order | name list | `priorityRank` (`lib/aio-defect-sort.ts`) |
| Category colours | hex literals | `statusCategoryColor` (`lib/statusStyles.ts`) |

## Common Pitfalls

1. **Existing tests will break.** These must be updated in the same commit, because the pre-commit hook runs the full vitest suite.
   - `AioCycleDetailPage.test.tsx` lines 183-189, 267-271, 296-297, 316-318 and 388-391 assert `progress-seg-*` testids and `style.width`.
   - Lines 185, 269, 317 and 629 assert `kpi-failing` text such as "Failing / Blocked1" and "all linked to defects".
   - Line 627 asserts `kpi-executed` = "2/3".
   - Line 1124 (`defects-summary` with "1 In Progress" and "Sev: Critical 1") is affected if the pills move into the donut.

   Replace the segment-width assertions with pure-helper unit tests (`executionSlices` returns non-zero slices in order, with share%). In the page test, assert the donut wrapper `data-testid` and the centre text.
2. **jsdom + recharts.** `src/test/setup.ts` mocks `ResizeObserver` (600x400), so responsive charts mount. Fixed-size `PieChart` does not need it. Tooltip hover on `<path>` sectors is not reliably triggerable in jsdom, so test tooltip rows through the helper functions, not by hovering.
3. **Status-map race.** The donut must show its skeleton (a ring of the same size, for identical geometry) while `countsLoading` is true. Otherwise everything renders as one "Not run" slice (module-map memory).
4. **Single-slice / empty cases.**
   - With one non-zero slice, `paddingAngle` must be 0, or a gap appears at the top.
   - With `total === 0`, render a muted ring and "No runs recorded", not an empty SVG.
   - Defect donuts: hide them while `isResolving`, or show a ring skeleton. Defects whose issue is null are excluded, which is the same rule as `openCount`.
5. **Defects tab render order.** `DefectsList` returns early with an `EmptyState` when there are no defects. The summary block must sit after that guard, as `SummaryStrip` does now.
6. **Pass-rate semantics** change if you adopt `pass/executed`. Update the test expectations: 33% becomes 50% in the 1-pass/1-fail/1-notRun fixture.
7. **Tailwind v4 JIT.** Colours passed as `var(--color-*)` strings must appear literally in source (see the `statusStyles.ts` comment), or the theme variables are not emitted.

## Assumptions Log
| # | Claim | Risk if wrong |
|---|---|---|
| A1 | Changing Pass rate to `pass/executed` is acceptable as a de-duplication | User expects AIO's `%-of-total` and asks to revert. Cheap to revert. |
| A2 | Not-run colour `gray-300` reads better than `muted` on the card | Purely visual; check at UAT. |
| A3 | The user accepts a donut here, although a donut was rejected on the cycles *list* dashboard (261013-l97, 2x2 grid with donut) | CONTEXT locks the donut for this page, but tell the user about the earlier rejection at UAT. |

## Environment Availability
No new dependencies. recharts 3.8.0 is installed (`node_modules/recharts/package.json`). No package installs, so no legitimacy audit is needed.

## Validation Architecture
| Property | Value |
|---|---|
| Framework | vitest + RTL (`vitest.config.ts`, setup `src/test/setup.ts`) |
| Quick run | `cd taskflow && npx vitest run src/lib/aio-cycle-charts.test.ts src/routes/dashboard/AioCycleDetailPage.test.tsx` |
| Full suite | `cd taskflow && npx vitest run` (also runs in pre-commit), plus `biome check` and `tsc` |

Wave 0: create `src/lib/aio-cycle-charts.test.ts` covering:
- slice order, zero-filtering and share%
- tooltip rows capped at 4
- priority colour from `iconUrl` (`major.svg` -> red, unknown -> gray)
- category slices

## Security Domain
Read-only rendering of already-fetched data. No new input, auth or network surface. Not applicable beyond the existing controls.

## Sources
- Codebase (verified): `aio-cycle/CycleKpiTiles.tsx`, `AioTile.tsx`, `useAioCycleData.ts`, `useCycleDefects.ts`, `DefectsList.tsx`, `lib/aio-cycle-list.ts`, `lib/statusStyles.ts`, `lib/aio-defect-sort.ts`, `services/aio/cycles.ts:588`, `services/jira.ts:2015`, `components/ui/chart.tsx`, `src/test/setup.ts`, `widget-removal.guard.test.ts`, git 1a6daa24 / c45211c5
- `node_modules/recharts/types` (3.8.0): Cell `@deprecated`, Pie `shape`, `paddingAngle`, `isAnimationActive`
- https://recharts.github.io/en-US/guide/cell/ (Cell to `shape` migration)
- 261013-mnc-PROBE-RESULTS.md (P2 `allDefects` on latestTestRun only; P5 no effort)
