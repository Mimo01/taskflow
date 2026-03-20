---
status: resolved
phase: 29-developer-tools
source: [29-01-SUMMARY.md, 29-02-SUMMARY.md, 29-03-SUMMARY.md, 29-04-SUMMARY.md]
started: 2026-03-20T10:15:00Z
updated: 2026-03-20T11:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server/service. Start the application from scratch. App boots without errors and loads the dashboard normally.
result: pass

### 2. Navigate to Dev Tools Page
expected: Go to /dev-tools in the browser (or click through the app). The Developer Tools page loads with a header, a "Clear Logs" button, and three tabs: Logs, Operations, Waterfall.
result: pass

### 3. Cmd+Shift+D Shortcut
expected: Press Cmd+Shift+D from anywhere in the app. You are navigated to the Developer Tools page.
result: pass

### 4. Native Menu Developer Tools
expected: In the native app menu bar, find a "Dev Tools" submenu containing a "Developer Tools" item. Clicking it navigates to the Developer Tools page.
result: pass

### 5. Dev Tools Settings Panel
expected: On the Developer Tools page, there is a collapsible settings panel. It contains a master toggle (Dev Tools Enabled) and granular toggles for Request Logging, Response Body Capture, Operation Profiling, Performance Waterfall, and a Retention Limit dropdown.
result: pass

### 6. Logs Tab
expected: With Dev Tools enabled and Request Logging on, perform some actions in the app (e.g., navigate to a board or open an issue). Switch to the Logs tab — API call logs appear with status codes, URLs, and operation badges (e.g., "Load Sprint Board").
result: pass

### 7. Operations Tab
expected: Switch to the Operations tab. API calls are grouped by operation label (e.g., "Load Sprint Board" groups multiple fetches). Each operation card is expandable to show individual fetch details. Ungrouped requests appear in a separate section.
result: issue
reported: "A lot of gitlab requests are ungrouped"
severity: minor

### 8. Waterfall Tab
expected: Switch to the Waterfall tab. A timeline visualization shows operations as horizontal bars with time axis. Each bar is colored by source and can expand to show nested fetch bars with relative timing.
result: issue
reported: "I don't like how the timeline looks and is used. Fix it, make it more clean and useful. Currently it is not really usable"
severity: major

### 9. Clear Logs Button
expected: Click the "Clear Logs" button on the Developer Tools page. All logs, operations, and waterfall entries are cleared.
result: pass

### 10. Old Debug Logs Removed
expected: The sidebar no longer shows a Bug icon / "Debug Logs" link. The Settings page no longer has an "Advanced" section with a debug mode toggle. Navigating to /debug-logs does NOT work (no page loads or it redirects).
result: pass

## Summary

total: 10
passed: 8
issues: 2
pending: 0
skipped: 0

## Gaps

- truth: "API calls grouped by operation label in Operations tab"
  status: resolved
  reason: "User reported: A lot of gitlab requests are ungrouped"
  severity: minor
  test: 7
  root_cause: "3 apiFetch('gitlab',...) calls in notifications.ts missing 4th operation label parameter. Notification polling runs repeatedly with 1-3 API calls per MR, generating high volume of ungrouped requests."
  artifacts:
    - path: "taskflow/src/services/notifications.ts"
      issue: "Lines 517, 521-525, 526-530 — apiFetch calls for MR notes, approvals, and pipelines missing operation labels"
  missing:
    - "Add 'Load Notifications' as 4th param to all 3 apiFetch calls in notifications.ts"
  debug_session: ".planning/debug/gitlab-ungrouped-requests.md"

- truth: "Waterfall tab shows clean, usable timeline visualization"
  status: resolved
  reason: "User reported: I don't like how the timeline looks and is used. Fix it, make it more clean and useful. Currently it is not really usable"
  severity: major
  test: 8
  root_cause: "Multiple usability problems: (1) Global timeline spans ALL operations making individual bars invisible slivers, (2) bg-muted bars barely visible, (3) expanded fetch bars misaligned with parent timeline, (4) no gridlines, (5) no tooltips, (6) duration text clips in narrow bars, (7) no parallelism indication, (8) no filtering/sorting"
  artifacts:
    - path: "taskflow/src/routes/dev-tools/WaterfallTab.tsx"
      issue: "Global timeline scoping, no gridlines, no filters"
    - path: "taskflow/src/routes/dev-tools/WaterfallBar.tsx"
      issue: "Misaligned fetch bars, invisible bg-muted color, clipped duration labels"
  missing:
    - "Per-operation scoped timelines instead of one global timeline"
    - "Proper bar coloring with source-based semantics"
    - "Vertical gridlines with time markers"
    - "Smart duration labels (inside wide bars, outside narrow ones)"
    - "Hover tooltips showing URL, method, status, duration"
    - "Parallel fetch visualization within operations"
    - "Source filtering and sort controls"
  debug_session: ""
