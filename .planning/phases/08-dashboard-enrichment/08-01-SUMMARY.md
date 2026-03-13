---
phase: 08-dashboard-enrichment
plan: "01"
subsystem: dashboard
tags: [testing, tdd, wave-0, dash-01, dash-02, dash-03, dash-04]
dependency_graph:
  requires: []
  provides:
    - SubtasksPanel.test.tsx (DASH-01 test contract)
    - MrHealthPanel.test.tsx (DASH-02 test contract)
    - SprintHealthPanel.test.tsx (DASH-03 test contract)
    - NotificationsPanel.test.tsx (DASH-04 test contract)
  affects:
    - 08-02-PLAN.md (Wave 1 SubtasksPanel implementation)
    - 08-03-PLAN.md (Wave 1 MrHealthPanel + SprintHealthPanel implementation)
    - 08-04-PLAN.md (Wave 1 NotificationsPanel implementation)
tech_stack:
  added: []
  patterns:
    - it.todo() stubs for Wave 0 RED state
    - vi.mock for @tanstack/react-query, auth.store, settings.store, notifications.store
key_files:
  created:
    - taskflow/src/routes/dashboard/SubtasksPanel.test.tsx
    - taskflow/src/routes/dashboard/MrHealthPanel.test.tsx
    - taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx
    - taskflow/src/routes/dashboard/NotificationsPanel.test.tsx
  modified: []
decisions:
  - "it.todo() chosen over expect(true).toBe(false) for stubs — cleaner test output, vitest reports them as todo/pending rather than failure noise"
  - "notifications.store mock included in NotificationsPanel test alongside react-query mocks — store is primary data source for DASH-04"
  - "SprintHealthPanel test includes fetchActiveSprint mock in jira service mock — anticipates Wave 1 implementation pattern"
metrics:
  duration: "2 min"
  completed_date: "2026-03-13"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 8 Plan 1: Wave 0 Test Stubs Summary

**One-liner:** Four it.todo() RED-state test stub files covering all DASH-01 through DASH-04 dashboard panel behaviors.

## What Was Built

Created four test files in `taskflow/src/routes/dashboard/` as the Wave 0 Nyquist requirement. All files use `it.todo()` stubs — vitest reports them as pending (todo state) which is the expected RED state before implementation.

| File | Requirement | Stubs | Status |
|------|-------------|-------|--------|
| SubtasksPanel.test.tsx | DASH-01 | 5 | RED (todo) |
| MrHealthPanel.test.tsx | DASH-02 | 2 | RED (todo) |
| SprintHealthPanel.test.tsx | DASH-03 | 6 | RED (todo) |
| NotificationsPanel.test.tsx | DASH-04 | 4 | RED (todo) |

**Total: 17 pending test stubs** — all reported by `npx vitest run src/routes/dashboard`.

## Mock Setup (consistent across all 4 files)

- `@tanstack/react-query` — `useQuery` and `useQueryClient` mocked via `vi.importActual` spread
- `@/stores/auth.store` — `useAuthStore` returns standard test credentials
- `@/stores/settings.store` — `useSettingsStore` returns `storyPointsFieldKey: 'customfield_10016'`
- `@/stores/notifications.store` — mocked in NotificationsPanel.test.tsx with `items`, `readIds`, `markAsRead`
- `@/services/jira` — `fetchMyTasksHierarchy`, `fetchSprintIssues`, `fetchActiveSprint` (for SprintHealthPanel)
- `@/services/gitlab` — `validateGitLab`, `fetchAssignedMRs`, `fetchMRApprovals` (for MrHealthPanel)
- `@/services/stronghold` — `readSecret` returns test tokens

## Test Behaviors Defined (as stubs)

### SubtasksPanel (DASH-01)
1. Renders subtask row with key, title, status badge, and parent story name
2. Hides orphan subtasks whose parent.key is not in the sprint issue set
3. Shows "No open subtasks in the current sprint" when no subtasks
4. Limits display to 5, shows "View all in My Tasks" link when more exist
5. Clicking a subtask row calls window.open with the Jira browse URL

### MrHealthPanel (DASH-02)
1. Shows correct Needs Review / Approved / Changes Requested counts from mr-health cache
2. Shows "No open MRs" empty state when assigned MRs list is empty

### SprintHealthPanel (DASH-03)
1. Shows correct "% done" computed from done-points / total-points
2. Shows 0% done guard when sprint has no story points
3. Shows "N days left" when activeSprint.endDate is present
4. Hides "days left" gracefully when activeSprint is null or endDate absent
5. Lists at-risk items (in-progress + timeSpentSeconds == 0) by title
6. Shows no at-risk list when all in-progress items have time logged

### NotificationsPanel (DASH-04)
1. Shows last 3 unread notifications sorted newest-first
2. Shows "No unread notifications" empty state
3. Clicking a notification row opens inline detail (not navigation)
4. Renders "View all notifications" link pointing to /notifications route

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | cbd01a0 | test(08-01): add failing test stubs for SubtasksPanel and MrHealthPanel |
| Task 2 | 0285570 | test(08-01): add failing test stubs for SprintHealthPanel and NotificationsPanel |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- [x] taskflow/src/routes/dashboard/SubtasksPanel.test.tsx exists
- [x] taskflow/src/routes/dashboard/MrHealthPanel.test.tsx exists
- [x] taskflow/src/routes/dashboard/SprintHealthPanel.test.tsx exists
- [x] taskflow/src/routes/dashboard/NotificationsPanel.test.tsx exists
- [x] Commits cbd01a0 and 0285570 exist
- [x] `npx vitest run src/routes/dashboard` picks up all 4 files (17 todo stubs)
