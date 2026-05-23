---
phase: quick
plan: 260318-x3d
subsystem: notifications
tags: [jira, changelog, notifications]
key-files:
  modified:
    - taskflow/src/services/notifications.ts
decisions:
  - TRACKED_FIELDS map approach chosen over long if/else chain for maintainability
  - Fix Version/s mapped with both "Fix Version" and "Fix Version/s" keys for Jira API compatibility
  - Description changes show "updated" vs "set" instead of full text diff
metrics:
  duration: 1m
  completed: "2026-03-18"
---

# Quick Task 260318-x3d: Expand Jira Changelog Field Extraction Summary

Expanded Jira changelog extraction in fetchIssueUpdates() from 2 fields (status, assignee) to 10 fields using a TRACKED_FIELDS map, surfacing description, priority, story points, sprint, fix version, labels, resolution, and issue type changes in notification bodies.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Expand changelog field extraction in fetchIssueUpdates | c6efff1 | notifications.ts |

## Implementation Details

Added a `TRACKED_FIELDS` constant mapping Jira API field names to display labels:
- `priority` -> Priority
- `Story Points` -> Story Points
- `Sprint` -> Sprint
- `Fix Version` / `Fix Version/s` -> Fix Version
- `labels` -> Labels
- `resolution` -> Resolution
- `issuetype` -> Type

Special handling for `description` field (shows "updated" or "set" instead of full text).

All new fields use the existing unicode arrow format ("Label: old -> new") that NotificationRow's parseBody() already renders as structured chips.

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED
