# Quick Task 260316-rlb: Remove priority and labels from notifications

**Status:** Complete
**Commits:** 86b94f9, 67cfcea

## Changes

### Remove priority and labels (86b94f9)
- Removed `priority` and `labels` fields from `NotificationItem` interface (store + service types)
- Removed priority/labels from Jira API field request
- Removed priority/labels chip rendering from NotificationRow and NotificationDetail
- Cleaned up all object literals
- Updated test to verify entityState chip instead of removed priority chip

### Jira links navigate to issue detail (67cfcea)
- Removed `openUrl` import and title click interceptor from NotificationRow
- Jira notification clicks now go through the row's `onClick` handler which routes to the in-app issue detail page via `onIssueClick`
