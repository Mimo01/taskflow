/**
 * SidebarItemsList -- Drag-reorder + toggle visibility list for sidebar nav items.
 *
 * Each row: [GripVertical] [Icon] [Label] [Switch toggle]
 * Uses @dnd-kit/sortable for drag-reorder with vertical axis constraint.
 */

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { SIDEBAR_NAV_ITEMS } from '@/components/app/sidebar-items';
import { useSettingsStore, type SidebarItem } from '@/stores/settings.store';

function SortableItem({
  item,
  onToggle,
}: {
  item: SidebarItem;
  onToggle: (id: string, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const def = SIDEBAR_NAV_ITEMS.find((d) => d.id === item.id);
  if (!def) return null;

  const Icon = def.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-background"
    >
      <button
        type="button"
        className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
        aria-label={`Drag to reorder ${def.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground flex-1">{def.label}</span>
      <Switch checked={item.visible} onCheckedChange={(v) => onToggle(item.id, v)} />
    </div>
  );
}

export default function SidebarItemsList() {
  const sidebarItems = useSettingsStore((s) => s.sidebarItems);
  const setSidebarItemVisible = useSettingsStore((s) => s.setSidebarItemVisible);
  const reorderSidebarItem = useSettingsStore((s) => s.reorderSidebarItem);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sidebarItems.findIndex((i) => i.id === active.id);
    const newIndex = sidebarItems.findIndex((i) => i.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      reorderSidebarItem(oldIndex, newIndex);
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={sidebarItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1">
          {sidebarItems.map((item) => (
            <SortableItem key={item.id} item={item} onToggle={setSidebarItemVisible} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
