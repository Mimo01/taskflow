---
status: complete
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
source: [86-01-SUMMARY.md, 86-02-SUMMARY.md, 86-03-SUMMARY.md, 86-04-SUMMARY.md]
started: 2026-06-16T07:03:55Z
updated: 2026-06-16T07:08:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard loads — new 3-region layout
expected: App opens to the dashboard. Renders cleanly in 3 regions — centered hero greeting, a two-card row (My Issues + Upcoming Releases), and a full-width Hours & Commits chart. No errors, no old widgets.
result: pass

### 2. Hero greeting + sprint-day subline
expected: Large centered greeting (text-6xl) over the ambient orange/cyan curve background. Subline shows "Sprint day X of N" counting working days only (start day = 0). On a weekend it instead reads "Weekend · sprint resumes Monday, …". Subline is hidden entirely when there is no active sprint.
result: pass

### 3. My Issues card — sprint progress
expected: Card titled around "My issues this sprint" with a ListChecks ambient icon. Shows a big "done" count with an "of N done" annotation and a thick segmented horizontal bar split into to-do / in-progress / done (slate / blue / green) with a legend of square swatches. Counts are issue counts (not story points) for issues assigned to you, subtasks excluded. Empty state "No issues assigned" if you have none.
result: pass

### 4. Upcoming Releases card — timeline
expected: Card with a Rocket ambient icon showing up to 3 upcoming unreleased fix versions as a left-aligned horizontal timeline. First (soonest) dot is solid orange with an orange connector + orange due-date label; remaining dots hollow. Timing labels read "Today" / "Tomorrow" / "in N days" / "overdue" (amber). Grayscale readiness bars (current release darker). Only real releases shown — no placeholder dots. Empty state when none upcoming.
result: pass

### 5. Hours & Commits chart — past 7 days
expected: Full-width diverging chart for the rolling 7 days — hours bars up (blue), commits bars down (green), each side normalized so the halves are comparable. Header shows total hours logged + total commits. Every day (including 0-value days) is labelled — hours above / commits below each column. Today's column is present. If Tempo is not connected, shows "Tempo not connected" empty state instead of the chart.
result: pass

### 6. Cards are clickable — navigation
expected: All three cards are clickable with hover/focus affordance (bg + colored ring + shadow, keyboard focusable). My Issues → /my-tasks, Upcoming Releases → /releases, Hours & Commits → /worklogs (or /sprint-board when Tempo is off).
result: pass

### 7. Old dashboard widgets removed
expected: The previous Phase 83-85 widgets are gone — no StatTile, Sprint Health section, Weekly Trend chart, Activity Strip, Release card, Velocity chart, or Burndown chart anywhere on the dashboard. Nothing references the removed widgets.
result: pass

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
