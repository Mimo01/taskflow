---
phase: quick-260511-epfmqx
plan: "01"
subsystem: search
tags: [jira, command-palette, search, tdd]
dependency_graph:
  requires: [quick-260511-3nn]
  provides: [fetchJiraIssueByKey, direct-key-match-ui]
  affects: [CommandPalette]
tech_stack:
  added: []
  patterns: [silent-failure-null, useQuery-auto-enabled, derived-boolean]
key_files:
  created: []
  modified:
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira/issues.test.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/CommandPalette.test.tsx
decisions:
  - "fetchJiraIssueByKey added to issues.ts sub-module and re-exported from jira.ts barrel via named export (barrel has its own implementations, not export * from ./jira/issues)"
  - "isJiraKeyQuery placed as derived boolean after closedSearchTriggered state — no new useState needed"
  - "Direct Match group rendered above Issues group so it appears first in search results"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-11T09:48:19Z"
  tasks_completed: 2
  files_modified: 5
---

# Phase quick-260511-epfmqx Plan 01: Fetch Closed Jira Task by ID Summary

**One-liner:** Silent-failure fetchJiraIssueByKey via /rest/api/2/issue/{key} with automatic CommandPalette key-pattern detection and Direct Match group rendering.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Add fetchJiraIssueByKey to issues.ts and re-export from jira.ts | d15f155 | issues.ts, issues.test.ts, jira.ts |
| 2 | Add key-pattern auto-detection and Direct Match group to CommandPalette | e671656 | CommandPalette.tsx, CommandPalette.test.tsx |

## What Was Built

### fetchJiraIssueByKey (issues.ts)

New function added after `searchJiraClosed` in `taskflow/src/services/jira/issues.ts`:

- Calls `GET /rest/api/2/issue/{issueKey}?fields=summary,status,assignee,customfield_10016,issuetype`
- Returns `JiraIssue` on 200, `null` on any error (404, 401, 403, network throw)
- No statusCategory filter — open and closed issues both returned
- Strips trailing slash from baseUrl
- Re-exported from `jira.ts` barrel via `export { fetchJiraIssueByKey } from './jira/issues'`

### CommandPalette key detection (CommandPalette.tsx)

- `isJiraKeyQuery` derived boolean: `/^[A-Za-z]+-\d+$/i.test(query.trim())`
- New `useQuery(['search', 'key', query])` auto-fires when `isJiraKeyQuery && query.length >= 2 && !!jiraBaseUrl && !!activeJiraProject`
- `Direct Match` CommandGroup rendered above Issues group when `keyMatchResult` is non-null
- Selecting the item calls `handleIssueSelect(key, summary)` — same path as all other issue selections
- `staleTime: 30_000, placeholderData: keepPreviousData` matching live search pattern

## Tests Added

**issues.test.ts** — 8 new cases in `describe('fetchJiraIssueByKey')`:
- Returns parsed JiraIssue on 200
- Calls correct URL with required fields
- Strips trailing slash from baseUrl
- Returns null on 404, 401, 403
- Returns null on network error
- Does not include statusCategory/jql in URL

**CommandPalette.test.tsx** — 3 new cases in `describe('key pattern detection')`:
- Shows Direct Match group when fetch returns an issue
- Does not show Direct Match group when fetch returns null
- Does not fire key fetch for non-key query ("fix login")

**Total:** 53 tests passing (38 issues + 15 CommandPalette)

## Deviations from Plan

### Auto-fixed Issues

None.

### Structural Note

The plan stated "If jira.ts already uses `export * from './jira/issues'`, no change to jira.ts is needed." `jira.ts` does NOT use `export *` from the sub-module — it has its own inline implementations of `searchJira`, `searchJiraClosed`, etc. The re-export was added as a named export: `export { fetchJiraIssueByKey } from './jira/issues'`. This is exactly what the plan's fallback instruction specified.

## Threat Surface Scan

The plan's threat model covered both surfaces introduced by this plan:

| Threat ID | Surface | Disposition |
|-----------|---------|-------------|
| T-epfmqx-01 | User-typed key interpolated into URL path | Mitigated — `/^[A-Za-z]+-\d+$/i` validation ensures only safe alphanumeric+hyphen chars reach the URL before the query fires |
| T-epfmqx-02 | Silent null-on-error | Accepted — no error detail leaks to UI |

No new threat surface beyond what the plan's threat model registered.

## Known Stubs

None.

## Self-Check

- [x] `taskflow/src/services/jira/issues.ts` — contains `fetchJiraIssueByKey` ✓
- [x] `taskflow/src/services/jira.ts` — re-exports `fetchJiraIssueByKey` ✓
- [x] `taskflow/src/components/app/CommandPalette.tsx` — contains `isJiraKeyQuery`, `keyMatchResult`, `Direct Match` group ✓
- [x] Commit d15f155 — Task 1 ✓
- [x] Commit e671656 — Task 2 ✓
- [x] 53 tests passing, 0 TypeScript errors ✓

## Self-Check: PASSED
