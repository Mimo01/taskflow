---
phase: quick-261111-h9a
plan: 01
status: complete
subsystem: notifications-ui
key-files:
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationAvatar.tsx
    - taskflow/src/routes/notifications/NotificationList.tsx
    - taskflow/src/routes/notifications/notification-view.ts
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
decisions:
  - "Unread = 'D · Ink halo': card surface + ring-foreground/15, no shadow/glow, foreground avatar halo, semibold foreground time. No blue anywhere in the unread state."
  - "Card gap 6→8px (compact 4→6, comfortable 8→10)"
---

# Quick 261111-h9a: Ink-halo unread + 8px gap

Replaced the 261111-ezr blue glow (ring-blue-500/45, blue halo + drop glow, blue avatar ring, blue time) with neutral ink, keeping the lift/sink structure: unread cards are the card surface with a slightly stronger foreground ring, read cards stay flat on the list surface with a 70% avatar. Gap between cards raised to 8px; the virtualizer estimate follows (+2px).

Chosen from four rendered neutral variants (`261111-h9a-variants-light.png` / `-dark.png`; the variants there show a 10px gap, the shipped gap is 8px). Variant B (shadow only) was weak in dark mode.

Executed inline (5-file class change), no planner/executor agents.

## Commits
- 1e9aebee: code + tests

## Verification
Notification tests 186/186; biome clean; tsc clean; full suite 4718 passed (pre-commit).
