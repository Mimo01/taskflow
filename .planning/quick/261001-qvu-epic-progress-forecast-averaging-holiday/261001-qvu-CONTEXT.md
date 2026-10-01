# Quick Task 261001-qvu: Epic progress — forecast averaging, holidays, hover polish, risks - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Fifth iteration on the epic detail progress section. User: "I really like it, keep this style." Visual language from 261001-ilq
(full-width divider layout, hero + stat strip, status colours via STATUS_CATEGORY_COLOR, unified TooltipBody/TooltipRow surface) is LOCKED — refine, don't restyle.

Key files: `taskflow/src/lib/epic-progress.ts` (forecastFromThroughput, deriveAdaptiveForecast, deriveTimeForecast, deriveProjection/withProjection,
working-day helpers ~335-360), `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, `EpicProgressSummary.tsx`, `EpicCfdChart.tsx`,
`EpicTimeBurnup.tsx`, `useEpicProgressQueries.ts`, `taskflow/src/components/ui/tooltip-body.tsx`, `taskflow/src/services/tempo/schedule.ts`
(fetchUserSchedule → Map<date, WORKING_DAY|NON_WORKING_DAY|HOLIDAY>), `taskflow/src/routes/worklogs/WorklogsPage.tsx` (~line 444: schedule query
wiring with tempoEnabled, jiraUserKey, key ['tempo','schedule',…]).

User feedback:
1. "For the forecast add more datapoints (only on hover)" → chart forecast line.
2. "The detail rows of people should be fully hoverable, including names and the end numbers."
3. "The legend under the main progress bar is too close to the bar."
4. "The subitems in the hover tooltips should have something on the left, only the statuses have it."
5. "Do the forecasts account for weekends and holidays?" → weekends yes (Mon–Fri working-day calendar); holidays no → add via Tempo.
6. "The risks should be nicer, including the tooltip."
7. "The forecast should be average of the 3 different points of view."

</domain>

<decisions>
## Implementation Decisions

### Forecast = average of Count, SP and Time (Claude's choice; user said "you decide")
- Compute three independent forecasts: Count (items), SP (story points), Time (remaining hours vs logged-hours pace, from worklogs).
- Headline Finish (hero strip) = average of the AVAILABLE metrics' dates, independent of the Count/SP/Time toggle:
  average earliest, average likely, average latest separately (average in working-day offsets from today, then map back to dates
  via the working calendar — never average raw calendar dates across weekends).
- A metric is "available" only when its state is `ok` with nLikely > 0. Unavailable metrics are excluded with a reason
  (e.g. "SP: no estimates", "Time: no logged time", "Time: loading worklogs"). If none available → fall back to the existing
  state messaging (Complete / Too early / Stalled / Not converging) using a sensible precedence (Complete only if all done).
- Confidence of the average: lowest of contributors, downgraded if the contributors disagree widely (planner defines threshold, e.g. spread > 50% of likely).
- Worklogs are now needed in every mode for the Time contribution: enable the worklog query in all modes, loaded after first paint
  (don't block hero render; Finish shows the available average and marks Time as loading until it arrives).
- The chart forecast line/band for the active metric stays per-metric (it's in that metric's units); the Finish tooltip lists all
  three metrics' dates + the average.

### Holidays (user choice: Tempo schedule)
- Working-day calendar becomes injectable: Mon–Fri default, minus Tempo NON_WORKING_DAY/HOLIDAY dates when available.
  Applies to pace measurement (window sampling) AND finish-date projection. Thread a `calendar`/`isWorkingDay` through forecast,
  working-day helpers and projection; keep pure + tested (holiday inside window, holiday inside projection, weekend + holiday adjacency).
- Data: reuse `fetchUserSchedule` for the current user (`jiraUserKey`, gated on `tempoEnabled` like WorklogsPage) over
  [window start − margin, today + horizon (e.g. 26 weeks)]. Own query key (e.g. ['tempo','schedule','epic-forecast', …]);
  don't collide with WorklogsPage's key shape unless identical semantics. Fallback silently to Mon–Fri when unavailable; Finish tooltip
  notes "Excludes weekends and N holidays (Tempo)" vs "Excludes weekends (holidays unavailable)".

### More forecast datapoints on hover (user choice: chart forecast line)
- Projection gets one point per working day (or per day, skipping non-working days consistently) from today to the latest date,
  each with projected remaining (likely) and earliest/latest band values. Dots hidden by default; the active dot/crosshair shows
  on hover with a tooltip row set: projected remaining, range, "N working days from today". Keep performance sane (cap points, e.g. ≤ 260).

### Fully hoverable assignee rows
- The whole assignee row (avatar + name + bar + chips) is ONE tooltip trigger with the full breakdown (one tab stop per row kept).
  No nested interactive elements; keep one-row-one-line.

### Legend spacing
- More space between the hero's main progress bar and its legend/caption below (and check similar bar→legend gaps in the section for consistency).

### Tooltip sub-items have a left marker
- Every TooltipRow gets a leading marker: status rows keep the status-colour swatch; other rows get a consistent neutral marker
  (e.g. muted dot/icon matching the series colour where one exists — chart series use their line/area colour; derived values
  like "Remaining"/"Range" use the matching series colour or a neutral dot). Make the marker part of TooltipRow's API so all
  tooltips (hero, strip, bars, assignee rows, charts, quick-peek, story mini bars) get it.

### Risks nicer (Claude's discretion within the locked style)
- Redesign the Risks cell: compact chips with icon + count + label, severity-tinted (warning vs info), consistent with status palette
  (don't reuse status colours for risk severity in a confusing way). Cover: unestimated, unassigned open, stalled/not converging,
  overdue vs epic due date if available cheaply (only if field already fetched — otherwise skip), scope growth when significant.
- Risks tooltip: one row per risk with marker, count, short explanation, and (where cheap) the top few affected issue keys.
- Clean state: a calm "No risks" with a check marker.

### Constraints carried over
- Keep the established style; existing tests updated only where intentionally changed (list them).
- EpicDetailSheet.test text-collision rules (no standalone "Stories"/"In Progress"/"Done" visible text nodes).
- Pre-commit: biome + tsc (incl tests, no `.at`) + full vitest; one commit per task; never --no-verify.
- Don't fix fetchAllSearchPages 200-step bug here.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/ (plan, research incl. forecast formulas, review)
- taskflow/src/routes/worklogs/WorklogsPage.tsx (Tempo schedule query wiring)

</canonical_refs>
