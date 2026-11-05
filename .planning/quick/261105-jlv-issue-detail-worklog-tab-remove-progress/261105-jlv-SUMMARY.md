---
quick_id: 261105-jlv
status: complete
commit: f8da1c6d
---

# Quick Task 261105-jlv Summary

Removed the redundant time bar from Issue Detail's Worklog tab. The sidebar Time Tracking row
(`TimeTrackingSummary`) still shows the shared `StackedTimeBar`.

- `IssueDetailView.tsx`: removed the `timelineFilter === 'worklog'` `WorklogProgressBar` block and its import
- Deleted `WorklogProgressBar.tsx` + `WorklogProgressBar.test.tsx` (sole consumer was the Worklog tab)
- `subtaskEnrichmentQuery` stays — still feeds subtasks list and the sidebar `timeSubtasks`

Verification: tsc clean, biome clean, full vitest suite 4399 passed.
Executed inline (trivial deletion) rather than via planner/executor agents.
