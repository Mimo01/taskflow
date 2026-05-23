---
status: resolved
trigger: "After the fix to import updateIssueField from jira/issues.ts, update calls for issue detail properties are now logged but are missing a category — the category badge is absent from the log entry entirely"
created: 2026-05-09
updated: 2026-05-09
---

## Symptoms

- **Expected:** Log entries for issue detail property updates (story points, fix version, etc.) should display a category badge, matching whatever category other similar issue API calls use
- **Actual:** Update calls now appear in the dev tool log, but the category badge is completely absent from the entry
- **Errors:** None
- **Timeline:** Appeared after the fix to import updateIssueField from @/services/jira/issues instead of @/services/jira
- **Reproduction:** Edit story points or fix version on issue detail, open Dev Tools Logs tab — entry appears but has no category badge

## Context from prior session

- Fix applied: `useFieldMutation.ts` and `BulkActionBar.tsx` now import `updateIssueField` from `@/services/jira/issues` (passes `operation:'Create/Edit Issue'` to apiFetch)
- Other API calls DO show category badges — only these update calls are missing them
- The dev log system has a concept of "source category" (recently added 'updater' source category per recent commits)

## Current Focus

hypothesis: "The 'category badge' is the operation label badge in LogsTab. jira.ts monolithic service functions call apiFetch WITHOUT the operation parameter. After the prior session fix, updateIssueField now routes through issues.ts which DOES pass 'Create/Edit Issue'. Remaining gap: useIssueMutations.ts imports bulkUpdateIssue from @/services/jira (old path, no operation label) — edit-modal updates still appear without category badge."
test: ""
expecting: ""
next_action: "fix applied"
reasoning_checkpoint: "The source badge (orange 'jira') is always rendered unconditionally in LogsTab. The operation badge is conditional on entry.operation. 'Category badge' = operation badge. jira.ts version has no operation param; issues.ts version has 'Create/Edit Issue'. Prior session fixed updateIssueField callers. useIssueMutations.ts still uses old bulkUpdateIssue."

## Evidence

- timestamp: 2026-05-09
  observation: "LogsTab.tsx renders source badge unconditionally (line 21) and operation badge conditionally (lines 22-25 — {entry.operation && ...})"
  file: taskflow/src/routes/dev-tools/LogsTab.tsx

- timestamp: 2026-05-09
  observation: "issues.ts updateIssueField (line 449) passes 'Create/Edit Issue' as 4th arg to apiFetch — operation label IS set after prior session fix"
  file: taskflow/src/services/jira/issues.ts

- timestamp: 2026-05-09
  observation: "jira.ts updateIssueField (line 1202) calls apiFetch without operation param — no operation badge for entries via this path"
  file: taskflow/src/services/jira.ts

- timestamp: 2026-05-09
  observation: "jira.ts bulkUpdateIssue (line 1521) also calls apiFetch without operation param — no operation badge for create/edit modal edit submissions"
  file: taskflow/src/services/jira.ts

- timestamp: 2026-05-09
  observation: "useIssueMutations.ts imports bulkUpdateIssue from @/services/jira (old path, no operation label). Fix: import from @/services/jira/issues"
  file: taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts

- timestamp: 2026-05-09
  observation: "issues.ts bulkUpdateIssue (line 548) passes 'Create/Edit Issue' as operation. issues.ts createIssue (line 513) also passes 'Create/Edit Issue'. links.ts createIssueLink (line 47) passes 'Manage Links'. CreatemetaField type is in jira/types.ts."
  file: taskflow/src/services/jira/issues.ts

## Eliminated

- "source field is missing" — source badge is always rendered; source is always 'jira' from apiFetch
- "apiFetch not called" — both jira.ts and issues.ts versions call apiFetch

## Resolution

root_cause: "The jira.ts monolithic service's bulkUpdateIssue and updateIssueField functions call apiFetch without the operation parameter. After the prior session fix, updateIssueField calls route through issues.ts (which passes 'Create/Edit Issue'). The remaining gap: useIssueMutations.ts still imports bulkUpdateIssue from @/services/jira (the old path without an operation label), so create/edit modal edit submissions appear in the dev log without the operation category badge."
fix: "Updated useIssueMutations.ts to import bulkUpdateIssue, createIssue, wrapCustomFieldValue from @/services/jira/issues; createIssueLink from @/services/jira/links; and CreatemetaField type from @/services/jira/types. All these sub-module versions pass appropriate operation labels to apiFetch."
verification: "Edit an issue via the Create/Edit modal. In DevTools Logs tab, the PUT entry should now show the 'Create/Edit Issue' operation badge alongside the orange 'jira' source badge."
files_changed: "taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts"
