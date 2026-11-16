---
quick_id: 261116-fe7
status: complete
commits: [741073c9]
---

# Quick 261116-fe7: Notifications data-loss fixes — Summary

**Jira notification polls no longer silently drop items.**

- **Paged polls.** All four Jira queries (issue updates, mentions, all comments, due dates) fetched one page of 20. Because the cursor then moved to the newest item, anything older in the window was lost for good. `searchAllNotificationPages` now pages through the results: 50 per page, stepping by what Jira actually returns, at most 20 pages (1000 issues) per query per poll. A failed later page keeps what was already fetched.
- **Server-time cursor (WR-06).** Due reminders carry `createdAt = client now` and no longer move the Jira cursor, so events that land between queries, or while the client clock is ahead, are no longer skipped.
- **Due-today id (WR-05) and a timezone label bug.** `new Date('YYYY-MM-DD')` is UTC midnight. East of UTC, an issue due today was labelled "Due tomorrow" until 01:00/02:00 local time. The comparison now uses local calendar-date strings. On the due day the id gets `-today`, so "Due today" arrives instead of being deduped against the earlier "Due tomorrow" card. The day-before id is unchanged, so stored reminders keep deduping.

## Tests
Four new tests: paging across an instance-capped page size, keeping earlier pages when a later page fails, local-day labels and ids with a pinned clock, and a due reminder not advancing the cursor. Three of them fail against the HEAD sources (the later-page guard passes either way). Full suite on commit: 339 files, 5310 tests passed.

## Noted, not changed
- Query D's JQL is `duedate >= now() AND duedate <= endOfDay("+1")`. `duedate` is date-only, so on the due day `duedate >= now()` may exclude the issue in Jira DC. If so, "Due today" reminders only appear through the label path for timezone-shifted dates. This needs a live check before changing it to `startOfDay()`, so I added it to the `notifications-due-date-overdue` todo instead of guessing.
