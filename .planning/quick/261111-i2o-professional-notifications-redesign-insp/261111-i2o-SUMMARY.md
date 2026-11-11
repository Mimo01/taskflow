---
phase: quick-261111-i2o
plan: 01
subsystem: notifications
tags: [notifications, ui, stacks, quick-actions, ledger]
requires: []
provides:
  - stackEntries view-model post-pass (stack / stack-header entries)
  - quickActionFor resolver (Reply / Review / Open MR / View pipeline)
  - composer-focus one-shot flag store
  - Ledger notification card, stack card, stack header, single-row shell
affects:
  - taskflow/src/routes/notifications/*
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/components/app/TopBar.tsx
tech-stack:
  added: []
  patterns:
    - view-model post-pass over buildEntries (stack entries re-derive bucket headers)
    - one-shot zustand flag consumed by a hook-subscribed effect
key-files:
  created:
    - taskflow/src/stores/composer-focus.store.ts
  modified:
    - taskflow/src/routes/notifications/notification-view.ts
    - taskflow/src/routes/notifications/notification-colours.ts
    - taskflow/src/routes/notifications/NotificationAvatar.tsx
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationList.tsx
    - taskflow/src/routes/notifications/NotificationPopover.tsx
    - taskflow/src/routes/dashboard/CommentComposer.tsx
    - taskflow/src/components/app/TopBar.tsx
decisions:
  - "Direction picked by the user: B Ledger. All offered defaults kept (bell counts cards, 60m same-actor merge stays and merged cards stack, popover 30rem, source filter as dropdown, list px-3 pt-2)."
  - "Colour carrier = the action phrase, only for mention / review / assignment / pipeline failed / due; plain updates, comments and approvals are neutral."
  - "Unread signal = surface only (bg-card + ring-foreground/25 + semibold title); read = transparent + faint ring + regular title, never dimmed."
  - "EventStyle.halo removed; EventStyle.badge kept (still asserted by tests) but the avatar badge is always neutral."
metrics:
  commits: 4
  tests: "4763 passed, 2 skipped, 7 todo (full suite, 298 files)"
completed: 2026-11-11
---

# Phase quick-261111-i2o: Notifications redesign (Ledger) Summary

Ledger-direction notifications popover: per-issue/MR stacks with peek edges, a corner Done X plus hover cluster, Reply/Review/View pipeline pills, and a single-row shell.

## What was built

- **View model:** `stackEntries()` groups 2+ cards of one issue/MR into one `stack` at the newest card (older cards leave their buckets, empty bucket headers dropped). An expanded entity becomes `stack-header` plus its member events with unchanged ids. `stackIds()` includes Jira duplicate comment copies. `countUnreadCards` is untouched, so the bell and chips count cards.
- **Card (Ledger):** neutral small badge, no halo, colour only on the action phrase of actionable events. Unread = `bg-card` + `ring-foreground/25` + semibold title; read = transparent + faint ring + regular title; text colours are identical so nothing is dimmed. Cards hug their content: the quick-action row exists only when the card has an action, the stack wrapper is `pb-3` (matching the +12 height estimate).
- **Hover:** a round X (Done, `aria-label="Clear notification"`) at the card corner and the read/unread + open-in-browser cluster. Both are keyed to that card's own `group/row`, so only the hovered or focused card shows them (stack peek edges are not part of the group). The scroller has `px-3 pt-2` so the X is not clipped.
- **Stacks:** `StackCard` (two peek edges via ring + surface, no shadow, `+N`), `StackHeader` (ref + title, Show less, Clear). Clear and the corner X on a collapsed stack remove every id including duplicates.
- **Quick actions:** Jira Reply sets `composerFocus`, opens the issue, marks read, closes; `CommentComposer` focuses its textarea and clears the flag. GitLab Reply / View pipeline use `openExternal` only for `isSafeHttpUrl` URLs. Review / Open MR open `/mr/:projectId/:iid` with numeric ids only.
- **Shell:** one h-11 row (title, light segmented Unread|All, "All sources" dropdown with per-source unread counts, Mark all read icon, overflow). No filter band, no inverted pressed state. TopBar popover width 40rem -> 30rem.
- **Keyboard:** Enter/Space/ArrowRight expand a stack (focus lands on the first member); Esc/ArrowLeft inside an expanded stack collapse it and refocus the stack (Esc is stopped so the popover stays open); e/Delete/Backspace and u act on the whole collapsed stack.

## Commits

- `feat`: stackEntries view model and quick-action resolver
- `feat`: composer focus flag
- `feat`: Ledger notifications redesign (cards, stacks, shell, keyboard)
- `docs`: final screenshots and this summary

(Direction previews: `docs(261111-i2o): render notification directions A/B/C light+dark previews`, 5eeaf559.)

## Deviations from Plan

- **Commit split:** the plan's commit 2 (card, stack, shell, keyboard) is one commit together with the NotificationList and Popover wiring, and the composer-focus store was committed on its own. The pre-commit hook type-checks the whole working tree, so the order view model -> composer flag -> UI still passed the hook at each step.
- **[Rule 3] Avatar size:** `CachedAvatar` only accepts sizes 16-40 in fixed steps, so the Ledger 32px lead uses `size={32}`.
- **Stray note:** the harness sprint line of the 3-field sample card is not shown in the screenshot because the parser did not produce a Sprint row for that placeholder body; this is existing parser behaviour, not a regression.

## Known Stubs

None.

## Verification

- Full vitest suite via the pre-commit hook on each code commit: 298 files passed, 4763 tests passed (2 skipped, 7 todo).
- `tsc --noEmit` and `biome check` clean on the touched files.
- Final light and dark screenshots of the REAL `NotificationPopover` (seeded with placeholder data), dark verified by the `--card` = `oklch(0.205 0 0)` assertion: `261111-i2o-final-light.png`, `261111-i2o-final-dark.png`.
- Preview harness deleted (it was never tracked).

## Self-Check: PASSED
