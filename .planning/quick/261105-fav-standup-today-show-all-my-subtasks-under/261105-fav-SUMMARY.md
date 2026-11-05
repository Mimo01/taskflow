---
phase: quick-261105-fav
plan: 01
subsystem: standup-notes
tags: [standup, today, subtasks]
key-files:
  modified:
    - taskflow/src/routes/standup-notes/filterSprintItems.ts
    - taskflow/src/routes/standup-notes/filterSprintItems.test.ts
metrics:
  completed: 2026-11-05
---

# Quick 261105-fav: Standup Today shows all my subtasks under shown stories

Shown stories now nest every subtask of mine (done included, Jira order, no duplicates); story selection and In Progress/Up Next placement still use active subtasks only.

- Commit: fed947d1
- Change: row.subtasks built from allSubtasksByParent filtered by isAssignedToMe; mySubtasks / placement / orphan logic untouched. Doc comments updated.
- Tests: flipped the SHOP-40 "does NOT nest done subtask" test; added a 261105-fav describe block (order, others' excluded, done-only does not select, placement from active subtask, done-only under my own story). Full suite (4396) and biome green; tsc clean.

## Deviations from Plan
None. The separate RED run was skipped (tests and implementation written together, single commit as the hook requires).

## Self-Check: PASSED
