# Phase 67: Settings UI Cleanup - Context

**Gathered:** 2026-05-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Strip drag-reorder capability from `SidebarItemsList.tsx` — replace the dnd-kit sortable UI with a simple checkbox-per-item visibility list, remove the now-orphaned `reorderSidebarItem` store action, and uninstall the `@dnd-kit/*` packages.

**Pre-satisfied by Phase 66 (no work needed):**
- SETUI-01: `SidebarItemsList` was already removed from `AppearanceSection.tsx` in commit `da30013b`. Appearance section is clean.
- SETUI-03: v22 migration in Phase 66 already resets `sidebarItems` to all-visible for all users.

**Phase 67 work = SETUI-02 only:** `SidebarItemsList.tsx` still contains `DndContext`, `SortableContext`, `DragOverlay`, `SortableItem` (~180 LOC). These must be stripped and replaced with a plain list of checkboxes.

</domain>

<decisions>
## Implementation Decisions

### SETUI-02: New SidebarItemsList layout
- **D-01:** Row structure: `[checkbox] Label` — checkbox input followed by label text. No drag handle. Same structure as other simple setting rows.
- **D-02:** Section headers (Main, Planning, Code, Tracking, Testing) are kept — they group the 9 items and make the list easier to scan.
- **D-03:** The existing `setSidebarItemVisible` action is kept and still called on checkbox change. Only the reorder logic is removed.

### Store cleanup
- **D-04:** Remove `reorderSidebarItem` from `settings.store.ts` — both the TypeScript type definition and the implementation. No store version bump needed: removing an action method does not affect persisted data (the `sidebarItems` array persists unchanged; only the in-memory action disappears).
- **D-05:** `setSidebarItems` action can be left in place — it is used by other callers (migration). Do not remove it.

### Package cleanup
- **D-06:** Uninstall all 4 `@dnd-kit/*` packages: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`. No other file in `src/` imports them after `SidebarItemsList.tsx` is cleaned up. Use `npm uninstall` inside the `taskflow/` workspace.

### Test updates
- **D-07:** In `SidebarItemsList.test.tsx`:
  - **Delete** the `'renders drag handles with aria-label "Drag to reorder"'` test — drag handles are gone.
  - **Delete** the `'each item row contains drag handle, checkbox, and label text'` test — asserts old row structure.
  - **Rewrite** the row structure test to assert: row contains a checkbox and label text in order, with no `data-sortable-item` attribute and no drag-handle button.
  - **Keep** `'checkbox toggles call setSidebarItemVisible'` and `'renders section headers'` tests unchanged.
- **D-08:** In `Settings.test.tsx`: remove the `reorderSidebarItem: vi.fn()` mock entry from the store mock object — becomes stale once the action is removed from the store type.

### Claude's Discretion
- Exact CSS classes for the simplified row (hover state, gap, padding) — match the app's existing settings row patterns.
- Whether `SidebarItemsList` gets a doc-comment update — remove the stale "Sortable checkbox list … dnd-kit" header comment and replace with an accurate one-liner.
- Order of commits within the plan (UI → store → packages → tests or combined) — planner decides based on type-safe incremental ordering.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Settings UI Cleanup (SETUI-01, SETUI-02, SETUI-03) — acceptance criteria; note SETUI-01 and SETUI-03 are already satisfied, only SETUI-02 needs implementation

### Source files to modify
- `taskflow/src/routes/settings/SidebarItemsList.tsx` — SETUI-02: strip dnd-kit, replace with plain checkbox list
- `taskflow/src/stores/settings.store.ts` — D-04: remove `reorderSidebarItem` type + implementation (line 158 type, lines 307–313 implementation)
- `taskflow/src/routes/settings/SidebarItemsList.test.tsx` — D-07: delete drag tests, rewrite row structure test
- `taskflow/src/routes/settings/Settings.test.tsx` — D-08: remove `reorderSidebarItem` mock (line 133)
- `taskflow/package.json` — D-06: uninstall `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/modifiers`, `@dnd-kit/utilities`

### Prior state reference
- `.planning/STATE.md` — build verification: use `npm run build`, not just `tsc` (Phase 59 standing rule)
- Phase 66 context: `da30013b` is the commit that removed `SidebarItemsList` from `AppearanceSection` — SETUI-01 already done

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useSettingsStore().sidebarItems` + `setSidebarItemVisible` — existing store API, keep as-is
- `SIDEBAR_NAV_ITEMS`, `SIDEBAR_SECTIONS` from `@/components/app/sidebar-items` — static nav registry used to render labels and section grouping; still needed in the simplified component
- `getDefaultSidebarItems()` (no-arg, all-visible after Phase 66) — used in test `beforeEach` setup

### Established Patterns
- Settings rows in this codebase: `flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent` — the current `SortableItem` row already uses this; keep it for the simplified row
- Checkbox: `h-4 w-4 rounded border-border accent-primary` — already in `SortableItem`, carry over
- Section header labels: `text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1` — keep unchanged
- Build verification: `npm run build` required after package removal (catches import/CSS issues `tsc` misses)

### Integration Points
- `SidebarSection.tsx` wraps `SidebarItemsList` — no changes needed there
- `Settings.tsx` renders `<SidebarSection />` on `activeSection === 'sidebar'` — no changes needed
- `settings.store.test.ts` — may have `reorderSidebarItem` references; researcher should grep before deleting from store

</code_context>

<specifics>
## Specific Ideas

- The stripped `SidebarItemsList` should be significantly shorter — target ~40–50 LOC vs the current ~180 LOC. Removing DndContext, SortableContext, DragOverlay, SortableItem, useSortable, CSS.Transform, useState (activeId), sensor setup, handleDragStart, handleDragEnd, and all dnd-kit imports accounts for most of the reduction.
- The component file should have no `@dnd-kit/*` imports after the change — the build will catch any missed imports.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 67-Settings UI Cleanup*
*Context gathered: 2026-05-24*
