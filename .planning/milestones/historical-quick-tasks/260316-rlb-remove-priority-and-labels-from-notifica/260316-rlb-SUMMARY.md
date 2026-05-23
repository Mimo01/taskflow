# Quick Task 260316-rlb: Notification polish

**Status:** Complete
**Commits:** 86b94f9, 67cfcea, d61eb26, e5cac9a, eccf7e4, 354d95c, 4e884ed, 401f8d1, e79a9d5

## Changes

### Remove priority and labels (86b94f9)
- Removed `priority` and `labels` fields from `NotificationItem` interface (store + service types)
- Removed priority/labels from Jira API field request and all object literals
- Updated test to verify entityState chip instead of removed priority chip

### Jira links navigate to issue detail (67cfcea)
- Removed `openUrl` title click interceptor from NotificationRow
- Jira notification clicks route to in-app issue detail page via `onIssueClick`

### Unread/read contrast + hover (d61eb26 → 401f8d1)
- Unread: blue dot indicator, `bg-accent/50` background, bold title, brighter body text
- Read: transparent background, normal weight
- Hover: `hover:bg-accent` for unread, `hover:bg-muted` for read — visually distinct

### Styled change cards (e79a9d5)
- Detail panel: each change rendered as bordered card with uppercase field label, strikethrough old value, arrow, bold new value
- Row preview: inline styled with bold field label and emphasized new value
