# Quick 260929-fnq — Code Review (quick depth)

Scope: 24c6d1c2, 58f2c9c4 (my-tasks-sort.ts, my-tasks-sort.test.ts, MyTasksPage.tsx)
Result: 0 critical, 1 warning, 1 info (advisory, not fixed)

## WR-01: Colleagues' subtasks influence subtree band (pre-existing)
`subtreeBand` mins over ALL subtasks, not just mine. A colleague's flagged/overdue subtask under a
foreign in-review story pulls it into Flagged/Overdue instead of "In Review — my subtasks".
Pre-existing behavior (predates this task); now more visible. Possible follow-up: compute the
subtree band over my subtasks only when the parent is not mine.

## IN-01: Band 3 guard relies on classifyBand never returning 3
Suggest a test asserting classifyBand never returns IN_REVIEW_MY_SUBTASKS_BAND.
