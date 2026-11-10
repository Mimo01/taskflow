---
phase: quick-261110-ccz
plan: 01
subsystem: release-detail
tags: [priority-icon, release-detail, jira]
key-files:
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
    - taskflow/src/services/jira.fixVersionIssues.test.ts
    - taskflow/src/services/jira-rm.test.ts
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.test.tsx
requirements-completed: [QUICK-261110-ccz]
---

# Quick 261110-ccz: Priority icon on release detail tables

The release task table and the Deployment package mismatches table now show the shared `PriorityIcon` right after the issue key, in the same 18x18 centring span used by Backlog and My Tasks.

## Commits
- b57c8055: request `priority` in `fetchFixVersionIssues` and `fetchStoriesWithPackage` (JQL unchanged)
- db74bb7c: priority cell and header spacer in `UnifiedTaskTable` (`COL_PRIORITY`)
- a108297c: priority cell and header spacer in `DeploymentPackageSection`

## Notes
- Primary task rows keep `pointer-events-none` on the priority cell so the row overlay receives clicks. Trade-off: the native `title` tooltip does not show on hover there. The package table has no overlay, so its tooltip works.
- Empty priority leaves an empty aligned slot (`aria-hidden`).
- Tests added: priority position (after key, before summary/state), empty slot, header/row cell counts.

## Deviations from Plan
- The worktree started on a different base than expected; reset to 9e397b84 per the branch check.
- The plan's Task 3 header-count test compares the header to the row's first child (the `CALLOUT_ROW_CLASS` line).
- Added `data-testid="task-row-priority"` on the task-row priority span for the empty-slot test.
- `node_modules` symlinked from the main checkout (untracked, not committed).

## Self-Check: PASSED
