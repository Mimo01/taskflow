---
phase: quick-260616-ktv
plan: "01"
subsystem: settings-store
tags: [migration, sidebar, persistence, zustand]
dependency_graph:
  requires: []
  provides: [MYTASK-01]
  affects: [taskflow/src/stores/settings.store.ts, taskflow/src/stores/settings.store.test.ts]
tech_stack:
  added: []
  patterns: [append-at-end sidebar migration, exported pure helper for direct unit testing]
key_files:
  created: []
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
decisions:
  - "Exported appendMyTasksItemIfMissing (unlike unexported sibling helpers) to enable direct unit testing — only deviation from precedent"
  - "Append at end, not splice into position, matching appendStandupNotesItemIfMissing pattern exactly"
  - "Exact-match version assertion kept at 27 (not toBeGreaterThanOrEqual) to catch future drift"
metrics:
  duration: ~5 minutes
  completed_date: 2026-06-16
---

# Quick Task 260616-ktv: My Tasks Sidebar Migration Summary

**One-liner:** Zustand persist v26→v27 migration injecting `{ id: 'my-tasks', visible: true }` into persisted `sidebarItems` so existing users see the My Tasks nav entry without resetting settings.

## What Was Done

Closed milestone-audit BLOCKER MYTASK-01. Existing users whose `settings.json` was written before the My Tasks nav item existed (v9–v26) had no `my-tasks` entry in their persisted `sidebarItems`. Sidebar.tsx builds `visibleIds` from that persisted array, so the entry was permanently invisible for them.

Added `appendMyTasksItemIfMissing` as an exported pure helper immediately after `appendStandupNotesItemIfMissing`, mirroring the exact pattern used by v16 (aio-projects), v21 (worklogs), and v23 (standup-notes) migrations. Bumped persist version 26→27, added the guarded `if (version < 27)` block.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add appendMyTasksItemIfMissing helper + v27 migration | 5c2ac903 | settings.store.ts |
| 2 | Unit tests for helper + fix stale version assertion | cfd70efb | settings.store.test.ts |

## Verification Results

- `npx tsc --noEmit`: clean (0 errors)
- `npx vitest run src/stores/settings.store.test.ts`: 62/62 passed (3 new my-tasks helper tests)
- `npm run check`: 17 warnings (pre-existing, 0 errors) — GREEN

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

**Export deviation (intentional, per plan):** `appendMyTasksItemIfMissing` is exported unlike its three unexported siblings. This was explicitly specified in the plan to enable direct unit testing.

## Known Stubs

None.

## Threat Flags

None — no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check

- [x] `taskflow/src/stores/settings.store.ts` exists and contains `appendMyTasksItemIfMissing`, `version: 27`, `if (version < 27)`
- [x] `taskflow/src/stores/settings.store.test.ts` exists and contains new describe block
- [x] Commit `5c2ac903` exists (Task 1)
- [x] Commit `cfd70efb` exists (Task 2)
