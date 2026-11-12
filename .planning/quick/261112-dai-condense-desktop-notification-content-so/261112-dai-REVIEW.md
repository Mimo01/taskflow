---
phase: 261112-dai
reviewed: 2026-11-12T00:00:00Z
depth: quick
files_reviewed: 5
files_reviewed_list:
  - taskflow/src/lib/notification-dispatch-log.ts
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/routes/dev-tools/NotificationsTab.tsx
  - taskflow/src/stores/notification-dispatch-log.store.ts
  - taskflow/src/routes/notifications/notification-view.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 261112-dai: Code Review Report

**Depth:** quick (diff-focused read of fc3e2505, plus callers)

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Formatting throws on persisted items lacking fields, aborting dispatch after state is already committed

**File:** `taskflow/src/lib/notification-dispatch-log.ts:105-150`, `taskflow/src/hooks/useNotificationPolling.ts:~243-262`
**Issue:** `formatOsNotification` now dereferences fields unguarded: `actorName(item.author)` calls `author.trim()`, `getEntityTitle` calls `entityTitle.trim()`, and `osWhat` calls `raw.split`, `raw.replace` and `bodyPreview.match` on `fullBody || bodyPreview`. The old code only interpolated them, so a missing field printed "undefined" and never threw. In the poller, `prependItems`, the banner push and `advanceCursors` have already run before the dispatch loop. The "skipped" branch also formats already-known items, which are persisted and so most likely to lack newer fields. A single throw in that first loop rejects the poll handler. Every fresh item then gets no OS banner and no dev-log entry, and the cursor has already moved, so those notifications are never re-dispatched. `due-date-reminder` can also return `undefined` from `osWhat`, which throws at `.replace`.
**Fix:** Make the formatter total, and isolate it per item:
```ts
const actor = actorName(item.author ?? '');
const raw = item.fullBody || item.bodyPreview || '';
// getEntityTitle: (item.entityTitle ?? '')
// due-date-reminder: return item.bodyPreview ?? ''
```
In the poller, wrap each `formatOsNotification` and `send` call in try/catch so one bad item cannot drop the others. Alternatively, move the dispatch block before `advanceCursors`.

## Warnings

### WR-01: Summary 'denied'/'error' still marks every folded item as 'grouped'

**File:** `taskflow/src/hooks/useNotificationPolling.ts:~268-279`
**Issue:** If the summary banner fails, the per-item rows are still logged as `grouped` ("folded into a summary banner"). The dev-tools UI then says they were folded into a banner that never appeared. Nothing is retried or delivered individually, which is the same loss as before, but the log now hides it.
**Fix:** Log the folded items as `grouped` only when `outcome === 'sent'`. Otherwise log them with the summary's outcome, or fall back to per-item banners.

### WR-02: Inline-image regex deletes legitimate text between two bangs

**File:** `taskflow/src/lib/notification-dispatch-log.ts:~58`
**Issue:** `/![^\s!|]+(?:\|[^!\n]*)?!/g` matches any `!word!` with no whitespace, such as "Fixed!Done!" or "wow!really!", and `(?:\|[^!\n]*)?` can span a long run. The result is silently dropped text in comments.
**Fix:** Require an image-like token, for example `/!(?=[^\s!|]*\.(?:png|jpe?g|gif|svg|webp|bmp)\b)[^\s!|]+(?:\|[^!\n]*)?!/gi`, or require the leading `!` to follow whitespace or the start of the string.

### WR-03: Emphasis stripping can delete meaningful `-`/`+`/`^` delimiters

**File:** `taskflow/src/lib/notification-dispatch-log.ts:~71`
**Issue:** `[*_+^-]` treats `-x-`, `+1+` and `^a^` as markup. For example, "took -5- minutes" or "(-1-)" would be altered. The pattern `(?:[^*_+^-]*[^\s*_+^-])?` also backtracks on every opener that has no closing delimiter. This runs on the full `fullBody` before the 140-character cap, so a long comment with many ` *x` openers costs roughly O(n²). That is a performance concern and out of scope for v1 unless the comments are large.
**Fix:** Drop `-`, `+` and `^` from the delimiter set, since they are rare in Jira prose. Truncate the input (for example `t.slice(0, 2000)`) before the heavy regexes.

## Info

### IN-01: Log ordering does not match the documented "summary then Grouped rows"

**File:** `taskflow/src/stores/notification-dispatch-log.store.ts:~31`, `NotificationsTab.tsx:5`
**Issue:** `append` reverses the entries. The summary is pushed first, so it is shown below its Grouped rows. The header comment says the opposite.
**Fix:** Push the summary last, or correct the comment.

### IN-02: Empty OS title is possible

**File:** `taskflow/src/lib/notification-dispatch-log.ts:~100`
**Issue:** `osTitle` returns `getEntityTitle(item)` when there is no ref. With an empty `entityTitle` that yields an empty title, and some OSes reject empty titles, which would surface as `error`.
**Fix:** `return ref ? ... : title || 'Notification'`.

### IN-03: Dead and misleading constants and tests

**File:** `taskflow/src/lib/notification-dispatch-log.ts:~34`
**Issue:** `OS_BURST_THRESHOLD` has no edge-case tests (exactly 3 versus 4 fresh items, mixed already-known items). The summary counts any non-jira source as GitLab, which is only valid while there are two sources.
**Fix:** Add boundary tests. Compute the GitLab count with `source === 'gitlab'`.

## Checked and found sound

- The discriminated union (`kind?: 'item'` versus `'summary'`) narrows correctly in `NotificationsTab`, and the store intersection type is fine.
- The `escapeRe` handling of the Jira username is correct.
- The new user-supplied RegExp is escaped, and the `(?<=` lookbehind is supported by WebKit 16.4+.
- Per-item dispatch stays sequential, with no double dispatch (fresh versus existing is partitioned once).

_Reviewer: Claude (gsd-code-reviewer)_
