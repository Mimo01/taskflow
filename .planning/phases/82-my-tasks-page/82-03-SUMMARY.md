---
phase: 82-my-tasks-page
plan: "03"
subsystem: service-layer
tags: [jira, pagination, service, tdd, flagged-field]
dependency_graph:
  requires: []
  provides: [fetchAllAssignedHierarchy, fetchMyTasksHierarchy-flagged]
  affects: [taskflow/src/services/jira.ts, taskflow/src/services/jira/client.test.ts]
tech_stack:
  added: []
  patterns: [fetchAllSearchPages-pagination, assignee-currentUser-scope, non-breaking-default-param]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/client.test.ts
decisions:
  - Import fetchAllSearchPages from jira/client.ts (not the private jira.ts copy) in fetchAllAssignedHierarchy — enforces the "use the exported paginator" pattern from RESEARCH assumption A3
  - flaggedFieldKey appended to both parent fields and subtaskFields in fetchMyTasksHierarchy — duedate also added to subtaskFields (was missing), both gaps closed in one pass
  - fetchAllAssignedHierarchy returns { issues, myIssueKeys } mirroring fetchMyTasksHierarchy return shape for drop-in interchangeability at the query layer
metrics:
  duration: "3 minutes"
  completed: "2026-06-14T14:06:35Z"
  tasks_completed: 2
  files_modified: 2
---

# Phase 82 Plan 03: Service Layer — fetchAllAssignedHierarchy + flagged-field extension Summary

Extends the Jira service layer for the My Tasks page (MYTASK-07): adds `fetchAllAssignedHierarchy` (All-Assigned scope) wrapping the exported `fetchAllSearchPages` from `jira/client.ts` (fully paginated, no page cap), extends `fetchMyTasksHierarchy` to include the flagged field in both parent and subtask field strings, and adds the criterion-6 pagination assertion.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | Criterion-6 pagination assertion in client.test.ts | 5205b013 | taskflow/src/services/jira/client.test.ts |
| 2 | fetchAllAssignedHierarchy + flagged-field extension of fetchMyTasksHierarchy | b664258f | taskflow/src/services/jira.ts |

## What Was Built

### Task 1 — Criterion-6 test (TDD)

Added `it('returns all 250 results when total=250 and first page returns 50', ...)` inside the existing `describe('fetchAllSearchPages')` block in `client.test.ts`. The test mocks:
- Page 1 (startAt=0): 50 issues returned, total=250
- Page 2 (startAt=200): 200 issues returned, total=250

Asserts `result.length === 250` and verifies both the first and last issue keys. This proves the loop continues past an under-full first page — satisfying criterion 6 (D-06 requirement).

### Task 2 — Service layer changes in jira.ts

**`fetchMyTasksHierarchy` extended:**
- Added `flaggedFieldKey = 'customfield_10021'` as a 5th parameter (non-breaking default)
- Appended `,${flaggedFieldKey}` to the parent `fields` string (was ending with `...duedate`)
- Appended `,duedate,${flaggedFieldKey}` to the `subtaskFields` string (was missing both `duedate` and the flagged field)
- This unblocks My Day band 0 (flagged/blocked) classification and overdue-subtask detection

**`fetchAllAssignedHierarchy` added (new export):**
- Signature: `fetchAllAssignedHierarchy(baseUrl, token, projectKey, flaggedFieldKey?, storyPointsFieldKey?)`
- Returns `{ issues: JiraIssue[]; myIssueKeys: Set<string> }` — same shape as `fetchMyTasksHierarchy`
- JQL: `project = ${projectKey} AND issuetype not in subtaskIssueTypes() AND assignee = currentUser() ORDER BY rank ASC`
- `assignee = currentUser()` hard-coded (T-82-04 threat mitigation — no assignee param from UI)
- Calls `fetchAllSearchPagesClient` (imported alias for `fetchAllSearchPages` from `./jira/client`) — no hand-rolled loop, no maxResults cap
- Fields include: SP fields, `customfield_10020` (sprint field for D-05 ordering), `duedate`, `flaggedFieldKey`
- Import line updated: `import { fetchAllSearchPages as fetchAllSearchPagesClient, isResponseLikeError } from './jira/client'`

## Verification

- `cd taskflow && node_modules/.bin/vitest run src/services/jira/client.test.ts` — 16 passed (15 original + 1 new criterion-6 test)
- `npx tsc --noEmit -p tsconfig.json` — clean, zero errors
- `grep -q "export async function fetchAllAssignedHierarchy" taskflow/src/services/jira.ts` — PASS
- `grep -q "assignee = currentUser()" taskflow/src/services/jira.ts` — PASS
- `grep -q "fetchAllSearchPagesClient" taskflow/src/services/jira.ts` — PASS
- `flaggedFieldKey` appended to both `fields` and `subtaskFields` strings in `fetchMyTasksHierarchy` — PASS
- No `maxResults=50` introduced in `fetchAllAssignedHierarchy` path — PASS
- `git diff taskflow/package.json` empty — PASS (no new packages)

## Deviations from Plan

None — plan executed exactly as written.

The pre-existing `maxResults=50` at lines 774/906 (other functions: `fetchIssuesChangedSince`, `fetchGlobalSearchIssues`) were noted as out-of-scope pre-existing code and not touched.

Note: `subtaskFields` in `fetchMyTasksHierarchy` also lacked `duedate` (not just `flaggedFieldKey`). Adding `duedate` alongside `flaggedFieldKey` was the correct fix since the plan's action explicitly called for `,duedate,${flaggedFieldKey}` to be appended to `subtaskFields`.

## Known Stubs

None. Both functions are complete implementations with no placeholder returns.

## Threat Flags

No new threat surface beyond the plan's T-82-04 mitigation (verified: `assignee = currentUser()` hard-coded in JQL).

## Self-Check: PASSED

- `taskflow/src/services/jira.ts` — modified and committed (b664258f)
- `taskflow/src/services/jira/client.test.ts` — modified and committed (5205b013)
- Commit 5205b013 exists: confirmed
- Commit b664258f exists: confirmed
- 16 tests passing, 0 failing
- TypeScript: clean
