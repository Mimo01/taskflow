---
quick_id: 261112-lpa
status: complete
commits: [ff9f66d1]
---
# Quick 261112-lpa Summary

The darker fill + left bar was the peek-sidebar highlight (PEEKED_ROW_CLASS) applied to notification
rows whose issue was open in the peek sidebar. Removed from NotificationRow entirely (useIsPeeked,
PEEKED_ROW_CLASS import, data-peeked attr). PEEKED_ROW_CLASS stays for other lists (backlog etc.).

- Regression test: NotificationRow.test.tsx "list row for the peeked issue gets no peek tint or leading-edge bar"
- Verification: src/routes/notifications 291/291; full pre-commit suite 5043 passed; biome + tsc clean
- Executed inline (3-line change), no planner/executor agents
