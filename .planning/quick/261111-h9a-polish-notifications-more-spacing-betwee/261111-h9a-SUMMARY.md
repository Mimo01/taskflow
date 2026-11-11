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

## Round 2 (same day) — FINAL
User: ink halo "quite plain, add a little colour but match the app"; then mid-turn: "bold border on the card is enough, no colour there" and "read notifications are greyed out, I don't like that".
- Unread avatar halo = the notification's own event colour (`EventStyle.halo`, static `ring-*` classes mirroring the verb colour; invariant test in notification-colours.test.ts). Chosen "1 · Event-colour halo" from 4 rendered variants (`*-colour-variants-*.png`; others: + card tint, + coloured time, single soft blue).
- Unread card border = `ring-2 ring-foreground/25` (bold, neutral). No shadow.
- Read cards: card surface (no longer the muted list colour), foreground title, full-opacity avatar. Time stays muted.
- Final screenshots of the shipped classes: `*-final-light.png`, `*-final-dark.png`.
- Commit 0e61ce81. Notifications tests 187/187, full suite 4719 passed.

## Round 3
User: card outline "a bit much". Rendered 2px/25, 1.5px/20, 1px/30, 1px/22 (`*-outline-weights-*.png`); shipped **ring-[1.5px] ring-foreground/20** (1px too close to read cards in dark). Commit 839ef9e0.
