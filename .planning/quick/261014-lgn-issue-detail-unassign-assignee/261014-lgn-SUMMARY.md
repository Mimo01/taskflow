# Quick 261014-lgn: Unassign assignee from Edit Issue modal

Edit modal now has an explicit "Unassigned" option that unassigns via `PUT /issue/{key}/assignee {"name":null}`, and focus/blur/typing no longer touches the assignee.

## Commits
- 65fa05df: assignIssue helper + fresh-null subtask enrichment fix (jira.ts, jira.test.ts)
- a8904da6: Unassigned option, ASSIGNEE_PICK/PICK_UNASSIGNED/BLUR reducer actions, explicit-only unassign in edit mutation, cache invalidation, tests (a)-(f)

## Deviations
- Worktree HEAD was reset to the plan base 4c3f2a25 (base check required it).
- Symlinked main repo node_modules into the worktree (gitignored) to run tests.
- Added `mode === 'edit'` to the listbox render gate; no other deviations.

## Self-Check: PASSED
Full vitest suite, biome check on touched files and tsc clean (pre-commit passed both commits).
