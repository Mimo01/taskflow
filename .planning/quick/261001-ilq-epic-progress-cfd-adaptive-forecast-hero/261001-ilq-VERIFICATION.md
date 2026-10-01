---
phase: quick-261001-ilq
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 10/10 must-haves verified (automated)
human_verification:
  - test: "Hover tooltips on hero, strip cells, status bar, assignee bar, quick-peek, story mini bar, and both charts"
    expected: "All use one surface and one swatch/label/value row layout"
    why_human: "Recharts tooltip hover and visual consistency are not testable in jsdom"
  - test: "CFD against a real Data Center changelog"
    expected: "Stacked Done/In progress/To do from real history; truncated-history top-up works; note reads 'From Jira status history'"
    why_human: "Needs live Jira (history order, from/to ids, Epic Link joinedAt assumption A3)"
  - test: "Visual rendering in Tauri/WKWebView: numeric time axis ticks, forecast dashed line and range band, hero/strip stacking at narrow widths, avatar and chip alignment"
    expected: "Matches intent; one row = one line"
    why_human: "Visual"
---

# Quick 261001-ilq Verification

**Goal:** Epic progress iteration 4 (CFD, adaptive forecast, hero + strip, Jira-like users, status chips, unified tooltips and colours, Time chart with remaining and forecast).
**Status:** human_needed (automated checks all pass)

## Automated evidence (run by verifier)

- vitest on 20 relevant files (epic-progress, statusStyles, jira, tooltip-body, issue-detail/*, EpicProgressCells, EpicsPage, IssueDetailContent, EpicDetailSheet, IssueDetailPage.progressive): 416 passed, 2 skipped, 0 failed.
- `npx tsc --noEmit`: clean.
- `biome check` on touched lib, ui and issue-detail files: clean.
- No TBD/FIXME/XXX markers in the touched files. No ad-hoc gray/green/hex chart colours in issue-detail/Epic*.tsx.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Count/SP CFD with stacked Done/In progress/To do from status history, with approximate fallback and note | VERIFIED | EpicCfdChart.tsx has three `stackId="cfd"` areas with STATUS_CATEGORY_COLOR. Section calls deriveCfd with history or null fallback (line 250), and tests cover the note states. |
| 2 | CFD axis starts at the epic created date | VERIFIED | deriveCfd tests (b) pass. |
| 3 | Remaining line and forecast/band in both charts | VERIFIED | The CFD uses withProjection/deriveProjection (Section 260-262). EpicTimeBurnup.tsx lines 104-109 do the same. |
| 4 | Adaptive forecast with states and the pinned case table | VERIFIED | The 8 pinned cases and edge cases pass in epic-progress.test.ts. |
| 5 | Time mode forecasts from worklog rate | VERIFIED | deriveTimeForecast is used in the section and in EpicTimeBurnup. Case 8 passes. |
| 6 | Hero plus 3-cell strip (Finish/Remaining/Risks) | VERIFIED | EpicProgressSummary.tsx switches on forecast.state. Section tests pass. |
| 7 | Assignee rows with 20px CachedAvatar and status-coloured chips | VERIFIED | Section line 378 uses CachedAvatar size 20. Chips carry testid epic-assignee-chip. |
| 8 | One tooltip surface and row layout | VERIFIED | TooltipContent uses TOOLTIP_SURFACE. The section, quick-peek, mini bar and chart tooltip use TooltipBody/TooltipRow. Visual confirmation is human. |
| 9 | Single status colour source | VERIFIED | The charts and swatches use STATUS_CATEGORY_COLOR. The grep for ad-hoc colours is clean. |
| 10 | Lazy, keyed queries. Status history is Count/SP only and worklogs are Time only | VERIFIED | useEpicProgressQueries.ts gates `enabled`. The Section passes `!timeMode` for history and `timeMode` for worklogs. Tests confirm no cross-fetch. |

## Key links

- Section -> deriveCfd: WIRED
- useEpicStatusHistory -> fetchEpicStatusHistory: WIRED (line 45)
- Summary -> forecast state: WIRED
- tooltip.tsx -> TOOLTIP_SURFACE: WIRED
- EpicCfdChart -> STATUS_CATEGORY_COLOR: WIRED

## Gaps

None found. Residual risk is real-Jira behaviour and the visual items above.
