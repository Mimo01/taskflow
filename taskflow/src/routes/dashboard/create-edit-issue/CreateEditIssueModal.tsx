import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { attachmentRef, stagedAttachmentRef } from '@/lib/attachment-markup';
import { fetchIssuePriorityOptions, fetchPriorities, type JiraPriority } from '@/services/jira';
import { uploadAttachment } from '@/services/jira/attachments';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { DescriptionEditor, type DescriptionEditorHandle } from '../DescriptionEditor';
import { CustomFieldsSection } from './CustomFieldsSection';
import { IssueTypeSelector } from './IssueTypeSelector';
import { LinkRowsSection } from './LinkRowsSection';
import { type EditInitialValues, useCreateEditForm } from './useCreateEditForm';
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

// ── Component ────────────────────────────────────────────────────────────────

export function CreateEditIssueModal({
  open,
  onClose,
  mode,
  initialValues,
  defaultIssueType,
  defaultParentKey,
}: CreateEditIssueModalProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { epicLinkFieldKey, storyPointsFieldKey } = useSettingsStore();
  const projectKey = activeJiraProject ?? '';
  const queryClient = useQueryClient();

  const { state, dispatch, isSubtask } = useCreateEditForm({
    open,
    mode,
    initialValues,
    defaultIssueType,
    defaultParentKey,
  });

  // ── Description attachments (Task 2: create-mode staging + edit-mode immediate upload) ──
  const descriptionRef = useRef<DescriptionEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [stagedUploadError, setStagedUploadError] = useState<string | null>(null);
  // Synchronous companion to stagedUploadError: set inside useIssueMutations'
  // onStagedUploadError (called mid-mutationFn) so the top-level onSuccess callback
  // below — invoked right after the mutation promise resolves — can read it without
  // waiting on React state batching.
  const stagedUploadErrorRef = useRef<string | null>(null);

  // Reset all staged/upload state whenever the modal (re)opens, so a reopened modal
  // never carries files or errors from the previous session.
  useEffect(() => {
    if (!open) return;
    setStagedFiles([]);
    setUploadingName(null);
    setUploadError(null);
    setStagedUploadError(null);
    stagedUploadErrorRef.current = null;
  }, [open]);

  const editIssueKey = mode === 'edit' ? initialValues?.issueKey : undefined;

  // Edit mode: upload immediately against the existing issue key (mirrors
  // CommentComposer.tsx's uploadMutation pattern).
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !editIssueKey) throw new Error('No Jira credentials');
      return uploadAttachment(jiraBaseUrl, token, editIssueKey, file);
    },
    onSuccess: (created) => {
      setUploadingName(null);
      setUploadError(null);
      if (jiraBaseUrl && editIssueKey) {
        queryClient.invalidateQueries({
          queryKey: ['jira-issue-detail', editIssueKey, jiraBaseUrl],
        });
      }
      const att = created[0];
      if (att) descriptionRef.current?.insertRef(attachmentRef(att));
    },
    onError: (_err, file) => {
      setUploadError(`Failed to upload ${file.name}. Check file size and try again.`);
      setUploadingName(null);
    },
  });

  function handleFileSelected(file: File) {
    if (mode === 'edit' && editIssueKey) {
      setUploadError(null);
      setUploadingName(file.name);
      uploadMutation.mutate(file);
    } else {
      // Create mode: stage locally (no issue key yet) and insert the ref immediately
      // so the description submitted to createIssue already contains it.
      setStagedFiles((prev) => [...prev, file]);
      descriptionRef.current?.insertRef(stagedAttachmentRef(file));
    }
  }

  function handleRemoveStagedFile(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = '';
  }

  const {
    creatmetaFields,
    creatmetaLoading,
    customRequiredFields,
    selectedIssueTypeId,
    parentFields,
    epics,
    linkTypes,
    linkTypesLoading,
    allAssignees,
    assigneeLoading,
  } = useCreateEditQueries({
    open,
    projectKey,
    jiraBaseUrl,
    selectedIssueType: state.selectedIssueType,
    epicLinkFieldKey,
    storyPointsFieldKey,
    parentKey: defaultParentKey,
  });

  // Priorities must be scoped to the priority scheme that actually applies here, not
  // the instance-wide list (which has many priorities this project never uses). In
  // create mode the scoped set is the createmeta priority field's allowedValues; in
  // edit mode it's the issue's editmeta allowedValues. Both fall back to the global
  // list. Never hardcode standard-Jira names like "Highest" which may not exist.
  const createmetaPriorities = useMemo<JiraPriority[]>(() => {
    const field = creatmetaFields?.find((f) => f.fieldId === 'priority');
    return (field?.schema.allowedValues ?? []) as unknown as JiraPriority[];
  }, [creatmetaFields]);

  const prioritiesQuery = useQuery<JiraPriority[]>({
    queryKey: ['jira-priorities', initialValues?.issueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      if (mode === 'edit' && initialValues?.issueKey) {
        const scoped = await fetchIssuePriorityOptions(jiraBaseUrl, token, initialValues.issueKey);
        if (scoped.length > 0) return scoped;
      }
      return fetchPriorities(jiraBaseUrl, token);
    },
    // Skip the network query when createmeta already gives us the scoped create-mode set.
    enabled: open && !!jiraBaseUrl && (mode === 'edit' || createmetaPriorities.length === 0),
    staleTime: 10 * 60 * 1000,
  });

  const priorityOptions =
    mode === 'create' && createmetaPriorities.length > 0
      ? createmetaPriorities
      : (prioritiesQuery.data ?? []);

  // Raw parent values for required custom fields — sent directly to Jira, bypassing
  // wrapCustomFieldValue so the original types (e.g. integer account IDs) are preserved.
  const parentInheritMap = useMemo(() => {
    if (!parentFields || customRequiredFields.length === 0) return {} as Record<string, unknown>;
    const map: Record<string, unknown> = {};
    for (const f of customRequiredFields) {
      if (parentFields[f.fieldId] != null) map[f.fieldId] = parentFields[f.fieldId];
    }
    return map;
  }, [parentFields, customRequiredFields]);

  // Show inherited field labels in the autocomplete inputs so users can see what's
  // being inherited, without touching customFieldValues (which would go through
  // wrapCustomFieldValue and lose type information).
  const prePopulatedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      prePopulatedRef.current = false;
      return;
    }
    if (prePopulatedRef.current) return;
    if (Object.keys(parentInheritMap).length === 0) return;
    prePopulatedRef.current = true;
    for (const field of customRequiredFields) {
      if (!parentInheritMap[field.fieldId]) continue;
      const raw = parentInheritMap[field.fieldId];
      const item = Array.isArray(raw) ? (raw as unknown[])[0] : raw;
      if (item == null) continue;
      const label =
        typeof item === 'object'
          ? String(
              (item as Record<string, unknown>).name ??
                (item as Record<string, unknown>).displayName ??
                (item as Record<string, unknown>).value ??
                (item as Record<string, unknown>).key ??
                '',
            )
          : String(item);
      if (label) dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: field.fieldId, value: label });
    }
  }, [open, parentInheritMap, customRequiredFields, dispatch]);

  const requiredCustomFieldsFilled = customRequiredFields.every(
    (f) =>
      (state.customFieldValues[f.fieldId] ?? '').trim() !== '' ||
      parentInheritMap[f.fieldId] != null,
  );

  const { handleSubmit, isPending } = useIssueMutations({
    jiraBaseUrl,
    projectKey,
    mode,
    initialValues,
    state,
    creatmetaFields,
    issueTypeId: selectedIssueTypeId || undefined,
    parentInheritMap,
    epicLinkFieldKey,
    storyPointsFieldKey,
    stagedFiles,
    onStagedUploadError: (failedNames) => {
      const msg = `Issue created, but ${failedNames.length} file(s) failed to upload: ${failedNames.join(', ')}`;
      stagedUploadErrorRef.current = msg;
      setStagedUploadError(msg);
    },
    onSuccess: () => {
      dispatch({ type: 'SET_FIELD', field: 'apiError', value: null });
      // If a staged-file upload failed post-create, the issue was still created
      // successfully (locked decision: never roll back). Keep the modal open so the
      // failure message stays visible instead of auto-closing over it — there is no
      // toast/notification convention in this app to surface it after close.
      if (stagedUploadErrorRef.current) {
        setStagedFiles([]);
        stagedUploadErrorRef.current = null;
        return;
      }
      onClose();
    },
    onError: (msg) => dispatch({ type: 'SET_FIELD', field: 'apiError', value: msg || null }),
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[680px] max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl flex flex-col">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">
              {mode === 'create' ? 'Create Issue' : 'Edit Issue'}
            </h2>
            <Dialog.Close
              render={
                <button type="button" className="rounded p-1 hover:bg-accent" aria-label="Close">
                  <X className="h-4 w-4" />
                </button>
              }
            />
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-6 py-4">
            {mode === 'create' && (
              <IssueTypeSelector
                selectedIssueType={state.selectedIssueType}
                defaultIssueType={defaultIssueType}
                dispatch={dispatch}
              />
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="issue-summary" className="text-sm font-medium">
                Summary <span className="text-destructive">*</span>
              </label>
              <Input
                id="issue-summary"
                value={state.summary}
                onChange={(e) =>
                  dispatch({ type: 'SET_FIELD', field: 'summary', value: e.target.value })
                }
                placeholder="Issue summary"
                required
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label htmlFor="issue-description" className="text-sm font-medium">
                  Description
                </label>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Paperclip className="h-3 w-3" />
                  Attach file
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
              <DescriptionEditor
                ref={descriptionRef}
                id="issue-description"
                value={state.description}
                onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'description', value: v })}
                disabled={isPending}
                attachments={initialValues?.attachments ?? []}
                stagedFiles={stagedFiles}
                onFileSelected={handleFileSelected}
                onRemoveStagedFile={handleRemoveStagedFile}
                uploadingName={uploadingName}
                uploadError={uploadError}
              />
              {stagedUploadError && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {stagedUploadError}
                </p>
              )}
            </div>

            {isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="parent-key" className="text-sm font-medium">
                  Parent <span className="text-destructive">*</span>
                </label>
                {defaultParentKey ? (
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground font-mono">
                    {state.parentKey}
                  </div>
                ) : (
                  <Input
                    id="parent-key"
                    value={state.parentKey ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'SET_FIELD',
                        field: 'parentKey',
                        value: e.target.value || null,
                      })
                    }
                    placeholder="Parent issue key (e.g. PROJ-123)"
                    disabled={isPending}
                  />
                )}
              </div>
            )}

            {!isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="modal-epic-link" className="text-sm font-medium">
                  Epic Link
                </label>
                {state.epicOpen ? (
                  <div className="rounded-md border shadow-sm">
                    <input
                      id="modal-epic-link"
                      role="combobox"
                      aria-expanded={state.epicOpen}
                      aria-controls="epic-listbox"
                      aria-label="Filter epics"
                      value={state.epicFilter}
                      onChange={(e) =>
                        dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: e.target.value })
                      }
                      placeholder="Filter epics..."
                      className="w-full rounded-t-md px-3 py-2 text-sm outline-none border-b bg-background"
                      onBlur={() =>
                        setTimeout(
                          () => dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false }),
                          150,
                        )
                      }
                    />
                    <div id="epic-listbox" role="listbox" className="max-h-48 overflow-y-auto">
                      <button
                        type="button"
                        role="option"
                        aria-selected={state.epicLinkKey === null}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent text-muted-foreground"
                        onMouseDown={() => {
                          dispatch({ type: 'SET_FIELD', field: 'epicLinkKey', value: null });
                          dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' });
                          dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false });
                        }}
                      >
                        None
                      </button>
                      {(epics ?? [])
                        .filter(
                          (e) =>
                            state.epicFilter === '' ||
                            e.key.toLowerCase().includes(state.epicFilter.toLowerCase()) ||
                            e.fields.summary.toLowerCase().includes(state.epicFilter.toLowerCase()),
                        )
                        .map((epic) => (
                          <button
                            key={epic.key}
                            type="button"
                            role="option"
                            aria-selected={state.epicLinkKey === epic.key}
                            className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent"
                            onMouseDown={() => {
                              dispatch({
                                type: 'SET_FIELD',
                                field: 'epicLinkKey',
                                value: epic.key,
                              });
                              dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' });
                              dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: false });
                            }}
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {epic.key}
                            </span>{' '}
                            {epic.fields.summary}
                          </button>
                        ))}
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      dispatch({ type: 'SET_FIELD', field: 'epicOpen', value: true });
                      dispatch({ type: 'SET_FIELD', field: 'epicFilter', value: '' });
                    }}
                    disabled={isPending}
                    className="flex h-9 w-full items-center rounded-md border bg-background px-3 py-2 text-sm text-left shadow-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {state.epicLinkKey ? (
                      epics?.find((e) => e.key === state.epicLinkKey) ? (
                        `${state.epicLinkKey}: ${epics?.find((e) => e.key === state.epicLinkKey)?.fields.summary}`
                      ) : (
                        state.epicLinkKey
                      )
                    ) : (
                      <span className="text-muted-foreground">Select epic (optional)</span>
                    )}
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="modal-assignee" className="text-sm font-medium">
                Assignee
              </label>
              <Input
                id="modal-assignee"
                role="combobox"
                aria-expanded={state.showAssigneeResults}
                aria-controls="assignee-listbox"
                aria-label="Assignee"
                value={state.assigneeInputValue}
                onChange={(e) => {
                  dispatch({
                    type: 'SET_FIELD',
                    field: 'assigneeInputValue',
                    value: e.target.value,
                  });
                  dispatch({ type: 'SET_FIELD', field: 'selectedAssigneeName', value: null });
                  dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: true });
                }}
                onFocus={() => {
                  if (state.selectedAssigneeName) {
                    dispatch({ type: 'SET_FIELD', field: 'assigneeInputValue', value: '' });
                    dispatch({ type: 'SET_FIELD', field: 'selectedAssigneeName', value: null });
                  }
                  dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: true });
                }}
                onBlur={() =>
                  setTimeout(
                    () =>
                      dispatch({ type: 'SET_FIELD', field: 'showAssigneeResults', value: false }),
                    150,
                  )
                }
                placeholder="Search assignee..."
                disabled={isPending}
              />
              {state.showAssigneeResults && (assigneeLoading || allAssignees.length > 0) && (
                <div
                  id="assignee-listbox"
                  role="listbox"
                  className="mt-1 rounded-lg border bg-popover shadow-md"
                >
                  {assigneeLoading && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">Loading...</div>
                  )}
                  {allAssignees
                    .filter((user) => {
                      const q = state.assigneeInputValue.toLowerCase();
                      if (!q) return true;
                      const fuzzy = (str: string) => {
                        let i = 0;
                        for (const ch of str.toLowerCase()) {
                          if (ch === q[i]) i++;
                          if (i === q.length) return true;
                        }
                        return false;
                      };
                      return fuzzy(user.displayName) || fuzzy(user.name);
                    })
                    .map((user) => (
                      <button
                        key={user.name}
                        type="button"
                        role="option"
                        aria-selected={state.selectedAssigneeName === user.name}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        onMouseDown={() => {
                          dispatch({
                            type: 'SET_FIELD',
                            field: 'selectedAssigneeName',
                            value: user.name,
                          });
                          dispatch({
                            type: 'SET_FIELD',
                            field: 'assigneeInputValue',
                            value: user.displayName,
                          });
                          dispatch({
                            type: 'SET_FIELD',
                            field: 'showAssigneeResults',
                            value: false,
                          });
                        }}
                      >
                        {user.displayName} ({user.name})
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="modal-priority" className="text-sm font-medium">
                Priority
              </label>
              <Select
                value={state.priority ?? ''}
                onValueChange={(v) =>
                  dispatch({ type: 'SET_FIELD', field: 'priority', value: v || null })
                }
              >
                <SelectTrigger id="modal-priority" className="w-full">
                  <SelectValue placeholder="Select priority (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {priorityOptions.map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="story-points" className="text-sm font-medium">
                  Story Points
                </label>
                <Input
                  id="story-points"
                  type="number"
                  min="0"
                  step="0.5"
                  value={state.storyPoints}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'storyPoints', value: e.target.value })
                  }
                  placeholder="Optional"
                  disabled={isPending}
                />
              </div>
            )}

            {isSubtask && (
              <div className="flex flex-col gap-1">
                <label htmlFor="time-estimate" className="text-sm font-medium">
                  Time Estimate
                </label>
                <Input
                  id="time-estimate"
                  value={state.timeEstimate}
                  onChange={(e) =>
                    dispatch({ type: 'SET_FIELD', field: 'timeEstimate', value: e.target.value })
                  }
                  placeholder="e.g. 2h, 1d 3h, 30m"
                  disabled={isPending}
                />
              </div>
            )}

            <CustomFieldsSection
              customRequiredFields={customRequiredFields}
              creatmetaFields={creatmetaFields}
              creatmetaLoading={creatmetaLoading}
              state={state}
              dispatch={dispatch}
              allAssignees={allAssignees}
              isPending={isPending}
            />
            <LinkRowsSection
              linkRows={state.linkRows}
              linkTypes={linkTypes}
              linkTypesLoading={linkTypesLoading}
              isPending={isPending}
              dispatch={dispatch}
            />

            {state.apiError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {state.apiError}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!state.summary.trim() || !requiredCustomFieldsFilled || isPending}
                className="gap-1.5"
              >
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                {isPending
                  ? mode === 'create'
                    ? 'Creating...'
                    : 'Saving...'
                  : mode === 'create'
                    ? 'Create'
                    : 'Save'}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
