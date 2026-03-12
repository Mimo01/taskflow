---
status: complete
phase: 03-notifications-hub
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md]
started: 2026-03-11T21:37:00Z
updated: 2026-03-11T21:42:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running dev server. Start the app fresh (`npm run tauri dev` or the built binary). App boots without errors, the main UI loads, and no crash or blank screen appears.
result: pass

### 2. TopBar Bell Icon
expected: After onboarding, the app shows a persistent header bar at the top containing a bell icon (from lucide-react). The bell is always visible regardless of which route is active.
result: pass

### 3. Unread Badge on Bell
expected: When there are unread notifications, a red badge appears on the bell icon showing the count. The count is capped — if there are more than 99 unread items, the badge shows "99+" instead of the actual number.
result: skipped
reason: No notifications available to test with

### 4. Bell Opens Notification Popover
expected: Clicking the bell icon opens a popover/dropdown panel showing the notification feed. Clicking away or pressing Escape closes it.
result: pass

### 5. Notification Row Source Borders
expected: In the notification feed, Jira notifications have an orange left border, and GitLab notifications have a purple left border, making it easy to distinguish sources at a glance.
result: skipped
reason: No notifications available to test with

### 6. Unread Rows Bold
expected: Unread notification rows show the title in bold. After reading (clicking to expand), the title becomes normal weight. Already-read notifications are not bold.
result: skipped
reason: No notifications available to test with

### 7. Notification Row Preview and Timestamp
expected: Each notification row shows a 2-line body preview (truncated) and a relative timestamp (e.g., "5 minutes ago", "2 hours ago"). Both are visible without expanding.
result: skipped
reason: No notifications available to test with

### 8. Inline Detail Expansion
expected: Clicking a notification row expands an inline detail panel below it (not a new page/modal). The detail shows: a source badge (Jira/GitLab), the entity title, author and timestamp, and the full body in a pre-formatted block. Clicking the same row again collapses the detail.
result: skipped
reason: No notifications available to test with

### 9. Mark All Read
expected: The notification popover has a "Mark all read" button/link in the header area. Clicking it marks all notifications as read: the unread badge disappears from the bell, and all row titles switch from bold to normal weight.
result: skipped
reason: No notifications available to test with

### 10. Empty State
expected: When there are no notifications at all, opening the popover shows an empty state message (not a blank panel). Something like "No notifications" or a placeholder indicating nothing to show.
result: pass

### 11. Permission Denied Banner
expected: If OS notification permission has been denied at the system level, the notification popover shows an alert/banner explaining that OS notifications are blocked. The in-app feed still works normally — only the system-level notifications are affected.
result: skipped
reason: No notifications available to test with

### 12. Notification Settings Section
expected: The Settings page has a "Notifications" section (after the Stale MR Threshold section). It contains: a poll interval input (labeled in seconds, valid range 30–300), a toggle for Jira OS notifications, and a toggle for GitLab OS notifications.
result: pass

### 13. Poll Interval Clamping
expected: In Settings, entering a poll interval value below 30 or above 300 is automatically clamped to the valid range (30 or 300 respectively) when the input loses focus or is saved. Values within range are accepted as-is.
result: pass

### 14. Notification Settings Persist
expected: Changing the poll interval or OS notification toggles in Settings and restarting the app shows the same values you set — the settings survive an app restart.
result: pass

## Summary

total: 14
passed: 7
issues: 0
pending: 0
skipped: 7

## Gaps

[none yet]
