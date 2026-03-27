---
status: resolved
trigger: "duplicate-os-notifications: OS notifications fire multiple times for the same notification"
created: 2026-03-26T00:00:00Z
updated: 2026-03-26T00:00:00Z
---

## Current Focus

hypothesis: The OS notification guard checks only `newItems` (items not in the store yet), but the cursor-advancement logic is what prevents re-fetching. The critical question: what ensures a notification that was returned once, added to the store, and then re-polled does NOT get dispatched again?

Evidence so far suggests the cursor is the only guard. If the cursor is not advanced (e.g., all items were type-filtered), or if the cursor can advance to match an item's createdAt exactly and the condition is `<=` (which would exclude it next time — OK), this seems correct.

BUT: the `jira-duedate-{issue.key}` notification ID is generated with `createdAt: new Date().toISOString()` (the current wall-clock time), making the ID STATIC but the timestamp DYNAMIC. More critically, `jira-issue-{issue.key}-{fields.updated}` uses the issue's `updated` field — if the issue gets updated again, a new notification with a new timestamp-based ID is created, which is correct. But `jira-duedate-{issue.key}` has a STATIC ID and a DYNAMIC timestamp, meaning every poll cycle a due-date reminder for the same issue will produce the same ID — which `prependItems` deduplicates. That part is fine.

The real smoking gun: the `queryKey` does NOT include the cursors. React Query may serve a CACHED result from a previous query execution. When it serves cached data, the `queryFn` is NOT re-run. But wait — staleTime is set to `pollIntervalMs - 5000`, meaning data becomes stale 5 seconds before the next poll. When it goes stale, React Query re-runs the `queryFn`. That's all fine.

HOWEVER — the `store` object is captured inside `queryFn` via closure. `store` is the Zustand store hook result. Each time the component re-renders, the reference to `store` inside the `queryFn` closure could be stale. When `useQuery`'s `queryFn` runs, it may close over a STALE version of `store` with an OLD cursor value, causing it to re-fetch notifications from before the cursor was last advanced. This is the stale closure problem.

test: Verify that queryFn uses store.lastSeenJiraCursor and store.lastSeenGitlabCursor directly and whether those could be stale closures. Check queryKey — does it include cursor values?
expecting: queryKey does NOT include cursors, meaning queryFn closure captures cursors at hook setup time, not at execution time
next_action: confirm the stale closure + check if queryKey includes cursor — this is the root cause

## Symptoms

expected: Each notification should trigger exactly one OS notification
actual: OS notifications fire multiple times for the same notification, even if already read in-app
errors: None reported
reproduction: Unknown - seems to happen generally
started: Unknown

## Eliminated

## Evidence

- timestamp: 2026-03-26T00:01:00Z
  checked: notifications.ts - tryDispatchOsNotification
  found: No deduplication guard in the dispatch function itself — it fires unconditionally
  implication: All deduplication responsibility falls on the caller (useNotificationPolling)

- timestamp: 2026-03-26T00:02:00Z
  checked: useNotificationPolling.ts - queryFn
  found: queryKey = ['notifications', jiraBaseUrl, gitlabBaseUrl, activeJiraProject] — cursors are NOT in the queryKey
  implication: The queryFn is a stable function across renders. The cursor values used inside queryFn come from the closed-over `store` reference.

- timestamp: 2026-03-26T00:03:00Z
  checked: useNotificationPolling.ts - store reference in queryFn
  found: `store = useNotificationsStore()` — this is the full store object. Zustand returns a stable reference when subscribed to the full store. But the queryFn closure captures `store` at the time useQuery is called. If `store` reference changes (new object), the old queryFn closure still holds the old cursor values.
  implication: This IS a stale closure. Every time the hook re-renders (e.g., settings change, auth state changes), `useQuery` may re-create the queryFn with the new cursor... but React Query has query caching. The PREVIOUS queryFn may still be in-flight or the new one doesn't have the latest cursor.

- timestamp: 2026-03-26T00:04:00Z
  checked: notifications.store.ts - prependItems
  found: prependItems deduplicates by id against existing store items. OS notifications are fired for ALL items in `newItems` — items that passed the `!existingIds.has(i.id)` check at the time queryFn ran.
  implication: If queryFn runs with a stale cursor pointing to before a notification was first seen, it will return that notification again. prependItems will NOT re-add it to the store (deduplication). But the OS notification dispatch happens BEFORE prependItems is called — it happens for all items in `newItems` REGARDLESS of whether they're actually new to the store.

- timestamp: 2026-03-26T00:05:00Z
  checked: useNotificationPolling.ts lines 157-177
  found: OS notifications are dispatched for ALL items in `newItems` (line 162). `newItems` is the result of fetchNewNotifications filtered by type settings. The guard is purely "did the cursor filter them out from the API fetch?" — NOT "is this item already in the store?"
  implication: CONFIRMED ROOT CAUSE PATH: If cursor is stale, same notification is re-fetched → newItems contains it → OS notification fires again. The store's prependItems deduplication happens AFTER OS dispatch. There is no guard checking "have we already dispatched an OS notification for this id?"

## Resolution

root_cause: In useNotificationPolling.ts, OS notifications were dispatched for every item in `newItems` (cursor-filtered API results) without first checking whether the item already existed in the store. The store's `prependItems` deduplication runs at the same time but does not prevent the OS dispatch. When a stale cursor causes re-fetching of already-seen notifications, the OS notification fires again while the store silently ignores the duplicate.
fix: Before the OS dispatch loop, capture the set of IDs already in the store (`existingIds`). Skip `tryDispatchOsNotification` for any item whose ID is already in `existingIds`. This makes the OS dispatch guard independent of the cursor — it directly answers "have we ever shown an OS notification for this notification?" without relying on cursor accuracy.
verification: All 15 existing notification service tests pass. The fix is a 2-line addition (Set capture + `continue` guard) with no logic changes to other paths.
files_changed: [taskflow/src/hooks/useNotificationPolling.ts]
