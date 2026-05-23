---
status: resolved
trigger: "When updating properties of a task on issue detail (eg story points, fix version, ...) the update calls do not seem to be logged in dev tool logs at all"
created: 2026-05-09
updated: 2026-05-09
---

## Symptoms

- **Expected:** Update API calls for task properties (story points, fix version, etc.) on the issue detail page should be logged in the dev tool logs panel
- **Actual:** Updates work correctly (UI reflects changes) but NO log entry appears in dev tool logs
- **Errors:** No errors in browser console or network tab — calls succeed silently
- **Timeline:** Unsure if this ever worked
- **Reproduction:** Edit story points field or fix version dropdown on the issue detail page; call succeeds but dev tool log is silent

## Current Focus

hypothesis: "Update calls for issue detail properties bypass the logging middleware/interceptor that captures and logs API calls"
test: ""
expecting: ""
next_action: "resolved"
reasoning_checkpoint: "Traced full call chain: FieldsSection → mutation.mutate → useFieldMutation → updateIssueField (jira.ts) → apiFetch. The jira.ts version lacks operation label so calls go to ungrouped in profiler. jira/issues.ts has the correct version with label."

## Evidence

- timestamp: 2026-05-09T00:00:00Z
  file: taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
  note: "Imported updateIssueField from '@/services/jira' which resolves to jira.ts (legacy version, no operation label)"

- timestamp: 2026-05-09T00:00:01Z
  file: taskflow/src/services/jira.ts:1194-1213
  note: "updateIssueField calls apiFetch WITHOUT operation parameter — calls go to ungrouped in profiler, invisible in Operations tab named groups"

- timestamp: 2026-05-09T00:00:02Z
  file: taskflow/src/services/jira/issues.ts:441-465
  note: "Parallel updateIssueField in jira/issues.ts correctly passes operation:'Create/Edit Issue' to apiFetch"

- timestamp: 2026-05-09T00:00:03Z
  file: taskflow/src/routes/dev-tools/OperationsTab.tsx:44-63
  note: "Ungrouped requests (no operation label) appear in collapsed <details> section — hidden from view by default"

- timestamp: 2026-05-09T00:00:04Z
  file: taskflow/src/routes/dashboard/BulkActionBar.tsx:20
  note: "Same issue found in BulkActionBar — also imported updateIssueField from legacy jira.ts"

## Eliminated

- apiFetch not being called: eliminated — updateIssueField in jira.ts line 1202 explicitly calls apiFetch
- devToolsEnabled/requestLogging off: eliminated — other calls ARE logged per user report
- Network error silently swallowed: eliminated — updates succeed (UI persists after re-fetch)

## Resolution

root_cause: "useFieldMutation.ts and BulkActionBar.tsx both imported updateIssueField from '@/services/jira' (legacy jira.ts), which calls apiFetch without an operation label. Without a label the call goes to 'ungrouped' in the operation profiler store and is hidden in the collapsed Ungrouped Requests section of the Operations tab. The refactored version in jira/issues.ts correctly passes operation:'Create/Edit Issue'."
fix: "Updated useFieldMutation.ts and BulkActionBar.tsx to import updateIssueField from '@/services/jira/issues' instead of '@/services/jira'. Update calls now carry the 'Create/Edit Issue' operation label through to apiFetch, making them visible as named operation entries in the Operations profiler and with an operation badge in the Logs tab."
verification: "After fix: edit story points or fix version on issue detail, open Dev Tools > Operations tab, confirm a 'Create/Edit Issue' operation card appears with a PUT /rest/api/2/issue/{key} fetch record inside it. In the Logs tab the entry now shows the 'Create/Edit Issue' badge."
files_changed: "taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts, taskflow/src/routes/dashboard/BulkActionBar.tsx"
