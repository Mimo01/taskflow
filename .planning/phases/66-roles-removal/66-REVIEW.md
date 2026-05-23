---
phase: 66-roles-removal
reviewed: 2026-05-23T22:57:15Z
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
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 66: Code Review Report

**Reviewed:** 2026-05-23T22:57:15Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

This phase removes the `role` field from the settings store and related UI, adds a dedicated Sidebar settings section, and cleans up tech debt. The core deletions are correct: `role` is gone from the state interface, the v22 migration deletes it from persisted data, and sidebar-items.ts has no workload entry (tests confirm absence). The new `SidebarSection` renders and navigates correctly.

Three concerns are worth fixing before shipping: (1) `goNext()` in the onboarding store has no upper-bound clamp, which lets `step` increment past the last step index into out-of-bounds territory at runtime; (2) `SidebarItemsList` renders items in static `SIDEBAR_NAV_ITEMS` order regardless of what the user drags, so the drag-reorder action updates the store but the settings UI never reflects the new order; (3) `persistChangelogBeforeRestart` hard-codes `version: 21` as the empty-store fallback even though the store is now at version 22, so a fresh install that triggers this path before the first write will write a stale schema version into the store. The remaining items are code-quality issues.

---

## Warnings

### WR-01: `goNext()` has no upper-bound clamp — step can exceed last valid index

**File:** `taskflow/src/stores/onboarding.store.ts:42`
**Issue:** `goBack` is clamped at 0 via `Math.max`, but `goNext` is unclamped:
```ts
goNext: () => set({ step: get().step + 1 }),
```
`STEP_COMPONENTS` has 4 entries (indices 0–3). If any child step component calls `goNext()` on the final step, `step` becomes 4. `OnboardingWizard` guards this with `STEP_COMPONENTS[step] ?? DoneStep`, so the UI does not crash — but `step === 4` is an invalid persistent value. If the store is not cleared between sessions and the wizard is re-opened, `step` begins at 4 and `DoneStep` renders immediately rather than at `step === 3`. The onboarding test suite does not cover calling `goNext()` past the last step.

**Fix:**
```ts
// onboarding.store.ts — mirror the goBack clamp
const MAX_STEP = 3; // STEP_COMPONENTS.length - 1
goNext: () => set({ step: Math.min(MAX_STEP, get().step + 1) }),
```
Add a corresponding test: `goNext clamps at MAX_STEP`.

---

### WR-02: Drag-reorder in `SidebarItemsList` updates the store but the settings UI renders in static order

**File:** `taskflow/src/routes/settings/SidebarItemsList.tsx:124-147`
**Issue:** The drag handler correctly writes the new order into the store via `reorderSidebarItem(oldIndex, newIndex)`. However, the list renders by iterating `SIDEBAR_SECTIONS` then filtering `SIDEBAR_NAV_ITEMS` — both static arrays. After a drag, `SortableContext` receives the updated `allItemIds` (store order), but the rendered `<SortableItem>` elements are produced from the static filter, so their DOM order never changes. The drag ghost snaps back to the original position visually. The reorder persists to the store (and Sidebar.tsx also ignores it, as it also iterates `SIDEBAR_NAV_ITEMS` statically), making the feature fully inert end-to-end.

**Fix:** Render items in store order, not static order. Replace the section-grouped iteration with a flat map over `sidebarItems` that looks up each nav definition:
```tsx
// Replace SIDEBAR_SECTIONS.map(...) in the JSX with:
const orderedNavItems = sidebarItems
  .map((item) => SIDEBAR_NAV_ITEMS.find((nav) => nav.id === item.id))
  .filter((nav): nav is SidebarNavDef => nav !== undefined);

// Then render orderedNavItems directly (section headers become optional separators)
```
`Sidebar.tsx` will also need the same change if cross-section reordering is intended; otherwise constrain dragging to within-section only.

---

### WR-03: `persistChangelogBeforeRestart` hard-codes `version: 21` as the empty-store fallback

**File:** `taskflow/src/lib/tauri-storage.ts:55`
**Issue:** When `get()` returns `null` (empty store on first launch) or returns an unparseable value, the fallback object is:
```ts
let parsed: { state: Record<string, unknown>; version: number } = { state: {}, version: 21 };
```
The store is now at schema version 22 (bumped by this phase). A fresh install that calls `persistChangelogBeforeRestart` before Zustand has written its first snapshot will write `version: 21` into the file. On next launch Zustand reads `version: 21`, runs the `version < 22` migration branch, and calls `getDefaultSidebarItems()` — which is harmless but is an unnecessary migration run that overwrites any state that `persistChangelogBeforeRestart` may have written alongside `lastSeenChangelog`. The tauri-storage tests use `version: 21` in their fixtures and assertions, so they will continue to pass while the production mismatch exists.

**Fix:**
```ts
// Keep version in sync with settings.store.ts persist version
const SETTINGS_STORE_VERSION = 22;
let parsed: { state: Record<string, unknown>; version: number } = {
  state: {},
  version: SETTINGS_STORE_VERSION,
};
```
Update `tauri-storage.test.ts` fixtures accordingly to use version 22, and update the `expect(parsed.version).toBe(21)` assertion on line 54 to `toBe(22)`.

---

### WR-04: Duplicate `SidebarItem` interface — `settings.store.ts` redeclares what `sidebar-items.ts` already exports

**File:** `taskflow/src/stores/settings.store.ts:19-22`
**Issue:** `sidebar-items.ts` exports `SidebarItem` (lines 19-22). `settings.store.ts` also declares and exports an identically shaped `SidebarItem` interface (lines 19-22) instead of importing the canonical one. The two definitions are currently identical, but they are structurally separate types. Any future divergence (e.g. adding an `order` field to one but not the other) will introduce silent type mismatches at the cast on migration line 393: `s.sidebarItems as SidebarItem[]` would cast to the store's local type while `getDefaultSidebarItems()` returns the `sidebar-items.ts` type.

**Fix:**
```ts
// settings.store.ts — remove local redeclaration and import the canonical type
import { getDefaultSidebarItems, type SidebarItem } from '@/components/app/sidebar-items';
```
Remove the local `export interface SidebarItem { ... }` block.

---

## Info

### IN-01: Stale module-level doc comment in `settings.store.ts`

**File:** `taskflow/src/stores/settings.store.ts:2`
**Issue:** The file-level JSDoc still says "Settings store — role and theme". The `role` field is removed in this phase; the comment is stale.
**Fix:** Update to "Settings store — theme, density, sidebar layout, and notification preferences" (or any accurate summary).

---

### IN-02: `AppearanceSection` renders `SidebarItemsList` in addition to `SidebarSection` — duplicate UI

**File:** `taskflow/src/routes/settings/AppearanceSection.tsx:63`
**Issue:** `AppearanceSection` renders `<SidebarItemsList />` inline (lines 61-64) under a "Sidebar Items" label. `Settings.tsx` now has a dedicated "Sidebar" nav section that renders `SidebarSection` → `SidebarItemsList`. A user navigating to Appearance therefore sees the full sidebar item toggle list twice — once in AppearanceSection and once when they click "Sidebar". This is redundant and may confuse users about which copy is authoritative.
**Fix:** Remove the `SidebarItemsList` block (lines 60-65) and the `import SidebarItemsList` from `AppearanceSection.tsx`. The Sidebar section is the canonical home for that control.

---

### IN-03: `SidebarItemsList.test.tsx` section-header test is missing "Testing"

**File:** `taskflow/src/routes/settings/SidebarItemsList.test.tsx:67-73`
**Issue:** The test `'renders section headers: Main, Planning, Code, Tracking'` asserts all four sections but omits "Testing" — which is present in `SIDEBAR_SECTIONS` and will appear in the rendered list whenever `aio-projects` is in `sidebarItems`. The test name explicitly lists the sections it checks, so the omission is not obviously intentional and the assertion is incomplete.
**Fix:**
```ts
expect(screen.getByText('Testing')).toBeInTheDocument();
```
Add this line to the test, and update the test description to include "Testing".

---

### IN-04: `Settings.test.tsx` `sidebarItems` mock is stale — missing `worklogs` and `aio-projects`

**File:** `taskflow/src/routes/settings/Settings.test.tsx:121-133`
**Issue:** The `mockSettingsStore.sidebarItems` array has 8 items and is missing `worklogs` and `aio-projects` (and `epics` is present but `sprint-progress` and `releases` are both included). The current canonical default has 9 items (all of `SIDEBAR_NAV_ITEMS`). While the Settings component tests pass because `SidebarItemsList` is rendered via the real component against the mocked store, the incomplete mock means the `SidebarItemsList` will not render rows for the missing items, reducing the fidelity of any visual/integration assertion made in these tests.
**Fix:** Sync the mock with `getDefaultSidebarItems()` or import and use it directly:
```ts
import { getDefaultSidebarItems } from '@/components/app/sidebar-items';
// ...
sidebarItems: getDefaultSidebarItems(),
```

---

_Reviewed: 2026-05-23T22:57:15Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
