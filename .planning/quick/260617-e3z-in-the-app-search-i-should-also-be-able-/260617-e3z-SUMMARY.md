---
phase: quick-260617-e3z
plan: "01"
subsystem: command-palette
tags: [search, jira, debounce, tanstack-query]
dependency_graph:
  requires: []
  provides: [debounced-text-search-in-command-palette]
  affects: [CommandPalette.tsx]
tech_stack:
  added: []
  patterns: [debounced-useEffect, useQuery-enabled-guard, issuesMap-dedup]
key_files:
  created: []
  modified:
    - taskflow/src/components/app/CommandPalette.tsx
decisions:
  - "Reset debouncedQuery both from the trimmed-length guard in the debounce effect AND from the close-palette effect to avoid stale queries on reopen"
  - "textSearchResults merged after sprint-board cache so cached issues take priority in dedup order"
metrics:
  duration: ~5min
  completed: "2026-06-17"
---

# Phase quick-260617-e3z Plan 01: Debounced Issue Text Search in CommandPalette Summary

**One-liner:** Wired 300ms debounced `useQuery(['search','text',debouncedQuery,activeJiraProject])` into CommandPalette that merges live Jira text results with sprint-board cache into the existing Issues group (deduped by key, capped at 10).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add debounced text search query and merge results into Issues group | 99d55ab5 | taskflow/src/components/app/CommandPalette.tsx |

## What Was Built

Three surgical additions to `CommandPalette.tsx`:

1. **`debouncedQuery` state + useEffect debounce** — a 300ms debounce on `trimmed`; clears immediately if `trimmed.length < 2`; also cleared in the existing palette-close effect to prevent stale state on reopen.

2. **Auto text search useQuery** — queryKey `['search', 'text', debouncedQuery, activeJiraProject]`, enabled only when `debouncedQuery.length >= 2 && !!jiraBaseUrl && !!activeJiraProject`, staleTime 30s, keepPreviousData. Scoped to active project via `activeJiraProject` guard in both `enabled` and inside `searchJira`.

3. **issuesMap merge + cap** — after populating from `cachedSprintBoard.issues`, a second loop adds `textSearchResults` entries only if the key is not already present. `allIssues` is then sliced to 10. The existing `<CommandGroup heading="Issues">` JSX required no changes.

The existing `liveSearch` (opt-in via "Search Jira for …" tail item) and `closedSearch` flows are untouched.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — T-e3z-02 (project scoping) and T-e3z-03 (debounce DoS protection) are both implemented as specified in the threat model.

## Self-Check: PASSED

- [x] `taskflow/src/components/app/CommandPalette.tsx` modified and committed at 99d55ab5
- [x] `npm run check` exits with 0 errors (17 pre-existing biome warnings + 2 pre-existing TS6133 errors in unrelated `MyTaskRow.tsx` — confirmed present at base HEAD before this change)
- [x] Component contains `debouncedQuery` state, useQuery with key `['search', 'text', debouncedQuery, activeJiraProject]`, and issuesMap populated from both cache and `textSearchResults`
