---
phase: quick
plan: 260518-wmy
subsystem: services/instrumentation
tags: [apiFetch, aioFetch, operation-profiler, labelling]
dependency_graph:
  requires: []
  provides: [operation-labels-complete]
  affects: [operation-profiler, dev-tools-operations-tab]
tech_stack:
  added: []
  patterns: [operation-label-convention]
key_files:
  created: []
  modified:
    - taskflow/src/services/aio/client.ts
    - taskflow/src/services/aio/client.test.ts
    - taskflow/src/services/aio/projects.ts
    - taskflow/src/services/aio/cycles.ts
    - taskflow/src/services/aio/issue-runs.ts
    - taskflow/src/services/aio/issue-steps.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/attachments.ts
    - taskflow/src/services/jira/users.ts
    - taskflow/src/services/jira/worklogs.ts
    - taskflow/src/services/jira/transitions.ts
    - taskflow/src/services/jira/projects.ts
    - taskflow/src/services/notifications.ts
    - taskflow/src/routes/dashboard/widgets/CustomJqlWidget.tsx
decisions:
  - aioFetch operation param inserted as 4th positional arg between path and apiPath to keep call sites readable
  - fetchFixVersions labeled Load Releases (matches jira/versions.ts convention) rather than plan-suggested Load Issue Detail
  - Fetch Notifications merged into Load Notifications (both fire in same poll cycle; unified label cleaner)
  - fetchJiraProjectNumericId renamed to Load Project (callers are AIO setup flows, not connection validation)
metrics:
  duration: ~45min
  completed: 2026-05-18
---

# Phase quick Plan 260518-wmy: Ensure All Backend Requests Have an Operation Group Summary

Every `apiFetch` and `aioFetch` call site in `taskflow/src/` now passes a meaningful Title Case operation label so that zero requests land in the "Ungrouped Requests" bucket of the dev-tools Operations tab.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Add required `operation` param to `aioFetch`; label all AIO call sites | `43da923d` | client.ts, client.test.ts, projects.ts, cycles.ts, issue-runs.ts, issue-steps.ts |
| 2 | Label all previously-unlabelled `apiFetch` calls in jira.ts, jira/\*, CustomJqlWidget | `4b1b1df6` | jira.ts (~30 calls), attachments.ts, users.ts, worklogs.ts, CustomJqlWidget.tsx |
| 3 | Audit existing labels — correct inconsistent ones | `4110b563` | transitions.ts, notifications.ts, projects.ts |

## Changes Made

### Task 1 — aioFetch signature change

`aioFetch` now requires a 4th `operation: string` parameter (between `path` and `apiPath`):

```typescript
export async function aioFetch(
  baseUrl: string,
  token: string,
  path: string,
  operation: string,       // NEW — required
  apiPath: string = AIO_API_PATH,
  init?: { method?: string; body?: string },
): Promise<Response>
```

All 11 AIO call sites updated with semantic labels:
- `projects.ts` — `'Load AIO Projects'`
- `cycles.ts` (8 calls) — `'Load AIO Cycles'`
- `issue-runs.ts` — `'Load AIO Execution Detail'`
- `issue-steps.ts` (3 calls) — `'Load AIO Execution Detail'`

### Task 2 — jira.ts and subfile labelling

Labels applied to ~30 previously-unlabelled calls:

| File | Label(s) |
|------|----------|
| jira.ts — board/sprint queries | `'Load Board'` |
| jira.ts — field/schema queries | `'Load Fields'` |
| jira.ts — search/backlog queries | `'Search Issues'` / `'Load Backlog'` |
| jira.ts — issue CRUD | `'Load Issue Detail'` / `'Create/Edit Issue'` |
| jira.ts — version management | `'Load Releases'` / `'Update Release'` |
| jira.ts — comment queries | `'Load Issue Detail'` |
| jira/attachments.ts | `'Load Issue Detail'` |
| jira/users.ts | `'Create/Edit Issue'` |
| jira/worklogs.ts | `'Manage Worklogs'` (all 4 ops) |
| CustomJqlWidget.tsx | `'Search Issues'` |

### Task 3 — Audit fixes

| File | Old label | New label | Reason |
|------|-----------|-----------|--------|
| `jira/transitions.ts:fetchTransitions` | `'Load Fields'` | `'Issue Transition'` | Wrong — it fetches transition options, not field definitions |
| `notifications.ts` (4 Jira query fns) | `'Fetch Notifications'` | `'Load Notifications'` | Merge with GitLab label (same poll cycle); standardize verb |
| `jira/projects.ts:fetchJiraProjectNumericId` | `'Fetch project'` | `'Load Project'` | Lowercase 'project' breaks Title Case; wrong verb 'Fetch' vs 'Load' |

### Files confirmed correct (no changes needed)

`jira/comments.ts`, `jira/transitions.ts:postTransition`, `jira/versions.ts`, `jira/sprints.ts`, `jira/links.ts`, `jira/fields.ts`, `jira/board-config.ts`, `jira/filters.ts`, `jira/backlog.ts`, `jira-watchers.ts`, `gitlab.ts`, `jira/projects.ts:validateJira`, `jira/projects.ts:listJiraProjects`, `useCreateEditQueries.ts`, `CustomFieldsSection.tsx`, `IssueDetailSidebar.tsx`, `FieldsSection.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Three aioFetch calls in issue-steps.ts not updated by replace_all**
- **Found during:** Task 1
- **Issue:** `replace_all` edit only matched one pattern variant; two calls on lines 174 and 254 still had bare 3-arg `aioFetch(baseUrl, token, path)` causing TS errors
- **Fix:** Targeted edits for each remaining call site
- **Files modified:** `taskflow/src/services/aio/issue-steps.ts`
- **Commit:** `43da923d`

**2. [Rule 2 - Deviation] fetchFixVersions labeled 'Load Releases' not 'Load Issue Detail'**
- **Found during:** Task 2
- **Issue:** Plan's line-number mapping suggested `'Load Issue Detail'` for `fetchFixVersions`, but it fetches fix versions/releases — semantically identical to `jira/versions.ts` which uses `'Load Releases'`
- **Fix:** Used `'Load Releases'` to match the existing convention and produce a meaningful group name
- **Files modified:** `taskflow/src/services/jira.ts`
- **Commit:** `4b1b1df6`

## Label Audit Decisions

| Call site | Verdict | Label | Notes |
|-----------|---------|-------|-------|
| `transitions.ts:fetchTransitions` | RENAMED | `'Issue Transition'` | Was `'Load Fields'` — wrong endpoint category |
| `notifications.ts:fetchIssueUpdates` | MERGED | `'Load Notifications'` | Was `'Fetch Notifications'` |
| `notifications.ts:fetchCommentMentions` | MERGED | `'Load Notifications'` | Was `'Fetch Notifications'` |
| `notifications.ts:fetchAllComments` | MERGED | `'Load Notifications'` | Was `'Fetch Notifications'` |
| `notifications.ts:fetchDueDateReminders` | MERGED | `'Load Notifications'` | Was `'Fetch Notifications'` |
| `projects.ts:fetchJiraProjectNumericId` | RENAMED | `'Load Project'` | Was `'Fetch project'` — Title Case fix + verb fix |
| All gitlab.ts labels | KEPT | various | All already correct Title Case |
| `jira/versions.ts` labels | KEPT | `'Load Releases'` | Correct |
| `jira/sprints.ts` labels | KEPT | various | Correct |
| `jira/board-config.ts` | KEPT | `'Load Quick Filters'` | Correct |

## Known Stubs

None.

## Threat Flags

None — this plan only changes string literals passed as instrumentation metadata; no new network endpoints, auth paths, or schema changes.

## Self-Check

- [x] Task 1 commit `43da923d` — verified via git log
- [x] Task 2 commit `4b1b1df6` — verified via git log
- [x] Task 3 commit `4110b563` — verified via git log
- [x] All 14 modified files exist on disk

## Self-Check: PASSED
