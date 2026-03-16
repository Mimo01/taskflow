---
status: resolved
trigger: "J/K navigation: fires when detail sheet open + not working in notifications"
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: Two separate issues - (1) MyTasksTab never passes selectedIssueKey to useListNavigation enabled flag, (2) NotificationsPage has no route entry in router
test: Code review of both call sites and router config
expecting: Missing enabled guard + missing route
next_action: Report findings

## Symptoms

expected: J/K stops navigating list when IssueDetailSheet is open; J/K works on /notifications page
actual: J/K continues navigating behind open sheet; notifications page may not be routable
errors: none
reproduction: Open any issue in My Tasks, press J/K — list scrolls behind sheet
started: Since J/K was added in phase 21-03

## Eliminated

(none)

## Evidence

- timestamp: 2026-03-16
  checked: useListNavigation hook interface
  found: Hook accepts `enabled?: boolean` option (line 7) and passes it to useHotkeys (lines 24, 29, 36). The mechanism to disable J/K exists.
  implication: Callers must pass enabled=false when sheet is open

- timestamp: 2026-03-16
  checked: MyTasksTab useListNavigation call (lines 304-308)
  found: enabled condition is `!isLoading && flatIssueKeys.length > 0` — no check for whether IssueDetailSheet is open (selectedIssueKey !== null)
  implication: ROOT CAUSE #1 — J/K hotkeys remain active even when the detail sheet is open

- timestamp: 2026-03-16
  checked: MyTasksTab access to selectedIssueKey
  found: MyTasksTab gets `onIssueClick` from outlet context (line 219) but does NOT have access to the current selectedIssueKey value. The outlet context only passes the setter function, not the state.
  implication: Fix requires either (a) adding selectedIssueKey to outlet context, or (b) lifting the enabled flag differently

- timestamp: 2026-03-16
  checked: AppLayout outlet context (main.tsx line 290)
  found: Context is `{ onIssueClick, onEpicClick, openEdit, openAddSubtask, openCreateStory }` — selectedIssueKey is NOT included
  implication: All tabs (MyTasks, SprintBoard, Backlog, etc.) cannot know if the sheet is open

- timestamp: 2026-03-16
  checked: Router config (main.tsx lines 328-347)
  found: NO route entry for /notifications or NotificationsPage. The component exists at src/routes/notifications/index.tsx but is never mounted as a route.
  implication: ROOT CAUSE #2 — NotificationsPage is unreachable via routing. J/K nav code in NotificationsPage is correct but the page itself cannot be visited.

- timestamp: 2026-03-16
  checked: NotificationsPage useListNavigation call (lines 28-32)
  found: Integration is correct — uses useListNavigation with itemCount, onSelect, and enabled. Focus highlighting and scroll-into-view are implemented.
  implication: The notification J/K code is properly written; the issue is purely that the page has no route.

## Resolution

root_cause: |
  Issue 1 (J/K fires behind detail sheet): MyTasksTab passes `enabled: !isLoading && flatIssueKeys.length > 0` to useListNavigation but never checks whether the IssueDetailSheet is open. The outlet context from AppLayout (main.tsx:290) only provides setter functions (onIssueClick, etc.) but does NOT expose `selectedIssueKey` state. Therefore, no child route can know whether the sheet is open to disable its hotkeys.

  Issue 2 (Notifications J/K not working): NotificationsPage (src/routes/notifications/index.tsx) has correct useListNavigation integration but the page has NO route entry in the router config (main.tsx:328-347). The page is unreachable.

fix: |
  Issue 1: Add `selectedIssueKey` (or a boolean `isSheetOpen`) to the outlet context in AppLayout (main.tsx:290). Then in MyTasksTab (and SprintBoardTab, BacklogPage — any view using useListNavigation), add `&& !selectedIssueKey` to the enabled condition.

  Issue 2: Add a route entry for NotificationsPage in main.tsx router config, e.g. `{ path: '/notifications', element: <NotificationsPage /> }` and add the import.

verification: Code review confirmed both root causes
files_changed: []
