---
type: todo
status: pending
created: 2026-11-10
origin: phase-95 (95-06 UAT review)
priority: medium
---

# Notifications: due reminders can't show "overdue" / "due in Nd"

The due-date query already requests `fields=duedate` but the NotificationItem doesn't carry it, so
cards only parse "Due today/tomorrow" from the body text. Pass `dueDate` through on the item and render
`due in 3d` / `overdue 2d` (red) on the card.
