---
status: complete
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
source: [84-01-SUMMARY.md, 84-02-SUMMARY.md, 84-03-SUMMARY.md, 84-04-SUMMARY.md]
started: 2026-06-15T14:18:34Z
updated: 2026-06-15T14:20:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Weekly Trend Chart renders
expected: Dashboard "Weekly Trend" section shows a Mon–Fri Tempo-hours bar chart — color-coded bars (green met / amber under 8h), per-bar value labels, today's bar highlighted, a dashed 8h target line, and the weekly total in the header.
result: issue
reported: "hours are shown in format of decimals, not h+m"
severity: minor
resolution: "Fixed inline — added formatHoursMinutes() helper; bar labels and weekly total now render h+m (e.g. 1h 30m, 8h). WeeklyTrendChart.tsx. Commit pending below."

### 2. Tempo-not-connected state
expected: When Tempo is not connected, the Weekly Trend section shows a calm "Tempo not connected" empty state (not an error/crash). When connected with no logged hours, it shows all-zero bars rather than empty.
result: skipped
reason: User skipped (Tempo connected; not toggling off to test)

### 3. Recent Activity feed populates
expected: The "Activity & Releases" section shows a Recent Activity feed merging Jira transitions and GitLab commits, newest first, populated for the last working day (not blank on Mondays). The next-release countdown also appears in this combined section.
result: pass

### 4. Activity feed overflow ("+N more")
expected: When more than 6 activity entries exist, the feed shows the first 6 and a "+N more" indicator for the remainder (non-expanding).
result: pass

### 5. Activity feed independent degradation
expected: If one activity source fails (e.g. Jira errors but commits load, or vice-versa), the working source still renders its rows — the strip does not go fully blank. Only when both sources fail does a single error state appear.
result: skipped
reason: User skipped (cannot force a single-source failure on demand). Covered by unit test "DASH-07 independent degradation" in ActivityStrip.test.tsx.

### 6. Dashboard layout & no duplicate fetches
expected: The Dashboard renders all sections without layout breakage or visible double-loading. Activity and the trend chart reuse already-cached data (Standup/Tempo) rather than triggering visible duplicate refetches; the MR review queue is intentionally absent (descoped).
result: pass

## Summary

total: 6
passed: 3
issues: 1
pending: 0
skipped: 2
blocked: 0

## Gaps

- truth: "Weekly Trend chart bar value labels display hours in human-readable h+m format"
  status: resolved
  reason: "User reported: hours are shown in format of decimals, not h+m"
  severity: minor
  test: 1
  root_cause: "LabelList formatter and weekly-total label used n.toFixed(1) (decimal hours) instead of an h+m format."
  artifacts:
    - path: "taskflow/src/routes/dashboard/WeeklyTrendChart.tsx"
      issue: "Decimal hour labels on bars and weekly total"
  missing:
    - "formatHoursMinutes() helper converting decimal hours to h+m"
  debug_session: ""
  resolution: "Fixed inline during UAT — formatHoursMinutes() applied to bar LabelList and weekly total. Tests green, npm run check 0 errors."
