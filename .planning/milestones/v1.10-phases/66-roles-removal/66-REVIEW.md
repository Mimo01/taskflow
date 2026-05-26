---
phase: 66-roles-removal
reviewed: 2026-05-23T23:11:39Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - taskflow/src/components/app/sidebar-items.ts
  - taskflow/src/components/app/sidebar-items.test.ts
  - taskflow/src/stores/settings.store.ts
  - taskflow/src/routes/settings/SidebarSection.tsx
  - taskflow/src/routes/settings/AppearanceSection.tsx
  - taskflow/src/routes/settings/Settings.tsx
  - taskflow/src/components/app/OnboardingWizard.tsx
  - taskflow/src/stores/onboarding.store.ts
  - taskflow/src/stores/onboarding.store.test.ts
  - taskflow/src/lib/tauri-storage.test.ts
  - taskflow/src/routes/settings/SidebarItemsList.test.tsx
  - taskflow/src/routes/settings/Settings.test.tsx
  - taskflow/src/routes/settings/ConnectionsSection.test.tsx
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 66: Code Review Report

**Reviewed:** 2026-05-23T23:11:39Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 66 successfully removes `role`, `setRole`, `applyPreset`, `RoleStep`, `PresetButtons`, and `RoleSection` from the codebase, collapses the onboarding wizard from 5 to 4 steps, and bumps the settings store to version 22. The mechanical deletions are clean — `role` is absent from the state interface and all deleted source files are gone.

Two blockers were found. The v22 migration unconditionally replaces `sidebarItems` with the all-visible default, destroying any order or visibility customizations the user made before upgrading — the phase only needed to delete the `role` key, not reset the sidebar. Additionally, `SidebarItemsList` renders items in the static `SIDEBAR_NAV_ITEMS` definition order while passing the user-ordered `sidebarItems` store array as the SortableContext ID list; after any prior reorder the two sequences diverge, causing dnd-kit to compute drop targets against the wrong item positions and produce incorrect store mutations.

Four warnings and three info items cover a stale module doc comment, the missing upper-bound clamp on `goNext`, `SidebarItemsList` appearing in both `AppearanceSection` and the dedicated `SidebarSection`, a duplicate `SidebarItem` interface, and gaps in test coverage.

---

## Critical Issues

### CR-01: v22 migration unconditionally resets sidebarItems — destroys all user customizations on upgrade

**File:** `taskflow/src/stores/settings.store.ts:414-417`

**Issue:** The v22 migration block calls `getDefaultSidebarItems()` and overwrites `s.sidebarItems` for every user upgrading from version 21 or earlier. The only state that phase 66 needed to clean up was the `role` key. All previous migrations that modified `sidebarItems` (v9, v16, v21) used `appendXxxItemIfMissing` to add new entries without disturbing existing order or visibility. The v22 block abandons this pattern: a user who hid "Worklogs", reordered their nav, or toggled any sidebar item will silently lose those preferences after the first launch following the upgrade.

```ts
// Current — destructive:
if (version < 22) {
  delete (s as Record<string, unknown>).role;
  s.sidebarItems = getDefaultSidebarItems(); // ← wipes all user customizations
}

// Fix — only delete the role key; sidebarItems is already valid from v21:
if (version < 22) {
  delete (s as Record<string, unknown>).role;
}
```

---

### CR-02: SidebarItemsList SortableContext order diverges from rendered DOM order after any reorder — drag produces wrong indices

**File:** `taskflow/src/routes/settings/SidebarItemsList.tsx:97,125,133`

**Issue:** `SortableContext` receives `allItemIds` built from `sidebarItems` (the store-ordered array, line 97). The rendered `<SortableItem>` elements are produced by filtering `SIDEBAR_NAV_ITEMS` per section (line 125) — a static iteration that ignores the store order. On first load the two sequences are identical. After a user drags one item, the store order changes but the rendered DOM order remains static. dnd-kit resolves collision detection from physical DOM layout, not from the SortableContext `items` prop order. `handleDragEnd` then calls `sidebarItems.findIndex()` (lines 107–108) to map the dnd-kit active/over IDs back to integer indices, but because the DOM and the store now describe different orderings, those indices correspond to different items — the store mutation is wrong. The reorder persists to disk in the incorrect order.

```tsx
// Fix: render items in sidebarItems store order, not static SIDEBAR_NAV_ITEMS order.
// Replace the current SIDEBAR_SECTIONS.map block with:

const sectionedGroups = SIDEBAR_SECTIONS.map((section) => ({
  section,
  items: sidebarItems
    .map((si) => SIDEBAR_NAV_ITEMS.find((nav) => nav.id === si.id))
    .filter((nav): nav is SidebarNavDef => nav !== undefined && nav.section === section.id),
}));

// Then render sectionedGroups instead of the current static filter.
// This ensures the DOM order always mirrors sidebarItems, keeping dnd-kit consistent.
```

---

## Warnings

### WR-01: goNext() has no upper-bound clamp — step can exceed last valid index

**File:** `taskflow/src/stores/onboarding.store.ts:42`

**Issue:** `goBack` is symmetrically clamped via `Math.max(0, ...)`, but `goNext` is unclamped: `set({ step: get().step + 1 })`. The wizard has 4 steps (indices 0–3); `DoneStep` has no "Next" button so normal navigation cannot exceed step 3. However any external caller (e.g. a test, a keyboard shortcut) can push `step` past 3. `OnboardingWizard` handles the out-of-range step with `STEP_COMPONENTS[step] ?? DoneStep`, but `StepIndicator` receives the invalid `currentStep` value: none of the 4 circles match `index === 4`, so all render in the muted "future" style — a silent visual regression.

```ts
// Fix: mirror the goBack clamp
const STEP_MAX = 3; // STEP_COMPONENTS.length - 1; keep in sync with OnboardingWizard
goNext: () => set({ step: Math.min(STEP_MAX, get().step + 1) }),
```

---

### WR-02: SidebarItemsList appears in both AppearanceSection and the dedicated SidebarSection

**File:** `taskflow/src/routes/settings/AppearanceSection.tsx:14,61-64`

**Issue:** `AppearanceSection` still imports and renders `<SidebarItemsList />` under a "Sidebar Items" label (lines 61–64). `Settings.tsx` now also exposes a dedicated "Sidebar" tab that renders `SidebarSection → SidebarItemsList`. Both are live in the same `Settings` shell. Phase 66 removed `PresetButtons` from `AppearanceSection` but left `SidebarItemsList` in place. A user visiting "Appearance" sees the full sidebar toggle list; so does a user visiting "Sidebar". There is one authoritative control rendered in two places, and changes made in one section are immediately visible in the other — but this is confusing UX and indicates an incomplete migration.

```tsx
// Fix: remove from AppearanceSection.tsx:
// - line 14: import SidebarItemsList from './SidebarItemsList';
// - lines 60-65: the entire "Sidebar Items" div block
```

---

### WR-03: persistChangelogBeforeRestart hard-codes version: 21 as the empty-store fallback

**File:** `taskflow/src/lib/tauri-storage.ts` (line with `version: 21` in the fallback object)

**Issue:** When `store.get()` returns `null` (first launch, empty store) or an unparseable value, `persistChangelogBeforeRestart` initialises a fallback object with `version: 21`. The settings store was bumped to version 22 by this phase. A fresh install that calls `persistChangelogBeforeRestart` before Zustand has written its first snapshot writes a `version: 21` document to disk. On next launch Zustand reads `version: 21`, runs the `version < 22` migration, and calls `getDefaultSidebarItems()` (the CR-01 reset) unnecessarily. The `tauri-storage.test.ts` fixtures also use `version: 21` and `toBe(21)` assertions so the tests will keep passing while the mismatch exists in production.

**Fix:** Keep the fallback version in sync with the persist schema version. Define a shared constant or use an import:
```ts
// In tauri-storage.ts:
const SETTINGS_SCHEMA_VERSION = 22; // keep in sync with settings.store.ts
let parsed = { state: {} as Record<string, unknown>, version: SETTINGS_SCHEMA_VERSION };
```
Update `tauri-storage.test.ts` fixture objects and `toBe(21)` assertions to use 22.

---

### WR-04: Duplicate SidebarItem interface — settings.store.ts redeclares the type instead of importing it

**File:** `taskflow/src/stores/settings.store.ts:19-22`

**Issue:** `sidebar-items.ts` exports `interface SidebarItem { id: string; visible: boolean }`. `settings.store.ts` declares and exports an identically shaped `interface SidebarItem` locally (lines 19–22) rather than importing the canonical definition. The two types are structurally identical today. Any future divergence will cause a silent mismatch: the cast on line 393 (`s.sidebarItems as SidebarItem[]`) would cast to the store-local type, while `getDefaultSidebarItems()` returns the `sidebar-items.ts` type, and TypeScript's structural typing would hide the inconsistency until runtime.

```ts
// Fix: remove the local redeclaration and import the canonical export:
import { getDefaultSidebarItems, type SidebarItem } from '@/components/app/sidebar-items';
```

---

## Info

### IN-01: Stale module-level doc comment in settings.store.ts

**File:** `taskflow/src/stores/settings.store.ts:2`

**Issue:** The file-level JSDoc reads `"Settings store — role and theme, persisted via Tauri Store plugin."` The `role` field was the subject of this phase's removal; the comment is now factually wrong.

**Fix:**
```ts
/**
 * Settings store — theme, sidebar, and app preferences, persisted via Tauri Store plugin.
 */
```

---

### IN-02: No absence-guard tests for removed role fields in settings.store.test.ts

**File:** `taskflow/src/stores/settings.store.test.ts`

**Issue:** Phase 59 established the pattern of adding a `describe('settings.store — widget removal')` block that asserts removed fields are absent from the live store state. Phase 66 removes `role`, `setRole`, and `applyPreset` but adds no equivalent block. Without these tests, re-introduction of the field (e.g. via a bad merge) will not be caught by the test suite.

```ts
describe('settings.store — roles removal (Phase 66)', () => {
  it('role field is absent from store state', () => {
    expect('role' in useSettingsStore.getState()).toBe(false);
  });
  it('setRole action is absent from store state', () => {
    expect('setRole' in useSettingsStore.getState()).toBe(false);
  });
  it('applyPreset action is absent from store state', () => {
    expect('applyPreset' in useSettingsStore.getState()).toBe(false);
  });
});
```

---

### IN-03: SidebarItemsList.test.tsx section-header assertion omits "Testing"

**File:** `taskflow/src/routes/settings/SidebarItemsList.test.tsx:67-73`

**Issue:** The test `'renders section headers: Main, Planning, Code, Tracking'` asserts all four human-visible section labels but omits "Testing" — which is present in `SIDEBAR_SECTIONS` and rendered whenever `aio-projects` is in `sidebarItems` (it always is by default). The omission is inconsistent with the test description implying complete coverage.

```ts
// Add:
expect(screen.getByText('Testing')).toBeInTheDocument();
// Update test name to include 'Testing'.
```

---

_Reviewed: 2026-05-23T23:11:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
