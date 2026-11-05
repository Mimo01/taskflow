---
status: resolved
trigger: "on issue detail verify how the time tracking progress bar is shown. there is a bug on subtasks it doesnt count estimate at all. On stories it does sum subtask estimates but verify it also adds the story estimate as well (it is a sum of all)"
created: 2026-11-05
updated: 2026-11-05
---

## Symptoms
- expected: subtask issue-detail time bar shows its estimate; story bar = own estimate + all subtask estimates
- actual: subtask bar shows no estimate
- timeline: since 3a1e96d3 (quick-261105-dsl, shared time bar)

## Resolution
root_cause: `timeBarIssues` (src/lib/time-bar.ts) skipped Jira's aggregate fields when `isSubtask` was set and read only the nested `timetracking` object, which is empty for Tempo-tracked issues. `ownTimed` also ignored the top-level `timeoriginalestimate`/`timeestimate`. The pre-dsl TimeTrackingSummary read the aggregates first for every issue type.
fix: the aggregate branch now applies to subtasks too (the subtasks argument is still ignored for a subtask). `ownTimed` falls back to the top-level own-estimate fields.
story_check: with subtasks, own part = aggregate − Σ subtasks, so the total = own + every subtask. Without aggregates it is own + subs. Both are now covered by tests.
verification: 4 new tests in time-bar.test.ts (2 subtask tests failed before the fix); 425 tests in the related suites pass; tsc and biome are clean.
files_changed: src/lib/time-bar.ts, src/lib/time-bar.test.ts
