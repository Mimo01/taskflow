---
phase: quick-260608-dhp
plan: "01"
subsystem: standup-notes
tags: [standup, jira, created-issues, yesterday-column]
dependency_graph:
  requires: []
  provides: [dhp-created-issues-yesterday]
  affects: [standup-notes]
tech_stack:
  added: []
  patterns: [useQuery-reporter-jql, buildGroups-pass-0, SubItemKind-extension]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/routes/standup-notes/IssueActivityGroup.tsx
    - taskflow/src/routes/standup-notes/YesterdayColumn.tsx
    - taskflow/src/routes/standup-notes/StandupNotesPage.tsx
decisions:
  - reporter= JQL (not creator=) matches fetchYesterdayJiraActivity convention for DC Jira
  - pass 0 ensures Created sub-item always leads insertion order before worklogs/transitions
  - issue-created falls into existing plain <div> branch in SubItemList — no dedicated render branch needed
  - JiraCreatedIssue keys added to referencedKeys so type/parent resolves via fetchIssueMeta
metrics:
  duration: 8m
  completed: "2026-06-08"
  tasks_completed: 2
  files_modified: 4
---

# Phase quick-260608-dhp Plan 01: Created Issues in Yesterday Column Summary

**One-liner:** Standup Yesterday column now surfaces issues created by the active user via a fifth `jiraCreatedQuery` (reporter= JQL), rendering a PlusCircle "Created" sub-item first in each group.

## What Was Built

Added "Created Issues" as a fifth data source to the standup notes Yesterday column. Issues created yesterday by the logged-in user (or watched person) appear as a "Created" sub-item row within their issue group — merged with other activity if any exists, or as a standalone group if not.

### jira.ts
- New `JiraCreatedIssue` interface: `{ issueKey, summary, issueType? }`
- New `fetchYesterdayCreatedIssues(baseUrl, token, projectKey, date, jiraUsername)`:
  - JQL: `project = X AND reporter = "user" AND created >= date AND created < nextDay`
  - TZ-safe nextDay arithmetic (same pattern as `fetchYesterdayJiraActivity`)
  - Returns `JiraCreatedIssue[]` mapped from `issues[].key/fields.summary/issuetype`

### IssueActivityGroup.tsx
- `PlusCircle` added to lucide imports
- `'issue-created'` added as last member of `SubItemKind` union
- `subItemIcon()` case for `'issue-created'` returns `PlusCircle`
- Renders in the existing plain `<div>` branch (no dedicated render branch needed — no mrLink/issueKey click affordance)

### YesterdayColumn.tsx
- `JiraCreatedIssue` added to jira.ts import
- `MarkdownSources` extended: `createdData?: JiraCreatedIssue[]`
- `YesterdayColumnProps` extended: `jiraCreatedQuery: UseQueryResult<JiraCreatedIssue[], Error>`
- `buildGroups()` 5th parameter `createdData?: JiraCreatedIssue[]` added before `issueMeta` (stays last)
- Pass 0 seeds created issues first: `group.subItems.push({ kind: 'issue-created', label: 'Created', originKey })`
- `useMemo` for `buildGroups` updated to pass `jiraCreatedQuery.data` + dependency
- `generateMarkdown` call updated to pass `sources.createdData`
- Loading/error state block added for `jiraCreatedQuery` at bottom of per-source status section

### StandupNotesPage.tsx
- `fetchYesterdayCreatedIssues` added to jira.ts imports
- `jiraCreatedQuery` added after `jiraActivityQuery` (same `queryKey`/`enabled`/`staleTime` pattern)
- `referencedKeys` useMemo: `for (const c of jiraCreatedQuery.data ?? []) keys.add(c.issueKey)` + dep
- `syncedMinutesAgo` includes `jiraCreatedQuery.dataUpdatedAt` (5th source)
- `handleCopyMarkdown` passes `createdData: jiraCreatedQuery.data`
- `<YesterdayColumn>` receives `jiraCreatedQuery={jiraCreatedQuery}`

## Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1+2  | Add created-issues data source to standup Yesterday column | 3e7c9f7e | jira.ts, IssueActivityGroup.tsx, YesterdayColumn.tsx, StandupNotesPage.tsx |

## Deviations from Plan

None — plan executed exactly as written. Tasks 1 and 2 committed together as a single atomic unit since they form one coherent feature with no intermediate verifiable state.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints or auth paths beyond what the existing four Jira queries already establish. T-dhp-01 accepted (reporter= scoped to activeJiraProject, user's own PAT).

## Self-Check: PASSED

- [x] `taskflow/src/services/jira.ts` — modified, contains `fetchYesterdayCreatedIssues`
- [x] `taskflow/src/routes/standup-notes/IssueActivityGroup.tsx` — modified, contains `issue-created`
- [x] `taskflow/src/routes/standup-notes/YesterdayColumn.tsx` — modified, contains `createdData` and `jiraCreatedQuery`
- [x] `taskflow/src/routes/standup-notes/StandupNotesPage.tsx` — modified, contains `jiraCreatedQuery`
- [x] Commit 3e7c9f7e exists: `git log --oneline | grep 3e7c9f7e`
- [x] `npm run check` (biome + tsc): 466 files, no errors
