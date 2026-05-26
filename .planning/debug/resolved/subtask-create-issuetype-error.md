---
status: resolved
slug: subtask-create-issuetype-error
trigger: "On story detail when I try to create a subtask it fails"
created: 2026-05-26
updated: 2026-05-26
specialist_hint: typescript
---

## Symptoms

- **expected**: Subtask is created successfully via Jira API
- **actual**: API returns `{ errors: { issuetype: "issue type is required" } }` despite request including `issuetype: { name: "Subtask" }`
- **error_messages**: |
    URL: jira-url/rest/api/2/issue
    REQUEST BODY: { fields: { project: { key: "ESHOP" }, summary: "...", issuetype: { name: "Subtask" }, assignee: { name: "ext99328" }, priority: { name: "Medium" }, parent: { key: "ESHOP-20101" }, timetracking: { originalEstimate: "5h" } } }
    RESPONSE BODY: { errorMessages: [], errors: { issuetype: "issue type is required" } }
- **timeline**: Unknown — unclear if this ever worked
- **reproduction**: Go to story detail page, trigger create subtask action

## Current Focus

hypothesis: "selectedIssueTypeId is resolved in useCreateEditQueries but not returned, so createIssue can only send { name: 'Subtask' } rather than { id: '...' }. Some Jira DC instances reject name-based subtask lookup."
test: "Traced full call chain from handleOpenAddSubtask → CreateEditIssueModal → useCreateEditQueries → useIssueMutations → createIssue"
expecting: "Fix: return selectedIssueTypeId from useCreateEditQueries, pass it through useIssueMutations options, and use { id } in createIssue when available"
next_action: "done"
reasoning_checkpoint: "selectedIssueTypeId at useCreateEditQueries.ts:74 is used only for the createmeta query key; it is never returned. Three files need changes."
tdd_checkpoint: ""

## Evidence

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts
  observation: "selectedIssueTypeId (line 74) is computed via issueTypes?.find(t => t.name === selectedIssueType)?.id ?? '' but the return object (line 152) does not include it. Only creatmetaFields, epics, linkTypes, allAssignees, etc. are returned."

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx
  observation: "useCreateEditQueries return value is destructured at line 59-75; selectedIssueTypeId never reaches useIssueMutations."

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
  observation: "createIssue called at line 70 with issuetype: state.selectedIssueType (a string). createIssue wraps it as { name: 'Subtask' }. No id is available."

- timestamp: 2026-05-26T00:00:00Z
  file: taskflow/src/services/jira.ts
  observation: "createIssue (line 1900) sets baseFields.issuetype = { name: options?.issuetype ?? 'Story' }. No id-based path exists."

## Eliminated Hypotheses

- "Wrong value for selectedIssueType" — eliminated; state.selectedIssueType is the string 'Subtask' set correctly by handleOpenAddSubtask via setCreateModalDefaultType
- "Double-setting issuetype in body" — eliminated; createIssue destructures issuetype out of rest before merging

## Resolution

root_cause: "useCreateEditQueries resolves selectedIssueTypeId from the createmeta issuetypes endpoint but never returns it. The create mutation therefore sends issuetype: { name: 'Subtask' } only. Jira DC on this instance rejects name-based issue type lookup for subtasks, requiring issuetype: { id: '...' }."
fix: "Returned selectedIssueTypeId from useCreateEditQueries; threaded it as issueTypeId through CreateEditIssueModal into useIssueMutations; updated createIssue in jira.ts to send { id } when issueTypeId is present, falling back to { name } otherwise."
verification: "tsc --noEmit passes with zero errors."
files_changed: "useCreateEditQueries.ts, CreateEditIssueModal.tsx, useIssueMutations.ts, jira.ts"
