---
phase: quick-261001-qvu
verified: 2026-10-01T00:00:00Z
status: human_needed
score: 9/9 must-haves verified (automated)
human_verification:
  - test: "Hover the CFD and Time chart forecast lines in the real Tauri app"
    expected: "A dot appears per calendar day on hover and the tooltip shows Forecast, Range and 'From today N working days'"
    why_human: "Recharts does not render in jsdom, so only the projection unit tests and tooltip tests cover this"
  - test: "Open an epic with Tempo enabled and a real schedule, then hover Finish"
    expected: "Note reads 'Excludes weekends and N holidays (Tempo)' and the dates skip holidays"
    why_human: "Needs a real Tempo schedule"
  - test: "Check risk chip tints in light and dark mode, assignee row hover highlight, and the legend and caption spacing"
    expected: "Warning chips are amber, info chips are muted, whole assignee row highlights, spacing is visibly larger"
    why_human: "Visual"
---

# Quick 261001-qvu Verification Report

**Goal:** Epic progress iteration 5 (averaged forecast, Tempo holidays, per-day hover points, hoverable assignee rows, spacing, tooltip markers, risks).
**Status:** human_needed (automated checks all pass)

## Automated evidence (run by verifier)

- vitest on epic-progress, tooltip-body, issue-detail/*, EpicDetailSheet, IssueDetailContent and IssueDetailPage.progressive: 17 files passed, 291 tests passed, 2 skipped.
- `npx tsc --noEmit`: clean.
- No `.at(` in epic-progress.ts. No TBD/FIXME/XXX in touched source files.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Finish is the average of Count/SP/Time, independent of the toggle | VERIFIED | Section calls `averageForecasts` with count, sp and time parts (EpicProgressSection.tsx:267). Toggle-independence tests pass. |
| 2 | Inclusion rules, exclusion reasons and fallback states | VERIFIED | averageForecasts tests pass. Per-metric reasons are rendered in the Finish tooltip. |
| 3 | Confidence is the lowest contributor, downgraded on disagreement | VERIFIED | Covered by lib tests (AVERAGE_DISAGREE_SPREAD). |
| 4 | Worklogs load in every mode, Time shows 'loading worklogs' until they arrive | VERIFIED | `useEpicWorklogs(epicKey, storyKeys, true)` at line 227. The once-per-mode test passes. |
| 5 | Tempo holiday-aware calendar with a Mon-Fri fallback, and the tooltip note | VERIFIED | `useEpicWorkCalendar` calls `fetchUserSchedule` (own query key). The calendar is passed into the forecasts and `deriveProjection`. Both note strings are present (EpicProgressSummary.tsx:249-254). Real Tempo data goes to UAT. |
| 6 | Per-day forecast points, dots on hover only, 'From today' tooltip row | VERIFIED (logic) | `activeDot` is set on both forecast lines and `dot={false}` is kept. The projection and tooltip tests pass. Rendering goes to UAT. |
| 7 | Assignee row is one tooltip trigger with one tab stop | VERIFIED | `epic-assignee-trigger` is at line 430. Row tests pass. |
| 8 | More spacing under hero and legend | VERIFIED | Caption has `mt-1` and the status block has `space-y-3`. Visual size goes to UAT. |
| 9 | Marker on every tooltip row and redesigned risks ('No risks', severity chips, tooltip) | VERIFIED | The TooltipRow marker API is covered by tests. The 'No risks' and 'No risks found' strings and the chip tests are present. |

## Key links

- `averageForecasts(` in EpicProgressSection: WIRED.
- `fetchUserSchedule(` in useEpicProgressQueries: WIRED.
- `deriveProjection(` with calendar in the section: WIRED.
- EpicTimeBurnup: `deriveTimeForecast` is no longer used and it receives forecast and calendar props: WIRED.

## Anti-patterns

None found.

## Gaps

None. Remaining items are visual and real-app checks listed under human_verification.
