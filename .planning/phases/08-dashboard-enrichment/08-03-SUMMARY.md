---
phase: 08-dashboard-enrichment
plan: "03"
subsystem: dashboard
tags: [tdd, wave-1, dash-02, dash-03, mr-health, sprint-health]
dependency_graph:
  requires:
    - 08-01 (MrHealthPanel.test.tsx, SprintHealthPanel.test.tsx stub files)
    - fetchActiveSprint from jira.ts (added in this plan — Plan 02 not yet executed)
  provides:
    - MrHealthPanel.tsx (DASH-02 component)
    - SprintHealthPanel.tsx (DASH-03 component)
    - fetchActiveSprint + JiraActiveSprint exports in jira.ts
  affects:
    - 08-05-PLAN.md (dashboard index wiring)
tech_stack:
  added: []
  patterns:
    - 3-element cache key ['gitlab-mrs', gitlabBaseUrl, userId] for MR health
    - 4-element cache key ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]
    - useQueryClient.getQueryData for per-MR health entries
    - getDaysRemaining helper with null-guard on endDate
    - Zero-denominator guard on donePct computation
    - At-risk heuristic: indeterminate status + timeSpentSeconds == 0
key_files:
  created:
    - taskflow/src/routes/dashboard/MrHealthPanel.tsx
    - taskflow/src/routes/dashboard/SprintHealthPanel.tsx
  modified:
    - taskflow/src/routes/dashboard/MrHealthPanel.test.tsx (stubs -> real GREEN tests)
    - taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx (stubs -> real GREEN tests)
    - taskflow/src/services/jira.ts (added fetchActiveSprint + JiraActiveSprint)
decisions:
  - "fetchActiveSprint added to jira.ts in this plan (Plan 02 not yet executed) — Rule 3 blocking dependency"
  - "MrHealthPanel uses full filtered list from 3-element cache, not just author-scoped subset — filtered list already scoped by MrAttentionTab"
  - "SprintHealthPanel reads JiraIssue[] directly (fetchSprintIssues returns array, not {issues, myIssueKeys}) — confirmed from SprintProgressTab pattern"
  - "at-risk list rendered as <ul> only when atRiskIssues.length > 0 — matches test expectation queryByRole('list') is null"
metrics:
  duration: "3 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 2
  files_modified: 3
---

# Phase 8 Plan 3: MrHealthPanel + SprintHealthPanel Summary

**One-liner:** MrHealthPanel (DASH-02) showing MR review health counts from 3-element TanStack cache, and SprintHealthPanel (DASH-03) showing sprint % done, days remaining, and at-risk items with graceful null guards throughout.

## What Was Built

### MrHealthPanel (DASH-02)
`taskflow/src/routes/dashboard/MrHealthPanel.tsx`

- Props: `{ gitlabBaseUrl, gitlabToken, userId }`
- Fetches MRs via `['gitlab-mrs', gitlabBaseUrl, userId]` (3-element key matching MrAttentionTab)
- Reads per-MR health from `['mr-health', project_id, iid]` via `useQueryClient.getQueryData`
- Undefined health entries default to Needs Review bucket
- Three count rows: Needs Review (default), Approved (green), Changes Requested (amber)
- Empty state: "No open MRs"
- Loading skeleton: animate-pulse

### SprintHealthPanel (DASH-03)
`taskflow/src/routes/dashboard/SprintHealthPanel.tsx`

- Props: `{ jiraBaseUrl, jiraToken, activeJiraProject }`
- Sprint issues: `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` (4-element key)
- Active sprint: `['jira-active-sprint', activeJiraProject]` via `fetchActiveSprint`
- Summary line: `"N days left · N% done · N at-risk"` (days-left omitted when null)
- `getDaysRemaining` helper with full null/NaN guard
- Zero-denominator guard: `totalPoints > 0 ? round(done/total*100) : 0`
- At-risk: in-progress stories (`!issuetype.subtask`) with `timeSpentSeconds == 0`
- At-risk list rendered below summary with key + summary per item
- Empty state: "No sprint data available"

### fetchActiveSprint (jira.ts addition — Rule 3 deviation)
Added because Plan 02 (which adds this function) had not yet been executed, blocking SprintHealthPanel implementation.

- Two-step: board discovery via `/rest/agile/1.0/board?projectKeyOrId=...&type=scrum`, then sprint via `/rest/agile/1.0/board/{id}/sprint?state=active`
- Returns `JiraActiveSprint | null` — null on any failure (graceful-hide for days-left)

## Test Results

| File | Tests | Status |
|------|-------|--------|
| MrHealthPanel.test.tsx | 2 | GREEN |
| SprintHealthPanel.test.tsx | 6 | GREEN |
| **Total** | **8** | **GREEN** |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | bcd5824 | feat(08-03): implement MrHealthPanel (DASH-02) |
| Task 2 | 74f6bc8 | feat(08-03): implement SprintHealthPanel (DASH-03) and add fetchActiveSprint |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added fetchActiveSprint to jira.ts**
- **Found during:** Task 2 (SprintHealthPanel requires fetchActiveSprint)
- **Issue:** Plan 02 (which was supposed to add `fetchActiveSprint` to `jira.ts`) had not been executed. SprintHealthPanel requires this export to compile and function.
- **Fix:** Added `JiraActiveSprint` interface and `fetchActiveSprint` function to the bottom of `jira.ts` following the exact pattern specified in the Plan 02 and RESEARCH.md.
- **Files modified:** `taskflow/src/services/jira.ts`
- **Commit:** 74f6bc8

**2. [Rule 2 - Test quality] Converted it.todo() stubs to real test implementations**
- **Found during:** Both tasks
- **Issue:** Tests were `it.todo()` stubs — GREEN trivially without testing behavior. Converted to real tests that verify component rendering.
- **Fix:** Replaced stubs with real assertions for counts, empty state, days-left display, at-risk items.

## Self-Check: PASSED

- [x] taskflow/src/routes/dashboard/MrHealthPanel.tsx exists
- [x] taskflow/src/routes/dashboard/SprintHealthPanel.tsx exists
- [x] fetchActiveSprint and JiraActiveSprint exported from taskflow/src/services/jira.ts
- [x] Commits bcd5824 and 74f6bc8 exist
- [x] `npx vitest run src/routes/dashboard/MrHealthPanel.test.tsx` — 2/2 GREEN
- [x] `npx vitest run src/routes/dashboard/SprintHealthPanel.test.tsx` — 6/6 GREEN
- [x] No new TypeScript errors introduced by this plan's files
