/**
 * SidebarItemsList -- Sortable checkbox list for sidebar item visibility & order.
 *
 * Uses @dnd-kit/sortable for drag-and-drop reordering with GripVertical drag handles.
 * Groups items by section with non-interactive section headers.
 * Each item can be toggled visible/hidden and dragged to reorder.
 */

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useState } from 'react';

import { SIDEBAR_NAV_ITEMS, SIDEBAR_SECTIONS } from '@/components/app/sidebar-items';
import { useSettingsStore } from '@/stores/settings.store';

// ---------------------------------------------------------------------------
// SortableItem — a single draggable row with handle, checkbox, and label
// ---------------------------------------------------------------------------

interface SortableItemProps {
  id: string;
  label: string;
  isVisible: boolean;
  onToggle: (visible: boolean) => void;
}

function SortableItem({ id, label, isVisible, onToggle }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
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
    <div
      ref={setNodeRef}
      style={style}
      data-sortable-item
      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent"
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground"
        type="button"
        aria-label="Drag to reorder"
      >
        <GripVertical className="size-4" />
      </button>
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

// ---------------------------------------------------------------------------
// SidebarItemsList — DndContext + SortableContext wrapper
// ---------------------------------------------------------------------------

export default function SidebarItemsList() {
  const { sidebarItems, setSidebarItemVisible, reorderSidebarItem } =
    useSettingsStore();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // Build a lookup: id -> visible
  const visibilityMap = new Map(
    sidebarItems.map((item) => [item.id, item.visible]),
  );

  const allItemIds = sidebarItems.map((item) => item.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sidebarItems.findIndex((item) => item.id === active.id);
    const newIndex = sidebarItems.findIndex((item) => item.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSidebarItem(oldIndex, newIndex);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={allItemIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-4">
          {SIDEBAR_SECTIONS.map((section) => {
            const sectionItems = SIDEBAR_NAV_ITEMS.filter(
              (nav) => nav.section === section.id,
            );
            if (sectionItems.length === 0) return null;

            return (
              <div key={section.id} className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
                  {section.label}
                </span>
                {sectionItems.map((nav) => {
                  const isVisible = visibilityMap.get(nav.id) ?? true;
                  return (
                    <SortableItem
                      key={nav.id}
                      id={nav.id}
                      label={nav.label}
                      isVisible={isVisible}
                      onToggle={(v) => setSidebarItemVisible(nav.id, v)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId
          ? (() => {
              const nav = SIDEBAR_NAV_ITEMS.find((n) => n.id === activeId);
              if (!nav) return null;
              const isVisible = visibilityMap.get(nav.id) ?? true;
              return (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-background border border-border shadow-md scale-[1.02]">
                  <GripVertical className="size-4 text-muted-foreground" />
                  <input
                    type="checkbox"
                    checked={isVisible}
                    readOnly
                    className="h-4 w-4 rounded border-border accent-primary"
                  />
                  <span className="text-sm">{nav.label}</span>
                </div>
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}
