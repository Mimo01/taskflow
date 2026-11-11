---
phase: 261111-i2o
reviewed: 2026-11-11T00:00:00Z
depth: quick
files_reviewed: 15
files_reviewed_list:
  - taskflow/src/components/app/TopBar.tsx
  - taskflow/src/routes/dashboard/CommentComposer.tsx
  - taskflow/src/routes/notifications/NotificationAvatar.tsx
  - taskflow/src/routes/notifications/NotificationList.tsx
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/notifications/notification-colours.ts
  - taskflow/src/routes/notifications/notification-view.ts
  - taskflow/src/routes/notifications/useUnreadCardCount.ts
  - taskflow/src/stores/composer-focus.store.ts
findings:
  critical: 0
  warning: 6
  info: 3
  total: 9
status: issues_found
---

# Phase 261111-i2o: Code Review Report

**Reviewed:** 2026-11-11
**Depth:** quick (targeted read of the focus areas; test files not reviewed)
**Status:** issues_found

## Summary

No security blockers. Both `openExternal` call sites (`getOpenInBrowser`, `getQuick` for `reply-gitlab` and `pipeline`) are gated by `isSafeHttpUrl`. `quickActionFor` also checks the URL, so the gate holds in depth. Composer-focus reads go through hooks (selector subscriptions), so there is no React Compiler module-read staleness. Duplicate Jira comment ids are handled: `stackIds` and `entryIds` include `duplicateIds`, and the read state is "any copy read". Unread counts for the bell, the chips and the popover all go through `countUnreadCards`, so they agree with each other. They count cards, not stacks (see WR-05).

The real issues are a stale composer-focus flag, a Done control with no count on collapsed stacks, an unreliable estimate for the virtualizer, and some fragile keyboard and expanded-state handling.

## Warnings

### WR-01: Composer focus flag can go stale and steal focus later

**File:** `taskflow/src/stores/composer-focus.store.ts:17`, `taskflow/src/routes/dashboard/CommentComposer.tsx:82-88`, `taskflow/src/routes/notifications/NotificationPopover.tsx:~200`
**Issue:** `requestComposerFocus(key)` is called unconditionally. This happens even when `onIssueClick` is undefined, so no navigation follows. It also happens when navigation lands on a view where the composer never mounts, for example when the issue fails to load. The flag is cleared only when a `CommentComposer` for that exact key mounts. If that happens minutes later, say the user opens that issue manually, focus is stolen. `CommentComposer` also clears the flag even if `textareaRef.current` is null (Write/Preview tabs, textarea not yet rendered). The reply is then silently lost. If two composers mount for the same key (page and peek), the first one consumes the flag.
**Fix:** Only request focus when `onIssueClick` exists. Store a timestamp (`{key, at}`) and ignore requests older than a few seconds. Clear the flag only after a successful focus:
```ts
const el = textareaRef.current;
if (!el) return; // keep the flag until the textarea exists
el.focus();
clearComposerFocus();
```

### WR-02: Done "X" on a collapsed stack deletes N hidden notifications with no indication

**File:** `taskflow/src/routes/notifications/NotificationRow.tsx:~583-593`, `NotificationPopover.tsx:~228` (`done(entry)` -> `removeItems(stackIds(entry))`)
**Issue:** The corner button is labelled "Clear notification", but on a stack's top card it removes the whole stack. The same applies to the `e`, `Delete` and `Backspace` keys. The user sees one card with "+N". Removal is irreversible (`removeItems`), so one stray keypress on the focused stack wipes every card.
**Fix:** Pass `stackMore` into the label, for example `Clear ${stackMore + 1} notifications`, and consider restricting the keyboard Done on a stack to marking read, or requiring the expanded state.

### WR-03: Virtualizer estimate omits the quick-action pill and the density variants

**File:** `taskflow/src/routes/notifications/notification-view.ts:974-990`
**Issue:** Each card with a quick action adds `mt-1.5` plus `h-5`, about 26px, which `estimateEntryHeight` ignores. The comment claims a default density of 70px. `estimateEntryHeight` does not call `quickActionFor`, so it under-estimates by 26px for most comment, mention, MR and pipeline cards. A `stack` estimate (`cards[0]` + 12) has the same gap, and a `stack-header` has no wrapper padding. Row measurement via `measureElement` corrects this after render, but total scroll height jumps and `scrollToIndex` is imprecise on first paint. `focusEntry` retries only 5 rAF frames, which can fail for unmeasured far rows.
**Fix:** Add `+ (quickActionFor(entry.item, parts) ? 26 : 0)` in the event branch. Optionally add density-aware padding.

### WR-04: Expanded-stack state is pruned against the filtered view, not the data

**File:** `taskflow/src/routes/notifications/NotificationPopover.tsx:112-122`
**Issue:** The prune effect keeps only entities that are stacked in the currently displayed `entries`. Switching the Unread/All toggle or the source filter, or marking one card read in Unread view so the stack falls below 2 cards, silently drops the expansion. Returning to the previous view then shows it collapsed again. This is acceptable as documented intent for removed items, but it also fires for filter changes. The effect also runs on every render, since `entries` is a fresh array each time unless the compiler memoizes it, and allocates a Set each time. If the item is removed (Done on the last pair), the key is pruned correctly. The lifetime rules are otherwise fine.
**Fix:** Prune against `items` (the unfiltered store), with the key still existing in some group of 2 or more cards, or accept the behavior and document it. Do not rely on `entries` identity for the effect.

### WR-05: Chip and bell counts are per card but the list shows stacks

**File:** `taskflow/src/routes/notifications/notification-view.ts:945-955`, `NotificationPopover.tsx:143`
**Issue:** `countUnreadCards` counts `event` entries from `buildEntries` (pre-stack). The popover list now shows one `stack` per issue or MR. The bell and chips agree with each other, but a list of 3 visible rows can show "9". This is consistent with the "unread cards" claim only if the user understands stacks. It is also a deliberate trade-off.
**Fix:** Decide intentionally. If the count should match visible rows, count `stack` entries and `event` entries after `stackEntries`. Otherwise, add a test and a comment that stack members count individually.

### WR-06: Keyboard handler: stale pendingFocus and Space double-toggle risk

**File:** `taskflow/src/routes/notifications/NotificationList.tsx:~65-85, 120-135`
**Issue:**
- `pendingFocus.current` is set before the action. If the action does not change `entries` (for example `removeItems` is a no-op or fails), it lingers. The next unrelated `entries` change (a poll, the `useNow` tick, read-state sync) then steals focus.
- For a stack, `Space` is `preventDefault`-ed on keydown to avoid the native button click. Browsers differ on whether that also cancels the keyup-triggered click. If the click still fires, `onOpen` calls `toggleStack` a second time and the stack immediately collapses again.
- `Escape` and `ArrowLeft` on `stack-header` buttons ("Show less" or "Clear") are ignored, because the header is not focusable. Esc then closes the whole popover rather than collapsing.

**Fix:** Clear `pendingFocus` in a `setTimeout` or rAF if no entries change. Handle `Space` on keyup, or drop the explicit `' '` case and let the native button click work (the overlay button is a real button). Give `stack-header` its own Esc/Left collapse handling.

## Info

### IN-01: Expand animation replays on virtual remount

**File:** `taskflow/src/routes/notifications/NotificationList.tsx:~250`
**Issue:** `animate-in slide-in-from-top-1` on expanded members runs on every mount, so rows scrolled back into view re-animate (virtualization unmounts and remounts them).
**Fix:** Track the "just expanded" entity in state and apply the animation only then, or drop it.

### IN-02: Magic numbers duplicated between the estimate and the CSS

**File:** `taskflow/src/routes/notifications/notification-view.ts:974-990`
**Issue:** The values 70, 12, 28 and 32 are tied to Tailwind classes in `NotificationRow` and `NotificationList` with no shared constant. They will drift silently.
**Fix:** Export named constants next to the components, or add a measurement test.

### IN-03: Cosmetic and dead-surface details

**File:** `taskflow/src/routes/notifications/notification-colours.ts:~101-155`, `NotificationAvatar.tsx`
**Issue:** The `badge` colour strings of `EventStyle` are no longer used by `NotificationAvatar` (the badge is now `bg-muted`). They remain in all style maps, so only `text` is live. Unused `style.badge` data is left behind (`FAMILY.badge`, `ACTION_STYLE`). The unused `cn` call with a single argument remains in the avatar.
**Fix:** Remove `badge` from `EventStyle` and the family maps if nothing else reads it (grep first).

---

_Reviewed: 2026-11-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
