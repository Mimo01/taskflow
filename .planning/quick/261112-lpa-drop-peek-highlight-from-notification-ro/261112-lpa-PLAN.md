---
quick_id: 261112-lpa
mode: quick
---
# Quick 261112-lpa: Drop peek highlight from notification rows

User report: "Sometimes when a notification arrives it is darker and with a left bar — I don't like it."

Cause: NotificationRow applied PEEKED_ROW_CLASS (lib/peek-highlight.ts: `bg-primary/10` + 3px inset
primary leading-edge shadow) whenever the row's Jira issue was open in the peek sidebar. Banners were
already exempted in abe9ffbe; list rows in the notifications panel still got it.

## Task 1 — remove peek highlight from NotificationRow (all variants)
- files: taskflow/src/routes/notifications/NotificationRow.tsx, NotificationRow.test.tsx
- action: drop useIsPeeked / PEEKED_ROW_CLASS / data-peeked from NotificationRow; add regression test
- verify: notifications suite, biome, tsc
- done: peeked-issue rows render plain bg-card / read fill, no tint, no bar
