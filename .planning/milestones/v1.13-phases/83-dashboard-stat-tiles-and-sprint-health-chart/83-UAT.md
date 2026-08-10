---
status: complete
phase: 83-dashboard-stat-tiles-and-sprint-health-chart
source: [83-01-SUMMARY.md, 83-02-SUMMARY.md, 83-03-SUMMARY.md]
started: 2026-06-15T11:29:19Z
updated: 2026-06-15T11:31:30Z
---

## Current Test

[testing complete]

## Tests

### 1. Dashboard Hero & Layout
expected: Gradient hero greeting with today's date (en-GB), page composes hero → 4 stat tiles → Sprint Health → release countdown. No blank sections or errors.
result: pass

### 2. Stat Tile Row
expected: A row of 4 tiles labelled Open, In Progress, Overdue, SP Done. Each shows a numeric value reflecting your assigned (non-subtask) issues and the sprint's story points done.
result: pass

### 3. Overdue Tile Red State
expected: When you have 1+ overdue issues, the Overdue tile value renders in red (destructive). With 0 overdue, it renders in the normal/neutral colour.
result: pass

### 4. Sprint Health Section
expected: Sprint Health section shows days remaining ("N day(s) remaining" or "Sprint ends today"), a progress bar with "{N}% complete · {done} / {total} pts" caption, and a donut chart with a centre value. Colours are theme chart colours.
result: pass

### 5. Active Sprint Renders (No False Empty State)
expected: With an active sprint, the Sprint Health section shows the donut + progress (NOT "No active sprint"). This is the cold-load fix — loading the dashboard fresh, without visiting the sprint board first, still renders the sprint correctly.
result: pass

### 6. Legacy Widgets Removed
expected: The old 3-card grid is gone — no DashboardSprintCard, no DashboardInProgressCard, and no SmokeTestChart scaffold anywhere on the dashboard.
result: pass

### 7. Release Countdown Retained
expected: The next-release countdown card still renders on the dashboard, unchanged from before.
result: pass

### 8. Stat Tiles Are Static
expected: The 4 stat tiles are display-only — no hover highlight, no pointer cursor, no click action. They don't behave like buttons or links.
result: pass

## Summary

total: 8
passed: 8
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none yet]
