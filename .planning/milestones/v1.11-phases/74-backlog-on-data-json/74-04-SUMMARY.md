---
phase: 74-backlog-on-data-json
plan: 04
subsystem: sidebar-prefetch
tags: [sidebar, prefetch, react-query, greenhopper, backlog]
requires:
  - 74-02 (getGhBacklogData public surface)
provides:
  - "Single-call /backlog prefetch warm using getGhBacklogData(boardId)"
affects:
  - taskflow/src/components/app/Sidebar.tsx
tech-stack:
  added: []
  patterns:
    - "Pattern S4: Sidebar prefetch warm — boardId chain (mirrors /sprint-board)"
key-files:
  created: []
  modified:
    - taskflow/src/components/app/Sidebar.tsx
decisions:
  - "D-08 collapse honored: /backlog prefetch now issues one fetchBoardId → getGhBacklogData chain instead of three legacy fetchers"
  - "D-08a guard preserved: silent return when boardId == null; .catch(() => {}) keeps prefetch best-effort"
metrics:
  duration: ~10 minutes
  completed: 2026-05-29
requirements:
  - GH-BACKLOG-01
---

# Phase 74 Plan 04: Sidebar /backlog Prefetch Collapse Summary

One-liner: Collapsed Sidebar's `/backlog` prefetch from three legacy fetchers (`fetchBacklogIssues`, `fetchSprintList`, `fetchBacklogSprintStories`) into a single `getGhBacklogData(qc, baseUrl, token, boardId)` warm-up that targets the `['gh-backlog', boardId]` cache key BacklogPage reads — flipping Plan 01's `Sidebar.prefetch.test.tsx` GREEN.

## Tasks Completed

| Task | Description | Result |
|------|-------------|--------|
| 1 | Collapse /backlog prefetch chain to single getGhBacklogData call | ✅ |

## Implementation Notes

**Import block (lines 30-38):**
- Removed: `import { fetchBacklogIssues, fetchBacklogSprintStories, fetchSprintList } from '@/services/jira/backlog'`
- Removed: `import { STALE_TIME_MS } from '@/lib/query-constants'` (no longer referenced after the legacy block was deleted — all three STALE_TIME_MS uses lived inside the now-removed `/backlog` chain)
- Added: `getGhBacklogData` to the existing `from '@/services/jira'` named-import group, placed alphabetically after `getGhAllData`

**Prefetch branch (lines ~178-191):**
- Deleted the immediate `prefetchQuery({queryKey: ['jira-backlog-issues', ...]})` call
- Deleted the chained `fetchBoardId → fetchSprintList → fetchBacklogSprintStories` block (~65 lines)
- Replaced with the Pattern S4 skeleton: `fetchQuery({queryKey: ['jira-board-id', ...]})` then `.then(boardId => { if (boardId == null) return; return getGhBacklogData(queryClient, jiraBaseUrl, jiraToken, boardId); }).catch(() => {})` — identical shape to the `/sprint-board` branch above with `getGhAllData` swapped for `getGhBacklogData`
- The `jira-epics-basic` prefetch immediately above (used by both `/backlog` and `/epics` for the epic-filter dropdown) was left untouched per the plan

**Unused selectors removed:** After dropping the legacy chain, `storyPointsFieldKey` and `epicLinkFieldKey` had no remaining references in Sidebar.tsx — removed their `useSettingsStore` selectors to keep biome's unused-var rule happy. `epicNameFieldKey` and `epicColorFieldKey` remain because the `jira-epics-basic` prefetch still consumes them.

## Acceptance Criteria

| Check | Result |
|-------|--------|
| `grep -cE "fetchBacklogIssues\|fetchBacklogSprintStories" Sidebar.tsx` returns 0 | ✅ 0 |
| `grep -cE "from '@/services/jira/backlog'" Sidebar.tsx` returns 0 | ✅ 0 |
| `grep -cE "getGhBacklogData" Sidebar.tsx` returns ≥ 1 | ✅ 4 (1 named import + 1 call site + comment refs) |
| `grep -cE "boardId == null" Sidebar.tsx` returns ≥ 1 | ✅ 2 (`/sprint-board` + `/backlog`) |
| `tsc --noEmit` exits 0 | ✅ |
| `biome check src/components/app/Sidebar.tsx` exits 0 | ✅ |
| `vitest run src/components/app/__tests__/Sidebar.prefetch.test.tsx` exits 0 | ✅ 2 passed |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Removed unused `STALE_TIME_MS` import**
- **Found during:** Task 1
- **Issue:** All three `STALE_TIME_MS` references in Sidebar.tsx lived inside the legacy `/backlog` block (`jira-backlog-issues`, `jira-sprint-list`, `jira-backlog-sprint-stories` prefetches). Dropping that block left the import unused — biome's `noUnusedImports` would have failed the acceptance gate.
- **Fix:** Removed `import { STALE_TIME_MS } from '@/lib/query-constants'` from line 31.
- **Files modified:** taskflow/src/components/app/Sidebar.tsx
- **Commit:** (this commit)

**2. [Rule 3 - Blocking] Removed unused `storyPointsFieldKey` / `epicLinkFieldKey` selectors**
- **Found during:** Task 1
- **Issue:** Both selectors were consumed exclusively by the deleted legacy fetchers (`fetchBacklogIssues` and `fetchBacklogSprintStories`). After the rewrite they had no remaining references — biome's `noUnusedVariables` would have failed.
- **Fix:** Removed the two `useSettingsStore` selector lines for `storyPointsFieldKey` and `epicLinkFieldKey`. Kept `epicNameFieldKey` and `epicColorFieldKey` because the `jira-epics-basic` prefetch (intentionally retained per plan) still consumes them.
- **Files modified:** taskflow/src/components/app/Sidebar.tsx
- **Commit:** (this commit)

Both removals follow naturally from the plan's instruction to delete the legacy fetchers; the plan's `<behavior>` block didn't enumerate them but the acceptance gate (biome check exits 0) would have been unreachable without them. Rule 3 (blocking) applies — fixing them inline is required to satisfy the gate.

### Auth Gates

None.

## Known Stubs

None — the prefetch warm now targets the exact `['gh-backlog', boardId]` key BacklogPage reads (Plan 02 cache layer; Plan 03 page wiring).

## Threat Flags

None — the rewrite removes network surface (three prefetches → one) and introduces no new auth paths, file access, or schema changes. T-74-09 (DoS via null boardId) is mitigated by the preserved `if (boardId == null) return` guard; T-74-10 (info disclosure via swallowed errors) carries forward the Phase 73 `.catch(() => {})` precedent.

## TDD Gate Compliance

Plan 01 (Wave 0) authored `Sidebar.prefetch.test.tsx` in the RED state. This plan provides the GREEN implementation — `vitest run src/components/app/__tests__/Sidebar.prefetch.test.tsx` exits 0 with 2/2 tests passing.

## Self-Check: PASSED

- File modified: `taskflow/src/components/app/Sidebar.tsx` — FOUND
- SUMMARY.md created: `.planning/phases/74-backlog-on-data-json/74-04-SUMMARY.md` — FOUND
- All three verification commands exit 0
- Plan 01 Sidebar.prefetch.test.tsx flipped RED → GREEN
- No modifications to STATE.md or ROADMAP.md (orchestrator owns those)
