---
phase: quick-260603-fb8
plan: 01
subsystem: jira
tags: [jira, agile, scrum-board, react-query, zustand, onboarding, settings]

# Dependency graph
requires:
  - phase: prior jira sprint/backlog work
    provides: fetchActiveSprint, fetchBoardId, useBoardId, getGhAllData/getGhBacklogData board chains
provides:
  - listProjectBoards() service + JiraBoard interface
  - per-project jiraBoardIds store map + setJiraBoardId setter
  - stored-board-aware useBoardId funnel
  - boardId? param on both fetchActiveSprint copies, threaded through all 3 direct callers
  - shared BoardPicker component used by onboarding wizard and Settings -> Connections
affects: [jira sprint board, backlog, dashboard active-sprint card, onboarding, settings connections]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-project preference map in zustand persist (jiraBoardIds), default {} merges over old auth.json"
    - "Resolved-id-in-queryKey invalidation: appending boardId to ['jira-active-sprint', ...] keys makes a board switch a fresh fetch"
    - "Shared picker component with loading/error/zero/single(auto-select)/multiple states"

key-files:
  created:
    - taskflow/src/components/jira/BoardPicker.tsx
  modified:
    - taskflow/src/services/jira/sprints.ts
    - taskflow/src/services/jira.ts
    - taskflow/src/stores/auth.store.ts
    - taskflow/src/hooks/useBoardId.ts
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/DashboardSprintCard.tsx
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/routes/onboarding/JiraStep.tsx
    - taskflow/src/routes/settings/ConnectionsSection.tsx
    - taskflow/src/stores/onboarding.store.ts

key-decisions:
  - "boardId param is optional and additive on both fetchActiveSprint copies — undefined preserves the legacy first-board discovery path so existing users are unaffected"
  - "Invalidation via boardId-in-queryKey (not extra invalidateQueries) on the prefetch/dashboard paths; Settings runtime switch additionally invalidates ['jira-active-sprint'] since the key change alone doesn't cover the live SprintBoardTab"
  - "BoardPicker auto-selects a single board exactly once via a ref-guarded effect; gates continue only on multiple-boards-no-choice"

patterns-established:
  - "Pattern: per-project user preference stored in auth.store with a Record<string, number> default of {} (no persist migration needed)"
  - "Pattern: shared Jira picker primitive matching the existing project Select visuals, options labelled name (id) for near-duplicate disambiguation"

requirements-completed: [FB8-1, FB8-2, FB8-3, FB8-4]

# Metrics
duration: 9min
completed: 2026-06-03
---

# Quick 260603-fb8: Select Jira Board Summary

**User-selectable per-project Jira scrum board — fixes the blind values[0] pick by storing jiraBoardIds, threading a boardId through both fetchActiveSprint copies and all 3 active-sprint callers, and adding a shared BoardPicker to the onboarding wizard and Settings -> Connections.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-03T09:37:xxZ
- **Completed:** 2026-06-03T09:46:33Z
- **Tasks:** 3
- **Files modified:** 11 (1 created, 10 modified) + 3 test files

## Accomplishments
- `listProjectBoards()` service returning `JiraBoard[]` (`[]` on failure, `maxResults=100`, no pagination loop) plus the `JiraBoard` interface.
- Optional `boardId?` param on both `fetchActiveSprint` copies (`sprints.ts` + legacy `jira.ts`); when provided it skips internal discovery and uses the chosen board for the active-sprint call.
- `jiraBoardIds` per-project map + `setJiraBoardId` in `auth.store`; `useBoardId` now prefers the stored id (skipping discovery) and falls back to the fetched first board.
- All 3 direct active-sprint callers (SprintBoardTab, DashboardSprintCard via dashboard/index, Sidebar prefetch) thread the resolved board id and include `boardId` in their `['jira-active-sprint', …]` queryKeys.
- Shared `<BoardPicker>` with loading / error+retry / zero (render nothing) / single (read-only, auto-select once) / multiple (`name (id)` Select) states, wired into the onboarding wizard (gates continue on multiple-no-choice, persists choice) and Settings -> Connections (persists + invalidates active-sprint caches on switch).

## Task Commits

1. **Task 1: Data layer (listProjectBoards, store, funnel, fetchActiveSprint boardId)** - `53b212bc` (feat)
2. **Task 2: Thread resolved boardId through 3 active-sprint callers** - `5210c81a` (fix)
3. **Task 3: Shared BoardPicker + wizard and settings wiring** - `9eb6040b` (feat)
4. **Post-gate: biome format + dashboard test mock** - `023c7828` (style)

_Plan/docs metadata commit handled by the orchestrator._

## Files Created/Modified
- `taskflow/src/components/jira/BoardPicker.tsx` - Shared board selector with all five UI states.
- `taskflow/src/services/jira/sprints.ts` - `listProjectBoards` + `JiraBoard`; `boardId?` on `fetchActiveSprint`.
- `taskflow/src/services/jira.ts` - Same `boardId?` change on the legacy duplicate `fetchActiveSprint`.
- `taskflow/src/stores/auth.store.ts` - `jiraBoardIds` map + `setJiraBoardId`.
- `taskflow/src/hooks/useBoardId.ts` - Stored-board preference funnel.
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` - Pass boardId, queryKey includes boardId.
- `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` - New `boardId` prop wired into fetchActiveSprint + queryKey.
- `taskflow/src/routes/dashboard/index.tsx` - Resolve boardId via `useBoardId`, pass to sprint card.
- `taskflow/src/components/app/Sidebar.tsx` - Prefetch reads stored board id before discovery fallback, threads into getGhAllData + active-sprint prefetch.
- `taskflow/src/routes/onboarding/JiraStep.tsx` - Board fetch, picker render, continue gate, persist choice.
- `taskflow/src/routes/settings/ConnectionsSection.tsx` - Picker after successful test, setJiraBoardId + invalidate active-sprint.
- `taskflow/src/stores/onboarding.store.ts` - `jiraBoards` + `jiraBoardId` fields.
- Test files updated: `DashboardSprintCard.test.tsx`, `Sidebar.test.tsx`, `ConnectionsSection.test.tsx`, `dashboard/index.test.tsx`.

## Decisions Made
- See key-decisions frontmatter. Notably: additive optional `boardId` to preserve the existing first-board fallback for users with no stored choice; queryKey-based invalidation as the primary refresh mechanism, supplemented by an explicit `invalidateQueries(['jira-active-sprint'])` only on the Settings runtime-switch path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated test fixtures/mocks for new prop, getState, and QueryClient usage**
- **Found during:** Tasks 2 and 3, and post-gate
- **Issue:** (a) `DashboardSprintCard.test.tsx` rendered the card without the new required `boardId` prop (tsc error). (b) `Sidebar.test.tsx` mocked `useAuthStore` as a bare function with no `getState`, which my prefetch now calls. (c) `ConnectionsSection.test.tsx` rendered the component with no `QueryClientProvider` while it now calls `useQueryClient`, and its auth mock lacked `setJiraBoardId`/`jiraBoardIds`. (d) `dashboard/index.test.tsx` failed because the new `useBoardId` call invokes `useQuery` with no provider.
- **Fix:** Added `boardId={null}` to the 6 card render sites; added `useAuthStore.getState` returning `{ jiraBoardIds: {} }` to the Sidebar mock; wrapped ConnectionsSection renders in a `QueryClientProvider` helper and mocked `listProjectBoards` + extended the auth mock; mocked `@/hooks/useBoardId` in the dashboard index test.
- **Files modified:** the four test files above.
- **Verification:** Affected suites pass (1028 tests green); `npm run check` GREEN.
- **Committed in:** `5210c81a` (Task 2), `9eb6040b` (Task 3), `023c7828` (post-gate).

**2. [Rule 3 - Blocking] biome format reflow of multi-arg fetchActiveSprint calls**
- **Found during:** Final `npm run check`
- **Issue:** Adding the 4th `boardId` argument pushed several `fetchActiveSprint(...)` calls over the line-width limit; biome's formatter flagged them.
- **Fix:** Ran `biome check --write`; the formatter wrapped the calls. No logic change.
- **Files modified:** `useBoardId.ts`, `SprintBoardTab.tsx`, `DashboardSprintCard.tsx`.
- **Verification:** `npm run check` GREEN.
- **Committed in:** `023c7828`.

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking — test infra + formatting). No production-logic deviations.
**Impact on plan:** All auto-fixes were mechanical (test setup + formatting) required to keep tsc/biome/tests green. No scope creep.

## Issues Encountered
- The worktree had no `node_modules`; symlinked the main repo's `taskflow/node_modules` into the worktree so the gate (`tsc`, `vitest`, `biome`) resolves. `node_modules` is gitignored and not committed.
- `npx tsc`/`npx vitest` resolved to an unrelated stub package in this environment; used the local `./node_modules/.bin/` binaries instead.

## User Setup Required
None - no external service configuration required. (Users with an existing `auth.json` lacking `jiraBoardIds` load fine and fall back to the first board, exactly as before.)

## Known Stubs
None - all picker states wire to real data sources (`listProjectBoards`, `jiraBoardIds`).

## Threat Flags
None - no new network endpoints, auth paths, or trust-boundary surface beyond the already-used Jira Agile board endpoint.

## Next Phase Readiness
- Board selection ships end-to-end: data layer, store, all active-sprint consumers, and both UI insertion points.
- Known limit (agreed): board listing is capped at `maxResults=100` with no pagination loop.

## Self-Check: PASSED
- Created file present: `taskflow/src/components/jira/BoardPicker.tsx` (FOUND).
- Task commits present: `53b212bc`, `5210c81a`, `9eb6040b`, `023c7828` (all FOUND in git log).
- `npm run check` GREEN; affected vitest suites 1028 passed / 2 skipped.

---
*Quick task: 260603-fb8-select-jira-board*
*Completed: 2026-06-03*
