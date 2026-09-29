---
status: advisory
blockers: 0
warnings: 2
info: 2
---
# Code Review — 260929-fz1 (depth: quick)

Files: taskflow/src/lib/my-tasks-sort.ts, my-tasks-sort.test.ts, taskflow/src/routes/my-tasks/MyTasksPage.tsx, MyTasksPage.test.tsx

## Warnings
- **WR-01** `statusName.includes('test')` is a broad substring match (e.g. "Latest"). *Disposition: accepted* — locked user decision (CONTEXT), consistent with "block"/"review"; no false positives among real workflow statuses (Backlog, To Do, In Progress, Code Review, Ready to test, Testing, Fixed, Reopened, Done, Blocked, Rejected).
- **WR-02** fnq foreign-review lift condition (`parentBand > IN_REVIEW_MY_SUBTASKS_BAND`) now also covers a testing-band parent. *Disposition: accepted* — only reachable when a status name contains both "review" and "test"; none exists, and review outranks testing in precedence anyway.

## Info
- **IN-01** `DISPLAY_RANK.get(...) ?? bandIndex` fallback mixes numbering schemes. *Covered* — permutation test asserts display order is a permutation of MY_DAY_BANDS.
- **IN-02** Docstrings still reference raw band numbers ("band 3", "0–7"). Cosmetic.
