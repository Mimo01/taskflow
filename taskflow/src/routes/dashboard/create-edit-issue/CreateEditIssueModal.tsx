import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { DescriptionEditor } from '../DescriptionEditor';
import { CustomFieldsSection } from './CustomFieldsSection';
import { IssueTypeSelector } from './IssueTypeSelector';
import { LinkRowsSection } from './LinkRowsSection';
import { useCreateEditForm, type EditInitialValues } from './useCreateEditForm';
import { useCreateEditQueries } from './useCreateEditQueries';
import { useIssueMutations } from './useIssueMutations';

// ── Types ────────────────────────────────────────────────────────────────────

export type { EditInitialValues } from './useCreateEditForm';

export interface CreateEditIssueModalProps {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialValues?: EditInitialValues;
  defaultIssueType?: 'Story' | 'Subtask' | 'Bug';
  defaultParentKey?: string;
}

const PRIORITY_OPTIONS = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

// ── Component ────────────────────────────────────────────────────────────────

export function CreateEditIssueModal({
  open, onClose, mode, initialValues, defaultIssueType, defaultParentKey,
}: CreateEditIssueModalProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { epicLinkFieldKey, storyPointsFieldKey } = useSettingsStore();
  const projectKey = activeJiraProject ?? '';

  const { state, dispatch, isSubtask } = useCreateEditForm({
    open, mode, initialValues, defaultIssueType, defaultParentKey,
  });

  const {
    creatmetaFields, creatmetaLoading, customRequiredFields,
    epics, linkTypes, linkTypesLoading, allAssignees, assigneeLoading,
  } = useCreateEditQueries({
    open, projectKey, jiraBaseUrl, selectedIssueType: state.selectedIssueType,
    epicLinkFieldKey, storyPointsFieldKey,
  });

  const requiredCustomFieldsFilled = customRequiredFields.every(
    (f) => (state.customFieldValues[f.fieldId] ?? '').trim() !== '',
  );

  const { handleSubmit, isPending } = useIssueMutations({
    jiraBaseUrl, projectKey, mode, initialValues, state, creatmetaFields,
    epicLinkFieldKey, storyPointsFieldKey,
    onSuccess: () => { dispatch({ type: 'SET_FIELD', field: 'apiError', value: null }); onClose(); },
    onError: (msg) => dispatch({ type: 'SET_FIELD', field: 'apiError', value: msg || null }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">{mode === 'create' ? 'Create Issue' : 'Edit Issue'}</h2>
            <Dialog.Close render={<button type="button" className="rounded p-1 hover:bg-accent" aria-label="Close"><X className="h-4 w-4" /></button>} />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
            {mode === 'create' && <IssueTypeSelector selectedIssueType={state.selectedIssueType} defaultIssueType={defaultIssueType} dispatch={dispatch} />}

            <div className="flex flex-col gap-1">
              <label htmlFor="issue-summary" className="text-sm font-medium">Summary <span className="text-destructive">*</span></label>
              <Input id="issue-summary" value={state.summary} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'summary', value: e.target.value })} placeholder="Issue summary" required disabled={isPending} />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="issue-description" className="text-sm font-medium">Description</label>
              <DescriptionEditor id="issue-description" value={state.description} onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'description', value: v })} disabled={isPending} />
            </div>

            {isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="parent-key" className="text-sm font-medium">Parent <span className="text-destructive">*</span></label>
                {defaultParentKey ? (
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono">{state.parentKey}</div>
                ) : (
                  <Input id="parent-key" value={state.parentKey ?? ''} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'parentKey', value: e.target.value || null })} placeholder="Parent issue key (e.g. PROJ-123)" disabled={isPending} />
                )}
              </div>
            )}

            {!isSubtask && (
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium">Epic Link</label>
                {state.epicOpen ? (
                  <div className="rounded-md border shadow-sm">
                    <input role="combobox" aria-expanded={state.epicOpen} aria-controls="epic-listbox" aria-label="Filter epics" value={state.epicFilter} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: e.target.value })} placeholder="Filter epics..." className="w-full rounded-t-md px-3 py-2 text-sm outline-none border-b bg-background" onBlur={() => setTimeout(() => dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false }), 150)} />
                    <div id="epic-listbox" role="listbox" className="max-h-48 overflow-y-auto">
                      <button type="button" role="option" aria-selected={state.epicLinkKey === null} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent text-muted-foreground" onMouseDown={() => { dispatch({ type: 'SET_FIELD', field: 'epicLinkKey', value: null }); dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' }); dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false }); }}>None</button>
                      {(epics ?? []).filter((e) => state.epicFilter === '' || e.key.toLowerCase().includes(state.epicFilter.toLowerCase()) || e.fields.summary.toLowerCase().includes(state.epicFilter.toLowerCase())).map((epic) => (
                        <button key={epic.key} type="button" role="option" aria-selected={state.epicLinkKey === epic.key} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent" onMouseDown={() => { dispatch({ type: 'SET_FIELD', field: 'epicLinkKey', value: epic.key }); dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' }); dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false }); }}>
                          <span className="font-mono text-xs text-muted-foreground">{epic.key}</span>{' '}{epic.fields.summary}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => { dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: true }); dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' }); }} disabled={isPending} className="flex h-9 w-full items-center rounded-md border bg-background px-3 py-2 text-sm text-left shadow-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                    {state.epicLinkKey ? (epics?.find((e) => e.key === state.epicLinkKey) ? `${state.epicLinkKey}: ${epics?.find((e) => e.key === state.epicLinkKey)?.fields.summary}` : state.epicLinkKey) : <span className="text-muted-foreground">Select epic (optional)</span>}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Assignee</label>
              <Input role="combobox" aria-expanded={state.showAssigneeResults} aria-controls="assignee-listbox" aria-label="Assignee" value={state.assigneeInputValue} onChange={(e) => { dispatch({ type: 'SET_FIELD', field: 'assigneeInputValue', value: e.target.value }); dispatch({ type: 'SET_FIELD', field: 'selectedAssigneeName', value: null }); dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: true }); }} onFocus={() => { if (state.selectedAssigneeName) { dispatch({ type: 'SET_FIELD', field: 'assigneeInputValue', value: '' }); dispatch({ type: 'SET_FIELD', field: 'selectedAssigneeName', value: null }); } dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: true }); }} onBlur={() => setTimeout(() => dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: false }), 150)} placeholder="Search assignee..." disabled={isPending} />
              {state.showAssigneeResults && (assigneeLoading || allAssignees.length > 0) && (
                <div id="assignee-listbox" role="listbox" className="mt-1 rounded-lg border bg-popover shadow-md">
                  {assigneeLoading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>}
                  {allAssignees.filter((user) => { const q = state.assigneeInputValue.toLowerCase(); if (!q) return true; const fuzzy = (str: string) => { let i = 0; for (const ch of str.toLowerCase()) { if (ch === q[i]) i++; if (i === q.length) return true; } return false; }; return fuzzy(user.displayName) || fuzzy(user.name); }).map((user) => (
                    <button key={user.name} type="button" role="option" aria-selected={state.selectedAssigneeName === user.name} className="w-full px-3 py-2 text-left text-sm hover:bg-accent" onMouseDown={() => { dispatch({ type: 'SET_FIELD', field: 'selectedAssigneeName', value: user.name }); dispatch({ type: 'SET_FIELD', field: 'assigneeInputValue', value: user.displayName }); dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: false }); }}>{user.displayName} ({user.name})</button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Priority</label>
              <Select value={state.priority ?? ''} onValueChange={(v) => dispatch({ type: 'SET_FIELD', field: 'priority', value: v || null })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select priority (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {!isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="story-points" className="text-sm font-medium">Story Points</label>
                <Input id="story-points" type="number" min="0" step="0.5" value={state.storyPoints} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'storyPoints', value: e.target.value })} placeholder="Optional" disabled={isPending} />
              </div>
            )}

            {isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="time-estimate" className="text-sm font-medium">Time Estimate</label>
                <Input id="time-estimate" value={state.timeEstimate} onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'timeEstimate', value: e.target.value })} placeholder="e.g. 2h, 1d 3h, 30m" disabled={isPending} />
              </div>
            )}

            <CustomFieldsSection customRequiredFields={customRequiredFields} creatmetaFields={creatmetaFields} creatmetaLoading={creatmetaLoading} state={state} dispatch={dispatch} allAssignees={allAssignees} isPending={isPending} />
            <LinkRowsSection linkRows={state.linkRows} linkTypes={linkTypes} linkTypesLoading={linkTypesLoading} isPending={isPending} dispatch={dispatch} />

            {state.apiError && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{state.apiError}</p>}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" disabled={!state.summary.trim() || !requiredCustomFieldsFilled || isPending}>
                {isPending ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create' : 'Save')}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
