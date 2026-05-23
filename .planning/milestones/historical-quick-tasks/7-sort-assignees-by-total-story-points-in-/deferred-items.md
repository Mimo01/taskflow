# Deferred Items — Quick Task 7

## Linter-injected SPPG-07 tests (out of scope)

After the final commit of quick task 7, the linter automatically appended a new `describe('SPPG-07')` block to `SprintProgressTab.test.tsx`. These 4 tests expect:

1. A "Stories" count column in the assignee breakdown table
2. A "Subtasks" count column in the assignee breakdown table
3. Cell indices [1]=Stories, [2]=Subtasks, [3]=To Do pts, [4]=In Progress pts, [5]=Done pts

The linter also updated the existing SPPG-03 pts test to use the new cell indices (anticipating these future columns), which causes it to fail.

**Action required:** A follow-up quick task or plan should add Stories and Subtasks columns to the SprintProgressTab assignee breakdown table to satisfy the SPPG-07 tests.

**Affected tests:**
- `SPPG-03: per-assignee breakdown table shows correct pts buckets` (cell index changed by linter)
- `Test A: assignee with 2 stories (any status) and 1 subtask shows Stories=2, Subtasks=1`
- `Test C: story named "Sub-task" but issuetype.subtask=false is NOT counted as subtask`
- `Test D: table header includes "Stories" and "Subtasks" column headers`
