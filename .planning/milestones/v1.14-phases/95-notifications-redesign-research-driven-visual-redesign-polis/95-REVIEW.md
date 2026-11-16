---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
reviewed: 2026-11-10T17:20:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - taskflow/src/components/app/TopBar.tsx
  - taskflow/src/components/app/TopBar.test.tsx
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/hooks/useNow.ts
  - taskflow/src/hooks/useNow.test.ts
  - taskflow/src/main.tsx
  - taskflow/src/routes/notifications/NotificationAvatar.tsx
  - taskflow/src/routes/notifications/NotificationList.tsx
  - taskflow/src/routes/notifications/NotificationList.test.tsx
  - taskflow/src/routes/notifications/NotificationPopover.tsx
  - taskflow/src/routes/notifications/NotificationPopover.test.tsx
  - taskflow/src/routes/notifications/NotificationRow.tsx
  - taskflow/src/routes/notifications/NotificationRow.test.tsx
  - taskflow/src/routes/notifications/notification-colours.ts
  - taskflow/src/routes/notifications/notification-view.ts
  - taskflow/src/routes/notifications/notification-view.test.ts
  - taskflow/src/routes/notifications/useUnreadCardCount.ts
  - taskflow/src/services/notifications.ts
  - taskflow/src/services/notifications.test.ts
  - taskflow/src/stores/notifications.store.ts
  - taskflow/src/stores/notifications.store.test.ts
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 95: Code Review Report

**Reviewed:** 2026-11-10T17:20:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

I reviewed the notification card redesign: the view-model merge rules, card rendering, the virtualized list and keyboard layer, the store tombstones, the bell count and the service id change. Grouping removal and colour-per-action were treated as settled design. The known follow-ups (maxResults=20, guessed status colours, missing due date, @you highlight) are not repeated here.

The main problems are in the new merge layer (`notification-view.ts`). It combines data in ways the service output does not support. A temporary vitest probe (since deleted) confirmed each critical finding against the real functions:

- One Jira comment becomes "mentioned you in 2 comments".
- Multi-word GitLab labels split into separate wrong chips.
- Merging Jira multi-value fields drops values.

## Critical Issues

### CR-01: A single Jira @mention comment shows as "mentioned you in 2 comments"

**File:** `taskflow/src/routes/notifications/notification-view.ts:566-577, 728-736` (source: `taskflow/src/services/notifications.ts:272-284, 345-359`)
**Issue:** A comment that mentions the user, on an issue the user is assigned to, reports or watches, comes back from two queries:
- Query B returns it as `jira-comment-{id}` (`comment-mention`).
- Query C returns it as `jira-allcomment-{id}` (`jira-comment`).

The ids differ, so neither `fetchNewNotifications` nor `prependItems` removes the copy. Both items have the same entity, the same author and the same `createdAt`. Both fall into the `'conversation'` merge category, so `buildEntries` merges them. The probe confirmed the result: one card with the verb `"mentioned you in 2 comments"`, a two-row comment list showing the same text twice, and `count: 2`. This is the most common mention scenario, and the card states a wrong count.
**Fix:** Drop the duplicate at the source. Skip `jira-allcomment-X` when `jira-comment-X` is in the same batch, or remove the duplicate by comment id before merging:
```ts
// services/notifications.ts, after the Promise.allSettled loop in fetchNewJiraComments
const mentionIds = new Set(
  results.filter((r) => r.notificationType === 'comment-mention').map((r) => r.id.slice('jira-comment-'.length)),
);
return results.filter(
  (r) => !(r.notificationType === 'jira-comment' && mentionIds.has(r.id.slice('jira-allcomment-'.length))),
);
```
Already-persisted pairs also need handling. In `describeEntryParts` / `buildEntries`, collapse items that share a comment id (the suffix after the last `-`) and prefer the mention.

### CR-02: Multi-word GitLab labels split into separate wrong labels (and single-label cards get the wrong verb)

**File:** `taskflow/src/routes/notifications/notification-view.ts:186-192, 427, 434-439, 603`; `NotificationRow.tsx:145`
**Issue:** `prefixList` joins the words of a multi-word label with U+00A0 so that each label stays one token (`"+needs review"`). But JS `\s` matches U+00A0, so every later tokenizer splits the label anyway:
- **Single card:** `signedTextMode` splits `"+needs review +bug"` into `["+needs","review","+bug"]`. `"review"` has no sign, so the function returns `undefined`. The card then reads "changed labels" instead of "added labels". Probe output: `verb: "changed labels"`.
- **Merged card:** `labelTokens` splits the label into `needs` and `review`, and `review` inherits the `+` sign. `stripSigns` then joins with a plain space, and `LabelChips` splits on `' '`. The probe got `text: "needs review bug ux"`, which renders as four chips (`needs`, `review`, `bug`, `ux`) for three real labels.

GitLab labels with spaces are common (`"needs review"`, `"In Progress"`).
**Fix:** Split tokens on ASCII whitespace or commas only, and keep NBSP inside the label:
```ts
const TOKEN_SPLIT = /[ \t\n,]+/;   // NOT \s — \s includes  
// signedTextMode: c.text.split(TOKEN_SPLIT)
// labelTokens:    text.split(TOKEN_SPLIT)
// stripSigns:     text.split(' ').map(...).join(' ')
```
Add a test with a label that contains a space, for both the single path and the merged path.

### CR-03: Merging changes to a multi-value Jira field (Fix Version, Component, Sprint) drops values

**File:** `taskflow/src/routes/notifications/notification-view.ts:637-645`
**Issue:** `mergeChanges` keys from→to diffs by `c.field` alone and keeps the first `from` and the last `to`. Jira reports each change to a multi-value field (Fix Version/s, Component/s) as its own changelog item. Take two consecutive merged updates by the same actor: `Fix Version: (none) → 1.0`, then `Fix Version: (none) → 1.1`. The result is `{ to: '1.1' }` and the card reads "added fix version 1.1", so 1.0 disappears (confirmed by the probe). "1.0 → (none)" followed by "1.1 → (none)" likewise shows only one removal. The merge exists to summarise; here it reports wrong data.
**Fix:** Only collapse first-from → last-to when the previous `to` equals the next `from` (a real chain). Otherwise keep both lines. One option is to treat a one-sided diff (`!from || !to`) on version/component fields as an "other" entry keyed by its value:
```ts
const chain = prev && prev.to === c.from;
if (prev && !chain) { order.push(`d:${key}#${order.length}`); diffs.set(`${key}#${order.length - 1}`, c); continue; }
```
(Or add +/− tokens the same way labels are handled.)

## Warnings

### WR-01: GitLab system notes are parsed from the 120-char `bodyPreview`, so long titles or label lists are silently truncated or lost

**File:** `taskflow/src/routes/notifications/notification-view.ts:454, 561, 568` (source: `services/notifications.ts:560`)
**Issue:** `describeEventParts`, `changesOf` and `mergeCategory` call `parseSystemLines(item.bodyPreview)`, and the service cuts that string to 120 characters. Two failures follow:
- `Title: <70 chars> → <70 chars>` keeps only the first 40 characters of the new title. The card shows the cut text as the new value with no ellipsis (confirmed by the probe).
- When the old title is longer than about 110 characters, the arrow falls past the cut. `CHANGE_RE` then fails, the card degrades to a bare "updated", and `mergeCategory` returns `null`.

Long label and reviewer lists lose their last entry, or end with a partial chip.
**Fix:** Parse from `item.fullBody || item.bodyPreview` in all three places. `fullBody` already holds the untruncated `parsedBody`.

### WR-02: Bell badge uses a stale clock and can disagree with the popover chips

**File:** `taskflow/src/routes/notifications/useUnreadCardCount.ts:10-11`
**Issue:** `Date.now()` is read inside `useMemo` with deps `[items, readIds]`, which breaks the "no clock reads in render" contract stated at the top of `notification-view.ts`. `prependItems` returns the same state when a poll brings nothing new, so the memo can keep a `now` that is hours or days old. Merge eligibility depends on `bucketOf(…, now)`. Two same-actor items at 23:30 and 00:20 are split while they sit in today/yesterday, and merge once both reach "This week" (day 3). The popover (driven by `useNow`) then shows 1 card while the bell still shows 2.
**Fix:**
```ts
const now = useNow(60_000);
return useMemo(() => countUnreadCards(items, new Set(readIds), 'all', now), [items, readIds, now]);
```

### WR-03: Keyboard triage loses focus when `u` is pressed in the Unread view

**File:** `taskflow/src/routes/notifications/NotificationList.tsx:126-131`
**Issue:** In Unread view (`unreadOnly`), marking a card read removes it from `entries`. Only the `e`/`Delete` path sets `pendingFocus`, so after `u` the focused button unmounts and focus falls to `document.body`. The scroller's `onKeyDown` stops receiving keys, and `j`/`k`/`u`/`e` stop working until the user clicks back into the list. Clicking the "Mark as read" tray button in Unread view also drops focus.
**Fix:** Set `pendingFocus.current = current` before `onToggleRead(focusable)`, as the Done path does. The existing effect resolves it to the same index, or to the nearest focusable entry, once entries update.

### WR-04: Bell pulse can stick on indefinitely

**File:** `taskflow/src/components/app/TopBar.tsx:58-65`
**Issue:** When `rawUnread` rises, the effect sets `bellPulse=true` and schedules a reset after 2s. If `rawUnread` changes again within those 2s, the cleanup cancels the timer. If the new value is not above `prevCountRef` (a decrease, for example an item evicted by the 200 cap or marked read from elsewhere), nothing sets the pulse back to false. The bell keeps the `animate-bell-ring` / `animate-pulse` animation until the popover is opened. Store rehydration (0 → N on launch) also rings the bell on every app start, even with no new notifications.
**Fix:** Reset the pulse in the non-increase branch, and seed the ref only after hydration:
```ts
useEffect(() => {
  if (rawUnread > prevCountRef.current) { … return () => { clearTimeout(timer); setBellPulse(false); }; }
  prevCountRef.current = rawUnread;
}, [rawUnread]);
```
(Also gate on `useNotificationsStore.persist.hasHydrated()`.)

### WR-05: The due-reminder id change re-notifies every current reminder once, and "Due today" is still never shown

**File:** `taskflow/src/services/notifications.ts:441`
**Issue:**
1. Changing the id from `jira-duedate-{key}` to `jira-duedate-{key}-{duedate}` makes every reminder already in the store "new". Upgraded users get a second card and a second OS notification for the same issue, and the old card stays.
2. The id is still the same across days for one due date. Day 1's "Due tomorrow" item stops day 2's "Due today" from ever being added (it is deduped as known), so the card keeps saying "due tomorrow" on the due day. This is separate from the filed "due date not passed through" follow-up.

**Fix:** Include the label in the id (`…-${issue.fields.duedate}-${dueLabel === 'Due today' ? 'today' : 'tomorrow'}`). On rehydrate, migrate or tombstone legacy `jira-duedate-KEY` ids, or skip OS dispatch for due reminders whose issue key already has a reminder in the store.

### WR-06: Due reminders push the Jira cursor to client "now", which can skip real events (pre-existing, data loss)

**File:** `taskflow/src/services/notifications.ts:447`; `taskflow/src/hooks/useNotificationPolling.ts:185-191, 210`
**Issue:** Due reminders get `createdAt: new Date().toISOString()`, which is the client time after the fetch, and `advanceCursors(allItems)` counts them. While any issue is due within a day, every poll moves the Jira cursor to the client wall-clock time after all four queries have returned. Two kinds of events are then skipped for good on the next poll's `<= since` filter:
- Comments or changes committed on the server after Query A/C took its snapshot but before the due query resolved.
- Any event, if the client clock runs ahead of the Jira server.

**Fix:** Leave `due-date-reminder` items out of `advanceCursors`. Advance the Jira cursor only from server-timestamped items.

## Info

### IN-01: Stale doc comments in NotificationRow

**File:** `taskflow/src/routes/notifications/NotificationRow.tsx:32, 395`
**Issue:** Line 32 says "Absolute time and full body live in a 600ms tooltip", but the card tooltip was removed (95-06). Line 395 says "max 3 + '+N more'", but the cap is now 10 (`MAX_LIST_ROWS`).
**Fix:** Update both comments.

### IN-02: Duplicate React keys possible in the change list

**File:** `taskflow/src/routes/notifications/NotificationRow.tsx:353`
**Issue:** The key is `${field}|${action}|${text ?? to}`. One Jira history that removes two Fix Versions (`1.0 → (none)`, `1.1 → (none)`) gives two lines with `to`/`text` undefined, so both keys are `fix version|version|`. React may reuse or reorder the wrong row.
**Fix:** Add `from` and the index to the key: `` `${i}|${c.field}|${c.from ?? ''}|${c.text ?? c.to ?? ''}` ``.

### IN-03: Net-zero merged changes render as a bare "updated"

**File:** `taskflow/src/routes/notifications/notification-view.ts:662, 419`
**Issue:** A merged run such as status `A → B` then `B → A` nets to nothing, and `changesParts` returns `{ verb: 'updated' }` with no detail and the generic style. The user sees "Cara updated" with no explanation.
**Fix:** If `mergeChanges` returns an empty list, fall back to the latest item's own parts, or show "changed status (reverted)".

---

_Reviewed: 2026-11-10T17:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
