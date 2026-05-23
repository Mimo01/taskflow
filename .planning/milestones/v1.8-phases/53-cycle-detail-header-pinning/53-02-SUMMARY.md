---
phase: 53
plan: "02"
subsystem: pinned-tabs-store + pinned-tab-strip
tags: [zustand, store-migration, discriminated-union, react-component, header-pinning]
dependency_graph:
  requires: ["53-00"]
  provides: ["53-03"]
  affects: ["taskflow/src/stores/pinned-tabs.store.ts", "taskflow/src/components/app/PinnedTabStrip.tsx"]
tech_stack:
  added: []
  patterns: ["discriminated-union-props", "zustand-persist-migration", "react-tab-rendering"]
key_files:
  modified:
    - taskflow/src/stores/pinned-tabs.store.ts
    - taskflow/src/components/app/PinnedTabStrip.tsx
decisions:
  - "Store version bumped 0→1 with sequential migration guard (if version < 1) — matches settings.store.ts pattern"
  - "pinnedCycleMeta default {} placed in create() factory body (not only migration) to cover fresh installs"
  - "PinnedTabStrip JSDoc comment updated to reflect new resolvedTabs prop name"
  - "Pre-existing test failures (UpdateDialog, AioCycleDetailPage stub) confirmed pre-existing; not fixed per scope boundary rule"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-13"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 2
---

# Phase 53 Plan 02: Store Extension + PinnedTabStrip Refactor Summary

Extended `usePinnedTabsStore` with `pinnedCycleMeta` persistence (version 0→1 migration) and refactored `PinnedTabStrip` to accept a `Map<string, IssueTab | CycleTab>` discriminated union prop, enabling cycle tabs to render alongside issue tabs with `FlaskConical` icon + cycle key + cycle name.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Extend pinned-tabs.store.ts (version 0→1, cycle metadata) | 8f07339 | taskflow/src/stores/pinned-tabs.store.ts |
| 2 | Refactor PinnedTabStrip.tsx (discriminated union prop, cycle tab rendering) | e5ab0da | taskflow/src/components/app/PinnedTabStrip.tsx |

## What Was Built

### Task 1 — pinned-tabs.store.ts (5 surgical changes)

- **CHANGE 1:** Added `pinnedCycleMeta: Record<string, { name: string; projectKey: string }>` to `PinnedTabsState` interface
- **CHANGE 2:** Added `setPinnedCycleMeta` and `clearCycleMeta` action signatures to interface
- **CHANGE 3:** Added `pinnedCycleMeta: {}` default in `create()` factory body (covers fresh installs that never run migration)
- **CHANGE 4:** Added `setPinnedCycleMeta` and `clearCycleMeta` action implementations after `isPinned`
- **CHANGE 5:** Bumped `version: 0` to `version: 1`; replaced migrate stub with real guard: `if (version < 1) { s.pinnedCycleMeta = {}; }`

All 5 existing tests (togglePin, isPinned, removePin, reorder) pass. 5 Wave 0 todos remain as todos.

### Task 2 — PinnedTabStrip.tsx (8 surgical changes + comment update)

- **CHANGE 1:** Added `FlaskConical` to lucide-react import in alphabetical position
- **CHANGE 2:** Replaced `interface ResolvedIssue` with three-type discriminated union: `IssueTab`, `CycleTab`, `ResolvedTab`
- **CHANGE 3:** Renamed prop in interface: `resolvedIssues: Map<string, ResolvedIssue>` → `resolvedTabs: Map<string, ResolvedTab>`
- **CHANGE 4:** Updated function destructure: `resolvedIssues` → `resolvedTabs`
- **CHANGE 5:** Updated ghost render lookup: `resolvedIssues.get(key)` → `resolvedTabs.get(key)`
- **CHANGE 6:** Replaced ghost content branch with three-way type switch (`'cycle'` / `'issue'` / fallback Loader2)
- **CHANGE 7:** Updated main tab render lookup: `resolvedIssues.get(key)` → `resolvedTabs.get(key)`
- **CHANGE 8:** Replaced main tab content branch with same three-way type switch
- **BONUS:** Updated `aria-label="Pinned issues"` → `aria-label="Pinned tabs"`
- **BONUS:** Updated JSDoc comment to reflect new `resolvedTabs` prop name

Cycle tabs render: `<FlaskConical className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />` + cycle key in `font-mono text-[9px]` + cycle name in `text-[11px] leading-tight`.

All drag/reorder/ghost/context-menu/pointer-event behavior unchanged. 6 Wave 0 todos remain.

## Verification Results

```
pinned-tabs.store.test.ts  — 5 passed, 5 todo (all existing tests green)
PinnedTabStrip.test.tsx    — 1 skipped (todo-only file), 6 todo (no crashes)
```

TypeScript check (`npx tsc --noEmit --skipLibCheck`): zero errors on `pinned-tabs.store.ts` and `PinnedTabStrip.tsx`.

## Deviations from Plan

None — plan executed exactly as written. All 8 touch points in PinnedTabStrip and 5 changes in the store were applied as specified.

## Pre-existing Failures (out of scope)

Two test failures were present before this plan's changes and remain unchanged:
- `UpdateDialog.test.tsx` — "Update Now calls invoke relaunch" (pre-existing, unrelated to this plan)
- `AioCycleDetailPage.test.tsx` — Wave 0 stub referencing page not yet created by Plan 53-01 (parallel wave)

These are logged here for the verifier but are not regressions from this plan.

## Known Stubs

None in the files modified by this plan. The `resolvedIssues` prop call site in `main.tsx` (line 488) still uses the old prop name — this is the intentional Wave 2 wiring gap documented in the plan frontmatter (`key_links`). Plan 53-03 will update `main.tsx`.

## Threat Flags

No new security surface introduced. Store migration safely initializes `pinnedCycleMeta = {}` for v0 persisted state — no user-supplied data enters the migration path (T-53-02-01 mitigated as designed).

## Self-Check

Files exist:
- taskflow/src/stores/pinned-tabs.store.ts — FOUND
- taskflow/src/components/app/PinnedTabStrip.tsx — FOUND

Commits exist:
- 8f07339 — feat(53-02): extend pinned-tabs store with cycle metadata (v0→v1)
- e5ab0da — feat(53-02): refactor PinnedTabStrip for discriminated union (IssueTab | CycleTab)

## Self-Check: PASSED
