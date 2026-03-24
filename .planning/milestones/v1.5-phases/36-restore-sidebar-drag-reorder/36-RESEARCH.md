# Phase 36: Restore Sidebar Drag-Reorder - Research

**Researched:** 2026-03-24
**Domain:** @dnd-kit/sortable integration for sidebar item reordering in Settings
**Confidence:** HIGH

## Summary

This phase restores drag-and-drop reordering of sidebar items in the Settings page. The store action `reorderSidebarItem(fromIndex, toIndex)` already exists and is tested. The `@dnd-kit/sortable` v10.0.0 package is already installed but unused. The project already uses `@dnd-kit/core` v6.3.1 in SprintBoardTab for drag-and-drop between columns, providing established patterns to follow.

The implementation is straightforward: wrap the existing `SidebarItemsList` component with `DndContext` + `SortableContext`, convert each item row to use `useSortable`, add a `GripVertical` drag handle via `setActivatorNodeRef`, and call `reorderSidebarItem` in the `onDragEnd` handler. Per decision D-06/D-07, reordering is constrained within sections in the sidebar view, but the Settings list allows free reorder across sections (D-03/D-04).

**Primary recommendation:** Use `@dnd-kit/sortable` with `verticalListSortingStrategy`, `restrictToVerticalAxis` modifier, and `DragOverlay` for the active item. Wire `arrayMove` index math to the existing `reorderSidebarItem` store action.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** GripVertical drag handle icon on the left of each row -- click+drag the handle to reorder. Checkbox stays clickable without accidental drags.
- **D-02:** Layout per row: `[drag handle] [checkbox] [label]` -- matches Phase 34 accessibility decision for separate drag handle button.
- **D-03:** Free reorder across section boundaries in Settings list -- items can be dragged from any section to any position. Sections in Settings are soft visual dividers, not drag constraints.
- **D-04:** Single flat sortable list in SidebarItemsList with section headers rendered as non-draggable dividers between groups.
- **D-05:** The store's flat `sidebarItems[]` array determines global order. `reorderSidebarItem(fromIndex, toIndex)` already handles the splice logic.
- **D-06:** Sidebar keeps section headers (Work / Views / Tools). Items maintain section affinity -- reordering changes position within each section, not which section an item belongs to.
- **D-07:** Sidebar renders items grouped by their original section, with custom order within each section based on the `sidebarItems[]` array position.

### Claude's Discretion
- Drag overlay visual feedback (opacity, shadow, scale)
- Drop placeholder styling
- Whether to use `restrictToVerticalAxis` modifier
- Animation timing for reorder transitions

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LAYOUT-02 | User can reorder sidebar items via drag-and-drop | Full stack verified: @dnd-kit/sortable v10 installed, useSortable hook available, reorderSidebarItem store action exists and tested, SidebarItemsList.tsx identified as modification target |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @dnd-kit/core | 6.3.1 | DndContext, DragOverlay, sensors | Already used in SprintBoardTab |
| @dnd-kit/sortable | 10.0.0 | SortableContext, useSortable, verticalListSortingStrategy, arrayMove | Already installed, purpose-built for sortable lists |
| @dnd-kit/modifiers | 9.0.0 | restrictToVerticalAxis | Already installed, constrains drag to Y axis |
| @dnd-kit/utilities | 3.2.2 | CSS.Transform | Already used in DraggableCard |
| lucide-react | 0.577.0 | GripVertical icon | Already used project-wide for icons |

### Supporting
No additional packages needed. Everything is already installed.

## Architecture Patterns

### Current SidebarItemsList Structure
```
SidebarItemsList
  -> iterates SIDEBAR_SECTIONS
    -> for each section: renders header + filtered items from SIDEBAR_NAV_ITEMS
    -> each item: <label> with checkbox + label text
```

### Target SidebarItemsList Structure (D-03, D-04)
```
SidebarItemsList
  DndContext (sensors, modifiers, onDragEnd, onDragStart)
    SortableContext (flat items array, verticalListSortingStrategy)
      -> iterates SIDEBAR_SECTIONS
        -> section header (non-draggable divider)
        -> filtered items as SortableItem components
    DragOverlay (active item clone)
```

### Key Architecture Decision: Flat List with Section Dividers (D-04)
The `sidebarItems[]` store array is flat -- all items in one array regardless of section. The Settings UI renders section headers as non-draggable visual dividers between groups, but `SortableContext` receives ALL items as a single flat list. This means items can be freely dragged across section boundaries in Settings (D-03).

### Index Mapping Pattern
The `reorderSidebarItem(fromIndex, toIndex)` operates on the store's `sidebarItems[]` array indices. The `SortableContext` items array should use item IDs. In `onDragEnd`, map from the drag event's `active.id` and `over.id` back to store array indices using `sidebarItems.findIndex()`.

### Pattern: SortableItem Component
```typescript
// Source: @dnd-kit/sortable v10 installed API (verified from node_modules type declarations)
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

function SortableItem({ id, label, isVisible, onToggle }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,  // For drag handle (D-01)
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent">
      {/* D-01: Drag handle -- only this element triggers drag */}
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
      {/* D-02: Checkbox stays clickable without accidental drags */}
      <input
        type="checkbox"
        checked={isVisible}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}
```

### Pattern: DndContext + onDragEnd Handler
```typescript
// Source: Project pattern from SprintBoardTab.tsx + @dnd-kit/sortable arrayMove
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const oldIndex = sidebarItems.findIndex((item) => item.id === active.id);
  const newIndex = sidebarItems.findIndex((item) => item.id === over.id);
  if (oldIndex !== -1 && newIndex !== -1) {
    reorderSidebarItem(oldIndex, newIndex);
  }
}
```

### Anti-Patterns to Avoid
- **Using useDraggable/useDroppable instead of useSortable:** The sortable package is purpose-built for reordering within a list. Using core primitives would require reimplementing index tracking, animation, and drop positioning.
- **Separate SortableContext per section:** D-03 says free reorder across sections. Using one SortableContext per section would prevent cross-section dragging.
- **Putting listeners on the entire row:** D-01 requires a separate drag handle. Use `setActivatorNodeRef` on the handle element only; listeners and attributes go on the handle, not the row wrapper.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List reorder DnD | Custom drag handlers with mouse events | @dnd-kit/sortable useSortable + SortableContext | Handles touch, keyboard, animations, accessibility out of the box |
| Array reorder | Manual splice logic in onDragEnd | arrayMove from @dnd-kit/sortable (for event handling) + existing reorderSidebarItem (for store mutation) | arrayMove provides correct index mapping; store action already tested |
| Drag axis constraint | CSS or manual position clamping | restrictToVerticalAxis from @dnd-kit/modifiers | Single import, zero config |
| Drag overlay | CSS absolute positioning | DragOverlay from @dnd-kit/core | Portal-based, avoids layout shifts, established project pattern |

## Common Pitfalls

### Pitfall 1: Index Mismatch Between UI and Store
**What goes wrong:** The Settings UI filters items by section for rendering, but the store has a flat array. If you use the visual index within a section rather than the store array index, items end up at wrong positions.
**Why it happens:** The UI iterates sections and filters items, so the "index within a section" differs from the store's flat array index.
**How to avoid:** Always use `sidebarItems.findIndex(item => item.id === id)` to find store indices. Never use the visual rendering index.
**Warning signs:** Items jumping to unexpected positions after reorder.

### Pitfall 2: Section Headers Breaking SortableContext
**What goes wrong:** If section header elements are included in the SortableContext items array, dnd-kit tries to make them draggable/droppable, causing errors or unexpected behavior.
**Why it happens:** SortableContext expects its items array to match only sortable elements.
**How to avoid:** Only include actual sidebar item IDs in the SortableContext items array. Section headers are rendered as plain divs outside the sortable item flow but visually interspersed.
**Warning signs:** Console errors about missing sortable nodes, headers shifting during drag.

### Pitfall 3: Missing DragOverlay Causing Layout Shift
**What goes wrong:** Without DragOverlay, the dragged item stays in the DOM flow and causes the list to jump/shift during drag.
**Why it happens:** useSortable applies CSS transforms to move items, but without an overlay the original item's space is still occupied then suddenly removed.
**How to avoid:** Use DragOverlay with a clone of the active item (same pattern as SprintBoardTab).
**Warning signs:** List items jumping or flickering during drag.

### Pitfall 4: Checkbox Click Triggering Drag
**What goes wrong:** Without a separate drag handle, clicking the checkbox to toggle visibility also starts a drag operation.
**Why it happens:** PointerSensor captures pointer events on the entire draggable element.
**How to avoid:** Use `setActivatorNodeRef` on the GripVertical button only (D-01). This restricts drag initiation to the handle element.
**Warning signs:** Toggling visibility also starts a drag motion.

## Code Examples

### Complete DndContext Setup
```typescript
// Source: verified from node_modules/@dnd-kit/sortable v10.0.0 type declarations
// and existing project pattern in SprintBoardTab.tsx

const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
);

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  modifiers={[restrictToVerticalAxis]}
  onDragStart={handleDragStart}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={sidebarItems.map(item => item.id)}
    strategy={verticalListSortingStrategy}
  >
    {/* section headers + SortableItem components */}
  </SortableContext>
  <DragOverlay>
    {activeId ? <ItemOverlay id={activeId} /> : null}
  </DragOverlay>
</DndContext>
```

### useSortable with Drag Handle (setActivatorNodeRef)
```typescript
// Source: @dnd-kit/sortable v10 useSortable type declarations (verified)
const {
  attributes,
  listeners,
  setNodeRef,
  setActivatorNodeRef,
  transform,
  transition,
  isDragging,
} = useSortable({ id });

// setNodeRef -> outer container div
// setActivatorNodeRef -> GripVertical button (drag handle only)
// attributes + listeners -> spread on the drag handle button
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | taskflow/vitest.config.ts |
| Quick run command | `cd taskflow && npx vitest run src/stores/settings.store.test.ts` |
| Full suite command | `cd taskflow && npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LAYOUT-02 | reorderSidebarItem moves item to correct position | unit (store) | `cd taskflow && npx vitest run src/stores/settings.store.test.ts -x` | Yes -- test exists |
| LAYOUT-02 | SidebarItemsList renders drag handles and reorders on drag | integration (component) | `cd taskflow && npx vitest run src/routes/settings/SidebarItemsList.test.tsx -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd taskflow && npx vitest run src/stores/settings.store.test.ts src/routes/settings/SidebarItemsList.test.tsx -x`
- **Per wave merge:** `cd taskflow && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `taskflow/src/routes/settings/SidebarItemsList.test.tsx` -- covers LAYOUT-02 UI integration (drag handle renders, reorder callback fires)

## Sources

### Primary (HIGH confidence)
- `node_modules/@dnd-kit/sortable/dist/` -- verified v10.0.0 API: useSortable, SortableContext, verticalListSortingStrategy, arrayMove exports
- `node_modules/@dnd-kit/core/dist/` -- verified v6.3.1 API: DndContext, DragOverlay, PointerSensor, closestCenter
- `node_modules/@dnd-kit/modifiers/dist/` -- verified v9.0.0 exports: restrictToVerticalAxis
- `taskflow/src/routes/dashboard/SprintBoardTab.tsx` -- existing DndContext + DragOverlay + useSensors pattern
- `taskflow/src/routes/dashboard/DraggableCard.tsx` -- existing useDraggable + CSS.Transform pattern
- `taskflow/src/stores/settings.store.ts` -- reorderSidebarItem action (line 259), sidebarItems state
- `taskflow/src/routes/settings/SidebarItemsList.tsx` -- current implementation (checkbox-only, no DnD)
- `taskflow/src/components/app/sidebar-items.ts` -- SIDEBAR_SECTIONS, SIDEBAR_NAV_ITEMS definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed and versions verified from node_modules
- Architecture: HIGH -- existing project DnD pattern in SprintBoardTab, API verified from type declarations
- Pitfalls: HIGH -- based on direct code analysis of current SidebarItemsList structure and store indexing

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable -- @dnd-kit API well-established)
