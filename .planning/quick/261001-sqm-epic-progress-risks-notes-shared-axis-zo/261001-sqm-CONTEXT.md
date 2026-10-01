# Quick Task 261001-sqm: Epic progress — risks, notes, shared axis, zoom, confidence, Time colours - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Seventh iteration on the epic detail progress section (prior: -fmk, -g5q, -hsz, -ilq, -qvu, -rtw; all on main). Keep the established style.
Key files: `taskflow/src/lib/epic-progress.ts` (deriveRisks, averageForecasts, projectFinish, deriveCfd, deriveTimeBurnup),
`taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, `EpicProgressSummary.tsx` (hero, Finish, Remaining, Risks),
`EpicCfdChart.tsx`, `EpicTimeBurnup.tsx`, `EpicChartTooltip.tsx`, `epic-markers.tsx` (SERIES), `EpicBands.tsx`,
`taskflow/src/components/ui/tooltip-body.tsx`, `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (onOpenIssue prop; renders the section).

User feedback on 261001-rtw:
1. "The risks are better. But refine it more, the task numbers should be clickable, the layout should be better and so on."
2. "Put the sentence 'From Jira status history' and others in the same place in different tabs elsewhere, maybe into the progress tooltip on the top left."
3. "The start and end dates in the graphs should stay consistent."
4. "On bigger graphs we should be able to zoom in/out somehow."
5. "The confidence of the estimate (in different places) should be communicated nicer."
6. "Colors on time graph have disappeared."

</domain>

<decisions>
## Implementation Decisions

### Risks (refine; Claude's discretion on layout within the established style)
- Issue keys in the Risks UI are clickable and open the issue exactly like Stories list rows do (`onOpenIssue(key)` threaded from
  IssueDetailContent → EpicProgressSection → Risks). Keys must be real buttons (keyboard reachable) — so they cannot live inside a
  tooltip trigger button/role=img; restructure: the Risks cell shows risk rows/chips, and each risk opens a small interactive popover
  (base-ui Popover, click/focus, not hover-only tooltip) OR the cell itself lists keys inline — planner picks, but keys must be clickable
  with mouse and keyboard, and "+N more" should reveal the rest (or open a filtered list) rather than dead text.
- Better layout: per risk a row with icon · label · count, short one-line explanation, key list (wrapping, compact mono, max ~5 + "+N more").
  Severity ordering (warnings first). Clean state unchanged ("No risks" with check).

### Data-source notes move to the hero tooltip (top-left)
- All provenance/explanatory notes ("From Jira status history", "Approximate — loading status history", "Approximate for some items",
  "Scope by story creation date", "Logged from worklogs", estimate formula note, holiday/calendar note, etc.) are removed from
  under/around the charts and listed in ONE "Data sources" block in the hero (progress) tooltip, identical structure in all three tabs
  (rows with neutral icon markers; tab-specific lines appear only when relevant, but always in the same place/order).
- Chart footers no longer show notes (a subtle indicator is OK only if a source is approximate/loading — e.g. a small neutral info icon
  next to the legend that opens the same text — planner's call; keep it consistent across charts).

### Consistent chart date range
- Both charts (Count/SP CFD and Time) use the SAME x-domain: start = shared axis start (epic created / earliest story, same rule
  in both — unify deriveCfd and deriveTimeBurnup start logic), end = max(today, shared forecast latest date) (same rule in both).
  Switching tabs never shifts the axis. Ticks generated the same way.

### Zoom (user choice: range brush + presets)
- A slim overview strip under the chart with draggable handles (recharts Brush) plus presets: All · 3M · 1M · 2W · Forecast
  (Forecast = today−2W … latest forecast date). Zoom state is shared by both charts and preserved when switching tabs
  (lift state to the section). Presets clamp to the shared domain; the active preset is highlighted; Brush drag deselects presets.
- Brush styling neutral (no status colours), works in light/dark. Respect performance (data ≤ ~260 points).
- Only on the "bigger graphs" (the two main charts).

### Confidence (user choice: signal meter + reason)
- One shared `ConfidenceMeter` component: 3-bar signal glyph (filled bars = level) + word (High / Medium / Low), neutral colours
  (not status colours). Used everywhere confidence appears: Finish tile, Finish tooltip, chart forecast tooltip rows, forecast legend.
- A plain-language reason derived in the lib (e.g. "Only 4 completions in the last 2 weeks", "Views disagree by 6 working days",
  "Steady pace over 6 weeks"), shown in tooltips next to the meter. Pure + tested.

### Time graph colours (user choice: map to status meaning)
- Time chart series use status colours by meaning: Logged = Done (STATUS_CATEGORY_COLOR.done), Remaining = In progress
  (STATUS_CATEGORY_COLOR.indeterminate), Estimate = To do (STATUS_CATEGORY_COLOR.new) area. Forecast line/band stay neutral (dashed / band).
  Tooltip markers follow: these three rows use status-colour markers; forecast rows neutral glyphs. Update the "colour = status meaning"
  rule documentation in epic-markers.tsx accordingly. CFD Remaining line: keep neutral solid (it's the sum of statuses) unless planner
  finds a cleaner mapping — must be consistent between the two charts' Remaining (both should mean the same thing: if Time Remaining
  is blue, the CFD Remaining line should match — planner decides one rule and applies it to both).

### Constraints carried over
- Existing tests: update only intentionally changed expectations; list them all (grep every affected assertion).
- EpicDetailSheet.test text-collision rules (no standalone visible "Stories"/"In Progress"/"Done" text nodes).
- No negative-margin hacks inside spaced containers (memory: Tailwind v4 space-y vs -my).
- Pre-commit: biome + tsc (incl tests, no `.at`) + full vitest; one commit per task; never --no-verify. zsh: use arrays for file loops.
- One row = one line where rows exist. Don't fix fetchAllSearchPages bug.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-rtw-epic-progress-one-forecast-neutral-marke/ (latest plan, summary, review)
- .planning/quick/261001-ilq-epic-progress-cfd-adaptive-forecast-hero/261001-ilq-RESEARCH.md (recharts notes: numeric time axis, null future points)

</canonical_refs>
