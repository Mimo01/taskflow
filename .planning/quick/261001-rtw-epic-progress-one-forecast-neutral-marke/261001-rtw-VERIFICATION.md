---
phase: quick-261001-rtw
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 6/6 must-haves verified (automated)
human_verification:
  - test: "Real Tauri app, light and dark mode: forecast line and band contrast against the chart"
    expected: "Neutral foreground dashed forecast and muted band are clearly visible"
    why_human: "Visual contrast"
  - test: "Both Count/SP CFD and Time chart on a real epic"
    expected: "Both charts reach 0 at the same likely/earliest/latest dates as the Finish tile"
    why_human: "Real data and rendering"
  - test: "Bar-to-legend gap for hero, status bar and assignee rows"
    expected: "A visible gap of about 12px"
    why_human: "Layout rendering"
  - test: "Time-mode person rows"
    expected: "Bar segments and chips show the same done/in-progress/to-do estimate values"
    why_human: "Visual agreement on real data"
---

# Quick 261001-rtw Verification

**Goal:** One shared averaged forecast in every chart, colour for statuses only, legend spacing fixed, Count/SP/Time unified through one status-bands model.
**Status:** human_needed (all automated checks pass; visual UAT remains)

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | One forecast in both charts | VERIFIED | `projectFinish(` is used in EpicProgressSection.tsx:228 and EpicTimeBurnup.tsx:115. No `deriveProjection(` or `metricForecast` remains in either file. The Section passes `finish` and `today` to both charts. |
| 2 | Non-ok state shows the same text everywhere | VERIFIED | `FINISH_STATE_TEXT` is used in EpicCfdChart.tsx:92 (`epic-forecast-state` node) and EpicProgressSummary.tsx:167. |
| 3 | Chart tooltip key-date rows match the Finish tooltip | VERIFIED | `finishDateRows` and `formatFinishDate` are shared. The Summary calls `finishDateRows(` at line 202. Tests pass. |
| 4 | Colour is for status only | VERIFIED | The only `STATUS_CATEGORY_COLOR` uses in Epic files are the status areas, status legend, status tooltip rows and BandBreakdown. The CFD and Time chart series all come from `SERIES`. The mini bar fill is `bg-muted-foreground`, and overrun keeps `bg-red-500` (IssueDetailContent.tsx:381). The hex/green/amber matches found are in unrelated files (FieldsSection, TimeTrackingSummary, WorklogProgressBar). |
| 5 | Gap is at least 12px, no negative margins | VERIFIED | The status block is `flex flex-col gap-1.5` with a `py-1.5` trigger. Assignee rows use `py-0.5` with no `-m`. The hero caption has `mt-1.5`. The grep for negative-margin tokens in the Epic files returns nothing. Remaining `-ml-1` matches are in FieldsSection and WatcherToggle, which this task did not touch. |
| 6 | Unified bands model | VERIFIED | `summaryBands`, `BandBar`, `BandChips` and `BandBreakdown` are used by the hero, status block and assignee rows. `chipNumber`, `TIME_CHIP_CLASS`, `AssigneeChips`, `pctLogged` and `dateText` are gone from the UI files. The Remaining tile note is always present. |

## Checks run

- vitest, 17 files (lib/epic-progress, tooltip-body, issue-detail/*, IssueDetailContent, EpicProgressCells, EpicDetailSheet): 324 passed, 2 skipped, 0 failed.
- `tsc --noEmit`: clean.
- `biome check` on the touched files: clean.
- `.at(` use: none. `fetchAllSearchPages`: untouched.
- Stalled-risk icon changed from Hourglass to CirclePause, as planned (EpicProgressSummary.tsx:45).

## Anti-patterns

None found. No TODO, FIXME or XXX markers were checked beyond the colour and margin greps above; those greps were clean.

## Human verification

See the frontmatter: contrast in light and dark mode, chart end dates versus the Finish tile, the visible legend gap, and Time-mode person rows.
