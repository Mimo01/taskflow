# Phase 80: Subtask Templates and Bulk Creation - Pattern Map

**Mapped:** 2026-06-05
**Files analyzed:** 9 new/modified files
**Analogs found:** 9 / 9

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `taskflow/src/stores/subtask-templates.store.ts` | store | CRUD | `taskflow/src/stores/tempo-filters.store.ts` | exact |
| `taskflow/src/routes/settings/SubtaskTemplatesSection.tsx` | component | CRUD | `taskflow/src/routes/settings/WorkflowSection.tsx` | role-match |
| `taskflow/src/routes/settings/Settings.tsx` (modify) | config | — | self | exact |
| `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx` | component | request-response | `taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx` | role-match |
| `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` | component | CRUD + batch | `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` | role-match |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (modify) | component | request-response | self | exact |
| `taskflow/src/routes/dashboard/resolveTemplateFields.ts` | utility | transform | `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` (CORE_FIELD_IDS) | partial |
| `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts` | utility | transform | `taskflow/src/stores/auth.store.ts` + `IssueDetailContent.tsx` | partial |
| `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` (adapt) | component | batch | self | exact |

---

## Pattern Assignments

### `taskflow/src/stores/subtask-templates.store.ts` (store, CRUD)

**Analog:** `taskflow/src/stores/tempo-filters.store.ts`

**Imports pattern** (lines 1–4):
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createTauriStorage } from '../lib/tauri-storage';
```

**Store shape** — mirror the `TempoFiltersState` interface with the new entity type. The `createTauriStorage` call is the only thing that changes between stores:
```typescript
// tauri-storage.ts lines 4–20: createTauriStorage wraps LazyStore with
// createJSONStorage, implementing getItem/setItem/removeItem each awaiting
// store.get/store.set+save/store.delete+save.
export function createTauriStorage(filename: string) {
  const store = new LazyStore(filename);
  return createJSONStorage(() => ({ ... }));
}
```

**Core persist pattern** (tempo-filters.store.ts lines 22–53):
```typescript
export const useTempoFiltersStore = create<TempoFiltersState>()(
  persist(
    (set) => ({
      savedFilters: [],
      addFilter: (filter) => set((s) => ({ savedFilters: [...s.savedFilters, filter] })),
      removeFilter: (id) =>
        set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      renameFilter: (id, name) =>
        set((s) => ({
          savedFilters: s.savedFilters.map((f) => (f.id === id ? { ...f, name } : f)),
        })),
      moveFilter: (id, direction) =>
        set((s) => {
          const idx = s.savedFilters.findIndex((f) => f.id === id);
          if (idx === -1) return s;
          const arr = [...s.savedFilters];
          const [item] = arr.splice(idx, 1);
          if (direction === 'left') arr.splice(Math.max(0, idx - 1), 0, item);
          else if (direction === 'right') arr.splice(Math.min(arr.length, idx + 1), 0, item);
          else if (direction === 'front') arr.unshift(item);
          else arr.push(item);
          return { savedFilters: arr };
        }),
    }),
    {
      name: 'tempo-filters-store',
      storage: createTauriStorage('tempo-filters.json'),
      version: 1,
      migrate: (persisted, _version) => persisted as TempoFiltersState,
    },
  ),
);
```

**New store substitutions:**
- `savedFilters` → `templates`
- `TempoFilter` → `SubtaskTemplate` (entity type defined in same file)
- `addFilter/removeFilter/renameFilter/moveFilter` → `addTemplate/removeTemplate/renameTemplate/moveTemplate/updateTemplate`
- Storage filename: `'subtask-templates.json'`
- Store name: `'subtask-templates-store'`
- Direction strings: `'left'/'right'` → `'up'/'down'` (vertical list)

**Entity types to define in the new store file** (from RESEARCH.md Pattern 1):
```typescript
export interface SubtaskTemplateRow {
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

export interface SubtaskTemplate {
  id: string;
  name: string;
  subtaskIssueTypeId: string;
  subtaskIssueTypeName: string;
  rows: SubtaskTemplateRow[];
}
```

**Critical:** `version: 1` and `migrate` passthrough must be present from day one (Pitfall 3 in RESEARCH.md).

---

### `taskflow/src/routes/settings/SubtaskTemplatesSection.tsx` (component, CRUD)

**Analog:** `taskflow/src/routes/settings/WorkflowSection.tsx`

**Outer shell pattern** (WorkflowSection.tsx lines 20–21, 67–69):
```typescript
export default function SubtaskTemplatesSection() {
  return (
    <div data-testid="section-subtask-templates" className="flex flex-col gap-8">
      <h2 className="text-lg font-semibold">Subtask Templates</h2>
      {/* content */}
    </div>
  );
}
```

**Subsection heading pattern** (WorkflowSection.tsx lines 27–29):
```tsx
<h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
  Sprint Board
</h3>
```
Use for the "ROWS" label inside the template row editor.

**Store consumption pattern** (WorkflowSection.tsx lines 9–18):
```typescript
import { useSettingsStore } from '../../stores/settings.store';
// → swap for:
import { useSubtaskTemplatesStore } from '../../stores/subtask-templates.store';
const { templates, addTemplate, removeTemplate, renameTemplate, moveTemplate, updateTemplate }
  = useSubtaskTemplatesStore();
```

**Template card row layout** (UI-SPEC Component Inventory §1):
```tsx
<div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
  {/* GripVertical drag handle — text-muted-foreground, cursor-grab */}
  {/* inline name <input> — border-none bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring rounded px-1 */}
  {/* "Edit Rows" ghost text button */}
  {/* Trash2 icon button — text-destructive hover:text-destructive, variant="ghost" size="icon-sm" */}
</div>
```

**Empty state** (UI-SPEC §1, ad-hoc empty state):
```tsx
<div className="flex flex-col items-center gap-3 py-12 text-center">
  <p className="text-sm font-semibold">No templates yet</p>
  <p className="text-xs text-muted-foreground">
    Create a template to bulk-add subtasks from any issue.
  </p>
  <Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" />New Template</Button>
</div>
```

**dnd-kit sortable pattern:** Follow the P78/P79 established overlay pattern — fixed-height drag overlay, NOT a live-rendered row clone (prevents ghost-reflow crash, RESEARCH.md Pitfall 5).

---

### `taskflow/src/routes/settings/Settings.tsx` (modify)

**Exact insertion pattern** (Settings.tsx lines 35–54, 84–96):

1. Add to `SettingsSection` union type (line 43):
```typescript
type SettingsSection =
  | 'connections'
  | 'appearance'
  | 'sidebar'
  | 'notifications'
  | 'workflow'
  | 'integrations'
  | 'updates'
  | 'advanced'
  | 'subtask-templates';   // ADD
```

2. Add to `SECTIONS` array (after `'workflow'` entry, lines 45–54):
```typescript
{ id: 'subtask-templates', label: 'Subtask Templates', icon: <LayoutTemplate className="h-4 w-4" /> },
```
Import `LayoutTemplate` from `'lucide-react'`.

3. Add import at top of file (alongside other section imports):
```typescript
import SubtaskTemplatesSection from './SubtaskTemplatesSection';
```

4. Add render block (lines 84–96, matching existing pattern):
```tsx
{activeSection === 'subtask-templates' && <SubtaskTemplatesSection />}
```

---

### `taskflow/src/routes/dashboard/create-edit-issue/SubtaskTemplateRow.tsx` (component, request-response)

**Analog:** `taskflow/src/routes/dashboard/create-edit-issue/CustomFieldsSection.tsx`

**Import base** (CustomFieldsSection.tsx lines 1–14):
```typescript
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { CreatemetaField, JiraUser } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
```
Add additionally: `ChevronRight, ChevronDown, X, Loader2, CheckCircle2, AlertCircle, GripVertical` from lucide-react; `Button` from `@/components/ui/button`.

**Custom field rendering switch** (CustomFieldsSection.tsx lines 113–208) — reuse the three-branch pattern (allowedValues → Select, hasAutocomplete → Input+dropdown, plain → Input) for the Advanced expand section.

**Row layout container** (UI-SPEC §2):
```tsx
<div className="flex items-center gap-2 min-h-[44px] px-2 py-1 rounded-md hover:bg-muted/50">
  {/* GripVertical handle (Settings mode only) */}
  {/* Title Input — flex-1 min-w-0 */}
  {/* Assignee selector — w-32 — shows PlaceholderChip or displayName */}
  {/* Priority select — w-28 */}
  {/* Labels multi-select — w-32 */}
  {/* Due date input — w-32 */}
  {/* Estimate text input — w-20, placeholder "e.g. 2h" */}
  {/* Story points number input — w-16 */}
  {/* Advanced toggle ChevronRight/ChevronDown — variant="ghost" size="icon-sm" */}
  {/* Status icon (bulk modal) OR Remove X (settings mode) — far right */}
</div>
```

**Per-row status icon pattern** (UI-SPEC §2, bulk modal only):
```tsx
// pending: nothing
// creating: <Loader2 className="size-4 animate-spin text-muted-foreground" />
// created:  <CheckCircle2 className="size-4 text-green-600 dark:text-green-400" aria-label="Created" role="img" />
// failed:   <AlertCircle className="size-4 text-destructive" aria-label="Failed" role="img" />
//           + row wrapper gets className="... bg-destructive/5"
```

**Advanced expand** (UI-SPEC §2):
```tsx
{advancedOpen && (
  <div
    id={`${row.id}-advanced`}
    className="flex flex-col gap-3 pl-4 pt-2 pb-3 rounded-b-md bg-muted/30 border-l-2 border-border"
  >
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
      Advanced fields
    </p>
    {/* Components multi-select */}
    {/* Custom fields via CustomFieldsSection pattern */}
  </div>
)}
```

**Placeholder chip pattern** (UI-SPEC Color section):
```tsx
// @inherit: bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300
// @current: bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300
// @unassigned: bg-muted text-muted-foreground
const chipBase = 'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-normal';
// aria-label="@inherit placeholder, resolved to {resolvedValue}"
```

**Props interface:** The component needs a `mode: 'settings' | 'preview'` prop — Settings mode shows drag handle + remove X; preview (bulk modal) mode shows status icons and disables fields during creation. Pass `rowState?: RowState` for preview mode.

---

### `taskflow/src/routes/dashboard/BulkCreateSubtasksModal.tsx` (component, CRUD + batch)

**Analog:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx`

**Imports pattern** (CreateEditIssueModal.tsx lines 1–22):
```typescript
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
// Additional for bulk modal:
import { readSecret } from '@/services/stronghold';
import { createIssue, wrapCustomFieldValue } from '@/services/jira';
import { invalidateGhAllData } from '@/services/jira/greenhopper/useGhAllData';
import { useBoardId } from '@/hooks/useBoardId';
import { useSubtaskTemplatesStore } from '@/stores/subtask-templates.store';
import { BulkProgressIndicator } from '../BulkProgressIndicator';
import { SubtaskTemplateRow } from '../create-edit-issue/SubtaskTemplateRow';
import { resolveTemplateFields } from '../resolveTemplateFields';
import { resolveRowPlaceholders } from '../resolveRowPlaceholders';
```

**Modal shell** (CreateEditIssueModal.tsx lines 150–170):
```tsx
<Dialog.Root open={open} onOpenChange={(o) => { if (!o && !creating) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2
                             w-[860px] max-h-[88vh] overflow-y-auto
                             bg-background border rounded-lg shadow-xl flex flex-col">
      {/* header */}
      {/* toolbar */}
      {/* row list */}
      {/* footer */}
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```
Note: `w-[860px]` (vs CreateEditIssueModal's `w-[680px]`); `max-h-[88vh]` (vs `max-h-[85vh]`).

**projectKey sourcing** (CreateEditIssueModal.tsx line 50):
```typescript
const { jiraBaseUrl, activeJiraProject, jiraUsername, jiraUserDisplayName } = useAuthStore();
const { storyPointsFieldKey } = useSettingsStore();
const projectKey = activeJiraProject ?? '';
```

**Createmeta query chain** (useCreateEditQueries.ts lines 58–96):
```typescript
// Step 1 — get issue types, filter to subtask types
const { data: issueTypes } = useQuery<CreatemtaIssueType[]>({
  queryKey: ['createmeta-issuetypes', projectKey],
  queryFn: async () => { ... },
  enabled: open && !!projectKey && !!jiraBaseUrl,
  staleTime: 5 * 60 * 1000,
});
const subtaskTypes = issueTypes?.filter(t => t.subtask === true) ?? [];

// Step 2 — get fields for selected subtask type
const selectedIssueTypeId =
  issueTypes?.find((t) => t.id === selectedSubtaskTypeId)?.id ?? subtaskTypes[0]?.id ?? '';

const { data: creatmetaFields } = useQuery<CreatemetaField[]>({
  queryKey: ['createmeta', projectKey, selectedIssueTypeId, 'Subtask'],
  queryFn: async () => fetchCreatemeta(jiraBaseUrl, token, projectKey, selectedIssueTypeId, 'Subtask'),
  enabled: open && !!projectKey && !!jiraBaseUrl && !!selectedIssueTypeId,
  staleTime: 5 * 60 * 1000,
});

// Step 3 — assignable users (for assignee picker)
const { data: allAssignees = [] } = useQuery<JiraUser[]>({
  queryKey: ['assignable-users', projectKey, jiraBaseUrl],
  // same queryFn as useCreateEditQueries.ts lines 141–157
});
```

**Sequential creation loop** (RESEARCH.md Pattern 6):
```typescript
type RowStatus = 'pending' | 'creating' | 'created' | 'failed';
interface RowState { status: RowStatus; createdKey?: string; error?: string; }

async function runCreation() {
  const snapshotRows = [...resolvedRows]; // snapshot at click time
  const newStates = rowStates.map(s => s.status === 'created' ? s : { status: 'pending' as const });
  setCreating(true);
  for (let i = 0; i < snapshotRows.length; i++) {
    if (newStates[i].status === 'created') continue; // SUBTPL-07 skip guard
    newStates[i] = { ...newStates[i], status: 'creating' };
    setRowStates([...newStates]);
    try {
      const result = await createIssue(jiraBaseUrl, token, projectKey, snapshotRows[i].title, snapshotRows[i].options);
      newStates[i] = { status: 'created', createdKey: result.key };
    } catch (e) {
      newStates[i] = { status: 'failed', error: e instanceof Error ? e.message : 'Unknown error' };
    }
    setRowStates([...newStates]);
  }
  setCreating(false);
  if (newStates.some(s => s.status === 'created')) {
    invalidateGhAllData(queryClient, boardId ?? undefined);
    queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', parentKey, jiraBaseUrl] });
    queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment', parentKey] });
  }
}
```

**BulkProgressIndicator wiring** (BulkProgressIndicator.tsx lines 13–21):
```typescript
// Derive props from RowState[]:
const progressProps = {
  total: rows.length,
  completed: rowStates.filter(s => s.status === 'created' || s.status === 'failed').length,
  succeeded: rowStates.filter(s => s.status === 'created').length,
  failed: rowStates.filter(s => s.status === 'failed').length,
  failures: rowStates
    .filter(s => s.status === 'failed')
    .map((s, i) => ({ key: rows[i]?.title ?? `Row ${i+1}`, error: s.error ?? 'Unknown error' })),
  isComplete: !creating && rowStates.every(s => s.status === 'created' || s.status === 'failed'),
  onDismiss: () => setShowProgress(false),
};
```

**Status text customization** (BulkProgressIndicator.tsx lines 44–57 — text is hardcoded "Updating N issues..."):
Add `actionVerb?: string` and `noun?: string` props to `BulkProgressIndicator`, defaulting to `'Updating'` and `'issues'`, so the bulk modal can pass `actionVerb="Creating"` and `noun="subtasks"`. This satisfies the UI-SPEC copy contract ("Creating {N} subtasks...") without forking the component.

**createIssue payload** (useIssueMutations.ts lines 55–103):
```typescript
// Per row, build options:
const options: Record<string, unknown> = {};
if (resolved.assignee) options.assignee = { name: resolved.assignee }; // never null — use omit for @unassigned
if (row.priority) options.priority = { name: row.priority };
if (row.labels.length) options.labels = row.labels;
if (row.duedate) options.duedate = row.duedate;
if (row.timeEstimate.trim()) options.timetracking = { originalEstimate: row.timeEstimate.trim() };
if (row.storyPoints != null && storyPointsFieldKey) options[storyPointsFieldKey] = row.storyPoints;
if (row.components.length) options.components = row.components.map(id => ({ id }));
for (const [fieldId, rawValue] of Object.entries(row.customFieldValues)) {
  if (!rawValue.trim()) continue;
  const fieldMeta = creatmetaFields?.find(f => f.fieldId === fieldId);
  options[fieldId] = fieldMeta ? wrapCustomFieldValue(fieldMeta, rawValue) : rawValue;
}
// DC: parent required for subtasks (useIssueMutations.ts line 64)
options.parent = { key: parentKey };

await createIssue(jiraBaseUrl, token, projectKey, row.title, {
  issueTypeId: selectedSubtaskTypeId,
  ...options,
});
```

**Footer layout** (UI-SPEC §3):
```tsx
<div className="flex items-center justify-between gap-2 border-t bg-muted/50 px-6 py-4 rounded-b-lg">
  {showProgress && <div className="flex-1"><BulkProgressIndicator {...progressProps} /></div>}
  <div className="flex items-center gap-2 ml-auto">
    <Dialog.Close render={
      <Button variant="ghost" disabled={creating}>Close</Button>
    } />
    {hasFailed && isComplete
      ? <Button variant="outline" onClick={handleRetry}>Retry Failed</Button>
      : <Button variant="default" disabled={rows.length === 0 || creating} onClick={handleCreate}>
          Create Subtasks
        </Button>
    }
  </div>
</div>
```

---

### `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (modify, entry-point wiring)

**Exact insertion location** (IssueDetailContent.tsx lines 323–330 — "Add subtask" button):
```tsx
{/* EXISTING "Add subtask" button at lines 323–330: */}
<button
  type="button"
  onClick={() => onAddSubtask?.(issueKey)}
  className="mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
>
  <Plus className="size-3.5" />
  Add subtask
</button>

{/* ADD immediately after — same section, before closing </section>: */}
<Button
  variant="outline"
  size="sm"
  className="mt-1 gap-1.5"
  onClick={() => setBulkCreateOpen(true)}
>
  <LayoutList className="size-3.5" />
  Bulk Create Subtasks
</Button>
<BulkCreateSubtasksModal
  open={bulkCreateOpen}
  onClose={() => setBulkCreateOpen(false)}
  parentKey={issueKey}
  parentIssue={issue}
/>
```

**State addition:**
```typescript
// Add to IssueDetailContent function body (alongside other useState calls):
const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
```

**Props interface** is unchanged — `parentKey` comes from the existing `issueKey` prop (CONTEXT.md canonical ref line 67: "`parentKey` comes from this component's local state"). The `issue` prop is `JiraIssueDetail` already in scope for `@inherit` resolution.

**Import additions:**
```typescript
import { LayoutList } from 'lucide-react'; // add to existing lucide import
import { BulkCreateSubtasksModal } from './BulkCreateSubtasksModal'; // new
```

---

### `taskflow/src/routes/dashboard/resolveTemplateFields.ts` (utility, transform)

**No direct analog** — this is a pure function with no existing equivalent. Reference `useCreateEditQueries.ts` for the `CORE_FIELD_IDS` set pattern (lines 33–43).

**Function signature and logic** (from RESEARCH.md Pattern 4):
```typescript
// CORE_FIELD_IDS pattern from useCreateEditQueries.ts lines 33–43:
const CORE_FIELD_IDS = new Set([
  'summary', 'description', 'assignee', 'priority', 'issuetype',
  'project', 'reporter', 'parent', 'timetracking',
]);

// New utility:
export interface ResolvedRowResult {
  row: SubtaskTemplateRow;          // row with unsupported custom fields cleared
  skippedFieldIds: string[];        // custom fieldIds that were dropped
}

export function resolveTemplateFields(
  rows: SubtaskTemplateRow[],
  creatmetaFields: CreatemetaField[],
  storyPointsFieldKey: string | null,
): { resolvedRows: ResolvedRowResult[]; totalSkipped: number } {
  const creatmetaFieldIds = new Set(creatmetaFields.map(f => f.fieldId));
  const ALWAYS_ALLOWED = new Set([
    'summary', 'assignee', 'priority', 'labels', 'duedate',
    'timetracking', 'parent',
    ...(storyPointsFieldKey ? [storyPointsFieldKey] : []),
  ]);

  let totalSkipped = 0;
  const resolvedRows = rows.map(row => {
    const skippedFieldIds: string[] = [];
    const cleanCustomFields: Record<string, string> = {};

    for (const [fid, val] of Object.entries(row.customFieldValues)) {
      if (creatmetaFieldIds.has(fid) || ALWAYS_ALLOWED.has(fid)) {
        cleanCustomFields[fid] = val;
      } else {
        skippedFieldIds.push(fid);
      }
    }

    // components: drop if not in createmeta and row has components
    let components = row.components;
    if (row.components.length > 0 && !creatmetaFieldIds.has('components')) {
      skippedFieldIds.push('components'); // counted once per row
      components = [];
    }

    totalSkipped += skippedFieldIds.length;
    return {
      row: { ...row, customFieldValues: cleanCustomFields, components },
      skippedFieldIds,
    };
  });

  return { resolvedRows, totalSkipped };
}
```

This is a **pure function** — no hooks, no side effects. Testable in isolation (referenced by `resolveTemplateFields.test.ts`).

---

### `taskflow/src/routes/dashboard/resolveRowPlaceholders.ts` (utility, transform)

**No direct analog** — pure function. Sources `@current` from `auth.store.ts` fields (lines 24–25) and `@inherit` from `JiraIssueDetail.fields` shape (IssueDetailContent.tsx lines 30–62).

**Function signature and logic** (from RESEARCH.md Pattern 5):
```typescript
import type { JiraIssueDetail } from '@/services/jira';

export interface PlaceholderContext {
  jiraUsername: string | null;         // for @current assignee payload value
  jiraUserDisplayName: string | null;  // for @current display hint
  parentIssue: JiraIssueDetail;        // for @inherit resolution
}

export interface ResolvedAssignee {
  payloadName: string | null;          // pass as assignee.name to createIssue, null = omit
  displayHint: string;                 // shown in chip: "@inherit → Alice"
}

export function resolveAssignee(
  assignee: SubtaskTemplateRow['assignee'],
  ctx: PlaceholderContext,
): ResolvedAssignee {
  if (assignee === '@unassigned') {
    return { payloadName: null, displayHint: '@unassigned' };
  }
  if (assignee === '@current') {
    return {
      payloadName: ctx.jiraUsername,
      displayHint: ctx.jiraUserDisplayName
        ? `@current → ${ctx.jiraUserDisplayName}`
        : '@current',
    };
  }
  if (assignee === '@inherit') {
    const name = ctx.parentIssue.fields.assignee?.name ?? null;
    const display = ctx.parentIssue.fields.assignee?.displayName ?? '(none)';
    return {
      payloadName: name,
      displayHint: `@inherit → ${display}`,
    };
  }
  // Concrete username — no placeholder
  return { payloadName: assignee, displayHint: assignee };
}

// Full row resolution at create time:
export function resolveRowForCreate(
  row: SubtaskTemplateRow,
  ctx: PlaceholderContext,
): { title: string; options: Record<string, unknown> } {
  const resolved = resolveAssignee(row.assignee, ctx);
  const options: Record<string, unknown> = {};
  if (resolved.payloadName) options.assignee = { name: resolved.payloadName };
  // @inherit field resolution (D-09): priority, labels, duedate
  const priority = row.priority === '@inherit'
    ? (ctx.parentIssue.fields.priority?.name ?? null)
    : row.priority;
  const labels = (row.labels.length === 1 && row.labels[0] === '@inherit')
    ? (ctx.parentIssue.fields.labels ?? [])
    : row.labels;
  const duedate = row.duedate === '@inherit'
    ? (ctx.parentIssue.fields.duedate ?? null)
    : row.duedate;
  if (priority) options.priority = { name: priority };
  if (labels.length) options.labels = labels;
  if (duedate) options.duedate = duedate;
  return { title: row.title, options };
}
```

**Auth store consumption** (auth.store.ts lines 24–25, 44–47):
```typescript
// In the component (not in the pure function):
const { jiraUsername, jiraUserDisplayName } = useAuthStore();
// Pass to resolveRowForCreate as ctx.jiraUsername / ctx.jiraUserDisplayName
```

**Pitfall: `components` field typing** (RESEARCH.md Pitfall 1): `JiraIssueDetail.fields.components` is not typed — access via `(issue.fields as Record<string, unknown>).components` or add `components?: Array<{ id: string; name: string }>` to `JiraIssueDetail.fields` in `jira.ts` L1206–1246 (recommended: additive field, no breaking callers).

---

### `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` (adapt — status text customization)

**Analog:** self

**Current hardcoded text** (BulkProgressIndicator.tsx lines 44–57):
```typescript
// LINE 47: statusText = `Updating ${total} issues...`;       // in-progress
// LINE 49: statusText = `${succeeded} updated successfully`; // all-success
// LINE 52: statusText = `All ${total} updates failed`;       // all-failed
// LINE 55: statusText = `${succeeded} updated, ${failed} failed`; // partial
```

**Required change** — add optional props with defaults (UI-SPEC Copywriting Contract):
```typescript
interface BulkProgressIndicatorProps {
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  failures: Array<{ key: string; error: string }>;
  isComplete: boolean;
  onDismiss: () => void;
  // NEW:
  actionVerb?: string;   // default: 'Updating'  → pass 'Creating' for bulk create
  noun?: string;         // default: 'issues'    → pass 'subtasks' for bulk create
}

// Status text derivation becomes:
const verb = actionVerb ?? 'Updating';
const n = noun ?? 'issues';
if (!isComplete) statusText = `${verb} ${total} ${n}...`;
else if (failed === 0) statusText = `${succeeded} ${n} ${verb === 'Creating' ? 'created' : 'updated'} successfully`;
// etc. — or use a more flexible copy pattern per UI-SPEC:
// "Creating {N} subtasks..." / "{N} subtask{s} created" / "{N} created, {M} failed"
```

**Minimal surgical change** — only modify the `BulkProgressIndicatorProps` interface and the `statusText` derivation block (lines 13–21 and 44–57). All other component logic unchanged.

---

## Shared Patterns

### `@base-ui/react/dialog` Modal Shell
**Source:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` lines 150–170
**Apply to:** `BulkCreateSubtasksModal.tsx`
```tsx
<Dialog.Root open={open} onOpenChange={(o) => { if (!o && !creating) onClose(); }}>
  <Dialog.Portal>
    <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
    <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 ...">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Dialog.Close render={<button type="button" className="rounded p-1 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>} />
      </div>
    </Dialog.Popup>
  </Dialog.Portal>
</Dialog.Root>
```

### zustand + persist + createTauriStorage
**Source:** `taskflow/src/stores/tempo-filters.store.ts` (entire file, 53 lines)
**Apply to:** `subtask-templates.store.ts`
The full pattern is the analog file itself — replace entity type and storage filename, keep all structural boilerplate identical.

### Settings Section Registration
**Source:** `taskflow/src/routes/settings/Settings.tsx` lines 35–96
**Apply to:** `Settings.tsx` modifications
Three insertion points: type union (line 43), SECTIONS array (line 54 area), render block (line 96 area). Match existing entry format exactly.

### Createmeta Subtask Type Filter
**Source:** `taskflow/src/routes/dashboard/create-edit-issue/useCreateEditQueries.ts` lines 78–81
**Apply to:** `BulkCreateSubtasksModal.tsx` subtask type selection
```typescript
// D-05: use subtask === true flag, NEVER name comparison (jira.ts L159 note)
const subtaskTypes = issueTypes?.filter(t => t.subtask === true) ?? [];
const defaultSubtaskTypeId = subtaskTypes[0]?.id ?? '';
```

### Error display (API errors in modal)
**Source:** `taskflow/src/routes/dashboard/create-edit-issue/CreateEditIssueModal.tsx` (line ~502 per UI-SPEC)
**Apply to:** `BulkCreateSubtasksModal.tsx` any pre-creation validation error
```tsx
{apiError && (
  <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
    {apiError}
  </div>
)}
```

### Cache Invalidation After Creation
**Source:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` lines 119–123 + RESEARCH.md Pattern 7
**Apply to:** `BulkCreateSubtasksModal.tsx` after creation loop
```typescript
import { invalidateGhAllData } from '@/services/jira/greenhopper/useGhAllData';
// boardId via useBoardId(jiraBaseUrl, jiraToken, activeJiraProject):
invalidateGhAllData(queryClient, boardId ?? undefined);
queryClient.invalidateQueries({ queryKey: ['jira-issue-detail', parentKey, jiraBaseUrl] });
queryClient.invalidateQueries({ queryKey: ['jira-subtask-enrichment', parentKey] });
// Note: subtaskSignature invalidation via prefix — ['jira-subtask-enrichment', parentKey]
// hits old key regardless of signature change (IssueDetailView.tsx L153)
```

### wrapCustomFieldValue for custom field payload
**Source:** `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` lines 73–77
**Apply to:** `BulkCreateSubtasksModal.tsx` creation loop, `resolveRowPlaceholders.ts`
```typescript
import { wrapCustomFieldValue } from '@/services/jira';
const fieldMeta = creatmetaFields?.find(f => f.fieldId === k);
options[k] = fieldMeta ? wrapCustomFieldValue(fieldMeta, v) : v;
```

### dnd-kit sortable (fixed-height overlay)
**Source:** P78/P79 pattern (project memory `project_dndkit_drag_patterns.md`)
**Apply to:** `SubtaskTemplatesSection.tsx` (template reorder) + `SubtaskTemplateRow.tsx` (row reorder)
Critical: use a fixed-height `DragOverlay` with a static clone, NOT a live-rendered row component. "reflowing ghost = crash" (P78 lesson). No `onDragOver` reorder — use `onDragEnd` only.

---

## No Analog Found

All files have analogs (exact or role-match). No files require falling back to RESEARCH.md patterns exclusively.

---

## Modification Map (files that already exist and need surgical changes)

| File | Location | Change |
|------|----------|--------|
| `taskflow/src/routes/settings/Settings.tsx` | Lines 35–96 | Add `'subtask-templates'` to type union, SECTIONS array, and render block |
| `taskflow/src/routes/dashboard/IssueDetailContent.tsx` | Lines 323–330 | Add `bulkCreateOpen` state + "Bulk Create Subtasks" button + modal mount |
| `taskflow/src/routes/dashboard/BulkProgressIndicator.tsx` | Lines 13–21, 44–57 | Add `actionVerb?`/`noun?` props with defaults; update status text derivation |
| `taskflow/src/services/jira.ts` | Lines 1206–1246 (JiraIssueDetail type), ~L1360–1382 (fetchIssueDetail fields list) | Add `components?: Array<{ id: string; name: string }>` to `JiraIssueDetail.fields` (for `@inherit` resolution — Pitfall 1) |

---

## Metadata

**Analog search scope:** `taskflow/src/stores/`, `taskflow/src/routes/settings/`, `taskflow/src/routes/dashboard/`, `taskflow/src/routes/dashboard/create-edit-issue/`, `taskflow/src/lib/`, `taskflow/src/services/`, `taskflow/src/stores/auth.store.ts`
**Files scanned:** 14 source files read + grep searches on useIssueMutations.ts and auth.store.ts
**Pattern extraction date:** 2026-06-05
