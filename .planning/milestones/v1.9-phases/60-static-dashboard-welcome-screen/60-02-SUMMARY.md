---
phase: 60-static-dashboard-welcome-screen
plan: "02"
subsystem: dashboard
tags: [dashboard, jira, tanstack-query, tdd, vitest]
dependency_graph:
  requires:
    - "TanStack Query cache: ['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey] (shared with SprintBoardTab, DashboardSprintCard, SprintHealthPanel)"
    - taskflow/src/services/jira.ts (fetchSprintIssues, JiraIssue)
    - taskflow/src/hooks/useDelayedLoading.ts
    - react-router-dom (useNavigate)
  provides:
    - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx (default export)
    - taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx (5 Vitest unit tests)
  affects:
    - taskflow/src/routes/dashboard/index.tsx (will consume DashboardInProgressCard as child)
tech_stack:
  added: []
  patterns:
    - TDD (RED → GREEN with separate commits)
    - Shared TanStack Query cache key (no extra API call when sprint board is warm)
    - Props-only auth (D-16) — no readSecret, no useAuthStore in card components
    - useDelayedLoading 3-block skeleton pattern
key_files:
  created:
    - taskflow/src/routes/dashboard/DashboardInProgressCard.tsx
    - taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx
  modified: []
decisions:
  - "Used JSX expression {overflow} in 'and {overflow} more' rather than template literal — semantically identical, renders same output, all tests confirm"
  - "node_modules symlink created in worktree taskflow/ to share main repo's dependencies for vitest execution"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 2
  tests_passing: 5
---

# Phase 60 Plan 02: DashboardInProgressCard Summary

**One-liner:** DashboardInProgressCard with shared sprint-board cache key, D-08 Option B displayName filter, cap-at-3 rows with overflow caption, and full TDD coverage (5 tests).

## What Was Built

`DashboardInProgressCard` — a React component that surfaces the current user's active in-progress subtasks at a glance on the static dashboard.

Key behaviors:
- Shares the exact TanStack Query cache key `['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]` with `SprintBoardTab`, `DashboardSprintCard`, and `SprintHealthPanel` — zero extra API calls when the sprint board has been visited
- Filters client-side using D-08 Option B: `issue.fields.issuetype.subtask && statusCategory.key === 'indeterminate' && assignee?.displayName === jiraUserDisplayName`
- Renders up to 3 subtask rows, each as an accessible `<button>` navigating to `/issue/:key` on click or Enter keydown
- Shows `and N more` as plain text (no link/button) when overflow > 0 (D-12)
- Shows `No subtasks in progress — nice work!` empty state (D-11)
- All auth values arrive as props — no `readSecret`, no `useAuthStore`, no `useSettingsStore` (D-16)
- 200ms flicker-prevention skeleton via `useDelayedLoading`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | TDD RED — test scaffold | 57180e3d | DashboardInProgressCard.test.tsx |
| 2 | TDD GREEN — implementation | 0f3fbdf1 | DashboardInProgressCard.tsx |

## Test Results

```
Tests  5 passed (5)
```

All 5 tests pass:
1. Filter logic — only subtask+indeterminate+Alice Doe rows render (2 of 5 fixtures)
2. Cap at 3 + overflow — shows 3 rows and "and 2 more" plain-text caption
3. Click navigation — `mockNavigate` called with `/issue/PROJ-101`
4. Empty state — "No subtasks in progress — nice work!" when no matches
5. No readSecret / no useAuthStore — both mocks confirm zero calls during render

## Verification

```
npx vitest run src/routes/dashboard/DashboardInProgressCard.test.tsx  → 5/5 passed
npx tsc --noEmit                                                       → exit 0
grep cache-key DashboardInProgressCard.tsx                             → 1 match
grep readSecret|useAuthStore|useSettingsStore DashboardInProgressCard.tsx → 0 matches (only in JSDoc comment)
```

## Deviations from Plan

None — plan executed exactly as written.

The one minor note: the plan specified `and ${overflow} more` as a template literal in the JSX. The implementation uses `and {overflow} more` as a JSX expression (`<p>and {overflow} more</p>`), which produces identical DOM output. Tests confirm `screen.getByText('and 2 more')` finds the element. No behavioral difference.

## Known Stubs

None — the component is fully wired. It will produce live data when `index.tsx` (plan 60-04) passes the correct props.

## Threat Flags

No new security surface beyond what is documented in the plan's threat model. All T-60-04 through T-60-07 mitigations are implemented:
- `jiraToken` prop is passed only to `fetchSprintIssues` queryFn, never rendered to DOM
- React JSX auto-escapes `issue.fields.summary` and `issue.key` — no `dangerouslySetInnerHTML`
- `navigate('/issue/${issue.key}')` resolves a relative SPA route — not a full URL redirect

## Self-Check: PASSED

- [x] `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — exists
- [x] `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` — exists
- [x] Commit `57180e3d` — exists (test(60-02): add failing test for DashboardInProgressCard)
- [x] Commit `0f3fbdf1` — exists (feat(60-02): implement DashboardInProgressCard)
- [x] All 5 tests pass
- [x] `tsc --noEmit` exits 0
