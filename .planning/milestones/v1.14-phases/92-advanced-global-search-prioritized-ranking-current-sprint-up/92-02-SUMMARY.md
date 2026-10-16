---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
plan: 02
subsystem: global-search data layer
tags: [jira, jql, react-query, search]
requires: []
provides:
  - buildBodySearchJql / searchJiraBody / BodySearchScope (services/jira.ts)
  - useGhBacklogData opts { ignoreRoute, enabled, staleTime, refetchOnWindowFocus }
  - useGlobalSearchSources / GLOBAL_SEARCH_STALE_MS
affects: [92-04, 92-05]
key-files:
  created:
    - taskflow/src/hooks/useGlobalSearchSources.ts
    - taskflow/src/hooks/useGlobalSearchSources.test.tsx
  modified:
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira.test.ts
    - taskflow/src/services/jira/greenhopper/useGhBacklogData.ts
decisions:
  - "Passive gh-all-data read uses useQuery with queryFn: skipToken (no enabled flag needed)"
  - "No sprint clause in body-search JQL; tiers assigned client-side (RESEARCH A3)"
metrics:
  tasks: 2
  completed: 2026-10-16
---

# Phase 92 Plan 02: Global search data layer Summary

Injection-safe, throwing scoped Jira body search plus a route-independent, open-gated shared backlog source and a passive sprint-board cache read for the palette.

## What was built
- `buildBodySearchJql`: tokenises input, strips JQL/Lucene reserved chars (including quotes and backslash), one quoted `text ~` clause per token joined by AND, `*` only on the last token, quoted/escaped project key, open/closed statusCategory clause, `ORDER BY updated DESC`; returns null with no usable tokens.
- `searchJiraBody`: single `/rest/api/2/search` request (fields incl. caller's epic-link field, maxResults 50), throws on non-ok and network errors, returns `[]` without fetching on null JQL. Existing `searchJira*` untouched.
- `useGhBacklogData(boardId, opts?)`: additive options; default behaviour (route gate, 30 s stale) unchanged for BacklogPage.
- `useGlobalSearchSources(open)`: shares `['gh-backlog', boardId]` from any route while open, 5-minute staleTime, no focus refetch; passive reactive read of `['gh-all-data', boardId]` that never fetches.

## Deviations from Plan
- Worktree base was behind the expected commit; reset to 23e34cac per the branch check.
- Test imports `react-router-dom` (not `react-router`), matching `useIsActiveRoute`.
- Task 1 and Task 2 commit hooks ran the full suite; the first Task 1 attempt hit 5 load-induced flaky failures in unrelated files (pass in isolation and on retry). No code change.

## Verification
vitest (jira.test.ts body tests, hook tests, greenhopper + BacklogPage suites), biome on touched files, and tsc --noEmit all clean.

## Known Stubs
None.

## Self-Check: PASSED
