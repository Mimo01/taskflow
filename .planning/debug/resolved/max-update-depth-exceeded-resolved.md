---
status: resolved
trigger: "max-update-depth-exceeded"
created: 2026-03-30T00:00:00Z
updated: 2026-03-30T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Two separate infinite loop patterns found: (1) SprintBoardTab useEffect depends on `localIssues.filter` and `queryClient.fetchQuery` (new references each render), (2) useNotificationPolling useEffect depends on `store.setFetchError` / `store.setRetryFetch` which get new references because the entire store object is subscribed without a selector
test: code inspection confirmed both patterns
expecting: fixes will stop infinite render loops
next_action: apply fixes to both files

## Symptoms

expected: App remains responsive during normal use
actual: App freezes/stops responding after heavy use, console floods with "Maximum update depth exceeded" errors
errors: "Maximum update depth exceeded. This can happen when a component calls setState inside useEffect, but useEffect either doesn't have a dependency array, or one of the dependencies changes on every render."
reproduction: Use the app heavily, particularly on the sprint board view. Eventually the app freezes.
started: Ongoing issue, user has observed it multiple times

## Eliminated

(none yet)

## Evidence

- timestamp: 2026-03-30T00:00:00Z
  checked: SprintBoardTab.tsx line 589-608
  found: useEffect dep array is `[jiraBaseUrl, jiraToken, localIssues.length, localIssues.filter, queryClient.fetchQuery]` — `localIssues.filter` is the Array.prototype.filter method (stable), BUT `queryClient.fetchQuery` is a method on the QueryClient instance. React Query does NOT guarantee this is stable. More critically, `localIssues.filter` is the same bound method per array instance, so it changes when `localIssues` changes. This effect fires every time localIssues changes which happens on every data refetch.
  implication: The prefetch loop isn't itself infinite, but it indicates the dep array is poorly formed.

- timestamp: 2026-03-30T00:00:00Z
  checked: useNotificationPolling.ts lines 195-207
  found: `const store = useNotificationsStore()` subscribes to the ENTIRE store (no selector). Zustand returns a new store snapshot object on every state update, so `store.setFetchError` and `store.setRetryFetch` are new references whenever ANY notification store field changes. The useEffect at line 200 depends on `[queryResult.refetch, store.setRetryFetch]` — since `store.setRetryFetch` changes on every store update, and the effect calls `store.setRetryFetch(fn)` which updates the store, this is a direct infinite loop: store changes → setRetryFetch ref changes → effect fires → store.setRetryFetch(fn) → store changes again.
  implication: PRIMARY ROOT CAUSE of "Maximum update depth exceeded" — this is a direct setState-in-useEffect loop.

## Resolution

root_cause: Three compounding issues all causing "Maximum update depth exceeded":

  1. PRIMARY — VirtualizedSwimlanes (SprintBoardTab.tsx): `filteredSwimlanes` (a new array every render) was in the scroll useEffect dep array. The effect ran immediately on mount via `onScroll()` and called `setStickyHeader({ new object })` (always a new object reference even if content is same). This triggered a SprintBoardTab re-render → new `filteredSwimlanes` array → effect triggered again → setStickyHeader again → infinite loop.

  2. SECONDARY — SprintBoardTab.tsx pre-fetch transitions useEffect: dep array incorrectly included `localIssues.filter` (method on new array each render) and `queryClient.fetchQuery` (potentially unstable). Caused the prefetch effect to run far more often than needed.

  3. TERTIARY — useNotificationPolling.ts: `const store = useNotificationsStore()` subscribed to the entire store without a selector. While Zustand action references are technically stable, subscribing to the entire store and using `store.setRetryFetch` in deps caused effects to run unnecessarily on every notification store update (high frequency). The `store.setRetryFetch(() => { queryResult.refetch(); })` pattern stored a new closure on each run.

fix: |
  1. VirtualizedSwimlanes (SprintBoardTab.tsx):
     - Added `filteredSwimlanesRef` — the scroll handler reads filteredSwimlanes via ref instead of closure
     - Removed `filteredSwimlanes` from useEffect deps (now: `[scrollElement, swimlaneVirtualizer]`)
     - Added `lastStickyKeyRef` — only calls `setStickyHeader` when the pinned swimlane key actually changes, preventing unnecessary re-renders on every scroll event
     - Made `handleStickyHeaderChange` stable with `useCallback(fn, [])`

  2. SprintBoardTab prefetch useEffect:
     - Added `localIssuesRef` — the effect reads issues via ref instead of closure
     - Removed `localIssues.filter` and `queryClient.fetchQuery` from deps
     - Correct deps: `[jiraBaseUrl, jiraToken, localIssues.length, queryClient]`

  3. useNotificationPolling.ts:
     - Changed from `const store = useNotificationsStore()` to targeted selectors for each action and piece of state
     - Store actions (`prependItems`, `setLastSeenJiraCursor`, etc.) now subscribe individually — stable references
     - Added `storeItemsRef`, `lastSeenJiraCursorRef`, `lastSeenGitlabCursorRef`, `typeEnabledMapRef`, `osNotifJiraEnabledRef`, `osNotifGitlabEnabledRef` refs so queryFn can read current values without adding them to the queryKey

verification: TypeScript compiles with zero errors. All 836 tests pass (86/91 test files, 5 skipped). Changes pending human verification in the actual running app.
files_changed:
  - taskflow/src/hooks/useNotificationPolling.ts
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
