# Quick Task 261002-0et: Epic progress — simpler confidence, conditional zoom, simpler risks - Context

**Gathered:** 2026-10-02
**Status:** Ready for planning

<domain>
## Task Boundary

Eighth iteration on the epic detail progress section (prior: …-rtw, 261001-sqm; all on main). Keep the established style.
Key files: `taskflow/src/routes/dashboard/issue-detail/ConfidenceMeter.tsx`, `EpicProgressSummary.tsx` (Finish tile/tooltip, RisksTile/RiskKeys),
`EpicChartTooltip.tsx`, `EpicCfdChart.tsx` (ForecastLegend), `EpicTimeBurnup.tsx`, `EpicChartZoom.tsx`, `EpicProgressSection.tsx`,
`taskflow/src/lib/epic-progress.ts` (confidence reason, deriveRisks / keysOf, zoom presets), `IssueDetailContent.tsx` (onOpenIssue, Stories list row pattern).

User feedback on 261001-sqm:
1. "There is too much information in the confidence, it doesn't line up really well, fix it."
2. "Only put the zoom in/out of the graph if the dates are above certain range; if the range is short it doesn't need to be there."
3. "Polish the risks more, it is too complex and hard to use."

</domain>

<decisions>
## Implementation Decisions (Claude's discretion — user gave direction, not specifics)

### Confidence — less information, aligned
- Everywhere except the Finish tooltip: ONLY the meter glyph + level word (High / Medium / Low). No reason text, no extra sub-lines
  (Finish tile sub-line, chart forecast tooltip rows, forecast legend, per-metric part rows).
- Finish tooltip: one confidence row (meter + word) and the reason as ONE short line under it (max ~60 chars; shorten reason strings in
  the lib if needed). No duplicated confidence for each metric part — per-metric rows show only their dates.
- Alignment: ConfidenceMeter is a fixed-size inline-flex with `items-center`, glyph and word baseline-aligned with surrounding text;
  in tooltip rows it sits in the value column like other values (right-aligned, same font size); in the Finish tile it sits on the
  same line as the date range sub-text or replaces it cleanly — no wrapping, one row = one line.

### Zoom only for long ranges
- Show the Brush strip AND presets only when the shared domain spans more than 42 calendar days (6 weeks). Below that: no strip,
  no presets, full domain, chart height shrinks back (no empty gap). Constant in lib (e.g. ZOOM_MIN_DAYS = 42), tested at the boundary.
- Presets that would equal or exceed the domain (e.g. 3M on a 2-month epic) are hidden, not disabled.
- Stored zoom resets to All if the domain drops below the threshold.

### Risks — simpler, easier to use
- Risks tile: a compact list, one line per risk: icon · count · short label (e.g. "3 unestimated", "2 unassigned", "Overdue 4 days").
  Warnings first. Clean state unchanged ("No risks" ✓). No nested popover-with-key-chips.
- Each risk line is a button. Clicking it opens ONE simple popover for that risk: a title with a one-sentence explanation, then a list
  of the affected issues as rows (key · summary, truncated, one line each), clickable like Stories list rows → onOpenIssue(key).
  Scrollable when long (max ~8 rows visible), no "+N more" buttons. Keyboard: Enter opens, arrow/Tab through rows, Escape closes.
  Risks without affected issues (overdue, stalled, not converging, scope growth) show only the explanation.
- Without onOpenIssue: rows render as plain text (keep the 261001-sqm WR-01 behaviour).
- Lib: risks carry issue {key, summary} (from the stories already loaded) instead of bare keys.
- Respect EpicDetailSheet.test (issue keys / summaries must not be in the DOM until a risk popover is opened; no standalone
  "Stories"/"In Progress"/"Done" text).

### Constraints carried over
- Update only intentionally changed existing tests; list them all.
- No negative margins inside spaced containers. One row = one line.
- Pre-commit: biome + tsc (incl tests, no `.at`) + full vitest; one commit per task; never --no-verify. zsh arrays for file loops.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-sqm-epic-progress-risks-notes-shared-axis-zo/ (latest plan, summary, review)

</canonical_refs>
