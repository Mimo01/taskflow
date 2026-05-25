---
name: worklogs-not-updated-after-log
status: resolved
trigger: When I log work somewhere in the app, the worklogs page doesn't reflect the change
created: 2026-05-25
updated: 2026-05-25
---

## Symptoms

- **Expected:** Worklogs page updates immediately after logging work — no manual refresh needed
- **Actual:** New worklog entry only appears after a full app restart/refresh
- **Errors:** No visible errors or console errors when logging work
- **Timeline:** Unknown — unsure if auto-update ever worked
- **Reproduction:** Logging work from multiple places in the app (issue detail page and potentially others)

## Current Focus

```
hypothesis: resolved
test: n/a
expecting: n/a
next_action: done
reasoning_checkpoint:
```

## Evidence

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx:62
  observation: onSuccess invalidates ['jira-worklogs', issueKey, jiraBaseUrl] only — this is the issue-detail ActivityTimeline key, not the WorklogsPage key

- timestamp: 2026-05-25
  file: taskflow/src/routes/worklogs/WorklogsPage.tsx:364
  observation: WorklogsPage registers its Tempo query with key ['tempo', 'worklogs', jiraBaseUrl, from, to, selectedUsername] — completely different prefix

- timestamp: 2026-05-25
  file: taskflow/src/routes/worklogs/WorklogCellPopover.tsx:50
  observation: WorklogCellPopover.handleMutationSuccess correctly invalidates ['tempo', 'worklogs'] — the in-table path works; the issue-detail path does not

- timestamp: 2026-05-25
  file: taskflow/src/routes/dashboard/IssueDetailPage.tsx:248
  observation: Confirmed ['jira-worklogs', issueKey, jiraBaseUrl] IS a real registered query (Jira worklog list for issue detail) — not a dead key; just the wrong one to target for WorklogsPage

## Eliminated

- Network/API errors — no console errors reported, createWorklog succeeds
- WorklogCellPopover path — already invalidates ['tempo', 'worklogs'] correctly
- Race condition — not a timing issue; the wrong query key was targeted entirely

## Resolution

```
root_cause: LogWorkPopover.onSuccess only invalidated ['jira-worklogs', issueKey, jiraBaseUrl]
  (the issue-detail ActivityTimeline query) but never invalidated ['tempo', 'worklogs']
  (the WorklogsPage Tempo grid query). The two queries use completely different key prefixes
  so the WorklogsPage cache was never busted after logging work from the issue detail page.
fix: Added a second queryClient.invalidateQueries({ queryKey: ['tempo', 'worklogs'] }) call
  in LogWorkPopover.onSuccess, after the existing jira-worklogs invalidation. This matches
  the pattern already used by WorklogCellPopover.handleMutationSuccess.
verification: Log work from an issue detail page — the WorklogsPage Tempo grid should
  refresh immediately without requiring an app restart.
files_changed:
  - taskflow/src/routes/dashboard/issue-detail/LogWorkPopover.tsx
```
