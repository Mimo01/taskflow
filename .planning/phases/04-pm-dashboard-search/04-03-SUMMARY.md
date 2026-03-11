---
phase: 04-pm-dashboard-search
plan: "03"
subsystem: ui
tags: [react, tanstack-query, tauri, search, jira, gitlab, debounce, tdd]

# Dependency graph
requires:
  - phase: 04-pm-dashboard-search plan 01
    provides: searchJira and searchGitLabMRs service functions, JiraIssue and GitLabMR types
  - phase: 03-notifications-hub
    provides: TopBar component structure, LazyStore mock pattern for tests
  - phase: 02-developer-dashboard
    provides: extractTicketKeys from linkEngine, openUrl from plugin-opener pattern

provides:
  - SearchOverlay component: full-width fixed overlay with 400ms debounce, parallel Jira+GitLab search, grouped results
  - SearchResultPanel component: read-only detail view for Jira issues and GitLab MRs with openUrl buttons
  - TopBar updated: Search icon button and conditional SearchOverlay render

affects:
  - Any future phase using TopBar layout
  - Any phase building on global search capability

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD with separate RED (tests) and GREEN (implementation) commits
    - Promise.allSettled for parallel search — one integration failure never blocks the other
    - debounced useQuery with enabled guard (debouncedQuery.length >= 2 AND tokens present)
    - data-testid="search-backdrop" on overlay root for backdrop click tests
    - data-testid="search-loading" on skeleton component for loading state assertions

key-files:
  created:
    - taskflow/src/components/app/SearchOverlay.tsx
    - taskflow/src/components/app/SearchResultPanel.tsx
  modified:
    - taskflow/src/components/app/SearchOverlay.test.tsx
    - taskflow/src/components/app/SearchResultPanel.test.tsx
    - taskflow/src/components/app/TopBar.tsx

key-decisions:
  - "data-testid attributes added to overlay backdrop and loading skeleton for testability — aria roles alone insufficient for backdrop click detection"
  - "performSearch helper colocated in SearchOverlay.tsx (not exported) — internal implementation detail with no external callers"
  - "SearchOverlay enabled guard requires both tokens AND base URLs AND projectKey — guards against partial auth state"

patterns-established:
  - "Backdrop click: outer div with data-testid + onClick(onClose), inner content div with onClick(stopPropagation)"
  - "Loading skeleton: dedicated component with data-testid='search-loading' and animate-pulse divs"

requirements-completed: [SRCH-01, SRCH-02]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 4 Plan 03: Global Search Summary

**SearchOverlay with 400ms debounced Promise.allSettled parallel Jira/GitLab search, grouped results list, SearchResultPanel read-only detail view, and Search icon in TopBar**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T22:45:58Z
- **Completed:** 2026-03-11T22:50:25Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- SearchOverlay: full-screen fixed overlay with debounced input (400ms, min 2 chars), parallel Jira JQL + GitLab MR search via Promise.allSettled, results grouped into Tasks/Merge Requests sections, loading skeleton, empty state, Escape key and backdrop close
- SearchResultPanel: read-only Jira panel (key, summary, status, assignee, story points, description excerpt) and GitLab MR panel (iid, title, state badge, author, linked ticket key chip), openUrl buttons for both
- TopBar: Search icon button added before Bell popover, conditional SearchOverlay render — no useQuery added to TopBar (constraint respected)
- 24 new tests across SearchOverlay (8) and SearchResultPanel (16), all GREEN; TopBar.test.tsx (3) still GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: SearchOverlay with debounced parallel search and grouped results** - `d467460` (feat)
2. **Task 2: SearchResultPanel and Search icon wired into TopBar** - `3690e6f` (feat)

## Files Created/Modified
- `taskflow/src/components/app/SearchOverlay.tsx` - Full-width fixed search overlay component with debounce and TanStack Query integration
- `taskflow/src/components/app/SearchOverlay.test.tsx` - 8 tests: empty query, single char, loading state, grouped results, empty results, Escape key, backdrop click
- `taskflow/src/components/app/SearchResultPanel.tsx` - Read-only detail panel for JiraIssue (7 fields) and GitLabMR (4 fields + linked key chip)
- `taskflow/src/components/app/SearchResultPanel.test.tsx` - 16 tests covering Jira panel, GitLab panel, openUrl calls, back button, null assignee, null description
- `taskflow/src/components/app/TopBar.tsx` - Added useState(searchOpen), Search icon button, SearchOverlay conditional render

## Decisions Made
- Added `data-testid` attributes to overlay backdrop and loading skeleton — aria roles alone were insufficient to target these elements in tests for backdrop click detection and loading state assertions
- `performSearch` helper function is colocated in SearchOverlay.tsx and not exported — it's an internal implementation detail with no external callers
- `useQuery` enabled guard checks tokens, base URLs, and activeJiraProject — guards against queries firing with partial auth state (e.g., jiraBaseUrl set but token not yet loaded from Stronghold)

## Deviations from Plan

None — plan executed exactly as written. The `data-testid` attributes were added to support testability as described in the behavior spec (loading state test, backdrop click test) — these are implied by the test requirements even though not explicitly listed in the JSX layout.

## Issues Encountered

**Pre-existing MyTasksTab skeleton test failure** — `MyTasksTab.test.tsx > renders skeleton when isLoading` was already failing before this plan's changes (confirmed via git stash). Not caused by Plan 03 changes. Logged to `deferred-items.md`.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Global search is fully implemented with passing tests
- Phase 4 Plan 03 is the final implementation plan — all SRCH requirements complete
- TopBar, SearchOverlay, and SearchResultPanel are ready for integration testing in the Tauri app

---
*Phase: 04-pm-dashboard-search*
*Completed: 2026-03-11*

## Self-Check: PASSED

- taskflow/src/components/app/SearchOverlay.tsx: FOUND
- taskflow/src/components/app/SearchResultPanel.tsx: FOUND
- .planning/phases/04-pm-dashboard-search/04-03-SUMMARY.md: FOUND
- commit d467460: FOUND
- commit 3690e6f: FOUND
