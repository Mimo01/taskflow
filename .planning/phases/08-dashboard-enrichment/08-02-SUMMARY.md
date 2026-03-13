---
phase: 08-dashboard-enrichment
plan: "02"
subsystem: dashboard
tags: [jira, subtasks, dashboard, dash-01, tdd, wave-1]
dependency_graph:
  requires:
    - 08-01 (SubtasksPanel.test.tsx stubs)
  provides:
    - SubtasksPanel.tsx (DASH-01 component)
    - JiraActiveSprint interface
    - fetchActiveSprint service function
  affects:
    - 08-03-PLAN.md (SprintHealthPanel uses fetchActiveSprint)
tech_stack:
  added: []
  patterns:
    - useQuery cache-sharing via identical query keys (SubtasksPanel + MyTasksTab share 'jira-issues' cache)
    - Orphan detection via sprintKeySet built from sprint-board cache
    - TDD RED→GREEN: stubs converted to real tests, component implemented to pass
key_files:
  created:
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
  modified:
    - taskflow/src/services/jira.ts (added JiraActiveSprint + fetchActiveSprint)
    - taskflow/src/routes/dashboard/SubtasksPanel.test.tsx (converted 5 it.todo() to real tests)
decisions:
  - "fetchActiveSprint uses two-step Agile REST API pattern: board discovery then active sprint fetch"
  - "SubtasksPanel receives jiraBaseUrl/jiraToken/activeJiraProject as props — no internal secret reads"
  - "Sprint-board query key matches existing fetchSprintIssues callers for shared cache"
metrics:
  duration: "~3 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 1
  files_modified: 2
---

# Phase 8 Plan 2: SubtasksPanel + fetchActiveSprint Summary

**One-liner:** DASH-01 SubtasksPanel with orphan filtering, 5-row cap, and deep-link click; fetchActiveSprint two-step Agile API function exported from jira.ts.

## What Was Built

### Task 1: fetchActiveSprint (jira.ts)

Added to `taskflow/src/services/jira.ts`:
- `JiraActiveSprint` interface with `id`, `name`, `state`, `startDate?`, `endDate?`, `goal?`
- `fetchActiveSprint(baseUrl, token, projectKey): Promise<JiraActiveSprint | null>`
  - Step 1: `GET /rest/agile/1.0/board?projectKeyOrId={key}&type=scrum` → boardId
  - Step 2: `GET /rest/agile/1.0/board/{boardId}/sprint?state=active` → sprint
  - Returns null on any failure — never throws

### Task 2: SubtasksPanel.tsx (DASH-01)

Created `taskflow/src/routes/dashboard/SubtasksPanel.tsx`:

| Behavior | Implementation |
|----------|---------------|
| Shows key, title, status badge, parent story name | Button row with 4 elements |
| Orphan filtering | `sprintKeySet.has(issue.fields.parent.key)` |
| 5-row cap | `mySubtasks.slice(0, 5)` |
| "View all in My Tasks" | `hasMore && <Link to="/my-tasks">` |
| Empty state | Conditional `<p>` when no subtasks |
| Deep-link | `window.open(jiraBaseUrl + '/browse/' + issue.key, '_blank')` |
| Loading | 3-row animate-pulse skeleton |

**Cache sharing:** Uses identical query key `['jira-issues', 'my-tasks', activeJiraProject, storyPointsFieldKey]` as MyTasksTab — no redundant Jira API calls.

**Test results:** 5/5 GREEN (converted from it.todo() stubs)

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 68a7c94 | feat(08-02): add fetchActiveSprint and JiraActiveSprint to jira.ts |
| Task 2 | cbe71e9 | feat(08-02): implement SubtasksPanel and convert test stubs to GREEN |

## Deviations from Plan

**[Rule 1 - Bug] Duplicate export removed from jira.ts**
- **Found during:** Task 2 file write
- **Issue:** Auto-formatter appended a second copy of `JiraActiveSprint` and `fetchActiveSprint` to jira.ts after Task 1 commit, causing 9 extra TypeScript errors (68 → 77 → 59 after removal)
- **Fix:** Removed the duplicate block; TypeScript error count dropped to 59 (below pre-phase baseline of 68)
- **Files modified:** taskflow/src/services/jira.ts
- **Commit:** cbe71e9 (included in Task 2 commit)

## Self-Check: PASSED

- [x] taskflow/src/routes/dashboard/SubtasksPanel.tsx exists
- [x] taskflow/src/services/jira.ts exports `fetchActiveSprint` and `JiraActiveSprint`
- [x] SubtasksPanel.test.tsx has 5 real tests (no it.todo())
- [x] 5/5 tests pass: `npx vitest run src/routes/dashboard/SubtasksPanel.test.tsx`
- [x] TypeScript error count: 59 (at or below pre-phase baseline of 68)
- [x] Commits 68a7c94 and cbe71e9 exist
