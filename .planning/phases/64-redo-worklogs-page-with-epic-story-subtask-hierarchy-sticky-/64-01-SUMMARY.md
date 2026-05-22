---
phase: 64-redo-worklogs-page-with-epic-story-subtask-hierarchy-sticky-
plan: 01
subsystem: worklogs
tags:
  - worklogs
  - hierarchy
  - sticky-table
  - tanstack-query
  - jira-enrichment
  - tdd
dependency_graph:
  requires: []
  provides:
    - WorklogsPage hierarchy table (TEMPO-08)
    - Jira enrichment dependent query
    - onIssueClick outlet context wiring
  affects:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
tech_stack:
  added: []
  patterns:
    - Dependent TanStack Query (uniqueKeys useMemo → enrichment useQuery)
    - CSS sticky table (z-30 corner / z-20 header / z-10 first column)
    - useOutletContext for onIssueClick (same pattern as BacklogPage)
    - Hierarchy useMemo (EpicNode/StoryNode/SubtaskNode nested Maps)
    - resolvedKeys Set for unresolvable issue detection
key_files:
  created: []
  modified:
    - taskflow/src/routes/worklogs/WorklogsPage.tsx
    - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
decisions:
  - "Used resolvedKeys Set (from enrichMap.keys()) to distinguish unresolvable issues from epics without relying on epicKey === NO_EPIC"
  - "Stories with unresolvable parent epic routed to NO_EPIC group (parent key not in enrichMap → NO_EPIC)"
  - "Epic rows also clickable per D-10 discretion"
  - "Enrichment error is non-blocking: Alert renders above table, hours still display"
  - "issueTotals tracks per-issue total using worklog-level accumulation before hierarchy classification"
metrics:
  duration: "9 minutes"
  completed_date: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 2
---

# Phase 64 Plan 01: Hierarchy Table + Sticky CSS + Jira Enrichment Summary

Replaced the person×day pivot table in WorklogsPage with a 3-level Jira issue hierarchy (Epic → Story → Subtask), batch Jira enrichment query, sticky header/column CSS, and `onIssueClick` outlet context wiring.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Update WorklogsPage.test.tsx mocks and fixtures for hierarchy table | 15134757 | WorklogsPage.test.tsx |
| 2 | Add useOutletContext, uniqueKeys useMemo, and dependent Jira enrichment query | 383f10d0 | WorklogsPage.tsx, WorklogsPage.test.tsx |
| 3 | Replace pivot table with epic/story/subtask hierarchy + sticky CSS + leaf-row navigation | 16b75990 | WorklogsPage.tsx |

## What Was Built

**WorklogsPage.tsx** — Rewritten table body replacing the flat person×day pivot:

- `useOutletContext` wired to consume `onIssueClick` from outlet (parallel to BacklogPage.tsx line 191)
- `uniqueKeys` useMemo: sorted deduplicated array of `w.issue.key` values; `uniqueKeysStr` for stable queryKey
- `enrichQuery` useQuery: `['jira', 'worklog-enrich', jiraBaseUrl, uniqueKeysStr]` — fires `issuekey in (...)` JQL against `/rest/api/2/search?fields=summary,issuetype,parent`; `jiraToken` excluded from queryKey (T-62-06); `staleTime: 5 * 60 * 1000`; guarded by `uniqueKeys.length > 0`
- `hierarchy` useMemo: builds `HierarchyMap` from `data` + `enrichQuery.data`; classification uses `issuetype.subtask` boolean (never `issuetype.name === 'Epic'`); stories with unresolvable epic parent route to `__NO_EPIC__` group
- `resolvedKeys` Set tracks which issue keys are in `enrichMap`; unresolvable keys render as `<span className="line-through">{key}</span>`
- Sticky CSS: corner `th` = `sticky top-0 left-0 z-30 bg-background`, date `th` = `sticky top-0 z-20 bg-background`, data `td` = `sticky left-0 z-10 bg-background`, tfoot `td` = `sticky left-0 bottom-0 z-20 bg-background`
- Epic rows: `Layers` icon (purple), `bg-muted/40`, clickable; Story rows: `BookOpen` icon (blue), `pl-4`, clickable; Subtask rows: `GitBranch` icon (muted), `pl-8`, clickable
- No Epic group: non-clickable header row with italic muted label; stories with unresolvable parent epic land here
- Enrichment error: non-blocking `Alert` above the table when `enrichQuery.isError`

**WorklogsPage.test.tsx** — Updated to support hierarchy:

- `vi.mock('react-router-dom')` with `useOutletContext` returning `{ onIssueClick: mockOnIssueClick }`
- `vi.mock('@/lib/apiFetch')` returning `mockEnrichResult` for `/rest/api/2/search` URLs
- `vi.mock('@/services/jira/worklogs')` stubbing CRUD (for Plan 02 cell popover)
- `makeWorklog` extended with `issueKey` parameter (default `'X-1'`)
- TEMPO-01 pivot table tests removed; TEMPO-07 updated to per-issue semantics
- 10 new tests covering enrichment query, outlet context, epic/story/subtask styling, unresolvable keys, No Epic group, subtask click, corner header non-click, enrichment error alert

## Test Results

```
Tests: 33 passed (33)
TypeScript: 0 errors
Full suite: 1323 passed (3 pre-existing failures in dashboard/index.test.tsx unrelated to this plan)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed No Epic routing for orphaned stories**
- **Found during:** Task 3 (test TEMPO-08 'No Epic' group)
- **Issue:** Stories whose parent epic key was not in enrichMap were routed to a named epic group (`EPIC-MISSING`) instead of the synthetic `__NO_EPIC__` group
- **Fix:** In the story branch, check `enrichMap.get(parentKey)` — if undefined, use `NO_EPIC` as the epic key
- **Files modified:** WorklogsPage.tsx (hierarchy useMemo, story branch)
- **Commit:** 16b75990

**2. [Rule 1 - Bug] Fixed resolvedKeys-based rendering for unresolvable issues**
- **Found during:** Task 3 (test unresolvable issue key line-through)
- **Issue:** JSX used `!isNoEpic` as proxy for "is resolvable" — but unresolvable top-level keys (no enrichment, placed as top-level epic nodes) were rendering their summary text instead of the strikethrough span
- **Fix:** Export `resolvedKeys: new Set(enrichMap.keys())` from the hierarchy useMemo; use `resolvedKeys.has(epicKey/storyKey/subtaskKey)` in all three row types
- **Files modified:** WorklogsPage.tsx
- **Commit:** 16b75990

**3. [Rule 1 - Bug] Fixed TypeScript tuple destructuring in test apiFetch assertions**
- **Found during:** Task 2 TypeScript check
- **Issue:** `calls.find(([, url]: [string, string]) => ...)` failed because `mock.calls` is typed as `any[][]`, not `[string, string][]`
- **Fix:** Cast to `unknown[][]` and access `args[1] as string`
- **Files modified:** WorklogsPage.test.tsx
- **Commit:** 383f10d0 (amended test file)

## Known Stubs

None. All data is wired from live `enrichQuery.data` and `data` (worklogs). The `entries` array on hierarchy nodes is populated but not yet rendered (used in Plan 02 cell popover).

## Threat Flags

No new network endpoints or auth paths introduced beyond what the threat model covers. The enrichment query follows the same pattern as existing Jira batch queries (T-64-01: `issuekey in (...)` values originate from Tempo API, not user input; URL-encoded via `encodeURIComponent`).

## Self-Check: PASSED

- SUMMARY.md: FOUND
- Commit 15134757: FOUND
- Commit 383f10d0: FOUND
- Commit 16b75990: FOUND
- All files present: taskflow/src/routes/worklogs/WorklogsPage.tsx, taskflow/src/routes/worklogs/WorklogsPage.test.tsx
