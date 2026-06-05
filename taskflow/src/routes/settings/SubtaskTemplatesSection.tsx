/**
 * SubtaskTemplatesSection — Settings section for managing subtask templates.
 *
 * Supports full template CRUD (create, rename, reorder, delete) with an
 * inline row editor per template. Backed by useSubtaskTemplatesStore.
 *
 * Reorder via dnd-kit fixed-height DragOverlay pattern (P78/P79 — onDragEnd only,
 * DragOverlay clone, never live row).
 */

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { useSubtaskTemplatesStore } from '../../stores/subtask-templates.store';
import type { SubtaskTemplate } from '../../stores/subtask-templates.store';

// ── Sortable template card ────────────────────────────────────────────────────

interface SortableTemplateCardProps {
  template: SubtaskTemplate;
  isOpen: boolean;
  onToggleEdit: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}

function SortableTemplateCard({
  template,
  isOpen,
  onToggleEdit,
  onRemove,
  onRename,
}: SortableTemplateCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: template.id,
  });

  const [localName, setLocalName] = useState(template.name);
  const prevNameRef = useRef(template.name);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex flex-col gap-0">
      <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
        {/* Drag handle */}
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="text-muted-foreground cursor-grab active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Inline name input */}
        <input
          className="flex-1 border-none bg-transparent text-sm font-normal focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 min-w-0"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onFocus={() => {
            prevNameRef.current = localName;
          }}
          onBlur={() => {
            const trimmed = localName.trim();
            if (!trimmed) {
              setLocalName(prevNameRef.current);
            } else {
              onRename(trimmed);
              prevNameRef.current = trimmed;
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              (e.target as HTMLInputElement).blur();
            }
          }}
          aria-label="Template name"
        />

        {/* Edit Rows button */}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onToggleEdit}
          className="text-xs shrink-0"
        >
          {isOpen ? 'Done' : 'Edit Rows'}
        </Button>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          className="text-muted-foreground hover:text-destructive shrink-0"
          onClick={onRemove}
          aria-label={`Delete template ${template.name}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Inline row editor — populated in Task 2 */}
      {isOpen && (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 px-4 py-4 mt-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Rows
          </h3>
          <p className="text-xs text-muted-foreground">
            Row editor coming in Task 2…
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function SubtaskTemplatesSection() {
  const { templates, addTemplate, removeTemplate, renameTemplate, moveTemplate } =
    useSubtaskTemplatesStore();

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleAddTemplate() {
    const id = crypto.randomUUID();
    addTemplate({
      id,
      name: 'Untitled Template',
      subtaskIssueTypeId: '',
      subtaskIssueTypeName: '',
      rows: [],
    });
    setOpenTemplateId(id);
  }

  function handleToggleEdit(id: string) {
    setOpenTemplateId((prev) => (prev === id ? null : id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const fromIdx = templates.findIndex((t) => t.id === active.id);
    const toIdx = templates.findIndex((t) => t.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const delta = toIdx - fromIdx;
    const direction = delta > 0 ? 'down' : 'up';
    const steps = Math.abs(delta);
    for (let i = 0; i < steps; i++) {
      moveTemplate(active.id as string, direction);
    }
  }

  const activeTemplate = activeId ? templates.find((t) => t.id === activeId) : null;

  return (
    <div data-testid="section-subtask-templates" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Subtask Templates</h2>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-sm font-semibold">No templates yet</p>
          <p className="text-xs text-muted-foreground">
            Create a template to bulk-add subtasks from any issue.
          </p>
          <Button variant="outline" size="sm" type="button" onClick={handleAddTemplate}>
            <Plus className="h-4 w-4 mr-1" />
            New Template
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" type="button" onClick={handleAddTemplate}>
              <Plus className="h-4 w-4 mr-1" />
              New Template
            </Button>
          </div>

          <DndContext
            sensors={sensors}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={(e) => setActiveId(e.active.id as string)}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={templates.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="flex flex-col gap-2">
                {templates.map((template) => (
                  <SortableTemplateCard
                    key={template.id}
                    template={template}
                    isOpen={openTemplateId === template.id}
                    onToggleEdit={() => handleToggleEdit(template.id)}
                    onRemove={() => {
                      removeTemplate(template.id);
                      if (openTemplateId === template.id) setOpenTemplateId(null);
                    }}
                    onRename={(name) => renameTemplate(template.id, name)}
                  />
                ))}
              </div>
            </SortableContext>

            {createPortal(
              <DragOverlay dropAnimation={null}>
                {activeTemplate ? (
                  <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-lg opacity-90">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-normal">{activeTemplate.name}</span>
                  </div>
                ) : null}
              </DragOverlay>,
              document.body,
            )}
          </DndContext>
        </div>
      )}
    </div>
  );
}
