# Quick Task 261001-rtw: Epic progress — one forecast, neutral markers, unified tabs, spacing - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Sixth iteration on the epic detail progress section (prior: -fmk, -g5q, -hsz, -ilq, -qvu; all on main). Keep the established style.
Key files: `taskflow/src/lib/epic-progress.ts` (averageForecasts, deriveProjection/withProjection, deriveAssigneeBuckets, deriveSummary),
`taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, `EpicProgressSummary.tsx`, `EpicCfdChart.tsx`, `EpicTimeBurnup.tsx`,
`EpicChartTooltip` (wherever it lives), `taskflow/src/components/ui/tooltip-body.tsx` (TooltipRow marker API), `taskflow/src/lib/statusStyles.ts`.

User feedback on 261001-qvu:
1. "The forecast is shown differently in each graph, unify it. We have one forecast."
2. "Only statuses should have colors in the hover, other things should have something different."
3. "The main progress bar has still the legend too close."
4. "The person progress bars in time view do not agree with the data."
5. "Overall unify the different tabs. Some things should be generalized and show the same for all 3."

</domain>

<decisions>
## Implementation Decisions

### One forecast (user: "charts share only the forecast")
- Chart TYPES stay per tab: Count/SP keep the stacked CFD; Time keeps its Estimate/Logged line chart (+ Remaining).
- The forecast drawn in EVERY chart is the single averaged forecast (`averageForecasts` result — same likely/earliest/latest dates
  and same state as the Finish tile). Each chart projects from its own current remaining (in its unit) to 0 at the averaged
  likely date, with the band reaching 0 at averaged earliest/latest. No per-metric forecasts drawn anywhere.
- When the averaged state is not ok (done/too-early/stalled/not-converging) no projection in any chart; the same state text everywhere.
- Per-day hover points (from -qvu) stay, now derived from the averaged forecast; "N working days from today" uses the same holiday calendar.
- Chart tooltip forecast rows and the Finish tooltip use identical labels and dates.

### Colour = status only; neutral glyphs for everything else (user choice: neutral line glyphs)
- TooltipRow marker variants: `status` (existing colour square — ONLY for done / in progress / to do and named statuses),
  `line` (solid neutral line glyph), `dashed` (dashed neutral line glyph), `band` (neutral range/hatched glyph), `icon` (small
  lucide icon in muted-foreground: e.g. calendar for dates, clock for time, alert for risks, user for people, hash for counts).
  All neutral markers are monochrome (foreground/muted-foreground), never status colours or other hues.
- Chart lines/areas that are NOT statuses become neutral tones (foreground / muted-foreground; solid vs dashed vs band fill
  distinguished by stroke style/opacity): CFD Remaining line, forecast line + band in both charts, Time chart Estimate, Logged
  and Remaining series. Status areas in the CFD keep STATUS_CATEGORY_COLOR. Ensure contrast in light and dark.
- Story mini bars (Stories list): logged-vs-estimate is not a status → neutral fill; overrun keeps a distinct warning treatment
  (not a status colour). Risk chips keep amber/muted severity (not status colours) — already compliant; markers inside risk tooltips → icons.
- Audit every tooltip in the feature (hero, Finish, Remaining, Risks, status bar, assignee rows, both charts, quick-peek, story mini bars)
  and assign the correct marker variant.

### Legend spacing — ROOT CAUSE (orchestrator-verified)
- Tailwind v4 `space-y-*` applies `margin-block-end` to children through a zero-specificity `:where()` selector. The status bar trigger
  (`EpicProgressSection.tsx` ~line 394, `className="py-1.5 -my-1.5"`) has its own `-my-1.5`, which overrides that margin, so the 12px
  gap is lost AND the negative bottom margin swallows the trigger's padding → legend touches the bar. The same `-my-1.5` hover-area hack
  is on the assignee row trigger (~line 434) inside a spaced list.
- Fix: remove the negative-margin hover hack wherever it sits inside a spaced container; achieve the larger hover area without negative
  margins (e.g. padding on the trigger and account for it in the parent spacing, or use `gap` on a flex column where the trigger has no
  vertical margin). Verify the computed bar→legend gap is ≥ 8–12px (add a test asserting the trigger carries no negative margin classes,
  since jsdom can't measure). Check the hero bar → caption gap too and make bar→legend spacing consistent across hero, status bar and rows.

### Unified tabs (generalize; same everywhere for Count / SP / Time)
- One generic "bands" model for every tab: done / in progress / to do weighted by the active metric (count = 1, SP = story points,
  time = estimate seconds via estimateOf). Used identically by: hero big % + segmented bar + caption, status bar, assignee bars,
  assignee chips, quick summaries, tooltips.
- Person rows in Time (fixes "do not agree with the data"): bar AND chips show the same three status values in estimated hours
  (done / in progress / to do estimate). Logged vs estimate moves to the row tooltip as neutral rows (clock icon). No chip shows a
  value that the bar doesn't draw.
- Hero in every tab: big % = done share in active metric; bar = 3 status bands; caption same template with unit-formatted values.
- Remaining tile: same structure in every tab (active metric primary; the other two metrics secondary); Time shows remaining
  estimate − logged consistently with the Time chart's Remaining.
- Tooltip contents use the same row order/labels across tabs; only units differ. Generalize via shared helpers/components
  (e.g. `formatMetric`, a `BandBreakdown` tooltip block) rather than per-tab branches. Remove dead per-tab code paths.

### Constraints carried over
- Existing tests: update only intentionally changed expectations; list them all (grep every affected assertion).
- EpicDetailSheet.test text-collision rules.
- Pre-commit: biome + tsc (incl tests, no `.at`) + full vitest; one commit per task; never --no-verify.
- One row = one line. Don't fix fetchAllSearchPages bug.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-qvu-epic-progress-forecast-averaging-holiday/ (latest plan, summary, review)
- .planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-RESEARCH.md (forecast formulas, recharts notes)
- Memory: "Visual bugs: inspect DOM before CSS" — spacing root cause recorded above.

</canonical_refs>
