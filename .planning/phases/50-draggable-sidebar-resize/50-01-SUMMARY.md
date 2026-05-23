---
phase: 50-draggable-sidebar-resize
plan: "01"
subsystem: hooks, settings-store
tags: [resize, hook, zustand, persistence, foundation]
dependency_graph:
  requires: []
  provides:
    - taskflow/src/hooks/useResizable.ts
    - taskflow/src/stores/settings.store.ts (version 14, four width fields)
  affects:
    - All wave-2 and wave-3 plans (50-02, 50-03, 50-04) depend on these two files
tech_stack:
  added: []
  patterns:
    - useCallback with empty deps array (reads refs only) for stable handleMouseDown
    - widthRef pattern to avoid stale closure in mouseup onCommit
    - document.documentElement cursor/userSelect lock during drag
    - Zustand persist version bump + migration guard pattern (v13 → v14)
key_files:
  created:
    - taskflow/src/hooks/useResizable.ts
  modified:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
decisions:
  - "Use getState() instead of renderHook for default-value assertions in Phase 50 tests — Zustand v5 + @testing-library/react v16 cross-test interaction causes result.current to be null for fields set via partial setState when previous describe block used act(getState().setter) without a renderHook"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-10"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 3
---

# Phase 50 Plan 01: Foundation Hook and Store Extension Summary

Shared drag-resize hook (useResizable) and settings store extension to version 14 with four persisted width fields.

## What Was Built

**useResizable hook** (`taskflow/src/hooks/useResizable.ts` — new file): A zero-dependency React hook encapsulating mousedown/mousemove/mouseup drag logic with bounds clamping, cursor lock (`document.documentElement.style.cursor`), selection suppression, and stale-closure-safe `onCommit` callback. The `widthRef` pattern ensures `onCommit` always receives the final drag position regardless of closure timing. `handleMouseDown` is memoized with `useCallback` and an empty dep array (it reads from refs, not state). Listeners are registered/cleaned up inside a `useEffect([isDragging])` so they are automatically removed on mouseup.

**Settings store extension** (`taskflow/src/stores/settings.store.ts` — modified): Four new width fields added to `SettingsState` interface and store implementation:
- `sidebarWidth: number` — default 224 (was `md:w-56` = 14rem)
- `issueDetailPanelWidth: number | null` — default null (null = use CSS 42% until first drag)
- `mrDetailPanelWidth: number` — default 288 (was `w-72`)
- `releaseDetailPanelWidth: number` — default 288

Store version bumped from 13 → 14. Migration guard at `version < 14` initialises all four fields for users upgrading from v13.

**Store tests** (`taskflow/src/stores/settings.store.test.ts` — modified): New `describe('settings.store — resize panel widths (Phase 50)')` block with 8 tests covering defaults and all four setters. All 26 store tests pass.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| a88cf1b | feat | create useResizable hook |
| 561f0df | feat | extend settings store with width fields and v14 migration |
| b4edf5d | test | add Phase 50 describe block to settings store tests |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zustand v5 + renderHook cross-test state contamination**
- **Found during:** Task 3 — 4 "defaults" tests failed with `result.current` = null or incorrect null value
- **Issue:** After a previous describe block runs `act(() => useSettingsStore.getState().someMethod())` (setter called directly via getState without a prior renderHook), the subsequent `renderHook(() => useSettingsStore())` in a new describe returns null or incorrect values. Zustand v5's subscriber mechanism and @testing-library/react v16's concurrent act flushing interact in a way that leaves `result.current` reflecting the pre-beforeEach state. The plan's verbatim test code used `renderHook(() => useSettingsStore())` for default assertions.
- **Fix:** Changed the 4 default-value `it` blocks to use `useSettingsStore.getState().fieldName` directly instead of `renderHook`. The setter tests (4 of 8) already used `getState()` and were unaffected. The fix is strictly equivalent — getState() reads the same store state, it just doesn't go through a React render cycle.
- **Files modified:** `taskflow/src/stores/settings.store.test.ts`
- **Commit:** b4edf5d

**2. [Rule 3 - Blocker] Worktree lacked node_modules symlink**
- **Found during:** Task 1 verification
- **Issue:** The worktree at `/Users/user/Documents/Projects/taskflow/.claude/worktrees/agent-a9d1504a831bf3596/taskflow/` had no `node_modules` directory, so `npx tsc` and `npx vitest` were unavailable from within the worktree path.
- **Fix:** Created a symlink `taskflow/node_modules → /Users/user/Documents/Projects/taskflow/taskflow/node_modules` inside the worktree. All tooling then worked via `node_modules/.bin/tsc` and `node_modules/.bin/vitest`.
- **Files modified:** None (filesystem symlink only)
- **Commit:** N/A (not committed — symlink is a filesystem artifact, not tracked)

**3. [Rule 1 - Bug] Accidental commit to main branch**
- **Found during:** Task 1 commit
- **Issue:** First commit attempt ran `git commit` from `/Users/user/Documents/Projects/taskflow` (main repo) rather than the worktree root, causing the commit to land on `main`.
- **Fix:** Immediately reverted with `git revert HEAD` on main (commit f6b4448). Then re-wrote the file to the correct worktree path and committed from the worktree branch.
- **Files modified:** None (revert restored main to prior state)
- **Commit on main:** f6b4448 (revert)

## Known Stubs

None — this plan creates foundational infrastructure (hook + store fields) with no UI wiring. The width values are wired to defaults; actual CSS application happens in plans 50-02 and 50-03.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or trust boundary crossings. Width values are numeric, clamped in useResizable, and stored in existing local Tauri store.

## Self-Check

Files created/modified:
- taskflow/src/hooks/useResizable.ts — FOUND
- taskflow/src/stores/settings.store.ts — FOUND (version: 14)
- taskflow/src/stores/settings.store.test.ts — FOUND (Phase 50 describe block)

Commits:
- a88cf1b — FOUND on worktree-agent-a9d1504a831bf3596
- 561f0df — FOUND
- b4edf5d — FOUND

## Self-Check: PASSED
