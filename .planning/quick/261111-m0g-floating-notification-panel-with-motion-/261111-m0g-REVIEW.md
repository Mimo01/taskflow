---
phase: 261111-m0g
reviewed: 2026-11-11T00:00:00Z
depth: quick
files_reviewed: 12
files_reviewed_list:
  - taskflow/src/routes/notifications/NotificationBanners.tsx
  - taskflow/src/stores/notification-banners.store.ts
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/notifications/NotificationList.tsx
  - taskflow/src/routes/notifications/useNotificationActions.ts
  - taskflow/src/routes/notifications/notification-motion.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/components/app/TopBar.tsx
  - taskflow/src/components/ui/popover.tsx
  - taskflow/src/index.css
  - taskflow/src/routes/notifications/NotificationRow.tsx
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# 261111-m0g: Code Review Report

**Depth:** quick (targeted reads of the lifecycle, queue, and migration code; tests not reviewed)

## Summary

No blockers found. The main risks hold up:
- The settings v35 migration is correct.
- `getState()` is only read in actions and the polling callback, never in render.
- `openExternal` is always gated by `isSafeHttpUrl`.
- `getItemKey` is keyed by entry id, so the per-row collapse state follows the entry rather than the index.
- Arrival detection is seeded on mount, so a filter change does not mark rows as entering.
- The unmount flush of pending removals is present.

The defects below are mostly in the banner timer and queue edges and in timing slack.

## Warnings

### WR-01: Banner pause/resume ignores the other input channel
**File:** `taskflow/src/routes/notifications/NotificationBanners.tsx:123-127, 141-149`
**Issue:** Hover and focus share one `pause`/`resume` pair, with no state recording which of them is active. If the pointer leaves while a button inside the banner still has focus, `onMouseLeave` calls `resume()` and the timer restarts. The banner then dismisses under a user who is keyboard-focused on it. The reverse also holds: a blur while the pointer is still hovering restarts the timer. The `durationSecs` effect (line 104) also restarts the clock unconditionally, even while paused.
**Fix:** Track `hovered` and `focused` in refs. Call `resume()` only when both are false, and have the `durationSecs` effect skip `start()` while either is true.

### WR-02: First-poll flag is consumed before the fetch succeeds
**File:** `taskflow/src/hooks/useNotificationPolling.ts:168-175`
**Issue:** `isFirstPollRef.current = false` is set before `fetchNewNotifications`. If the first poll throws (network or auth), the next poll counts as a normal poll. With persisted non-null cursors, every item missed while the app was closed (up to 3) then pops up as a banner. This is the "no banners on initial load" case the focus list called out.
**Fix:** Clear the flag only after the first successful fetch and `prependItems`, or after the cursor advance.

### WR-03: Suppressed flag is never reset on unmount
**File:** `taskflow/src/routes/notifications/NotificationBanners.tsx:45-48`
**Issue:** The effect sets `suppressed` to `open` but has no cleanup. If `TopBar` or the banners unmount while the panel is open, for example on a layout switch or an HMR remount, `suppressed` stays true in the global store. Banners are then dead until the panel is opened and closed again.
**Fix:** Return `() => setSuppressed(false)` from the effect.

### WR-04: Row collapse finishes after the store removal
**File:** `taskflow/src/routes/notifications/NotificationList.tsx:343-353`, `taskflow/src/routes/notifications/notification-motion.ts:11-13`
**Issue:** The collapse starts at `NOTIF_SLIDE_MS + delay` (200ms), then waits two animation frames (about 33ms), then runs a 0.28s transition. It ends at roughly 513ms plus the delay. The store removal fires at `NOTIF_EXIT_MS + maxDelay` (500ms plus the delay). Items are removed about 13ms before the transition finishes, which gives a small visible jump. The duration is also hard-coded in the style string (`.28s`) rather than in `notification-motion.ts`.
**Fix:** Raise `NOTIF_EXIT_MS` to at least 560 and define the collapse duration as a constant used by both the style and the exit timer.

### WR-05: Row recycled by the virtualizer mid-animation replays or breaks
**File:** `taskflow/src/routes/notifications/NotificationList.tsx:327-354`, `taskflow/src/routes/notifications/NotificationPopover.tsx:156-166`
**Issue:** The `collapse` state lives in `EntryWrapper`, which the virtualizer unmounts when the row scrolls out of overscan. On remount during the 500ms exit, `collapse` resets to phase 0. The leaving card re-enters at full height and replays its slide-out from the start, then collapses late. Likewise `data-entering` is set for 450ms. A row that remounts inside that window replays the slide-in. This is rare, since overscan is 8, but it is the "rows recycled mid-animation" case.
**Fix:** Keep the leaving state on the entry rather than the row. Alternatively, pin leaving ids in the virtualizer via `rangeExtractor` so they are not unmounted until removed.

### WR-06: Fire-and-forget timers are not cleared on unmount
**File:** `taskflow/src/routes/notifications/NotificationPopover.tsx:159-165, 226-228, 252-259`
**Issue:** The `entering`, `justExpanded`, and `flashing` timeouts are never tracked or cleared. After the panel closes they call `setState` on an unmounted component. This is harmless on React 19, but they are the only timers in the feature without cleanup, unlike the exit timers. The intro timer returns a cleanup. Under React Compiler and strict-mode double effects the pattern is fragile.
**Fix:** Collect the timer ids in a ref set and clear them in the unmount cleanup, as is done for `exitTimers`.

## Info

### IN-01: Banner ordering compares ISO strings from mixed sources
**File:** `taskflow/src/stores/notification-banners.store.ts:60`
**Issue:** `createdAt` is compared as a string across Jira and GitLab. Jira timestamps often use `+0000` and GitLab uses `Z`, so the order of the top 3 can be wrong across sources. The cursor reducers in the polling hook have the same quirk.
**Fix:** Compare `Date.parse(a.createdAt)` instead.

### IN-02: Magic layout values and casts
**File:** `taskflow/src/routes/notifications/NotificationBanners.tsx:56`, `taskflow/src/routes/notifications/NotificationList.tsx:355-359`
**Issue:** `top-[60px]` and `z-[70]` are hard-coded and coupled to the TopBar height and the popover z-order. The `(style as Record<string, string | number>)['--i']` casts repeat.
**Fix:** Use a shared CSS variable for the TopBar height. Add a typed `CSSProperties & Record<\`--${string}\`, string | number>` helper.

### IN-03: Banner setting values are unvalidated at runtime
**File:** `taskflow/src/stores/settings.store.ts:34, 342`
**Issue:** `0 | 3 | 5 | 8` is a type-only constraint. A hand-edited `settings.json`, or a persisted value of an unexpected type, bypasses it. A non-number would make the `durationSecs * 1000` timer `NaN`, which `setTimeout` treats as 0, so banners vanish instantly. The migration only checks `=== undefined`.
**Fix:** In the setter and in `migrate`, coerce unknown values to 5.

---

_Reviewed: 2026-11-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
