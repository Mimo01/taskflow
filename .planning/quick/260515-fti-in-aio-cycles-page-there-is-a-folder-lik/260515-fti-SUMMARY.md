---
phase: quick-260515-fti
plan: "01"
subsystem: aio
tags: [persistence, zustand, tauri-storage, folder-selection]
dependency_graph:
  requires: [aio-cycles-selection.store, tauri-storage]
  provides: [persisted-folder-selection]
  affects: [AioProjectOverviewPage]
tech_stack:
  added: []
  patterns: [zustand-persist, createTauriStorage]
key_files:
  created:
    - taskflow/src/stores/aio-cycles-selection.store.ts
    - taskflow/src/stores/aio-cycles-selection.store.test.ts
  modified:
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
decisions:
  - "Used createTauriStorage (not localStorage) — codebase standard for client-side persistence in this Tauri app"
  - "Per-projectKey map shape { byProjectKey: Record<string, number> } chosen for JSON round-trip safety (no Map/Set)"
  - "autoExpandedRef reset on projectKey change so navigating between projects re-runs the stored-selection logic"
  - "Ancestor-path expansion implemented: root folders expand themselves, nested folders expand their ancestors"
metrics:
  duration: "~10 minutes"
  completed: "2026-05-15"
  tasks_completed: 3
  tasks_total: 3
---

# Quick Task 260515-fti: Persist Last-Selected Folder in AIO Cycles Page

**One-liner:** Persisted Zustand store keyed by Jira projectKey remembers the last-selected folder in the AIO cycles page across reloads, with graceful stale-ID fallback to first-non-empty.

## What Was Built

### New: `aio-cycles-selection.store.ts`

Zustand store with Tauri-backed persistence (`aio-cycles-selection.json`). Shape:

```ts
{ byProjectKey: Record<string, number> }
```

Exports `useAioCyclesSelectionStore` with three actions:
- `getSelectedFolder(projectKey)` — returns `number | null`
- `setSelectedFolder(projectKey, folderID)` — writes through; supports `-1` for Ungrouped
- `clearSelectedFolder(projectKey)` — removes only the targeted project entry

### Modified: `AioProjectOverviewPage.tsx`

1. **Mount read:** Auto-select effect reads `getSelectedFolder(projectKey)`. If the stored ID is still valid (positive ID found in folder tree via `searchSubtree`, or `-1` with ungroupedCount > 0), it is used as the initial selection instead of `findFirstNonEmptyFolder`.

2. **Stale fallback:** If stored ID is not found in the current tree (deleted/renamed folder, or Ungrouped now empty), the page falls back to `findFirstNonEmptyFolder` and calls `clearSelectedFolder(projectKey)` to evict the stale entry.

3. **Write-through:** `selectFolder(id)` now calls `setSelectedFolder(projectKey, id)` after updating local state. Covers both regular folder clicks and the Ungrouped button (which already calls `selectFolder(-1)`).

4. **Per-project isolation:** A `useEffect(() => { autoExpandedRef.current = false; }, [projectKey])` resets the one-shot guard on navigation so each project re-runs the auto-select logic against its own stored value.

## Persistence Shape

```json
{
  "byProjectKey": {
    "PROJ": 101,
    "OTHER": -1
  }
}
```

Stored in `~/.local/share/<app>/aio-cycles-selection.json` via Tauri LazyStore.

## Stale-ID Fallback Contract

| Condition | Behavior |
|-----------|----------|
| No stored entry for this projectKey | First non-empty folder auto-selected (unchanged behavior) |
| Stored positive ID exists in current folder tree | Stored folder auto-selected |
| Stored positive ID not found in tree | Fallback to first non-empty; stale entry cleared |
| Stored `-1` (Ungrouped) and ungroupedCount > 0 | Ungrouped auto-selected |
| Stored `-1` but ungroupedCount === 0 | Fallback to first non-empty; stale entry cleared |

## Tests

- **Store (5 tests):** empty state returns null; round-trip; per-project isolation; clear removes only targeted key; `-1` is valid
- **Page (3 new tests):** persisted folder auto-selected on second load; stale ID falls back and clears; click persists via `setSelectedFolder`
- **Existing page tests (6):** all passing — no regressions

## Deviations from Plan

No deviations.

## Self-Check

- [x] `taskflow/src/stores/aio-cycles-selection.store.ts` exists
- [x] `taskflow/src/stores/aio-cycles-selection.store.test.ts` exists
- [x] `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` modified
- [x] `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` modified
- [x] Commit `b483023` — Task 1 (store + tests)
- [x] Commit `dee597d` — Task 2 (page wiring + tests)
- [x] Commit `e737311` — Task 3 (expand selected folder, not always first root)
- [x] All 9 tests pass
- [x] Typecheck clean

## Self-Check: PASSED
