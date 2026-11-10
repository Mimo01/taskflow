---
type: todo
status: pending
created: 2026-11-10
origin: phase-95 (95-06 UAT review)
priority: high
---

# Notifications: Jira polls drop items beyond maxResults=20

`services/notifications.ts` Jira queries (issue updates, comments, mentions, due dates) each fetch a
single page with `maxResults=20` and keep only that page. On a busy day, more than 20 matching issues
in the polling window means notifications are silently dropped. This is the recurring "fetch one capped page"
pitfall (see memory: fetch-once page-cap).

Fix: page through results (startAt/total) until the polling window is covered, or bound by a sane
max with a visible "more activity" signal. Add a test with >20 issues.
