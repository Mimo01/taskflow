# Quick 261001-qvu: Epic progress forecast averaging, holidays, hover polish, risks - Summary

**One-liner:** Finish is now the average of Count, SP and Time forecasts on a Tempo-holiday-aware working calendar, with per-day hover forecast points, fully hoverable assignee rows, marker-led tooltip rows and redesigned risk chips.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 297e0eb5 | holiday-aware working calendar, averaged forecast, per-day projection, risks |
| 2 | e67d50fd | averaged finish, Tempo holidays, risks redesign, tooltip row markers |
| 3 | a4e06b51 | per-day forecast hover points, fully hoverable assignee rows |

## What changed

- `lib/epic-progress.ts`: `WorkCalendar` (`DEFAULT_CALENDAR`, `buildWorkCalendar`, `holidaysBetween`, `addCalendarDays`) threaded through `addWorkingDays`, `workingDaysBetween`, `forecastFromThroughput`, `deriveAdaptiveForecast`, `deriveTimeForecast`, `deriveProjection` (all optional trailing param). `averageForecasts`, `METRIC_LABEL`, `deriveRisks`, `PROJECTION_MAX_POINTS`. Projection is one point per calendar day (thinned beyond 260; the budget reserves room for today and the three key dates), with `wd` / `workingDay` copied onto chart rows by `withProjection`.
- `useEpicProgressQueries.ts`: `useEpicWorkCalendar` (own query key, gated on `tempoEnabled` + jira user key, silent Mon-Fri fallback); worklogs now enabled in every mode.
- `EpicProgressSection` / `EpicProgressSummary`: toggle-independent averaged Finish with per-metric rows and calendar note; risk chips and tooltip; `epicDueDate` prop wired from `IssueDetailContent`; legend `space-y-3`; hero caption `mt-1`.
- `TooltipRow`: `marker` (`swatch | dot | line`) and `icon` props; neutral dot by default.
- Charts: hover-only `activeDot` on the forecast lines; `From today N working days` tooltip row; Time chart now takes `forecast` + `calendar` props (no local `deriveTimeForecast`, resolving the duplicate computation).
- Assignee row is a single tooltip trigger (one tab stop, no nested interactive).

## Intentional existing-test changes (plan items 1-6)

1. `deriveProjection / withProjection` "projects today, optimistic, likely and pessimistic with a band": date list is now the 13 calendar days; likely point found by date.
2. `withProjection pins today...`: `toHaveLength(14)`; added `merged[1].wd === 0`.
3. EpicProgressSection time burnup: "Count and SP never fetch worklogs" renamed "worklogs load once in every mode for the averaged Finish" (waits for one call, toggles, still one call).
4. Same rewrite applied in the ilq hero/strip describe (kept, not deleted).
5. Risks test renamed "...severity chips... or No risks when clean"; `None` became `No risks`; added `data-severity="info"` assertions.
6. "Finish shows —, not today..." now asserts `Stalled` (toggle-independent), identical text in Count and SP, not Today, and the tooltip row `Story pointsno estimates`.

Neighbour mock additions: `fetchEpicWorklogs: vi.fn().mockResolvedValue(new Map())` in `IssueDetailContent.test.tsx`, `IssueDetailPage.progressive.test.tsx`, `EpicDetailSheet.test.tsx`.

## Deviations from Plan

None - plan executed as written. Notes:
- The plan-checker advisory options were not needed: marker work stayed in Task 2, and worklogs were not passed as a prop (the section's single `useEpicWorklogs` query is shared by the Finish and the Time chart, so there is no duplicate observer).
- Test 6's hover assertion uses the same Finish tooltip rows the plan described; no production code was bent for test mocks.
- Forecast constants were not tuned.

## Verification

- Full pre-commit hook (biome, tsc, full vitest) passed on all 3 commits. Final: 204 files passed, 3026 tests passed.
- No `.at(` added; `fetchAllSearchPages` untouched.

## UAT (real Tauri app)

Hover dots on the forecast line, Tempo holiday note with a real schedule, risk chip tints in light and dark mode, row hover highlight. Recharts does not render in jsdom, so per-day points are covered by the projection unit tests only.

## Known Stubs

None.

## Self-Check: PASSED
