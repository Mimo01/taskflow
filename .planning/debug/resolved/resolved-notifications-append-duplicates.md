---
status: resolved
trigger: "Notifications keep appending on load even if already present, causing duplicate notifications and ever-increasing notification counts."
created: 2026-03-13T00:00:00Z
updated: 2026-03-13T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — prependItems blindly prepends all returned items without checking if their IDs already exist in the store, AND the JQL sinceJql has minute-precision truncation causing items in the same minute as the cursor to be re-fetched on every poll
test: traced execution path through useNotificationPolling -> fetchNewNotifications -> prependItems
expecting: fix requires prependItems to deduplicate against existing store items before prepending
next_action: fix prependItems in notifications.store.ts to filter out IDs already present

## Symptoms

expected: Notifications should load/refresh without duplicating — existing notifications should be updated or ignored, not appended again.
actual: Every time notifications load, they are appended to the existing list, causing duplicates and inflating notification counts.
errors: None reported — purely behavioral/UI bug.
reproduction: Load the app or trigger a notification refresh — notification count goes up and duplicates appear.
started: Unknown

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-13T00:00:00Z
  checked: useNotificationPolling.ts line 76
  found: calls store.prependItems(newItems) with every non-empty result from fetchNewNotifications
  implication: prependItems always prepends regardless of whether those IDs are already in the store

- timestamp: 2026-03-13T00:00:00Z
  checked: notifications.store.ts prependItems (lines 70-73)
  found: implementation is `[...newItems, ...s.items].slice(0, 200)` — no deduplication against existing items
  implication: if fetchNewNotifications returns any item whose ID is already in store.items, it gets duplicated

- timestamp: 2026-03-13T00:00:00Z
  checked: notifications.ts fetchIssueUpdates JQL sinceJql (line 65)
  found: `since.substring(0, 16).replace('T', ' ')` truncates to minute-precision for JQL
  implication: after cursor is set to e.g. 10:05:30, sinceJql = "2026-03-13 10:05" — next poll re-fetches everything from 10:05:00 onwards, which includes items already in the store

- timestamp: 2026-03-13T00:00:00Z
  checked: fetchNewNotifications deduplication (lines 316-323)
  found: deduplication only runs within a single fetch result, not against the store
  implication: cross-poll duplicates are not caught here

- timestamp: 2026-03-13T00:00:00Z
  checked: useNotificationPolling.ts cursor update (line 79)
  found: cursor advanced to newest.createdAt (full ISO precision)
  implication: client-side filters in fetchCommentMentions and fetchGitlabNotes use full-precision comparison and would correctly exclude already-seen items; BUT fetchIssueUpdates uses minute-precision JQL so it re-fetches same-minute items repeatedly

## Resolution

root_cause: Two compounding bugs. (1) prependItems in notifications.store.ts does not filter out items whose IDs are already in the store — it blindly prepends all incoming items. (2) The Jira JQL cursor uses minute-precision (sinceJql truncates to HH:mm), so on every poll cycle items updated in the same minute as the cursor are re-fetched and passed to prependItems again. Together they cause every poll to re-add already-present notifications as duplicates.
fix: Made prependItems deduplicate incoming items against the existing store by ID before prepending. Builds a Set of existing IDs, filters newItems to only truly-new entries, and early-returns the unchanged state reference when all incoming items are already present.
verification: All 11 store tests pass (9 existing + 2 new regression tests covering the no-duplicate and no-state-mutation paths).
files_changed: [taskflow/src/stores/notifications.store.ts, taskflow/src/stores/notifications.store.test.ts]
