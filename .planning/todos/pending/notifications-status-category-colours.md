---
type: todo
status: pending
created: 2026-11-10
origin: phase-95 (95-06 UAT review)
priority: medium
---

# Notifications: status pill colours are guessed from status names

Changelog items carry only status *names*, so `statusCategoryGuess()` in
`routes/notifications/notification-view.ts` maps them to new/indeterminate/done by keyword. Custom
statuses can get the wrong colour. Look up the real status category from the app's cached
Jira status metadata (same source as board/backlog pills) and fall back to the guess.
