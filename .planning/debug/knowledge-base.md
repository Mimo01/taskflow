# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## pinned-tabs-loading-bug -- Pinned tabs show loading spinner on cold start instead of issue metadata
- **Date:** 2026-03-16
- **Error patterns:** loading state, spinner, pinned tabs, cold start, cache empty, resolveIssueFromCache, no subscription
- **Root cause:** PinnedTabStrip resolved issue metadata via synchronous cache reads (resolveIssueFromCache) at render time but never actively fetched data. On cold start the react-query cache is empty and tabs show loading spinners indefinitely.
- **Fix:** Added fetchIssueSummary() lightweight endpoint (2 fields), useQueries in AppLayout to actively fetch for each pinned key, passed resolved map to PinnedTabStrip as prop. Simplified PinnedTabStrip to pure presentational component.
- **Files changed:** taskflow/src/services/jira.ts, taskflow/src/main.tsx, taskflow/src/components/app/PinnedTabStrip.tsx
---
