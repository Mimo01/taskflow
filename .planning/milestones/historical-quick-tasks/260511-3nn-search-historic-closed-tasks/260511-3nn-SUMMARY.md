---
phase: quick
plan: 260511-3nn
subsystem: ui
tags: [jira, search, command-palette, react-query]

requires: []
provides:
  - searchJiraClosed function in jira/issues.ts and jira.ts with statusCategory=Done JQL
  - "Search closed tasks for..." tail item in CommandPalette search state
  - Separate closed-task result group under "Closed Jira Tasks" heading
affects: [command-palette, jira-search]

tech-stack:
  added: []
  patterns:
    - "Dual-query search pattern: open and closed searches are separate on-demand queries, each capped at 20 results"
    - "Triggered search pattern: closed search only fires when user explicitly clicks the tail item (closedSearchTriggered flag)"

key-files:
  created: []
  modified:
    - taskflow/src/services/jira/issues.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/services/jira/issues.test.ts
    - taskflow/src/components/app/CommandPalette.tsx
    - taskflow/src/components/app/CommandPalette.test.tsx

key-decisions:
  - "Added searchJiraClosed to both jira/issues.ts (tested by issues.test.ts) and jira.ts (used by CommandPalette via @/services/jira import) — the two files coexist as separate implementations"
  - "Closed search placed after live search tail item so open results appear first; closed results are explicitly opt-in"

patterns-established:
  - "On-demand search trigger: closedSearchTriggered state gate prevents query until user explicitly opts in"

requirements-completed: [search-historic-closed-tasks]

duration: 3min
completed: 2026-05-11
---

# Quick Task 260511-3nn: Search Historic Closed Tasks Summary

**Separate on-demand closed-task search in CommandPalette using statusCategory=Done JQL, capped at 20 results, with distinct "Closed Jira Tasks" result group**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-11T10:27:00Z
- **Completed:** 2026-05-11T10:29:30Z
- **Tasks:** 2 (TDD task + UI task)
- **Files modified:** 5

## Accomplishments

- `searchJiraClosed(baseUrl, token, projectKey, query)` exported from both `jira/issues.ts` and `jira.ts`, using `statusCategory = Done AND text ~ query` JQL, maxResults=20, same silent-failure contract as `searchJira`
- Double-quote injection mitigation via `query.replace(/"/g, '\\"')` (threat T-3nn-01 mitigated)
- CommandPalette gains a "Search closed tasks for..." tail item below the live-search trigger; clicking it fires a separate React Query (`['search','closed',query]`) — does not share state with open search
- Results render under "Closed Jira Tasks" heading with same issue-key + summary layout as open results
- All 30 issues.test.ts tests pass; all 12 CommandPalette tests pass; full suite 895/896 pass (1 pre-existing `UpdateDialog` failure, unrelated)

## Task Commits

1. **RED: Failing tests for searchJiraClosed** - `f3e2ff9` (test)
2. **GREEN: searchJiraClosed implementation** - `01c053d` (feat)
3. **Task 2: CommandPalette closed-task search** - `667662c` (feat)

## Files Created/Modified

- `taskflow/src/services/jira/issues.ts` - Added `searchJiraClosed` after `searchJira`
- `taskflow/src/services/jira.ts` - Added `searchJiraClosed` after `searchJira` for CommandPalette import path
- `taskflow/src/services/jira/issues.test.ts` - Added `describe('searchJiraClosed')` block with 4 tests (success, non-ok, network error, JQL assertion)
- `taskflow/src/components/app/CommandPalette.tsx` - Import `searchJiraClosed`, add `closedSearchTriggered` state + reset, add `useQuery` for closed search, add tail item + loading skeleton + results group
- `taskflow/src/components/app/CommandPalette.test.tsx` - Added `searchJiraClosed` to jira service mock

## Decisions Made

- `searchJiraClosed` added to both `jira/issues.ts` and `jira.ts` because the two files are separate parallel implementations — CommandPalette imports from `@/services/jira` (resolves to `jira.ts`), while tests live in `jira/issues.test.ts` (imports from `./issues`). Adding to both avoids breaking the established module structure.
- Closed search tail item positioned after live-search tail item and its results, so open results appear first and closed search is an explicit secondary opt-in action.

## Deviations from Plan

None - plan executed exactly as written. The dual-file addition (both `jira.ts` and `jira/issues.ts`) was clarified during discovery but aligns with the plan's explicit instruction to "Export `searchJiraClosed` from the barrel `taskflow/src/services/jira.ts`".

## Issues Encountered

- Pre-existing `UpdateDialog.test.tsx` failure (1 test) confirmed present before any changes by stashing and re-running. Out of scope per deviation boundary rules; logged to deferred items.

## Known Stubs

None.

## Threat Flags

None - `statusCategory = Done` JQL injection mitigation (T-3nn-01) applied via `query.replace(/"/g, '\\"')`, consistent with existing `searchJira` pattern. No new trust boundaries introduced.

## Next Steps

None - feature complete. Manual smoke test recommended: open command palette, type 2+ chars, verify "Search closed tasks for..." appears below "Search Jira for...", click it, confirm "Closed Jira Tasks" group renders.

---
*Phase: quick*
*Completed: 2026-05-11*
