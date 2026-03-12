---
phase: 02-developer-dashboard
plan: 02
subsystem: ui
tags: [dashboard, tanstack-query, zustand, tauri, vitest, tdd, react, typescript]

# Dependency graph
requires:
  - phase: 02-developer-dashboard
    plan: 01
    provides: "JiraIssue, JiraTransition types + fetchSprintIssues; GitLabMR types + fetchAssignedMRs, fetchReviewerMRs; linkEngine.ts with isStale, ReviewHealth; dashboard.store.ts; settings.store.ts with staleMrThresholdDays"
provides:
  - "DashboardPage with three-tab shell (My Tasks | Sprint Board | MR Attention) in index.tsx"
  - "MyTasksTab with 60s useQuery polling, loading skeleton, error state, last-refreshed timestamp"
  - "SprintBoardTab with column derivation from status.name, horizontal scroll, TaskCard per column"
  - "MrAttentionTab with merged assigned+reviewer MRs (deduped), stale badge, 60s polling"
  - "TaskRow with status badge, MR chip slots (Plan 03 fills), comment button"
  - "TaskCard with compact layout, assignee avatar/initials, health dot slot"
  - "MrRow with stale badge, Tauri opener for web_url, linked task slot (Plan 03 fills)"
  - "popover.tsx wrapping @base-ui/react/popover following tabs.tsx pattern"
  - "StaleMrThresholdSection in Settings page with select 1/2/3/5/7 days, bound to setStaleMrThresholdDays"
affects:
  - 02-03
  - 02-04

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useQuery with refetchInterval: 60_000 + refetchIntervalInBackground: true + staleTime: 30_000 for background polling"
    - "Token read via useRef + useEffect — token stored in ref, not state or Zustand"
    - "MR dedup: const seen = new Set(); [...a, ...b].filter(mr => !seen.has(mr.iid) && seen.add(mr.iid))"
    - "Column derivation: Array.from(new Set(issues.map(i => i.fields.status.name)))"
    - "@tauri-apps/plugin-opener openUrl() for external link opening; fallback to window.open for test environments"
    - "TDD: vi.mock() at module scope + dynamic import in each test for per-test mock control"

key-files:
  created:
    - taskflow/src/components/ui/popover.tsx
    - taskflow/src/routes/dashboard/index.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.tsx
    - taskflow/src/routes/dashboard/TaskRow.tsx
    - taskflow/src/routes/dashboard/TaskCard.tsx
    - taskflow/src/routes/dashboard/MrRow.tsx
    - taskflow/src/routes/dashboard/MyTasksTab.test.tsx
    - taskflow/src/routes/dashboard/MrAttentionTab.test.tsx
    - taskflow/src/routes/settings/StaleMrThresholdSection.tsx
  modified:
    - taskflow/src/routes/settings/Settings.tsx
    - taskflow/src/stores/dashboard.store.ts

key-decisions:
  - "DashTab type extended to include mr-attention — plan spec required three tabs but the store from Plan 01 only had two"
  - "@tauri-apps/plugin-opener (openUrl) used instead of @tauri-apps/plugin-shell (open) — plugin-shell not installed; openUrl is the correct API for this plugin"
  - "MrAttentionTab reviewer MR filter: only includes reviewer MRs with unresolved discussions; assigned MRs always included"

# Metrics
duration: 13min
completed: 2026-03-11
---

# Phase 2 Plan 02: Developer Dashboard UI Summary

**Three-tab developer dashboard with real Jira/GitLab data, 60s polling, loading skeletons, error states, stale MR badges, and Settings page stale threshold selector — 71 tests passing**

## Performance

- **Duration:** ~13 min
- **Completed:** 2026-03-11
- **Tasks:** 3 (Task 1 TDD: RED + GREEN; Task 2 implicit in Task 1 commit; Task 3 feat)
- **Files created:** 11 new files, 2 modified

## Accomplishments

- Built full three-tab DashboardPage: My Tasks, Sprint Board, MR Attention — all with 60s background polling via TanStack Query
- Implemented TaskRow (My Tasks list) with status badge, story points, MR chip slot, comment button
- Implemented TaskCard (Sprint Board) with compact layout, assignee avatar/initials, health dot slot
- Implemented MrRow with stale badge, Tauri plugin-opener for external URLs, linked task slot
- Implemented Base UI Popover primitive following tabs.tsx structural pattern
- Added StaleMrThresholdSection to Settings page with 1/2/3/5/7 day select, persisted via existing store middleware
- 71 tests pass; no regressions from Plan 01

## Task Commits

1. **Task 1 RED: Failing tests for MyTasksTab and MrAttentionTab** - `9630998` (test)
2. **Task 1 GREEN + Task 2: Dashboard shell, tabs, display components** - `19a5db5` (feat)
3. **Task 3: Stale MR threshold selector in Settings** - `d16ec5a` (feat)

## Files Created/Modified

**Created:**
- `taskflow/src/components/ui/popover.tsx` — Base UI Popover wrapper (Root/Trigger/Popup via Positioner/Portal)
- `taskflow/src/routes/dashboard/index.tsx` — DashboardPage three-tab shell
- `taskflow/src/routes/dashboard/MyTasksTab.tsx` — My Tasks with useQuery polling, loading/error/empty states
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — Sprint Board with column derivation, horizontal scroll
- `taskflow/src/routes/dashboard/MrAttentionTab.tsx` — MR Attention with merged/deduped MRs, stale flagging
- `taskflow/src/routes/dashboard/TaskRow.tsx` — Task row with status badge, MR chips, comment button
- `taskflow/src/routes/dashboard/TaskCard.tsx` — Compact sprint board card with avatar + health dot
- `taskflow/src/routes/dashboard/MrRow.tsx` — MR row with stale badge, external link, linked task slot
- `taskflow/src/routes/dashboard/MyTasksTab.test.tsx` — 4 tests for loading/error/empty/refreshed states
- `taskflow/src/routes/dashboard/MrAttentionTab.test.tsx` — 2 tests for stale badge logic
- `taskflow/src/routes/settings/StaleMrThresholdSection.tsx` — Select with 1/2/3/5/7 days options

**Modified:**
- `taskflow/src/routes/settings/Settings.tsx` — Added StaleMrThresholdSection, updated subtitle
- `taskflow/src/stores/dashboard.store.ts` — Extended DashTab type to include 'mr-attention'

## Decisions Made

- **DashTab extended to mr-attention**: Plan 01 store only had 'my-tasks' | 'sprint-board'. The plan spec requires three tabs including 'mr-attention'. Extended the type — non-breaking since the store is ephemeral.
- **@tauri-apps/plugin-opener used for external URLs**: Plan spec referenced `@tauri-apps/plugin-shell` but that package is not installed; the project uses `@tauri-apps/plugin-opener` which exports `openUrl()`. Used that with a `window.open` fallback for test environments.
- **Reviewer MR filtering logic**: Reviewer MRs are only shown if they have at least one unresolved, resolvable discussion note. Assigned MRs are always shown regardless of discussion state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Extended DashTab type to include 'mr-attention'**
- **Found during:** Task 1 (dashboard index.tsx required three tabs; store only had two)
- **Issue:** `dashboard.store.ts` from Plan 01 defined `DashTab = 'my-tasks' | 'sprint-board'` — the plan spec states three tabs but the store implementation was incomplete
- **Fix:** Added `| 'mr-attention'` to the DashTab union type — backwards compatible since the store is ephemeral
- **Files modified:** `taskflow/src/stores/dashboard.store.ts`
- **Committed in:** `19a5db5` (feat commit)

**2. [Rule 3 - Blocking] Used plugin-opener instead of plugin-shell for external URL opening**
- **Found during:** Task 2 (MrRow implementation — `@tauri-apps/plugin-shell` not installed)
- **Issue:** Plan spec referenced `import { open } from '@tauri-apps/plugin-shell'` but this package is not in node_modules. Only `@tauri-apps/plugin-opener` is installed.
- **Fix:** Used `import { openUrl } from '@tauri-apps/plugin-opener'` with `window.open` fallback for test environments
- **Files modified:** `taskflow/src/routes/dashboard/MrRow.tsx`
- **Committed in:** `19a5db5` (feat commit)

---

**Total deviations:** 2 auto-fixed (Rule 1 + Rule 3)
**Impact on plan:** Both fixes essential for correctness. No scope creep. All must-have truths and artifacts satisfied.

## Self-Check: PASSED

All created files exist and all commits verified.

## Next Phase Readiness

- Dashboard is fully functional with real data polling
- TaskRow.linkedMrs and MrRow.linkedTask prop slots are ready for Plan 03 (link engine integration)
- staleMrThresholdDays settings propagates to MrAttentionTab via useSettingsStore
- 71 tests passing, no regressions
