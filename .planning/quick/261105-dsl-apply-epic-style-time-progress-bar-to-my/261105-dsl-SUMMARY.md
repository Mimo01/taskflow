---
status: complete
---
# Quick 261105-dsl: epic-style time bar everywhere (minimal redo)

StackedTimeBar now renders the epic/story TimeBar (status-coloured solid logged, faint remaining up to estimate, amber/red beyond, estimate tick) keeping captions. Used by My Tasks, standup Today rows, issue sidebar Time Tracking (via TimeTrackingSummary), and Worklog bar. No aggregation/colour-logic changes (unlike reverted 261105-bs1). Commit 23193f98.

## Follow-ups (same day)
- 6d5efefd / 9b530657: tooltips on sidebar, My Tasks, standup.
- 3a1e96d3: redesign from the to-scale sketch (user picked option A). Shared `lib/time-bar.ts`
  (`timeBarIssues`, `timeBarModel`):
  - remaining is Jira's remaining estimate, so forecast overruns show
  - stories split by subtask status
  - darker To Do logged colour
  - tick only past the estimate
  - dashed track when there's no estimate
  - logged turns amber/red in the caption when over
  - rows 96×6px, panes full width × 8px
  - `aggregateTimeTracking` removed
