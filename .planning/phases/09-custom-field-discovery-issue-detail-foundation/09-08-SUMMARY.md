---
phase: 09-custom-field-discovery-issue-detail-foundation
plan: "08"
subsystem: ui
tags: [react, jira, sheet, tanstack-query, zustand, search, notifications]

# Dependency graph
requires:
  - phase: 09-07
    provides: IssueDetailSheet component + SprintBoardTab and MyTasksTab wired as entry points

provides:
  - IssueDetailSheet accessible from search results (SearchOverlay Jira results call onIssueClick)
  - IssueDetailSheet accessible from Jira notification rows (NotificationPopover extracts issue key)
  - IssueDetailSheet accessible from Dashboard SubtasksPanel rows
  - Global sheet state lifted to AppLayout in main.tsx — sheet accessible from any route
  - Dashboard/index.tsx adds local selectedIssueKey + IssueDetailSheet for SubtasksPanel click-through

affects:
  - Phase 10+ (global IssueDetailSheet at AppLayout available for any new entry points)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Global IssueDetailSheet state lifted to AppLayout (main.tsx) with onIssueClick prop threading
    - Issue key extraction from NotificationItem.entityTitle ("PROJ-123: ...") with /browse/ URL fallback
    - Dual fallback for optional onIssueClick — sheet when provided, browser open otherwise (backward compat)

key-files:
  created: []
  modified:
    - taskflow/src/main.tsx
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/components/app/SearchOverlay.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/SubtasksPanel.tsx

key-decisions:
  - "Global IssueDetailSheet lifted to AppLayout (not Dashboard) — search and notifications live in TopBar (global shell), not inside a route, so the sheet must be at the same level"
  - "onIssueClick prop threading used (not React context) — consistent with existing codebase which has zero context usage; keeps data flow explicit"
  - "Dashboard/index.tsx gets its own selectedIssueKey for SubtasksPanel — Dashboard is a route component below AppLayout; AppLayout sheet handles search/notifications, Dashboard sheet handles panel clicks"
  - "Jira issue key extracted from NotificationItem.entityTitle first (PROJ-123: ...), URL fallback (/browse/PROJ-123) — entityTitle is always set, URL is optional"
  - "SearchOverlay closes overlay when onIssueClick fires — consistent UX: search result click opens sheet, overlay dismisses"

patterns-established:
  - "AppLayout-level IssueDetailSheet: const [selectedIssueKey, setSelectedIssueKey] = useState<string|null>(null) at AppLayout root; threaded as onIssueClick to TopBar → SearchOverlay and NotificationPopover"
  - "Optional onIssueClick with browser fallback: onIssueClick ? onIssueClick(key) : openJiraIssue(url, key) — enables progressive enhancement without breaking existing behavior"

requirements-completed: [ISSUE-01]

# Metrics
duration: 4min
completed: 2026-03-14
---

# Phase 9 Plan 08: IssueDetailSheet Entry Points (Search + Notifications) Summary

**Global IssueDetailSheet lifted to AppLayout with prop-threaded onIssueClick — search results and Jira notification rows now open the sheet in-app rather than the browser**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-14T10:26:01Z
- **Completed:** 2026-03-14T10:30:00Z
- **Tasks:** 1 (+ checkpoint)
- **Files modified:** 6

## Accomplishments

- `AppLayout` in `main.tsx` gains `selectedIssueKey` state and renders `IssueDetailSheet` globally — any entry point in the app can trigger it via `onIssueClick`
- `TopBar` accepts `onIssueClick` and threads it to both `SearchOverlay` and `NotificationPopover`
- `SearchOverlay`: clicking a Jira task result calls `onIssueClick(task.key)` and closes the overlay; GitLab MR results still open the inline `SearchResultPanel`
- `NotificationPopover`: clicking a Jira notification extracts the issue key from `entityTitle` (with URL fallback) and calls `onIssueClick`; GitLab notifications fall back to inline `NotificationDetail`
- `SubtasksPanel` on the Dashboard overview gains `onIssueClick` prop; rows route through the sheet when wired, fall back to browser open otherwise
- `Dashboard/index.tsx` adds `selectedIssueKey` state + `IssueDetailSheet` at JSX root for both PM and developer layouts

## Task Commits

1. **Task 1: Wire IssueDetailSheet into Dashboard (search + notifications entry points)** - `44bd6f0` (feat)

## Files Created/Modified

- `taskflow/src/main.tsx` - Added `useState` import, `selectedIssueKey` state in AppLayout, `IssueDetailSheet` import and render at layout root; `TopBar` now receives `onIssueClick={setSelectedIssueKey}`
- `taskflow/src/components/app/TopBar.tsx` - Added `TopBarProps` interface with `onIssueClick`; threads it to `SearchOverlay` and `NotificationPopover`
- `taskflow/src/components/app/SearchOverlay.tsx` - Added `onIssueClick` prop; Jira task clicks call `onIssueClick(task.key)` + `onClose()` when prop provided; falls back to inline panel otherwise
- `taskflow/src/routes/notifications/NotificationPopover.tsx` - Added `extractJiraIssueKey` helper; `onIssueClick` prop; Jira notification row clicks call `onIssueClick` with extracted key
- `taskflow/src/routes/dashboard/index.tsx` - Added `selectedIssueKey` state, `IssueDetailSheet` import, sheet rendered at both PM and developer layout roots; `SubtasksPanel` wired with `onIssueClick`
- `taskflow/src/routes/dashboard/SubtasksPanel.tsx` - Added optional `onIssueClick` prop; row buttons call `onIssueClick(key)` when provided, `openJiraIssue(url, key)` otherwise

## Decisions Made

- **Global sheet at AppLayout, not Dashboard**: Search and notifications render inside `TopBar` (part of `AppLayout`), not inside any route. Lifting the sheet to `AppLayout` was the only correct level for those entry points.
- **Prop threading over context**: The codebase uses zero `createContext`/`useContext` — kept consistent by threading `onIssueClick` as explicit props.
- **Dashboard gets its own sheet instance**: Dashboard is a route-level component that cannot access AppLayout's `setSelectedIssueKey` without context or prop drilling through the router. Two sheet instances are harmless — only one can be open at a time since they have independent `issueKey` state.
- **Key extraction from entityTitle**: `NotificationItem` has no dedicated `issueKey` field. `entityTitle` format is always `"PROJ-123: Fix login bug"` for Jira items, making `split(':')[0]` extraction reliable. `/browse/PROJ-123` URL extraction is the fallback.

## Deviations from Plan

### Auto-fixed / Extended Scope

**1. [Rule 3 - Blocking] Search and notifications are in TopBar (global), not Dashboard**
- **Found during:** Task 1
- **Issue:** The plan assumed search and notification components exist inside `Dashboard/index.tsx`. They actually live in `TopBar` (global AppLayout shell). Modifying only `Dashboard/index.tsx` would not wire those entry points.
- **Fix:** Lifted IssueDetailSheet to AppLayout level; added onIssueClick prop to TopBar, SearchOverlay, and NotificationPopover — the minimum required to make search and notification entry points work.
- **Files modified:** `main.tsx`, `TopBar.tsx`, `SearchOverlay.tsx`, `NotificationPopover.tsx` (in addition to planned `dashboard/index.tsx`)
- **Verification:** TypeScript clean compile on all modified files; no new test failures introduced.
- **Committed in:** `44bd6f0` (Task 1 commit)

---

**Total deviations:** 1 architectural discovery (handled via Rule 3)
**Impact on plan:** Required scope expansion to the correct architectural level. All new file modifications were minimal (prop threading only). No behavior regressions.

## Issues Encountered

- Pre-existing test failures in `SubtasksPanel.test.tsx` (4 tests), `MyTasksTab.test.tsx` (1 test), and `ReleasesTab.test.tsx` (1 test) were present before this plan's execution — documented in 09-07 SUMMARY. My changes did not introduce new failures.

## Next Phase Readiness

- All four entry points now open `IssueDetailSheet` on click: Sprint Board, My Tasks, Search results (Jira), Notification rows (Jira)
- The global sheet at AppLayout is available for any future entry points without additional lifting
- User verification checkpoint pending — requires live app test to confirm sheet behavior across all four entry points

---
*Phase: 09-custom-field-discovery-issue-detail-foundation*
*Completed: 2026-03-14*
