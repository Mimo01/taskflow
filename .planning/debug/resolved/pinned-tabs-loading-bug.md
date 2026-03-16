---
status: resolved
trigger: "Pinned issue tabs show loading state on app start. First tab only loads after navigating into it and back out."
created: 2026-03-16T00:00:00Z
updated: 2026-03-16T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED -- PinnedTabStrip needs active fetching, not passive cache reads
test: Added useQueries in AppLayout + fetchIssueSummary endpoint for each pinned key
expecting: Tabs load independently on app start regardless of which page is active
next_action: Awaiting human verification

## Symptoms

expected: Pinned issue tabs should load their content/metadata immediately when the app starts
actual: Tabs show loading/skeleton state on app start. First tab only populates after navigating into it and exiting.
errors: No console errors visible
reproduction: Open app with pinned tabs -> first tab stuck in loading -> navigate into it and back out -> then it loads
started: Not sure if it ever worked correctly

## Eliminated

- hypothesis: Passive cache subscription (useCacheRevision) is sufficient
  evidence: User confirmed tabs need to actively fetch their own data, not wait for other page queries to populate the cache. A user on the settings page would never see pinned tabs resolve.
  timestamp: 2026-03-16T00:10:00Z

## Evidence

- timestamp: 2026-03-16T00:01:00Z
  checked: PinnedTabStrip.tsx - resolveIssueFromCache function
  found: Function does a synchronous read of queryClient cache using getQueriesData(). It searches jira-issues, jira-backlog-view, and jira-issue-detail caches. Returns undefined if no match found. No subscription or useQuery is used.
  implication: Component renders loading state when cache is empty and has NO mechanism to re-render when cache gets populated by other components' queries.

- timestamp: 2026-03-16T00:02:00Z
  checked: main.tsx - AppLayout component where PinnedTabStrip is rendered
  found: PinnedTabStrip receives pinnedKeys from zustand store, activeKey from URL. No prefetching of issue data for pinned keys. Component only re-renders when props change (route change, pin change).
  implication: After navigating into an issue (which fetches its detail into cache) and back out, the route change triggers re-render and now resolveIssueFromCache finds data. This matches the reported symptom exactly.

- timestamp: 2026-03-16T00:03:00Z
  checked: pinned-tabs.store.ts - zustand store with Tauri LazyStore persistence
  found: Store only persists pinnedKeys (string[]). Hydration is async (LazyStore). No issue metadata is stored or cached.
  implication: By design, metadata must come from react-query cache. But the cache is empty on cold start.

## Resolution

root_cause: PinnedTabStrip resolved issue metadata via synchronous cache reads (resolveIssueFromCache) at render time but never actively fetched data. On cold start (or when on a page that doesn't fetch issue lists), the cache is empty and tabs show loading spinners indefinitely.
fix: (1) Added fetchIssueSummary() to jira.ts -- lightweight 2-field fetch (summary, issuetype). (2) Added useQueries in AppLayout (main.tsx) that actively fetches summary data for each pinned key on mount, with staleTime=5min and gcTime=Infinity. (3) Passes resolved map to PinnedTabStrip as resolvedIssues prop. (4) Simplified PinnedTabStrip to a pure presentational component -- removed resolveIssueFromCache, useCacheRevision, and useQueryClient dependency.
verification: TypeScript compilation passes. Each pinned tab now has its own query that fires on mount regardless of what page the user is on.
files_changed: [taskflow/src/services/jira.ts, taskflow/src/main.tsx, taskflow/src/components/app/PinnedTabStrip.tsx]
