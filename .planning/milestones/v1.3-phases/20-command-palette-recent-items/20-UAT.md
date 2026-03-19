---
status: diagnosed
phase: 20-command-palette-recent-items
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md, 20-03-SUMMARY.md, 20-04-SUMMARY.md, 20-05-SUMMARY.md]
started: 2026-03-16T09:00:00Z
updated: 2026-03-16T09:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Open Command Palette with Cmd+K
expected: Press Cmd+K. A full-screen overlay appears with a search input auto-focused. The palette shows grouped results.
result: pass

### 2. Default State (No Search)
expected: With the palette open and no text typed (or fewer than 2 characters), you see two groups: "Recent Items" and "Navigation" (with Sprint Board, Backlog, Notifications entries).
result: pass

### 3. Fuzzy Search Results
expected: Type 2+ characters in the palette search. Results filter across multiple groups: Issues, Merge Requests, Navigation, and Actions. Items matching your query appear with fuzzy matching.
result: issue
reported: "when searching the items from 'navigation' do not appear. For example when I type 'setti' it doesn't list 'Settings' navigation"
severity: major

### 4. Search Jira Tail Item
expected: With 2+ characters typed, a "Search Jira for [your query]" item appears at the bottom of results. Clicking it triggers a search with a loading skeleton while results load.
result: pass

### 5. Keyboard Navigation Shortcuts
expected: Close the palette. Press Cmd+Shift+S — navigates to Sprint Board. Press Cmd+Shift+B — navigates to Backlog.
result: pass

### 6. Notifications Shortcut
expected: Press Cmd+Shift+N. The notifications popover opens (same as clicking the bell icon).
result: pass

### 7. Recent Items Popover
expected: A clock icon appears in the TopBar (near the notification bell). Clicking it opens a popover listing your recently opened items. If no items opened yet, shows an empty state.
result: pass

### 8. Recent Item Tracking
expected: Open any Jira issue (from search, sprint board, or notifications). Then open the Recent Items popover (clock icon). The issue you just opened appears in the list with its title.
result: issue
reported: "item is there but the title is missing"
severity: major

### 9. Create Issue Action
expected: Open palette (Cmd+K), type "create". A "Create issue" action appears in the Actions group. Selecting it closes the palette and opens the create issue dialog.
result: pass

### 10. App Actions (Theme & Notifications)
expected: Open palette (Cmd+K), type "theme". A "Toggle theme" action appears. Type "mark" — a "Mark all notifications read" action appears. Selecting Toggle theme switches light/dark mode.
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "Navigation items appear in search results when filtering with 2+ characters"
  status: failed
  reason: "User reported: when searching the items from 'navigation' do not appear. For example when I type 'setti' it doesn't list 'Settings' navigation"
  severity: major
  test: 3
  root_cause: "Navigation and Actions groups are duplicated inside both branches of the isDefaultState ternary. When query crosses the 2-char threshold, the entire item tree swaps — default-branch Navigation items unmount and search-branch ones mount as new cmdk items. This unmount/remount race with cmdk's internal filtering causes items to get score 0 and be hidden."
  artifacts:
    - path: "taskflow/src/components/app/CommandPalette.tsx"
      issue: "Navigation/Actions groups duplicated in ternary branches causing unmount/remount race"
  missing:
    - "Move Navigation and Actions groups outside the ternary so they render unconditionally — let cmdk filtering handle visibility"
  debug_session: ""

- truth: "Recently opened issue appears in Recent Items popover with its title"
  status: failed
  reason: "User reported: item is there but the title is missing"
  severity: major
  test: 8
  root_cause: "handleIssueClick in main.tsx line 125 calls pushRecentItem({ type: 'jira', id: issueKey }) without passing a title. RecentItemsPopover falls back to cache lookup which is unreliable. CommandPalette correctly passes title at line 137 but the main entry point does not."
  artifacts:
    - path: "taskflow/src/main.tsx"
      issue: "pushRecentItem called without title at line 125"
    - path: "taskflow/src/components/app/RecentItemsPopover.tsx"
      issue: "Fallback chain resolves to undefined when title was never stored"
  missing:
    - "Resolve issue title from react-query cache at click time in handleIssueClick and pass as title to pushRecentItem"
  debug_session: ".planning/debug/recent-items-missing-title.md"
