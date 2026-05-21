---
plan: 60-05
phase: 60-static-dashboard-welcome-screen
status: complete
started: "2026-05-21T06:55:00Z"
completed: "2026-05-21T09:02:00Z"
commits:
  - b2e9bd5e
  - 3c1b6527
  - 614cdcd2
self_check: PASSED
---

# Plan 60-05 Summary — In-Progress Card Navigation Fix

## What Was Built

Fixed the breadcrumb regression in `DashboardInProgressCard`: subtask row clicks now route through `handleIssueClick` in `main.tsx` (via outlet context) instead of calling `useNavigate` directly. This restores the breadcrumb trail so users can navigate back to the Dashboard after clicking into an issue.

## Key Files

### Created
*(none)*

### Modified
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — removed `useNavigate`; added `onIssueClick: (key: string) => void` prop; both `onClick` and `onKeyDown` handlers now call `onIssueClick(issue.key)`
- `taskflow/src/routes/dashboard/index.tsx` — added `useOutletContext` import; destructures `onIssueClick` from outlet context; passes it as prop to `DashboardInProgressCard`
- `taskflow/src/routes/dashboard/DashboardInProgressCard.test.tsx` — replaced `mockNavigate`/`useNavigate` mock with `onIssueClick: vi.fn()` in `defaultProps`; test 3 now asserts `onIssueClick` was called with `'PROJ-101'`
- `taskflow/src/routes/dashboard/index.test.tsx` — added `useOutletContext` mock returning `{ onIssueClick: vi.fn() }` to prevent `TypeError` from null outlet context in tests

## Commits

1. `b2e9bd5e` feat(60-05): add onIssueClick prop to DashboardInProgressCard, remove useNavigate
2. `3c1b6527` feat(60-05): thread onIssueClick from useOutletContext through dashboard/index.tsx
3. `614cdcd2` test(60-05): update DashboardInProgressCard tests — replace navigate mock with onIssueClick spy

## Verification

- **10/10 tests pass** (5 DashboardInProgressCard + 5 index)
- **TypeScript**: no errors in modified files
- Test 3 confirms `onIssueClick('PROJ-101')` is called (key string, not full path) — breadcrumb chain: click → `onIssueClick(key)` → `handleIssueClick` in `main.tsx` → `breadcrumbStore.push()` + `navigate('/issue/:key')`

## Deviations

None.

## Self-Check

| Must-Have | Status |
|-----------|--------|
| Clicking subtask row navigates to /issue/:key AND adds Dashboard to breadcrumb trail | ✓ (breadcrumb chain restored via handleIssueClick) |
| DashboardInProgressCard does not call useNavigate directly | ✓ (removed entirely) |
| dashboard/index.tsx reads onIssueClick from useOutletContext and threads it as prop | ✓ |

**Self-Check: PASSED**
