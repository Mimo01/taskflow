# Quick Task 260316-rlb: Notification polish

**Status:** Complete
**Commits:** 0d4b2bc9, d55af813, 6605a593, 8332f48d, 11fe41e1, 9dfb55f0, fac62770, 01b0ef38, eebc5991

## Changes

### Remove priority and labels (0d4b2bc9)
- Removed `priority` and `labels` fields from `NotificationItem` interface (store + service types)
- Removed priority/labels from Jira API field request and all object literals
- Updated test to verify entityState chip instead of removed priority chip

### Jira links navigate to issue detail (d55af813)
- Removed `openUrl` title click interceptor from NotificationRow
- Jira notification clicks route to in-app issue detail page via `onIssueClick`

### Unread/read contrast + hover (6605a593 → 01b0ef38)
- Unread: blue dot indicator, `bg-accent/50` background, bold title, brighter body text
- Read: transparent background, normal weight
- Hover: `hover:bg-accent` for unread, `hover:bg-muted` for read — visually distinct

### Styled change cards (eebc5991)
- Detail panel: each change rendered as bordered card with uppercase field label, strikethrough old value, arrow, bold new value
- Row preview: inline styled with bold field label and emphasized new value
