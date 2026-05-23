---
phase: 66-roles-removal
plan: "01"
subsystem: sidebar-items, settings-store
tags: [roles-removal, store-migration, sidebar, wave-1]
dependency_graph:
  requires: []
  provides:
    - getDefaultSidebarItems() no-arg all-visible (ROLES-06 data layer)
    - useSettingsStore role-free at version 22 (ROLES-04)
  affects:
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/sidebar-items.test.ts
tech_stack:
  added: []
  patterns:
    - Zustand persist migrate v22 block (delete field + reset sidebarItems)
    - No-arg default factory function replacing preset-parameterised function
key_files:
  created: []
  modified:
    - taskflow/src/components/app/sidebar-items.ts
    - taskflow/src/components/app/sidebar-items.test.ts
    - taskflow/src/stores/settings.store.ts
decisions:
  - "v9 migration block updated to call getDefaultSidebarItems() no-arg; v22 resets sidebarItems anyway so old-preset semantics are irrelevant for those users"
  - "tsc errors in Wave 2 files (RoleStep.tsx, PresetButtons.tsx, RoleSection.tsx, SidebarItemsList.test.tsx) left in place — expected until Plan 02 removes those callers"
metrics:
  duration: "3m"
  completed_date: "2026-05-23"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 66 Plan 01: Roles Removal — Data Layer Foundation Summary

**One-liner:** Removed role-based preset sidebar system: `getDefaultSidebarItems` becomes no-arg all-visible, `useSettingsStore` drops `role`/`setRole`/`applyPreset` with a v22 migration that resets all users to all-visible.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Simplify getDefaultSidebarItems to no-arg all-visible, remove preset constants | 70a94aee | sidebar-items.ts |
| 2 | Update sidebar-items.test.ts to assert all-visible default | 1ebd32dd | sidebar-items.test.ts |
| 3 | Strip role/setRole/applyPreset from settings store, bump to v22, add migration | 3d18427d | settings.store.ts |

## What Was Built

**Task 1 — sidebar-items.ts simplification:**
- `getDefaultSidebarItems(preset: 'dev' | 'pm')` → `getDefaultSidebarItems()` (no parameter)
- Body replaced: removed `devVisible`/`pmVisible` Sets and `visibleSet` conditional; now returns `SIDEBAR_NAV_ITEMS.map((item) => ({ id: item.id, visible: true }))`
- Deleted `DEV_SIDEBAR_PRESET` and `PM_SIDEBAR_PRESET` exported constants (plus JSDoc comment)
- `SIDEBAR_NAV_ITEMS`, `SIDEBAR_SECTIONS`, `SidebarNavDef`, `SidebarItem` unchanged

**Task 2 — sidebar-items.test.ts update:**
- Replaced two preset-arg test cases (`getDefaultSidebarItems('pm')` and `getDefaultSidebarItems('dev')`) with single all-visible test
- New test asserts: length equals `SIDEBAR_NAV_ITEMS.length`, every item `visible === true`, ids match in order
- Phase 59 workload-absence guard tests (5 tests) preserved unchanged
- Test suite: 5 tests, all passing

**Task 3 — settings.store.ts role removal + v22 migration:**
- Removed `role: 'developer' | 'pm' | 'tech-lead' | null` from `SettingsState` interface
- Removed `setRole: (role: ...) => void` from interface
- Removed `applyPreset: (preset: 'dev' | 'pm') => void` from interface
- Updated doc comment: `Default: DEV_SIDEBAR_PRESET.` → `Default: all items visible.`
- Removed `role: null` from initial state
- Removed `setRole: (role) => set({ role })` action implementation
- Changed initial state: `getDefaultSidebarItems('dev')` → `getDefaultSidebarItems()`
- Removed `applyPreset` action implementation (4 lines)
- Fixed v9 migration block: replaced `const role`/`const preset`/`getDefaultSidebarItems(preset)` with `s.sidebarItems = getDefaultSidebarItems()`
- Bumped persist version: `21` → `22`
- Added v22 migration block after v21 block: `delete (s as Record<string, unknown>).role; s.sidebarItems = getDefaultSidebarItems()`

## Verification Results

- `npx vitest run src/components/app/sidebar-items.test.ts` — 5 passed, 0 failed
- `npx tsc --noEmit` — 0 errors in `sidebar-items.ts` and `settings.store.ts`
- Remaining tsc errors: 4 (in Wave 2 files RoleStep.tsx, PresetButtons.tsx, RoleSection.tsx, SidebarItemsList.test.tsx) — expected, Plan 02 removes those callers
- `grep DEV_SIDEBAR_PRESET|PM_SIDEBAR_PRESET|applyPreset|setRole sidebar-items.ts settings.store.ts` — no matches

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — no placeholder data, no TODO markers, no hardcoded empty values introduced.

## Threat Flags

None — this plan only removes fields and simplifies a factory function. No new network endpoints, auth paths, file access, or schema changes at trust boundaries.

## Self-Check

**Commits exist:**
- 70a94aee: feat(66-01): simplify getDefaultSidebarItems to no-arg all-visible, remove preset constants
- 1ebd32dd: test(66-01): update sidebar-items test to assert all-visible default
- 3d18427d: feat(66-01): strip role/setRole/applyPreset from settings store, bump to v22
