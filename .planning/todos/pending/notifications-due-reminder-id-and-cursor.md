---
type: todo
status: pending
created: 2026-11-11
origin: phase-95 code review (95-REVIEW.md WR-05, WR-06)
priority: medium
---

# Notifications: due-reminder id rollover + client-clock cursor

From the phase 95 code review (not fixed in phase 95):

- **WR-05:** the new due-reminder id (embeds the due date) gives existing users one duplicate card
  and OS notification after upgrade. The id is also stable across days, so "Due today" never
  replaces "Due tomorrow". Include the reminder kind/day in the id or update the item in place.
- **WR-06 (predates phase 95, data loss risk):** due reminders are stamped with the client's
  `now` and advance the Jira cursor. Server events landing between the queries, or any event when
  the client clock is ahead, are skipped permanently. Keep the cursor on server timestamps only.
