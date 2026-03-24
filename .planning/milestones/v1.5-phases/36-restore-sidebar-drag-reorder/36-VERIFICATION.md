---
phase: 36-restore-sidebar-drag-reorder
verified: 2026-03-24T10:36:58Z
status: passed
score: 4/4 must-haves verified
gaps: []
human_verification:
  - test: "Drag a sidebar item to a new position in Settings > Appearance"
    expected: "Item visually moves, DragOverlay ghost follows pointer, item lands in new slot; store reorderSidebarItem is called; order persists after app restart"
    why_human: "jsdom cannot simulate pointer-drag sequences with dnd-kit; persistence requires Tauri plugin-store IPC which is mocked in tests"
---

# Phase 36: Restore Sidebar Drag-Reorder Verification Report

**Phase Goal:** Restore drag-and-drop reordering of sidebar items in Settings > Appearance using @dnd-kit/sortable
**Verified:** 2026-03-24T10:36:58Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can drag sidebar items to reorder them in Settings > Appearance | VERIFIED | `SidebarItemsList.tsx` rendered inside `AppearanceSection.tsx` (line 64) and `SidebarSection.tsx` (line 20); full dnd-kit DndContext + SortableContext present |
| 2 | Drag handle (GripVertical) initiates drag; checkbox remains independently clickable | VERIFIED | `setActivatorNodeRef` on the button (line 67), `{...listeners}` only on that button, checkbox `onChange` wired independently (line 77-80) |
| 3 | Items can be dragged across section boundaries in Settings list | VERIFIED | Single flat `SortableContext items={allItemIds}` wraps all sections (line 131-133); sections are visual groupings only, not separate contexts |
| 4 | Reordered positions persist (store action fires and Zustand persist saves) | VERIFIED | `handleDragEnd` calls `reorderSidebarItem(oldIndex, newIndex)` (line 119); store action mutates `sidebarItems` array which is governed by Zustand persist (confirmed in settings.store.ts lines 259-265) |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `taskflow/src/routes/settings/SidebarItemsList.tsx` | dnd-kit sortable sidebar reordering UI | VERIFIED | 187 lines; contains `useSortable`, `DndContext`, `SortableContext`, `GripVertical`, `DragOverlay`, `reorderSidebarItem`, `setActivatorNodeRef` |
| `taskflow/src/routes/settings/SidebarItemsList.test.tsx` | Integration tests for drag handle rendering and reorder | VERIFIED | 98 lines; 4 tests — drag handles, checkbox toggle, section headers, row layout |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SidebarItemsList.tsx` | `settings.store.ts` | `reorderSidebarItem(oldIndex, newIndex)` called in `handleDragEnd` | WIRED | Line 119: `reorderSidebarItem(oldIndex, newIndex)` inside `handleDragEnd`; store action verified real at lines 259-265 |
| `SidebarItemsList.tsx` | `@dnd-kit/sortable` | `useSortable` hook with `setActivatorNodeRef` for drag handle | WIRED | Lines 43-51: `useSortable({ id })` with `setActivatorNodeRef` spread onto the `<button>` at line 67 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `SidebarItemsList.tsx` | `sidebarItems` (from `useSettingsStore`) | Zustand store initialized from `DEV_SIDEBAR_PRESET` / persisted via `plugin-store` | Yes — `sidebarItems` array is populated from real store state, mutated by `reorderSidebarItem` | FLOWING |
| `SidebarItemsList.tsx` | `allItemIds` | Derived: `sidebarItems.map(item => item.id)` line 106 | Yes — direct map over live store array, used by `SortableContext items` | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SidebarItemsList component tests pass | `npx vitest run src/routes/settings/SidebarItemsList.test.tsx` | 4/4 tests pass | PASS |
| settings.store reorderSidebarItem tests pass | `npx vitest run src/stores/settings.store.test.ts` | 15/15 tests pass | PASS |
| `useSortable` present in implementation | `grep -c "useSortable" SidebarItemsList.tsx` | 2 matches | PASS |
| `reorderSidebarItem` wired in onDragEnd | `grep -c "reorderSidebarItem" SidebarItemsList.tsx` | 2 matches | PASS |
| `GripVertical` drag handle present | `grep -c "GripVertical" SidebarItemsList.tsx` | 3 matches | PASS |
| Documented commits exist in git history | `git log --oneline \| grep 8c51939\|65d46e1` | Both commits found | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LAYOUT-02 | 36-01-PLAN.md | User can reorder sidebar items via drag-and-drop | SATISFIED | `SidebarItemsList.tsx` implements full dnd-kit sortable; `onDragEnd` calls `reorderSidebarItem`; 4 tests pass |

**Orphaned requirements check:** No additional requirements mapped to Phase 36 in REQUIREMENTS.md beyond LAYOUT-02.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | None detected | — | — |

No TODOs, FIXMEs, placeholder returns, hardcoded empty arrays, or stub handlers found in either modified file.

---

### Human Verification Required

#### 1. Live Drag-and-Drop Interaction

**Test:** In a running Taskflow app, navigate to Settings > Appearance. Locate the sidebar items list. Grab the GripVertical handle on any item (e.g., "Sprint Board") and drag it to a different position — including across a section boundary (e.g., drag from "Planning" into "Main").

**Expected:**
- DragOverlay ghost follows the pointer during drag
- Item lands in the target slot on release
- Section headers remain static; only items move
- The reordered list is immediately reflected in the sidebar nav
- After restarting the app, the custom order is preserved

**Why human:** jsdom cannot simulate pointer-drag sequences with @dnd-kit's `PointerSensor`. The `activationConstraint: { distance: 5 }` requires pointer movement which is not testable in unit tests. Persistence requires Tauri `plugin-store` IPC which is mocked in the test environment.

---

### Gaps Summary

No gaps. All four observable truths are verified. Both required artifacts exist, are substantive (non-stub), are wired into the Settings UI (imported and rendered in `AppearanceSection.tsx` and `SidebarSection.tsx`), and data flows through live Zustand store state. The store action `reorderSidebarItem` is the sole drag-end effect and has its own independently passing unit tests. The only remaining item is a human live-run check of the actual pointer interaction, which cannot be automated without a running Tauri app.

---

### Full Suite Context

The full test suite shows 3 failing test files (ReleasesTab.test.tsx, jira.test.ts, IssueDetailSheet.test.tsx) and 2 partially failing files (BacklogPage.test.tsx, SprintBoardTab.test.tsx). These are pre-existing failures explicitly noted in the SUMMARY as unrelated to Phase 36. The two Phase 36 target files — `SidebarItemsList.test.tsx` and `settings.store.test.ts` — pass 19/19 tests.

---

_Verified: 2026-03-24T10:36:58Z_
_Verifier: Claude (gsd-verifier)_
