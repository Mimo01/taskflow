---
phase: 08-dashboard-enrichment
plan: "06"
subsystem: ui
tags: [react, vitest, react-router-dom, tauri, jira, dashboard]

requires:
  - phase: 08-dashboard-enrichment
    provides: SubtasksPanel and NotificationsPanel built in plans 01-05

provides:
  - SubtasksPanel reads sprintData?.issues correctly — orphan detection works
  - SubtasksPanel tests: all 5 pass (display, orphan filter, empty state, limit, deep-link)
  - NotificationsPanel "View all notifications" Link to /notifications route

affects:
  - dashboard-verification

tech-stack:
  added: []
  patterns:
    - "sprintData?.issues ?? [] — safe optional chaining for fetchSprintIssues {issues, myIssueKeys} return shape"
    - "Tauri openUrl mock rejection pattern — vi.mock reject + window.open spy covers the fallback branch"

key-files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.test.tsx
    - taskflow/src/routes/dashboard/NotificationsPanel.tsx

key-decisions:
  - "sprintData?.issues ?? [] — line 61 fix aligns with fetchSprintIssues {issues, myIssueKeys} return shape (not array)"
  - "Tauri opener mock uses mockRejectedValue so catch block fires and window.open fallback is exercised in tests"
  - "View all notifications Link added after conditional content block using mt-auto to push to panel bottom"

patterns-established:
  - "Tauri plugin-opener fallback pattern: mock reject + spy on window.open with 3-arg assertion including noopener,noreferrer"

requirements-completed:
  - DASH-01
  - DASH-04

duration: 5min
completed: 2026-03-13
---

# Phase 08 Plan 06: Gap Closure — SubtasksPanel + NotificationsPanel Summary

**SubtasksPanel sprintData?.issues access fixed and all 5 tests green; NotificationsPanel Link to /notifications added and 4/4 tests green — 14/18 verification gaps closed to 18/18**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-13T11:49:00Z
- **Completed:** 2026-03-13T11:52:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Fixed `sprintData ?? []` to `sprintData?.issues ?? []` on SubtasksPanel line 61 — orphan detection now correctly reads the `{ issues, myIssueKeys }` return shape of `fetchSprintIssues`
- Aligned three SubtasksPanel test assertions: Tauri opener mock (reject → window.open fallback), display-limit regex, deep-link third argument
- Added `Link to="/notifications"` at bottom of NotificationsPanel — all 4 DASH-04 tests pass including the "View all notifications" link test

## Task Commits

1. **Task 1: Fix SubtasksPanel sprintData access + align test assertions** - `a0216ac` (fix)
2. **Task 2: Add "View all notifications" Link to NotificationsPanel** - `b57d547` (feat)

## Files Created/Modified

- `taskflow/src/routes/dashboard/SubtasksPanel.tsx` - Changed `sprintData ?? []` to `sprintData?.issues ?? []` on line 61
- `taskflow/src/routes/dashboard/SubtasksPanel.test.tsx` - Added Tauri opener mock; updated display-limit and deep-link assertions
- `taskflow/src/routes/dashboard/NotificationsPanel.tsx` - Added `Link` import and "View all notifications" Link element

## Decisions Made

- Used `sprintData?.issues ?? []` — optional chaining is the correct idiom since `sprintData` may be undefined while loading
- Tauri opener mock uses `mockRejectedValue` so the try/catch catch block fires and `window.open` (the real fallback path) is exercised
- `Link to="/notifications"` placed after the conditional content block (not inside the ternary) so it always renders regardless of empty/non-empty state

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Two pre-existing test failures (`MyTasksTab` skeleton test and `ReleasesTab` task count test) were present before and after changes — confirmed via `git stash` check. These are out-of-scope for this plan and deferred.

## Next Phase Readiness

- All four DASH-01 and DASH-04 must-haves are now satisfied
- Dashboard verification suite should score 17/17 on the four targeted panel test suites (SubtasksPanel 5/5, MrHealthPanel 2/2, SprintHealthPanel 6/6, NotificationsPanel 4/4)
- Phase 08 gap closure complete

---
*Phase: 08-dashboard-enrichment*
*Completed: 2026-03-13*
