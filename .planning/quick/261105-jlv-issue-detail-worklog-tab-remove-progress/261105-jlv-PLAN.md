---
quick_id: 261105-jlv
mode: quick
---

# Quick Task 261105-jlv: Remove time bar from issue detail Worklog tab

The Worklog view of Issue Detail renders `WorklogProgressBar` (a full-width `StackedTimeBar`)
above the timeline. The sidebar Time Tracking row (`TimeTrackingSummary`) already shows the
same bar, so the Worklog copy is redundant.

## Task 1: Remove WorklogProgressBar
- files: taskflow/src/routes/dashboard/IssueDetailView.tsx, taskflow/src/routes/dashboard/issue-detail/WorklogProgressBar.tsx, taskflow/src/routes/dashboard/issue-detail/WorklogProgressBar.test.tsx
- action: drop the `timelineFilter === 'worklog'` render block + import; delete the component and its test (no other consumers)
- verify: tsc clean, biome clean, vitest green
- done: Worklog tab shows no time bar; sidebar Time Tracking unchanged
