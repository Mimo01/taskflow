import { Dialog } from '@base-ui/react/dialog';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LayoutList, Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBoardId } from '@/hooks/useBoardId';
import { apiFetch } from '@/lib/apiFetch';
import {
  type CreatemetaField,
  createIssue,
  fetchCreatemeta,
  type JiraIssueDetail,
  type JiraUser,
  wrapCustomFieldValue,
} from '@/services/jira';
import { invalidateGhAllData } from '@/services/jira/greenhopper/useGhAllData';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import type { SubtaskTemplate } from '@/stores/subtask-templates.store';
import { useSubtaskTemplatesStore } from '@/stores/subtask-templates.store';
import { BulkProgressIndicator } from './BulkProgressIndicator';
import type { RowState, RowStatus } from './create-edit-issue/SubtaskTemplateRow';
import { SubtaskTemplateRow } from './create-edit-issue/SubtaskTemplateRow';
import { resolveRowForCreate } from './resolveRowPlaceholders';
import { resolveTemplateFields } from './resolveTemplateFields';

// ── Types ────────────────────────────────────────────────────────────────────

interface CreatemtaIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

export interface BulkCreateRow {
  id: string;
  title: string;
  assignee: string | '@inherit' | '@current' | '@unassigned';
  priority: string | null;
  labels: string[];
  duedate: string | null;
  timeEstimate: string;
  storyPoints: number | null;
  components: string[];
  customFieldValues: Record<string, string>;
}

interface CreateAllRowsOptions {
  rows: Array<{ title: string; options: Record<string, unknown> }>;
  rowStates: RowState[];
  createFn: (
    title: string,
    options: Record<string, unknown>,
  ) => Promise<{ id: string; key: string }>;
  onStateChange: (states: RowState[]) => void;
}

/**
 * Exported pure-ish async function so BulkCreateSubtasksModal.test.ts can drive it
 * with a mocked createFn. This is the SUBTPL-07 creation loop.
 */
export async function createAllRows({
  rows,
  rowStates,
  createFn,
  onStateChange,
}: CreateAllRowsOptions): Promise<RowState[]> {
  const states: RowState[] = rowStates.map((s) =>
    s.status === 'created' ? s : { status: 'pending' as const },
  );

  for (let i = 0; i < rows.length; i++) {
    if (states[i].status === 'created') continue; // SUBTPL-07: the ONLY dedup mechanism

    states[i] = { ...states[i], status: 'creating' };
    onStateChange([...states]);

    try {
      const result = await createFn(rows[i].title, rows[i].options);
      states[i] = { status: 'created', createdKey: result.key };
    } catch (e) {
      states[i] = {
        status: 'failed',
        error: e instanceof Error ? e.message : 'Unknown error',
      };
    }

    onStateChange([...states]);
  }

  return states;
}

// ── Sortable row wrapper ──────────────────────────────────────────────────────

function SortableRowItem({
  row,
  rowState,
  creatmetaFields,
  allAssignees,
  placeholderCtx,
  creating,
  onChange,
  onRemove,
}: {
  row: BulkCreateRow;
  rowState: RowState;
  creatmetaFields?: CreatemetaField[];
  allAssignees?: JiraUser[];
  placeholderCtx: Parameters<typeof SubtaskTemplateRow>[0]['placeholderCtx'];
  creating: boolean;
  onChange: (patch: Partial<BulkCreateRow>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <SubtaskTemplateRow
        row={row}
        mode="preview"
        onChange={(patch) => onChange(patch as Partial<BulkCreateRow>)}
        onRemove={onRemove}
        creatmetaFields={creatmetaFields}
        assignees={allAssignees}
        placeholderCtx={placeholderCtx}
        rowState={rowState}
        dragHandleProps={creating ? {} : { ...attributes, ...listeners }}
      />
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export interface BulkCreateSubtasksModalProps {
  open: boolean;
  onClose: () => void;
  parentKey: string;
  parentIssue: JiraIssueDetail;
}

export function BulkCreateSubtasksModal({
  open,
  onClose,
  parentKey,
  parentIssue,
}: BulkCreateSubtasksModalProps) {
  const { jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName } = useAuthStore();
  const { storyPointsFieldKey } = useSettingsStore();
  const projectKey = activeJiraProject ?? '';

  // Read jiraToken for boardId hook (lazy — only used at create time)
  const [jiraToken, setJiraToken] = useState<string | null>(null);
  // boardId for invalidateGhAllData — sourced via hook, never direct store read
  const { boardId } = useBoardId(jiraBaseUrl, jiraToken, activeJiraProject);

  const queryClient = useQueryClient();

  // Templates
  const { templates } = useSubtaskTemplatesStore();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('__adhoc__');

  // Rows state
  const [rows, setRows] = useState<BulkCreateRow[]>([]);
  const [rowStates, setRowStates] = useState<RowState[]>([]);
  const [totalSkipped, setTotalSkipped] = useState(0);

  // Creation state
  const [creating, setCreating] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  // dnd-kit
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const staleTime = 5 * 60 * 1000;

  // Createmeta: issue types (subtask filter via .subtask flag — D-05)
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
        'Bulk Create Subtasks',
      );
      if (!resp.ok) return [];
      const data = await resp.json();
      return (data.values ?? []) as CreatemtaIssueType[];
    },
    enabled: open && !!projectKey && !!jiraBaseUrl,
    staleTime,
  });

  // Filter to subtask types only (D-05: .subtask flag, never name comparison)
  const subtaskTypes = issueTypes?.filter((t) => t.subtask === true) ?? [];

  // Selected subtask type — default to template's stored type or first available
  const [selectedSubtaskTypeId, setSelectedSubtaskTypeId] = useState<string>('');
  const effectiveTypeId = selectedSubtaskTypeId || subtaskTypes[0]?.id || '';

  // Createmeta fields for selected subtask type
  const { data: creatmetaFields } = useQuery<CreatemetaField[]>({
    queryKey: ['createmeta', projectKey, effectiveTypeId, 'Subtask'],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey || !effectiveTypeId) return [];
      return fetchCreatemeta(jiraBaseUrl, token, projectKey, effectiveTypeId, 'Subtask');
    },
    enabled: open && !!projectKey && !!jiraBaseUrl && !!effectiveTypeId,
    staleTime,
  });

  // Assignable users for the project
  const { data: allAssignees = [] } = useQuery<JiraUser[]>({
    queryKey: ['assignable-users', projectKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !projectKey) return [];
      const base = jiraBaseUrl.replace(/\/$/, '');
      const resp = await apiFetch(
        'jira',
        `${base}/rest/api/2/user/assignable/search?project=${projectKey}&maxResults=200`,
        { headers: { Authorization: `Bearer ${token}` } },
        'Bulk Create Subtasks',
      );
      if (!resp.ok) return [];
      return (await resp.json()) as JiraUser[];
    },
    enabled: open && !!projectKey && !!jiraBaseUrl,
    staleTime,
  });

  // Placeholder context for chip hints
  const placeholderCtx = {
    jiraUsername,
    jiraUserDisplayName,
    parentIssue,
  };

  // Resolve template rows + compute skipped fields count
  const applyTemplate = useCallback(
    (templateId: string, typeId?: string) => {
      if (templateId === '__adhoc__') {
        setRows([]);
        setRowStates([]);
        setTotalSkipped(0);
        return;
      }
      const template = templates.find((t: SubtaskTemplate) => t.id === templateId);
      if (!template) return;

      const fields = creatmetaFields ?? [];
      const { resolvedRows, totalSkipped: skipped } = resolveTemplateFields(
        template.rows,
        fields,
        storyPointsFieldKey,
      );
      const newRows = resolvedRows.map((r) => r.row as BulkCreateRow);
      setRows(newRows);
      setRowStates(newRows.map(() => ({ status: 'pending' as const })));
      setTotalSkipped(skipped);

      // Use the template's stored subtask type, or fall back to current selection
      const typeToUse = typeId ?? template.subtaskIssueTypeId;
      const isTypeAvailable = subtaskTypes.some((t) => t.id === typeToUse);
      if (isTypeAvailable) {
        setSelectedSubtaskTypeId(typeToUse);
      } else if (subtaskTypes.length > 0) {
        // Pitfall 4: template's subtask type absent from this project — fall back
        setSelectedSubtaskTypeId(subtaskTypes[0].id);
      }
    },
    [templates, creatmetaFields, storyPointsFieldKey, subtaskTypes],
  );

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    applyTemplate(templateId);
  }

  function handleTypeChange(typeId: string) {
    setSelectedSubtaskTypeId(typeId);
    if (selectedTemplateId !== '__adhoc__') {
      // Re-resolve fields with the new type
      applyTemplate(selectedTemplateId, typeId);
    }
  }

  function handleAddRow() {
    const newRow: BulkCreateRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: '',
      assignee: '@inherit', // D-10: ad-hoc add defaults assignee to @inherit
      priority: null,
      labels: [],
      duedate: null,
      timeEstimate: '',
      storyPoints: null,
      components: [],
      customFieldValues: {},
    };
    setRows((prev) => [...prev, newRow]);
    setRowStates((prev) => [...prev, { status: 'pending' }]);
  }

  function handleRowChange(idx: number, patch: Partial<BulkCreateRow>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleRowRemove(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setRowStates((prev) => prev.filter((_, i) => i !== idx));
  }

  // dnd-kit handlers
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const oldIdx = rows.findIndex((r) => r.id === active.id);
    const newIdx = rows.findIndex((r) => r.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    setRows((prev) => arrayMove(prev, oldIdx, newIdx));
    setRowStates((prev) => arrayMove(prev, oldIdx, newIdx));
  }

  // Create handler
  async function handleCreate() {
    if (!jiraBaseUrl || !projectKey) return;

    const token = await readSecret('jira-pat').catch(() => null);
    if (!token) return;
    setJiraToken(token);

    // Snapshot rows at click time (Pitfall 6 — disable edits during creation)
    const snapshotRows = rows.map((row) => {
      const ctx = { jiraUsername, jiraUserDisplayName, parentIssue };
      const { title, options: resolvedOptions } = resolveRowForCreate(row, ctx);

      // Build full payload
      const options: Record<string, unknown> = {
        ...resolvedOptions,
        parent: { key: parentKey },
      };

      // Additional fields from row
      if (row.timeEstimate.trim()) {
        options.timetracking = { originalEstimate: row.timeEstimate.trim() };
      }
      if (row.storyPoints != null && storyPointsFieldKey) {
        options[storyPointsFieldKey] = row.storyPoints;
      }
      if (row.components.length > 0) {
        options.components = row.components.map((id) => ({ id }));
      }
      for (const [fieldId, rawValue] of Object.entries(row.customFieldValues)) {
        if (!rawValue.trim()) continue;
        const fieldMeta = creatmetaFields?.find((f) => f.fieldId === fieldId);
        options[fieldId] = fieldMeta ? wrapCustomFieldValue(fieldMeta, rawValue) : rawValue;
      }

      return { title, options };
    });

    setCreating(true);
    setShowProgress(true);

    const createFn = (title: string, opts: Record<string, unknown>) =>
      createIssue(jiraBaseUrl, token, projectKey, title, {
        issueTypeId: effectiveTypeId,
        ...opts,
      });

    const finalStates = await createAllRows({
      rows: snapshotRows,
      rowStates,
      createFn,
      onStateChange: setRowStates,
    });

    setRowStates(finalStates);
    setCreating(false);

    if (finalStates.some((s) => s.status === 'created')) {
      invalidateGhAllData(queryClient, boardId ?? undefined);
      queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', parentKey, jiraBaseUrl] });
      queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment', parentKey] });
    }
  }

  function handleRetry() {
    handleCreate();
  }

  // Progress indicator derived props
  const progressCompleted = rowStates.filter(
    (s) => s.status === 'created' || s.status === 'failed',
  ).length;
  const progressSucceeded = rowStates.filter((s) => s.status === 'created').length;
  const progressFailed = rowStates.filter((s) => s.status === 'failed').length;
  const progressFailures = rowStates
    .filter((s) => s.status === 'failed')
    .map((s, i) => ({ key: rows[i]?.title ?? `Row ${i + 1}`, error: s.error ?? 'Unknown error' }));
  const isComplete =
    !creating &&
    rowStates.length > 0 &&
    rowStates.every(
      (s: RowState) =>
        (s.status as RowStatus) === 'created' || (s.status as RowStatus) === 'failed',
    );

  const hasFailed = rowStates.some((s) => s.status === 'failed');

  const activeRow = activeId ? rows.find((r) => r.id === activeId) : null;

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o && !creating) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[860px] max-h-[88vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold">Bulk Create Subtasks</h2>
              <p className="text-sm text-muted-foreground">Parent: {parentKey}</p>
            </div>
            <Dialog.Close
              render={
                <button
                  type="button"
                  className="rounded p-1 hover:bg-accent"
                  aria-label="Close"
                  disabled={creating}
                >
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/30">
            {/* Template selector */}
            <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="No template (ad-hoc)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__adhoc__">No template (ad-hoc)</SelectItem>
                {templates.map((t: SubtaskTemplate) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Subtask type selector */}
            <Select value={effectiveTypeId} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Subtask type" />
              </SelectTrigger>
              <SelectContent>
                {subtaskTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* N fields skipped badge — shown only when totalSkipped > 0 */}
            {totalSkipped > 0 && (
              <span
                role="status"
                className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 rounded-md px-2 py-0.5 text-xs"
              >
                {totalSkipped} field{totalSkipped !== 1 ? 's' : ''} skipped
              </span>
            )}
          </div>

          {/* Row list */}
          <div className="flex flex-col gap-1 px-6 py-4 flex-1 min-h-0">
            {rows.length === 0 ? (
              /* Ad-hoc empty state */
              <p className="text-sm text-muted-foreground text-center py-6">
                Add rows below, or choose a template above to pre-fill.
              </p>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={rows.map((r) => r.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {rows.map((row, idx) => (
                    <SortableRowItem
                      key={row.id}
                      row={row}
                      rowState={rowStates[idx] ?? { status: 'pending' }}
                      creatmetaFields={creatmetaFields}
                      allAssignees={allAssignees}
                      placeholderCtx={placeholderCtx}
                      creating={creating}
                      onChange={(patch) => handleRowChange(idx, patch)}
                      onRemove={() => handleRowRemove(idx)}
                    />
                  ))}
                </SortableContext>
                <DragOverlay>
                  {activeRow ? (
                    <div className="opacity-90 shadow-lg rounded-md bg-background border px-3 py-2 text-sm">
                      {activeRow.title || '(untitled row)'}
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}

            {/* Add row button */}
            <button
              type="button"
              onClick={handleAddRow}
              disabled={creating}
              className="mt-2 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="size-3.5" />
              Add row
            </button>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-6 py-4 rounded-b-lg">
            {/* Left slot: progress indicator */}
            {showProgress && (
              <div className="flex-1">
                <BulkProgressIndicator
                  total={rows.length}
                  completed={progressCompleted}
                  succeeded={progressSucceeded}
                  failed={progressFailed}
                  failures={progressFailures}
                  isComplete={isComplete}
                  onDismiss={() => setShowProgress(false)}
                  actionVerb="Creating"
                  noun="subtasks"
                />
              </div>
            )}

            {/* Right group */}
            <div className="flex items-center gap-2 ml-auto">
              <Dialog.Close
                render={
                  <Button variant="ghost" disabled={creating}>
                    Close
                  </Button>
                }
              />
              {hasFailed && isComplete ? (
                <Button variant="outline" onClick={handleRetry}>
                  Retry Failed
                </Button>
              ) : (
                <Button
                  variant="default"
                  disabled={rows.length === 0 || creating}
                  onClick={handleCreate}
                >
                  <LayoutList className="size-4 mr-1.5" />
                  Create Subtasks
                </Button>
              )}
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
