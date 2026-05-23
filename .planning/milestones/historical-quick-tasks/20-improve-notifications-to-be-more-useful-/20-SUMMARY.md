---
phase: quick-20
plan: "01"
subsystem: notifications
tags: [notifications, ui, jira, gitlab, linkify, metadata]
dependency_graph:
  requires: []
  provides: [enriched-notification-items, notification-row-rich-ui, notification-detail-rich-ui]
  affects: [notifications-popover, notifications-feed]
tech_stack:
  added: []
  patterns: [dangerouslySetInnerHTML-linkify, tauri-openUrl, optional-fields-backward-compat]
key_files:
  created: []
  modified:
    - taskflow/src/stores/notifications.store.ts
    - taskflow/src/services/notifications.ts
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationDetail.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
decisions:
  - "linkifyText defined locally in both Row and Detail (not extracted to shared util) — avoids new file for two small identical helpers"
  - "Clickable title in NotificationRow uses span+onClick+stopPropagation (not nested button) — nested interactive elements are invalid HTML"
  - "Priority chip uses orange-50/orange-700 palette to match Jira brand; entityState uses semantic colors (green=open, purple=merged, red=closed)"
metrics:
  duration: "~2 min"
  completed: "2026-03-13"
  tasks_completed: 2
  files_modified: 5
---

# Quick Task 20: Improve Notifications to be More Useful — Summary

**One-liner:** Rich notifications with type labels, priority/label/state metadata chips, clickable titles via Tauri openUrl, and linkified body text in both row and detail panel.

## What Was Built

### Task 1: Extend NotificationItem type and populate new fields in fetchers

Added five optional fields to `NotificationItem` in both `notifications.store.ts` and `notifications.ts` (kept in sync):

- `url?` — browser-openable entity URL
- `notificationType?` — `'comment-mention' | 'issue-update' | 'mr-note'`
- `priority?` — Jira issue priority name
- `labels?` — Jira issue label names array
- `entityState?` — GitLab MR state string

Populated at fetch time:
- **fetchIssueUpdates**: extends Jira `fields` param to include `priority,labels`; sets `url=${base}/browse/${issue.key}`, `notificationType='issue-update'`, `priority` and `labels` from API
- **fetchCommentMentions**: sets `url=${base}/browse/${issue.key}`, `notificationType='comment-mention'`
- **fetchNewGitlabNotes**: sets `url=mr.web_url`, `notificationType='mr-note'`, `entityState=mr.state`

All existing notification service tests pass (15/15).

### Task 2: Update NotificationRow and NotificationDetail with rich UI

**NotificationRow.tsx:**
- Added `openUrl` import from `@tauri-apps/plugin-opener`
- Type label badge rendered above entity title when `notificationType` is set
- Entity title wrapped in `<span onClick stopPropagation openUrl>` when `url` is defined — clicking the title opens the URL without triggering the outer button's detail panel toggle
- Body preview uses `dangerouslySetInnerHTML` with `linkifyText()` to make HTTP/HTTPS URLs clickable
- Metadata chips below preview: priority (orange), labels (muted), entityState (semantic color)

**NotificationDetail.tsx:**
- Added `openUrl` import from `@tauri-apps/plugin-opener`
- Type label badge placed inline next to the source badge in a flex row
- Entity title rendered as `<button onClick openUrl>` when `url` is defined
- Metadata chips (priority, labels, entityState) after author/timestamp line
- "Open in Jira ↗" / "Open in GitLab ↗" button when `url` is defined
- Full body uses `dangerouslySetInnerHTML` with `linkifyText()` inside `<pre>`

**NotificationRow.test.tsx:**
- Added `vi.mock('@tauri-apps/plugin-opener', ...)` at top
- Added test: renders "Comment mention" label when `notificationType='comment-mention'`
- Added test: renders "High" priority chip when `priority='High'`
- All 6 tests pass

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 5 modified files exist. Both task commits verified: `5ec3cdf` (Task 1) and `2177ec3` (Task 2).
