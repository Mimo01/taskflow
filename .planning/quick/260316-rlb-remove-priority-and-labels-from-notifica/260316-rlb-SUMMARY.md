# Quick Task 260316-rlb: Remove priority and labels from notifications

**Status:** Complete
**Commit:** 86b94f9

## Changes

- Removed `priority` and `labels` fields from `NotificationItem` interface (both store and service type definitions)
- Removed priority and labels from Jira API field request (`&fields=` parameter)
- Removed priority/labels chip rendering from NotificationRow and NotificationDetail
- Cleaned up all `priority: undefined` / `labels: undefined` from notification object literals
- Updated test to verify entityState chip instead of removed priority chip
