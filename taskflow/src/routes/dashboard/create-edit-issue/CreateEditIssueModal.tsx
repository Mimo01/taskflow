import { Dialog } from '@base-ui/react/dialog';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { EpicPicker } from '@/components/ui/epic-picker';
import { Input } from '@/components/ui/input';
import { Keycap } from '@/components/ui/keycap';
import { PersonPicker, toPersonValue } from '@/components/ui/person-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { WikiEditorHandle, WikiEditorHost } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { fetchIssuePriorityOptions, fetchPriorities, type JiraPriority } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useIssueEditorHost } from '../issue-detail/useIssueEditorHost';
import { StagedFilesStrip } from '../StagedFilesStrip';
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
  /** Epic key to prefill the Epic Link field in create mode (epic-child flow). */
  defaultEpicLinkKey?: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export function CreateEditIssueModal({
  open,
  onClose,
  mode,
  initialValues,
  defaultIssueType,
  defaultParentKey,
  defaultEpicLinkKey,
}: CreateEditIssueModalProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { epicLinkFieldKey, storyPointsFieldKey } = useSettingsStore();
  const projectKey = activeJiraProject ?? '';

  const { state, dispatch, isSubtask } = useCreateEditForm({
    open,
    mode,
    initialValues,
    defaultIssueType,
    defaultParentKey,
    defaultEpicLinkKey,
  });

  // ── Description attachments: create mode stages files, edit mode uploads live ──
  const editorRef = useRef<WikiEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLInputElement>(null);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [stagedUploadError, setStagedUploadError] = useState<string | null>(null);
  // Set when create succeeds but a staged attachment failed to upload, so the modal
  // stays open with the error visible (locked decision: never roll back the created
  // issue). Disables the submit button so the still-populated form can't be
  // resubmitted into a second, duplicate Jira issue (WR-01).
  const [hasCreatedWithError, setHasCreatedWithError] = useState(false);
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
    setStagedUploadError(null);
    stagedUploadErrorRef.current = null;
    setHasCreatedWithError(false);
  }, [open]);

  const editIssueKey = mode === 'edit' ? initialValues?.issueKey : undefined;

  const initialUserMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (state.selectedAssignee)
      map[state.selectedAssignee.name] = state.selectedAssignee.displayName;
    return map;
  }, [state.selectedAssignee]);
  const descriptionTexts = useMemo(() => [state.description], [state.description]);
  const userMap = useMentionUserMap(initialUserMap, descriptionTexts, jiraBaseUrl ?? '');

  // Edit mode uploads live to the existing issue; create (and clone) always stage, so a
  // file can never land on the wrong issue (T-100-16).
  const liveHost = useIssueEditorHost({
    issueKey: editIssueKey ?? null,
    projectKey,
    attachments: initialValues?.attachments ?? [],
    userMap,
    referenceTexts: [],
  });
  const stagedHost = useMemo<WikiEditorHost>(
    () => ({
      projectKey,
      userMap,
      staged: true,
      stageFile: (f) => setStagedFiles((p) => [...p, f]),
    }),
    [projectKey, userMap],
  );
  const host = mode === 'edit' && editIssueKey ? liveHost : stagedHost;

  function handleRemoveStagedFile(index: number) {
    setStagedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) editorRef.current?.insertFiles(files);
    e.target.value = '';
  }

  // Epic stories inherit required custom fields (e.g. Account) from their epic, the same
  // way subtasks inherit from their parent. Follows the Epic Link the user may change;
  // edit mode never inherits.
  const inheritFromKey =
    state.selectedIssueType === 'Subtask'
      ? defaultParentKey
      : mode === 'create'
        ? (state.epicLinkKey ?? undefined)
        : undefined;

  const {
    creatmetaFields,
    creatmetaLoading,
    customRequiredFields,
    selectedIssueTypeId,
    parentFields,
    linkTypes,
    linkTypesLoading,
  } = useCreateEditQueries({
    open,
    projectKey,
    jiraBaseUrl,
    selectedIssueType: state.selectedIssueType,
    epicLinkFieldKey,
    storyPointsFieldKey,
    inheritFromKey,
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
  // Tracks which source key was prefilled and the labels written, so a changed/cleared
  // Epic Link removes only labels the prefill itself wrote (never user-typed text).
  const prePopulatedRef = useRef<{
    key: string | undefined;
    labels: Record<string, string>;
  } | null>(null);
  const inputValues = state.customFieldInputValues;
  useEffect(() => {
    if (!open) {
      prePopulatedRef.current = null;
      return;
    }
    const prev = prePopulatedRef.current;
    if (prev && prev.key !== inheritFromKey) {
      for (const [fieldId, label] of Object.entries(prev.labels)) {
        if (inputValues[fieldId] === label)
          dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId, value: '' });
      }
      prePopulatedRef.current = null;
    }
    if (prePopulatedRef.current) return;
    if (Object.keys(parentInheritMap).length === 0) return;
    const labels: Record<string, string> = {};
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
      if (label) {
        labels[field.fieldId] = label;
        dispatch({ type: 'SET_CUSTOM_FIELD_INPUT', fieldId: field.fieldId, value: label });
      }
    }
    prePopulatedRef.current = { key: inheritFromKey, labels };
  }, [open, inheritFromKey, parentInheritMap, customRequiredFields, inputValues, dispatch]);

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
        setHasCreatedWithError(true);
        return;
      }
      onClose();
    },
    onError: (msg) => dispatch({ type: 'SET_FIELD', field: 'apiError', value: msg || null }),
  });

  const canSubmit =
    !!state.summary.trim() && requiredCustomFieldsFilled && !isPending && !hasCreatedWithError;

  // Cmd+Enter from any field: same guard as the primary button (T-100-15).
  function trySubmit() {
    if (!canSubmit) {
      if (!state.summary.trim()) summaryRef.current?.focus();
      return;
    }
    formRef.current?.requestSubmit();
  }

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

          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                trySubmit();
              }
            }}
            className="flex flex-col gap-4 px-6 py-4"
          >
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
                ref={summaryRef}
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
                <span className="text-sm font-medium">Description</span>
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
                  multiple
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </div>
              <WikiEditorLazy
                ref={editorRef}
                value={state.description}
                onChange={(v) => dispatch({ type: 'SET_FIELD', field: 'description', value: v })}
                preset="full"
                aria-label="Description"
                host={host}
                onSubmit={(text) => {
                  flushSync(() =>
                    dispatch({ type: 'SET_FIELD', field: 'description', value: text }),
                  );
                  trySubmit();
                }}
              />
              <StagedFilesStrip
                files={stagedFiles}
                onRemove={handleRemoveStagedFile}
                disabled={isPending}
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
                <EpicPicker
                  variant="field"
                  id="modal-epic-link"
                  value={state.epicLinkKey}
                  projectKey={projectKey}
                  disabled={isPending}
                  onChange={(epic) =>
                    dispatch({ type: 'SET_FIELD', field: 'epicLinkKey', value: epic?.key ?? null })
                  }
                />
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label htmlFor="modal-assignee" className="text-sm font-medium">
                Assignee
              </label>
              <PersonPicker
                variant="field"
                id="modal-assignee"
                aria-label="Assignee"
                projectKey={projectKey}
                jiraBaseUrl={jiraBaseUrl ?? ''}
                value={state.selectedAssignee}
                allowUnassign
                showAssignToMe
                disabled={isPending}
                emptyLabel={mode === 'create' ? 'Select assignee (optional)' : 'Unassigned'}
                onChange={(user) =>
                  dispatch(
                    user
                      ? { type: 'ASSIGNEE_PICK', user: toPersonValue(user) }
                      : { type: 'ASSIGNEE_PICK_UNASSIGNED' },
                  )
                }
              />
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
              projectKey={projectKey}
              jiraBaseUrl={jiraBaseUrl ?? ''}
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
              <Tooltip>
                <TooltipTrigger
                  render={<Button type="submit" disabled={!canSubmit} className="gap-1.5" />}
                >
                  {isPending && <Loader2 className="size-3.5 animate-spin" />}
                  {isPending
                    ? mode === 'create'
                      ? 'Creating...'
                      : 'Saving...'
                    : mode === 'create'
                      ? 'Create'
                      : 'Save'}
                </TooltipTrigger>
                <TooltipContent>
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{mode === 'create' ? 'Create' : 'Save'}</span>
                    <span className="flex items-center gap-1">
                      <Keycap>⌘</Keycap>
                      <Keycap>↵</Keycap>
                    </span>
                  </span>
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
