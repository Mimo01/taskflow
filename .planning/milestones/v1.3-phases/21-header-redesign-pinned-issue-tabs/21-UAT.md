---
status: complete
phase: 21-header-redesign-pinned-issue-tabs
source: 21-01-SUMMARY.md, 21-02-SUMMARY.md, 21-03-SUMMARY.md, 21-04-SUMMARY.md, 21-05-SUMMARY.md
started: 2026-03-16T12:00:00Z
updated: 2026-03-16T20:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Sidebar Branding
expected: Sidebar displays inline SVG app icon and "Taskflow" text at the top. Icon renders crisp at any size.
result: pass
note: "Replaced <img> with inline SVG component. User confirmed position correct and icon crisp."

### 2. Window Title Bar
expected: Window title bar is empty (no duplicate branding). App name only appears in sidebar.
result: pass

### 3. Pin an Issue
expected: Open any issue detail. A pin button appears. Clicking it pins the issue. Tab strip shows with two-line layout (key on first line, summary on second).
result: pass

### 4. Pinned Tab Display
expected: Each tab shows issue type icon (consistent size), issue key (no line wrap), truncated summary, and a centered close (X) button.
result: pass

### 5. Unpin via Tab Strip
expected: Click the X button on a pinned tab. The tab disappears. If no pinned tabs remain, the strip hides.
result: pass

### 6. Unpin via Issue Detail
expected: Open a pinned issue's detail. The pin button shows as filled/primary. Clicking it unpins and removes the tab.
result: pass

### 7. J/K Navigation in My Tasks
expected: J/K navigates the issue list. Navigation is disabled when issue detail sheet is open.
result: pass

### 8. J/K Navigation in Notifications
expected: Notifications live in popover only — no standalone route needed.
result: pass
note: "User confirmed notifications should only be in the popover. Route was reverted."

### 9. J/K Navigation in Backlog
expected: J/K navigates issues in Backlog view, skipping collapsed sections.
result: pass

### 10. Pinned Tabs Persist Across Reload
expected: Pinned tabs persist via local storage. Loading state shows skeleton while data fetches.
result: pass

### 11. Pinned Tabs Scroll on Small Screens
expected: On narrow viewports, pinned tabs scroll horizontally. No overflow dropdown. All tabs accessible via scroll.
result: pass

### 12. Drag to Reorder Pinned Tabs
expected: Drag a tab to reorder. Ghost clone follows cursor. Dashed placeholder shows drop position. Original tab collapses. Dropping in original position does not open the issue.
result: pass

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
