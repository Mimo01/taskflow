---
phase: quick-261111-ezr
plan: 01
subsystem: notifications-ui
tags: [notifications, styling, tailwind]
key-files:
  modified:
    - taskflow/src/routes/notifications/NotificationRow.tsx
    - taskflow/src/routes/notifications/NotificationAvatar.tsx
    - taskflow/src/routes/notifications/NotificationRow.test.tsx
decisions:
  - "Unread tint = blue-500 8% into card (tuned from 6%), ring-blue-500/30; not --primary (grey)"
  - "Hover = accent 50% mixed into per-state --card-bg; tray shares --card-hover"
---

# Quick 261111-ezr: Tinted unread notification cards

Unread cards use a `--card-bg` surface (blue-500 8% mixed into card) with `ring-blue-500/30`; the unread dot and its extra left padding are gone (symmetric `px-3` / `density-compact:px-2.5` / `density-comfortable:px-3.5`). Read cards are unchanged (`bg-card ring-foreground/10`). Hover is `color-mix(accent 50%, var(--card-bg))`, so the tray and its fade use the same colour as the hovered card. The badge cut-out ring is `ring-(--card-bg)`. STYLE CONTRACT A and H updated.

## Final values (tuned from screenshots)
- Tint: 8% (upper end of the 5-8% range). 6% was clear in light but too faint in dark.
- Ring: blue-500/30 (unchanged), visible in both themes.
- Hover accent share: 50% (unchanged). Hover is distinguishable from rest in both themes, though it desaturates the blue toward grey (accent is neutral); the unread hover card is still bluer than the read hover card in light, close to neutral dark grey in dark. No seam at the tray.

Screenshots: `261111-ezr-light.png`, `261111-ezr-dark.png` (rows: unread, read, unread+hover, read+hover; default density). Hover was simulated in a throwaway vite page by forcing background to `var(--card-hover)` and the tray to opacity 1. Compact and comfortable density were not screenshotted (padding is covered by unit tests).

## Commits
- 8e745908: code + tests (6% tint)
- Follow-up commit: tint 8% + summary + screenshots

## Deviations
None to plan scope. Tint changed 6% -> 8% per Task 2 tuning instructions.

## Self-Check: PASSED

## Redesign after review (3ba843e4) — FINAL
User found the flat 8% tint "ok but do something more interesting". Four variants were rendered (gradient wash, edge stripe, avatar halo, lifted glow); user picked **avatar halo + lifted glow**:
- Unread: --card-bg = card (white/dark card), ring-blue-500/45, shadow 0 0 0 3px blue/10 + 0 6px 18px -8px blue/55; avatar halo span (ring-2 blue-500 / dark blue-400, rounded-full or rounded-[10px] for CI/due tiles); time semibold text-blue-600 / dark:text-blue-400.
- Read: --card-bg = muted 40% (dark 20%) over popover = the list surface, ring-foreground/10, avatar wrapper opacity-70.
- Halo rendered in both states (opacity toggle) so read/unread is still classes-only.
- Screenshots replaced with the final design (rows 2 and 5 forced hover). Full suite 4718 passed. Approved by user 2026-11-11.
