---
phase: quick-261111-m0g
plan: 01
subsystem: notifications-ui
tags: [notifications, motion, banners, tailwind, base-ui]
requires: [261111-i2o]
provides:
  - floating chrome-less notification panel with feathered glass blur
  - notification motion lifecycle (intro, arrival, slide-out + collapse, flash, fan)
  - in-app banners and the Banner duration setting (settings v35)
key-files:
  created:
    - taskflow/src/routes/notifications/notification-motion.ts
    - taskflow/src/routes/notifications/useNotificationActions.ts
    - taskflow/src/routes/notifications/NotificationBanners.tsx
    - taskflow/src/stores/notification-banners.store.ts
  modified:
    - taskflow/src/index.css
    - taskflow/src/components/app/TopBar.tsx
    - taskflow/src/components/ui/popover.tsx
    - taskflow/src/routes/notifications/{NotificationPopover,NotificationList,NotificationRow,NotificationAvatar,notification-view}.ts*
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/hooks/useNotificationPolling.ts
    - taskflow/src/routes/settings/NotificationSettingsSection.tsx
completed: 2026-11-11
---

# Quick 261111-m0g: Floating notification panel with motion and banners

The approved prototype is now the real notifications UI: a chrome-less floating panel over a
feathered frosted blur, depth and motion on every card, a list that really scrolls, in-app banners
and a "Banner duration" setting.

## Commits

| Task | Commit | Message |
| --- | --- | --- |
| 1A | 0da467d0 | feat: floating notification panel shell, depth and scrolling list |
| 1B | 44e10027 | feat: notification motion (intro stagger, arrival, slide-out collapse, flash, fan) |
| 2 | 714c093a | feat: in-app notification banners with Banner duration setting |
| 3 fix | f87480e3 | fix: align floating panel 8px from the right edge (alignOffset sign) |
| 3 | 1eb811e2 | docs: final floating panel and banner screenshots |

Full suite at the last code commit: 4803 tests passing (301 files); biome and tsc clean.

## Design choices

- **Popover vs portal:** the Base UI Popover was kept (focus return, outside press, Esc, bell
  toggle). `PopoverContent` gained an `alignOffset` prop; all chrome is overridden with classes
  (`notif-glass relative z-0 ... border-0 bg-transparent shadow-none`). The blur lives on the
  popup's `::before` (`.notif-glass` in index.css): inset -14px, radius 30px, `var(--glass)`,
  `blur(18px) saturate(1.2)` with both `-webkit-` and standard mask intersection.
- **Virtualizer + animations:** nothing animates the virtualizer's absolutely positioned row div
  (its inline transform positions it). All motion is attributes (`data-intro/entering/leaving/flash`)
  and classes on the inner `EntryWrapper`, with card-level rules in index.css
  (`[data-notif-entry][data-leaving] [data-card]`). The collapse sets the wrapper's own height
  (measured, then 0) so the virtualizer's ResizeObserver glides the rows below up. No entry id
  changes and no remounts; browser check confirms node identity for unrelated rows.
- **Deferred removal:** Done/Clear play the exit, then call `removeItems` after `NOTIF_EXIT_MS`
  (immediately under `prefers-reduced-motion`). Closing the panel mid-exit applies pending removals
  on unmount, so a clear is never lost.
- **Bell:** the open-effect only resets on the closed -> open transition, so arrivals while open
  ring the bell and pop the badge (`notif-badge-pop`).
- **Tokens:** `--sh-rest/--sh-hover/--sh-pop/--glass/--hair` (light + .dark), `--ease-out`,
  `--spring`, plus composed `--notif-sh-*` shadow lists.

## Review warnings fixed

WR-01 (first bullet: composer focus only when `onIssueClick` exists), WR-02 (stack X labelled
"Clear N notifications"), WR-03 (`estimateEntryHeight` adds the quick-action row), WR-04 (expanded
keys pruned against the unfiltered items), WR-06 (`pendingFocus` expires after
`NOTIF_EXIT_MS + 300`), IN-01 (fan-out once per expand instead of replaying on virtual remount),
IN-02 (named geometry constants).

## Verification (browser, Chromium harness, deleted afterwards)

All assertions passed in light and dark: dark `--card` token, no border / transparent background,
`::before` blur(18px), top 51px / right 8px / height 736 (<= 800-64), list scroll
(`scrollHeight 2584 > clientHeight 688`, wheel -> `scrollTop 400`), arrival while open
(`data-entering`, `notif-enter`, 15/15 existing rows still connected), monotonic collapse
(233 -> 135, other rows connected), 3 banners in the body portal.
Chromium does not prove WKWebView blur/mask rendering: that is checkpoint step 1.

Screenshots (in `.planning/quick/261111-m0g-floating-notification-panel-with-motion-/`):
`261111-m0g-final-light.png`, `261111-m0g-final-dark.png`, `261111-m0g-banners-light.png`,
`261111-m0g-banners-dark.png`.

## Deviations from CONTEXT (pending user confirmation)

**Banner filter.** CONTEXT: banners use "the same filter as OS desktop notifications". As built,
banners follow the per-type toggles (already applied to `newItems`) and the genuinely-new guard
(not first poll, hydrated, not in `existingIds`, source cursor was not null), but NOT the OS
per-source Jira / GitLab desktop switches. Those control the OS channel; banners have their own
Off setting. Answer "keep" or "also respect the desktop switches" at the checkpoint.

## Deviations from Plan (Rules 1-3)

- **[Rule 1 - Bug]** The first `alignOffset={8}` put the panel 24px from the right edge; the sign is
  inverted for `align="end"`. Fixed to `-8` (8px), commit f87480e3.
- **[Rule 2]** Closing the panel mid-exit would have dropped the pending clear; added an unmount
  flush of pending removals (tested).
- Shadows use composed `--notif-sh-*` custom properties with Tailwind `shadow-(--var)` instead of
  inline `shadow-[var(--sh-rest),0_0_0_1px_var(--hair)]`; same computed result, shorter classes.
- Row lifecycle CSS (leave / flash) lives in index.css attribute selectors rather than long
  descendant-selector utility strings; behaviour as specified.

## Known stubs

None. No auth gates.

## Threat flags

None beyond the plan's threat model: URL handling is unchanged and shared through
`useNotificationActions` (isSafeHttpUrl gate, numeric MR ids); banners render text nodes only.

## Self-Check: PASSED

Commits 0da467d0, 44e10027, 714c093a, f87480e3, 1eb811e2 exist; 4 PNGs, notification-motion.ts,
useNotificationActions.ts, NotificationBanners.tsx and notification-banners.store.ts exist;
`taskflow/preview` removed.
