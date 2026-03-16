---
status: diagnosed
phase: 21-header-redesign-pinned-issue-tabs
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md
started: 2026-03-16T12:00:00Z
updated: 2026-03-16T12:15:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. TopBar Branding
expected: TopBar displays the app icon (small logo) and "Taskflow" text on the left side. Action buttons remain on the right side.
result: issue
reported: "I liked the app name and brand above sidebar better. Also the app logo image is not found, it is rendered as ?"
severity: major

### 2. Sidebar Branding Removed
expected: Sidebar shows only navigation links — no logo or branding block at the top.
result: pass

### 3. Pin an Issue
expected: Open any issue detail. A pin button (outline icon) appears in the header action row. Clicking it changes the icon to filled/primary. A pinned tab strip appears below the TopBar showing that issue.
result: pass
note: "User wants pinned tab layout changed to two lines: key on first line, summary on second. Current text wrapping looks weird."

### 4. Pinned Tab Display
expected: Each pinned tab shows the issue type icon, issue key, truncated summary text, and a close (X) button.
result: pass
note: "Same two-line layout feedback as Test 3"

### 5. Unpin via Tab Strip
expected: Click the X button on a pinned tab. The tab disappears from the strip. If no pinned tabs remain, the entire tab strip hides.
result: pass

### 6. Unpin via Issue Detail
expected: Open a pinned issue's detail. The pin button shows as filled/primary. Clicking it reverts to outline state and removes the tab from the strip.
result: pass

### 7. J/K Navigation in My Tasks
expected: In My Tasks view, press J to move focus down and K to move focus up through the issue list. The focused row gets a subtle background highlight with a primary-colored left border accent.
result: issue
reported: "Works but when I open the story the j/k still switches the selected story in the background even though the focus is already on the issue detail"
severity: major

### 8. J/K Navigation in Notifications
expected: In Notifications view, press J/K to navigate up/down the notification list. Press Enter on a focused notification to toggle its accordion expand/collapse.
result: issue
reported: "I don't know how to test it or it doesn't work"
severity: major

### 9. J/K Navigation in Backlog
expected: In Backlog view, press J/K to navigate issues. Navigation skips collapsed sections and respects active filters — only visible issues are navigable.
result: pass

### 10. Pinned Tabs Persist Across Reload
expected: Pin one or more issues. Reload the app. The pinned tab strip still shows the same pinned issues (persisted via local storage).
result: issue
reported: "works, but until the data is loaded there is only the issue key and check. I'd like some sort of visual representation, that the data is still loading"
severity: minor

## Summary

total: 10
passed: 6
issues: 4
pending: 0
skipped: 0

## Gaps

- truth: "TopBar displays app icon and Taskflow text on left side"
  status: failed
  reason: "User reported: I liked the app name and brand above sidebar better. Also the app logo image is not found, it is rendered as ?"
  severity: major
  test: 1
  root_cause: "Two issues: (1) app-icon.svg missing from taskflow/public/ — img src='/app-icon.svg' resolves to public/ which only has tauri.svg and vite.svg. Source file exists at taskflow/app-icon-source.svg but wrong location/name. (2) User prefers branding in sidebar, not TopBar — need to move branding block from TopBar.tsx lines 35-39 back to Sidebar.tsx before the nav block."
  artifacts:
    - path: "taskflow/src/components/app/TopBar.tsx"
      issue: "Branding block at lines 35-39 referencing missing /app-icon.svg"
    - path: "taskflow/src/components/app/Sidebar.tsx"
      issue: "Branding was removed — needs to be re-added before nav at line 47"
    - path: "taskflow/public/"
      issue: "Missing app-icon.svg file"
  missing:
    - "Copy app-icon-source.svg to taskflow/public/app-icon.svg"
    - "Move branding block from TopBar.tsx to Sidebar.tsx"
  debug_session: ""
- truth: "J/K navigation should not operate when issue detail is open"
  status: failed
  reason: "User reported: Works but when I open the story the j/k still switches the selected story in the background even though the focus is already on the issue detail"
  severity: major
  test: 7
  root_cause: "useListNavigation enabled condition in MyTasksTab (line 307) only checks !isLoading && flatIssueKeys.length > 0 but never checks if IssueDetailSheet is open. The hook supports 'enabled' boolean but main.tsx outlet context (line 290) doesn't expose selectedIssueKey to child routes."
  artifacts:
    - path: "taskflow/src/main.tsx"
      issue: "Outlet context at line 290 missing selectedIssueKey"
    - path: "taskflow/src/routes/dashboard/MyTasksTab.tsx"
      issue: "enabled condition at line 307 missing sheet-open check"
  missing:
    - "Add selectedIssueKey to outlet context in main.tsx"
    - "Add && !selectedIssueKey to useListNavigation enabled condition in all list views"
  debug_session: ".planning/debug/jk-nav-issues-phase21.md"
- truth: "J/K navigation works in Notifications view with Enter to toggle accordion"
  status: failed
  reason: "User reported: I don't know how to test it or it doesn't work"
  severity: major
  test: 8
  root_cause: "NotificationsPage component exists with correct useListNavigation integration (lines 28-32) but has no route entry in main.tsx router config (lines 328-347). The page is unreachable — users can never navigate to it."
  artifacts:
    - path: "taskflow/src/main.tsx"
      issue: "Router config missing /notifications route entry"
    - path: "taskflow/src/routes/notifications/index.tsx"
      issue: "Component is correctly implemented but unreachable"
  missing:
    - "Add /notifications route to router config in main.tsx"
  debug_session: ".planning/debug/jk-nav-issues-phase21.md"
- truth: "Pinned tabs show loading state while data is being fetched after reload"
  status: failed
  reason: "User reported: works, but until the data is loaded there is only the issue key and check. I'd like some sort of visual representation, that the data is still loading"
  severity: minor
  test: 10
  root_cause: "resolveIssueFromCache() returns undefined on cold start before queries resolve. Line 135: resolved?.summary ?? '' renders empty string. Line 133: resolved?.issueTypeName ?? '' hits default switch case rendering blue CheckSquare icon. No skeleton/spinner for loading state."
  artifacts:
    - path: "taskflow/src/components/app/PinnedTabStrip.tsx"
      issue: "Lines 118-148: no loading state when resolved is undefined"
  missing:
    - "Import Skeleton component and show it when resolved is undefined"
    - "Replace empty summary with <Skeleton className='h-3 w-20' />"
  debug_session: ".planning/debug/pinned-tab-loading-state.md"
- truth: "Pinned tabs show issue info clearly without awkward wrapping"
  status: failed
  reason: "User reported: wants two-line layout — key on first line, summary on second line. Current text wrapping looks weird."
  severity: minor
  test: 3
  root_cause: "Tab button uses single-line flex layout (h-7 flex items-center gap-1) at line 126. Key and summary are inline in same row causing text to wrap awkwardly. Needs restructuring to flex-col with key on top line and summary below."
  artifacts:
    - path: "taskflow/src/components/app/PinnedTabStrip.tsx"
      issue: "Lines 114, 126-131: single-line inline layout needs two-line vertical layout"
  missing:
    - "Restructure tab button internals to flex-col for key/summary"
    - "Increase container height from h-9 to ~h-14"
  debug_session: ".planning/debug/pinned-tab-loading-state.md"
