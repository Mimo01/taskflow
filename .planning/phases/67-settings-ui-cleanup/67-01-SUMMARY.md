---
phase: 67-settings-ui-cleanup
plan: "01"
subsystem: settings-ui
tags: [cleanup, dnd-kit-removal, sidebar, settings, tdd]
dependency_graph:
  requires: []
  provides: [visibility-only-sidebar-list, dnd-kit-uninstalled]
  affects: [taskflow/src/routes/settings/SidebarItemsList.tsx, taskflow/src/stores/settings.store.ts]
tech_stack:
  removed: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/modifiers", "@dnd-kit/utilities"]
  patterns: [checkbox-visibility-toggle, section-grouping, zustand-store-action-removal]
key_files:
  created: []
  modified:
    - taskflow/src/routes/settings/SidebarItemsList.tsx
    - taskflow/src/routes/settings/SidebarItemsList.test.tsx
    - taskflow/src/routes/settings/Settings.test.tsx
    - taskflow/src/stores/settings.store.ts
    - taskflow/package.json
    - taskflow/package-lock.json
decisions:
  - "Removed reorderSidebarItem from SettingsState type and implementation without bumping store version (D-04: in-memory action removal does not affect persisted data)"
  - "npm run build used (not just tsc) to catch CSS/import resolution failures per Phase 59 standing rule"
metrics:
  duration_minutes: 15
  completed_date: "2026-05-24"
  tasks_completed: 2
  files_changed: 6
---

# Phase 67 Plan 01: Strip dnd-kit drag-and-drop from Settings Sidebar List Summary

**One-liner:** Replaced 180-LOC dnd-kit sortable component with a 50-LOC visibility-only checkbox list grouped by section, removed reorderSidebarItem store action, and uninstalled all four @dnd-kit/* packages with green build.

## What Was Built

### Task 1: Rewrite SidebarItemsList + remove reorderSidebarItem (TDD)

**RED commit:** `c12a72f5` — Updated test file with failing new row-structure test; removed drag-handle and old row-structure tests; removed reorderSidebarItem from mock state.

**GREEN commit:** `ae272617` — Implemented all changes:

- `SidebarItemsList.tsx`: Rewritten from ~180 LOC to 50 LOC. Removed all @dnd-kit/* imports, GripVertical, useState, SortableItem component, DndContext, SortableContext, DragOverlay, useSortable, useSensors, handleDragStart, handleDragEnd, activeId state. Now renders via `SIDEBAR_NAV_ITEMS.filter(nav.section === section.id)` (static registry order correct now that reorder is gone). Visibility lookup via `new Map(sidebarItems.map(item => [item.id, item.visible]))` with `?? true` default.
- `settings.store.ts`: Removed `reorderSidebarItem` from SettingsState type (was line 158) and its implementation block (was lines 307-313). `setSidebarItems` and `setSidebarItemVisible` untouched. `version: 22` unchanged.
- `SidebarItemsList.test.tsx`: Deleted drag-handle rendering test and old row-structure test. Added replacement row-structure test asserting checkbox before label with no drag button and no data-sortable-item attribute. Removed reorderSidebarItem from mock state setup.
- `Settings.test.tsx`: Removed `reorderSidebarItem: vi.fn()` from mock store object.

### Task 2: Uninstall @dnd-kit packages + verify build

**Commit:** `f60c834f` — Ran `npm uninstall @dnd-kit/core @dnd-kit/sortable @dnd-kit/modifiers @dnd-kit/utilities` from the worktree's taskflow directory. Both package.json and package-lock.json now have zero @dnd-kit entries. `npm run build` exits 0 with no dnd-kit resolution errors.

## Verification Results

All phase-level verification checks passed:

1. **SETUI-02:** `grep -rc '@dnd-kit' src/` returns 0 across all files.
2. **SETUI-02:** `grep -c 'data-sortable-item|GripVertical|DndContext' src/routes/settings/SidebarItemsList.tsx` returns 0.
3. **SETUI-02 store:** `grep -rc 'reorderSidebarItem' src/` returns 0 across all files.
4. **SETUI-01 (pre-satisfied Phase 66):** `grep -c 'SidebarItemsList' src/routes/settings/AppearanceSection.tsx` returns 0.
5. **SETUI-03 (pre-satisfied Phase 66):** `grep -c 'version: 22' src/stores/settings.store.ts` returns 1; v22 migration resets sidebarItems to all-visible.
6. **tsc:** `npx tsc --noEmit` exits 0.
7. **Build:** `npm run build` exits 0; no dnd-kit resolution errors.
8. **Tests:** `npx vitest run src/routes/settings/` — 61 tests passing across 5 test files.

SidebarItemsList.tsx: 50 LOC (target: 40-70 LOC). Component renders checkbox-per-item visibility list with section headers (Main, Planning, Code, Tracking, Testing) and no drag UI.

## TDD Gate Compliance

- RED gate: commit `c12a72f5` — `test(67-01)` commit with 1 failing test (drag-handle assertion).
- GREEN gate: commit `ae272617` — `feat(67-01)` commit with all 21 tests passing.
- REFACTOR: no cleanup needed; component is already minimal.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — SidebarItemsList renders live data from `useSettingsStore().sidebarItems` with no hardcoded placeholders.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes introduced. This plan only removed code (dnd-kit packages and reorderSidebarItem action).

## Self-Check: PASSED

- [x] `taskflow/src/routes/settings/SidebarItemsList.tsx` exists and contains 50 LOC with no @dnd-kit imports
- [x] `taskflow/src/stores/settings.store.ts` exists with `version: 22`, no `reorderSidebarItem`
- [x] `taskflow/src/routes/settings/SidebarItemsList.test.tsx` updated — no drag-handle test names
- [x] `taskflow/src/routes/settings/Settings.test.tsx` updated — no `reorderSidebarItem: vi.fn()`
- [x] Commits c12a72f5, ae272617, f60c834f exist in git log
- [x] `npm run build` green
- [x] 61 settings tests passing
