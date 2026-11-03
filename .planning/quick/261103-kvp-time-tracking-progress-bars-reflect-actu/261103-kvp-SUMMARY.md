# Quick 261103-kvp: Time-tracking bars reflect actual progress

All time-tracking progress bars now fill by spent / ORIGINAL estimate through one shared pure helper `timeProgress` (`taskflow/src/lib/time-progress.ts`), so closed issues (Jira zeroes remaining on close) no longer show a full bar.

## Commits
- a58560ad: shared helper + StackedTimeBar + My Tasks / standup callers thread `isDone`
- b93a48ca: TimeTrackingSummary, WorklogProgressBar, aggregateTimeTracking use original estimate + helper

## Changes
- `timeProgress` / `isDoneStatus` helper with colour matrix (over = red, equal = green if done else amber, under = green if done else green <75% / amber >=75%).
- TimeTrackingSummary: `aggregateprogress` prop removed; new required `isDone`; remaining estimate used as fallback only for not-done issues. FieldsSection passes `isDone`.
- aggregateTimeTracking: `opts.isDone`; remaining fallback skipped for done issue/done subtasks (reads `status.statusCategory.key` defensively).
- WorklogProgressBar derives `isDone` from the issue.

## Deviations
None. Verification: full vitest suite (pre-commit), tsc, and biome on touched files pass.

## Self-Check: PASSED

## UAT follow-up (2026-11-03)

- 9d5578bb: overrun tolerance — amber up to 125% of original estimate (any status), red only beyond (`OVERRUN_RED_RATIO`).
- Other bars audited (epic, release, AIO, sprint/My Issues): item-count or original-estimate based, no close-to-full bug. Epic Stories-list mini time bar left as-is; user will address it in a separate issue.
- UAT approved.
