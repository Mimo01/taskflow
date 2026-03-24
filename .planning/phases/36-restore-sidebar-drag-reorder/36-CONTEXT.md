# Phase 36: Restore Sidebar Drag-Reorder - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-implement dnd-kit sortable sidebar item reordering in Settings > Appearance. The `reorderSidebarItem` store action exists but is not wired to the UI — SidebarItemsList was stripped of dnd-kit sortable during post-verification cleanup (commit 850ed04). This phase restores that functionality.

</domain>

<decisions>
## Implementation Decisions

### Drag Interaction
- **D-01:** GripVertical drag handle icon on the left of each row — click+drag the handle to reorder. Checkbox stays clickable without accidental drags.
- **D-02:** Layout per row: `[drag handle] [checkbox] [label]` — matches Phase 34 accessibility decision for separate drag handle button.

### Reorder Behavior
- **D-03:** Free reorder across section boundaries in Settings list — items can be dragged from any section to any position. Sections in Settings are soft visual dividers, not drag constraints.
- **D-04:** Single flat sortable list in SidebarItemsList with section headers rendered as non-draggable dividers between groups.
- **D-05:** The store's flat `sidebarItems[]` array determines global order. `reorderSidebarItem(fromIndex, toIndex)` already handles the splice logic.

### Sidebar Rendering
- **D-06:** Sidebar keeps section headers (Work / Views / Tools). Items maintain section affinity — reordering changes position within each section, not which section an item belongs to.
- **D-07:** Sidebar renders items grouped by their original section, with custom order within each section based on the `sidebarItems[]` array position.

### Claude's Discretion
- Drag overlay visual feedback (opacity, shadow, scale)
- Drop placeholder styling
- Whether to use `restrictToVerticalAxis` modifier
- Animation timing for reorder transitions

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Sidebar settings (restore target)
- `taskflow/src/routes/settings/SidebarItemsList.tsx` — Current checkbox-only list that needs dnd-kit sortable added back
- `taskflow/src/routes/settings/SidebarSection.tsx` — Section component used in settings
- `taskflow/src/routes/settings/AppearanceSection.tsx` — Parent section that renders SidebarItemsList

### Store (existing logic)
- `taskflow/src/stores/settings.store.ts` — `reorderSidebarItem(fromIndex, toIndex)` action at line ~259, `sidebarItems` state
- `taskflow/src/stores/settings.store.test.ts` — Existing tests for reorder action

### dnd-kit patterns (existing usage)
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` — DndContext + DragOverlay pattern used for sprint board
- `taskflow/src/routes/dashboard/DraggableCard.tsx` — useDraggable + CSS transform pattern

### Sidebar structure
- `taskflow/src/components/app/sidebar-items.ts` — SIDEBAR_NAV_ITEMS and SIDEBAR_SECTIONS definitions
- `taskflow/src/components/app/Sidebar.tsx` — Live sidebar that renders items by section

### Requirements
- `.planning/REQUIREMENTS.md` §Layout — LAYOUT-02: User can reorder sidebar items via drag-and-drop

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `reorderSidebarItem(fromIndex, toIndex)` in settings.store.ts — splice-based reorder already implemented and tested
- `@dnd-kit/sortable` v10 — already installed in package.json, not yet used anywhere
- `@dnd-kit/core` v6 — used in SprintBoardTab for DndContext/DragOverlay pattern
- `@dnd-kit/modifiers` v9 — installed, available for restrictToVerticalAxis
- `SIDEBAR_SECTIONS` and `SIDEBAR_NAV_ITEMS` — section/item definitions with section affinity

### Established Patterns
- SprintBoardTab uses DndContext + DragOverlay + useDraggable/useDroppable from @dnd-kit/core
- SidebarItemsList groups items by SIDEBAR_SECTIONS with map/filter pattern
- Settings store uses Zustand persist with LazyStore and versioned migrations

### Integration Points
- `SidebarItemsList.tsx` — primary file to modify: wrap items with useSortable, add DndContext
- `settings.store.ts` — `reorderSidebarItem` already exists, just needs to be called from drag-end handler
- No new store fields or migrations needed — the action is already defined

</code_context>

<specifics>
## Specific Ideas

No specific requirements — standard dnd-kit sortable implementation restoring previously-built functionality.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 36-restore-sidebar-drag-reorder*
*Context gathered: 2026-03-24*
