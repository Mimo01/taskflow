---
status: complete
phase: 82-my-tasks-page
source: [82-01-SUMMARY.md, 82-02-SUMMARY.md, 82-03-SUMMARY.md, 82-04-SUMMARY.md, 82-05-SUMMARY.md]
started: 2026-06-14T21:08:54Z
updated: 2026-06-14T21:12:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Start the app from scratch. App boots without errors, window opens, and My Tasks loads live data (assigned issues) without crash or blank screen.
result: pass

### 2. Navigate to My Tasks from Sidebar
expected: The sidebar shows a "My Tasks" entry with a CheckSquare icon. Clicking it opens the My Tasks page at /my-tasks.
result: pass

### 3. Hero Header + Sprint Donut + Stat Tiles
expected: Page shows a hero header, a sprint-progress donut, and three stat tiles (To Do / In Progress / Done) reflecting your real counts.
result: issue
reported: "the hero is correct but the style of 'My tasks' and the text below doesn't match the one on standup notes. The 3 cards are a little too large and I dont like todo and in progress icons, choose other"
severity: cosmetic

### 4. Stat Tiles as Single-Select Filter
expected: Clicking a stat tile (e.g. "To Do") filters the rows to that category and marks the tile active. Clicking it again clears the filter. Only one tile filters at a time.
result: pass

### 5. My Day Band Grouping with Section Headers
expected: Tasks are grouped into urgency-ordered standup-style sections (e.g. flagged/overdue first, then in-progress, to-do, etc.) with clear section headers. Subtasks nest under their parents.
result: pass

### 6. Row Anatomy Completeness
expected: Each row shows issue type icon, issue key, priority, summary (with flag/overdue badge when applicable), status pill, due date, story points, MR health badge when an MR exists, time bars, and assignee avatar on the far right.
result: pass
note: "labels metadata chip uses a folder icon — user wants a more appropriate icon (cosmetic, captured in Gaps)"

### 7. Inline Status Transition via Status Pill
expected: Clicking the status pill on a row opens a popover; selecting a new status transitions the issue inline without leaving the page.
result: pass

### 8. Row Body Click Opens PeekPanel
expected: Clicking the body of a row (not the key) slides open the PeekPanel with the issue details.
result: pass

### 9. Issue Key Click Opens Full Page
expected: Clicking the issue key (not the body) navigates to the full issue page with a breadcrumb trail back to My Tasks.
result: pass

### 10. Scope Toggle (Current Sprint / All Assigned / All Reported)
expected: A scope toggle lets you switch between Current Sprint, All Assigned, and All Reported. Switching re-fetches and shows the appropriate issue set; All-Assigned/All-Reported shows a progressive "loading more" indicator while fetching.
result: pass

### 11. Per-Section States (Loading / Empty / Error)
expected: While loading, skeleton rows appear. When you're caught up, an empty state ("You're all caught up") shows. A filter with no matches shows a "No matches" empty state.
result: pass

### 12. Persisted Scope Across Reload
expected: Change the scope, then reload/restart the app. The page reopens with your last-selected scope preserved (persisted via my-tasks.json).
result: issue
reported: "i dont like that, remove it. it shouldnt be persisted"
severity: minor

### 13. Responsive Donut Hide
expected: Opening a drawer or narrowing the content area below ~1000px hides the sprint donut (container-query driven), and the header keeps a constant height without layout jumps.
result: pass

## Summary

total: 13
passed: 11
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "My Tasks page header title/subtext style matches Standup Notes; stat tiles are appropriately sized with good icon choices"
  status: failed
  reason: "User reported: the hero is correct but the style of 'My tasks' and the text below doesn't match the one on standup notes. The 3 cards are a little too large and I dont like todo and in progress icons, choose other"
  severity: cosmetic
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Labels metadata chip on a row uses an icon appropriate for labels/tags"
  status: failed
  reason: "User reported: the labels use a folder icon (wants a more appropriate icon, e.g. a tag icon)"
  severity: cosmetic
  test: 6
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Scope selection persists across app reloads via my-tasks.json"
  status: failed
  reason: "User reported: i dont like that, remove it. it shouldnt be persisted — scope should NOT persist (reset to default on reload)"
  severity: minor
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
