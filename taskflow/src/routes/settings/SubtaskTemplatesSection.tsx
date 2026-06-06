/**
 * SubtaskTemplatesSection — Settings section for managing subtask templates.
 *
 * Supports full template CRUD (create, rename, reorder, delete) with an
 * inline row editor per template. Row editor includes subtask-type selector
 * (filtered by issuetype.subtask === true flag per D-05), per-row editing
 * via SubtaskTemplateRow, and dnd-kit row reorder.
 *
 * Backed by useSubtaskTemplatesStore; templates persist across restart.
 * Reorder via dnd-kit fixed-height DragOverlay pattern (P78/P79 — onDragEnd
 * only, DragOverlay clone, never live row).
 */

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/apiFetch';
import type { CreatemetaField } from '@/services/jira';
import { fetchCreatemeta } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '../../stores/auth.store';
import type {
  SubtaskTemplateRow as RowType,
  SubtaskTemplate,
} from '../../stores/subtask-templates.store';
import { useSubtaskTemplatesStore } from '../../stores/subtask-templates.store';
import { SubtaskTemplateRow } from '../dashboard/create-edit-issue/SubtaskTemplateRow';

// ── Internal types ────────────────────────────────────────────────────────────

interface CreatemtaIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

// ── Sortable row inside the editor ───────────────────────────────────────────

interface SortableRowProps {
  row: RowType;
  onChange: (patch: Partial<RowType>) => void;
  onRemove: () => void;
  creatmetaFields?: CreatemetaField[];
}

function SortableRow({ row, onChange, onRemove, creatmetaFields }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : undefined,
  };

  const dragHandleProps = { ...attributes, ...listeners };

  return (
    <div ref={setNodeRef} style={style}>
      <SubtaskTemplateRow
        row={row}
        mode="settings"
        onChange={onChange}
        onRemove={onRemove}
        creatmetaFields={creatmetaFields}
        dragHandleProps={dragHandleProps}
      />
    </div>
  );
}

// ── Inline row editor (shown below a template card when "Edit Rows" is active) ─

interface TemplateRowEditorProps {
  template: SubtaskTemplate;
  onRowsChange: (rows: RowType[]) => void;
  onSubtaskTypeChange: (typeId: string, typeName: string) => void;
}

function TemplateRowEditor({
  template,
  onRowsChange,
  onSubtaskTypeChange,
}: TemplateRowEditorProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const projectKey = activeJiraProject ?? '';

  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Step 1: fetch issue types, filter to subtask types (D-05: .subtask flag, never name comparison)
  const { data: issueTypes } = useQuery<CreatemtaIssueType[]>({
    queryKey: ['createmeta-issuetypes', projectKey],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      const base = jiraBaseUrl.replace(/\/$/, '');
      const resp = await apiFetch(
        'jira',
        `${base}/rest/api/2/issue/createmeta/${projectKey}/issuetypes`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Subtask Templates',
      );
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.values ?? []) as CreatemtaIssueType[];
    },
    enabled: !!projectKey && !!jiraBaseUrl,
    staleTime: 5 * 60 * 1000,
  });

  const subtaskTypes = issueTypes?.filter((t) => t.subtask === true) ?? [];

  // T-80-06: if stored typeId absent from current project's subtask types, fall back to first
  const effectiveTypeId =
    template.subtaskIssueTypeId && subtaskTypes.some((t) => t.id === template.subtaskIssueTypeId)
      ? template.subtaskIssueTypeId
      : (subtaskTypes[0]?.id ?? '');

  const effectiveTypeName =
    subtaskTypes.find((t) => t.id === effectiveTypeId)?.name ?? template.subtaskIssueTypeName;

  // Step 2: fetch createmeta fields for selected subtask type
  const { data: creatmetaFields } = useQuery<CreatemetaField[]>({
    queryKey: ['createmeta', projectKey, effectiveTypeId, 'Subtask'],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey || !effectiveTypeId) return [];
      return fetchCreatemeta(jiraBaseUrl, token, projectKey, effectiveTypeId, effectiveTypeName);
    },
    enabled: !!projectKey && !!jiraBaseUrl && !!effectiveTypeId,
    staleTime: 5 * 60 * 1000,
  });

  function handleRowChange(rowId: string, patch: Partial<RowType>) {
    onRowsChange(template.rows.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  function handleRowRemove(rowId: string) {
    onRowsChange(template.rows.filter((r) => r.id !== rowId));
  }

  function handleAddRow() {
    const newRow: RowType = {
      id: crypto.randomUUID(),
      title: '',
      assignee: '@inherit', // D-10
      priority: null,
      labels: [],
      duedate: null,
      timeEstimate: '',
      storyPoints: null,
      components: [],
      customFieldValues: {},
    };
    onRowsChange([...template.rows, newRow]);
  }

  function handleRowDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveRowId(null);
    if (!over || active.id === over.id) return;

    const rows = template.rows;
    const fromIdx = rows.findIndex((r) => r.id === active.id);
    const toIdx = rows.findIndex((r) => r.id === over.id);
    if (fromIdx === -1 || toIdx === -1) return;

    const newRows = [...rows];
    const [moved] = newRows.splice(fromIdx, 1);
    newRows.splice(toIdx, 0, moved);
    onRowsChange(newRows);
  }

  const activeRow = activeRowId ? template.rows.find((r) => r.id === activeRowId) : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 px-4 py-4 mt-1">
      {/* Subtask type selector */}
      <div className="flex items-center gap-3">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          ROWS
        </h3>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Subtask type:</span>
          <Select
            value={effectiveTypeId}
            onValueChange={(v) => {
              const found = subtaskTypes.find((t) => t.id === v);
              if (found) onSubtaskTypeChange(found.id, found.name);
            }}
            disabled={subtaskTypes.length === 0}
          >
            <SelectTrigger className="h-7 w-40 text-xs">
              <SelectValue placeholder="Select type">
                {(v) => subtaskTypes.find((t) => t.id === v)?.name ?? 'Select type'}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {subtaskTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row list */}
      {template.rows.length > 0 ? (
        <DndContext
          sensors={sensors}
          modifiers={[restrictToVerticalAxis]}
          onDragStart={(e) => setActiveRowId(e.active.id as string)}
          onDragEnd={handleRowDragEnd}
        >
          <SortableContext
            items={template.rows.map((r) => r.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {template.rows.map((row) => (
                <SortableRow
                  key={row.id}
                  row={row}
                  onChange={(patch) => handleRowChange(row.id, patch)}
                  onRemove={() => handleRowRemove(row.id)}
                  creatmetaFields={creatmetaFields}
                />
              ))}
            </div>
          </SortableContext>

          {createPortal(
            <DragOverlay dropAnimation={null}>
              {activeRow ? (
                <div className="flex items-center gap-2 rounded-md border bg-background px-2 py-1 shadow-md opacity-90 min-h-[44px]">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{activeRow.title || 'Untitled row'}</span>
                </div>
              ) : null}
            </DragOverlay>,
            document.body,
          )}
        </DndContext>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          No rows yet. Add a row below.
        </p>
      )}

      {/* Add row button */}
      <Button variant="ghost" size="sm" type="button" onClick={handleAddRow} className="self-start">
        <Plus className="h-4 w-4 mr-1" />+ Add row
      </Button>
    </div>
  );
}

// ── Sortable template card ────────────────────────────────────────────────────

interface SortableTemplateCardProps {
  template: SubtaskTemplate;
  isOpen: boolean;
  onToggleEdit: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
  onRowsChange: (rows: RowType[]) => void;
  onSubtaskTypeChange: (typeId: string, typeName: string) => void;
}

function SortableTemplateCard({
  template,
  isOpen,
  onToggleEdit,
  onRemove,
  onRename,
  onRowsChange,
  onSubtaskTypeChange,
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

      {/* Inline row editor */}
      {isOpen && (
        <TemplateRowEditor
          template={template}
          onRowsChange={onRowsChange}
          onSubtaskTypeChange={onSubtaskTypeChange}
        />
      )}
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function SubtaskTemplatesSection() {
  const { templates, addTemplate, removeTemplate, renameTemplate, moveTemplate, updateTemplate } =
    useSubtaskTemplatesStore();

  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
                    onRowsChange={(rows) => updateTemplate(template.id, { rows })}
                    onSubtaskTypeChange={(typeId, typeName) =>
                      updateTemplate(template.id, {
                        subtaskIssueTypeId: typeId,
                        subtaskIssueTypeName: typeName,
                      })
                    }
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
