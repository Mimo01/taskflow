import { Dialog } from '@base-ui/react/dialog';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { DiscardChangesDialog } from '@/components/ui/discard-changes-dialog';
import { DraftNote } from '@/components/ui/draft-note';
import { Input } from '@/components/ui/input';
import { IssueTypeIcon } from '@/components/ui/issue-type-icon';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { WikiEditorHandle, WikiEditorHost } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { draftKey } from '@/lib/draft-keys';
import {
  fetchIssueDescription,
  fetchIssuePriorityOptions,
  fetchPriorities,
  type JiraPriority,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useDraftsStore } from '@/stores/drafts.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useIssueEditorHost } from '../issue-detail/useIssueEditorHost';
import { StagedFilesStrip } from '../StagedFilesStrip';
import { IssueTypeSelector } from './IssueTypeSelector';
import { LinkRowsSection } from './LinkRowsSection';
import { ModalSidebar } from './ModalSidebar';
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
  /** Draft to restore on open (Phase 101) */
  resumeDraftId?: string | null;
  /** Opens a just-created issue in the peek (Create another feedback) */
  onOpenIssue?: (key: string) => void;
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

  // Edit mode only: create/clone never read or write a description draft (Phase 101).
  const editIssueKey = mode === 'edit' ? initialValues?.issueKey : undefined;
  const descriptionKey = editIssueKey ? draftKey.description(editIssueKey) : null;

  const { state, dispatch, isSubtask } = useCreateEditForm({
    open,
    mode,
    initialValues,
    defaultIssueType,
    defaultParentKey,
    defaultEpicLinkKey,
    getDescriptionOverride: () =>
      descriptionKey ? useDraftsStore.getState().drafts[descriptionKey]?.text : undefined,
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

  // ── Description draft (edit mode): base, live stale check, restore ────────
  const [descriptionBase, setDescriptionBase] = useState(initialValues?.description ?? '');
  const [discardOpen, setDiscardOpen] = useState(false);
  const hydratedAtOpenRef = useRef(false);
  const descriptionRef = useRef(state.description);
  descriptionRef.current = state.description;
  const descriptionBaseRef = useRef(descriptionBase);
  descriptionBaseRef.current = descriptionBase;

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per open
  useEffect(() => {
    if (!open) return;
    setDiscardOpen(false);
    hydratedAtOpenRef.current = useDraftsStore.persist.hasHydrated();
    const stored =
      descriptionKey && hydratedAtOpenRef.current
        ? useDraftsStore.getState().drafts[descriptionKey]
        : undefined;
    setDescriptionBase(stored?.base ?? initialValues?.description ?? '');
  }, [open, initialValues]);

  const liveDescription = useQuery({
    queryKey: ['jira-issue-description', editIssueKey, jiraBaseUrl],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl || !editIssueKey) return null;
      return fetchIssueDescription(jiraBaseUrl, token, editIssueKey);
    },
    staleTime: 0,
    enabled: open && mode === 'edit' && !!editIssueKey && !!jiraBaseUrl,
  });

  const draft = useEditorDraft({
    key: descriptionKey,
    kind: 'description',
    issueKey: editIssueKey ?? '',
    base: descriptionBase,
    liveBase: liveDescription.data?.description ?? null,
  });
  const draftHydrated = draft.hydrated;

  // Drafts hydrated after the modal opened and the user has not typed: restore once.
  useEffect(() => {
    if (!open || !descriptionKey || !draftHydrated || hydratedAtOpenRef.current) return;
    hydratedAtOpenRef.current = true;
    const stored = useDraftsStore.getState().drafts[descriptionKey];
    if (!stored || descriptionRef.current !== descriptionBaseRef.current) return;
    dispatch({ type: 'SET_FIELD', field: 'description', value: stored.text });
    setDescriptionBase(stored.base ?? descriptionBaseRef.current);
  }, [open, descriptionKey, draftHydrated, dispatch]);

  // Issue no longer reachable (404): its drafts must not linger (D-06, T-100-24).
  useEffect(() => {
    if (liveDescription.isSuccess && liveDescription.data === null && editIssueKey) {
      useDraftsStore.getState().clearIssue(editIssueKey);
    }
  }, [liveDescription.data, liveDescription.isSuccess, editIssueKey]);

  const dirty = mode === 'edit' && state.description !== descriptionBase;

  function handleDescriptionChange(v: string) {
    dispatch({ type: 'SET_FIELD', field: 'description', value: v });
    draft.schedule(v);
  }

  function handleDiscardDraft() {
    draft.discard();
    dispatch({ type: 'SET_FIELD', field: 'description', value: descriptionBase });
    editorRef.current?.focus({ toEnd: true });
  }

  function handleUseJiraVersion() {
    const live = liveDescription.data?.description ?? '';
    draft.discard();
    setDescriptionBase(live);
    dispatch({ type: 'SET_FIELD', field: 'description', value: live });
  }

  function closeSilently() {
    draft.flush();
    onClose();
  }

  function requestCancel() {
    if (dirty) {
      setDiscardOpen(true);
      return;
    }
    closeSilently();
  }

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
    labelsRequired,
    fixVersionsOffered,
    fixVersionsRequired,
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
      if (mode === 'edit') draft.discard();
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
    onError: (msg) => {
      draft.flush();
      dispatch({
        type: 'SET_FIELD',
        field: 'apiError',
        value:
          msg && dirty
            ? "Couldn't save your changes. Your text is kept as a draft, try again."
            : msg || null,
      });
    },
  });

  const canSubmit =
    !!state.summary.trim() &&
    requiredCustomFieldsFilled &&
    (!labelsRequired || state.labels.length > 0) &&
    (!fixVersionsRequired || isSubtask || state.fixVersions.length > 0) &&
    !isPending &&
    !hasCreatedWithError;

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
      onOpenChange={(o, details) => {
        if (o) return;
        if (details.reason === 'escape-key') {
          details.cancel();
          // The editor's own Esc (onCancel) already handled this keypress.
          if (details.event?.defaultPrevented) return;
          requestCancel();
          return;
        }
        // X and backdrop close silently; the draft stays stored (D-13).
        closeSilently();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-[min(1080px,94vw)] h-[88vh] min-h-[480px] max-h-[calc(100vh-2rem)] overflow-hidden bg-background border rounded-lg shadow-xl flex flex-col">
          <div className="@container flex min-h-0 flex-1 flex-col">
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  trySubmit();
                }
              }}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex items-center gap-3 border-b px-6 py-4">
                {mode === 'create' ? (
                  <>
                    <div className="w-40 shrink-0">
                      <IssueTypeSelector
                        selectedIssueType={state.selectedIssueType}
                        defaultIssueType={defaultIssueType}
                        dispatch={dispatch}
                      />
                    </div>
                    <Dialog.Title className="text-lg font-semibold leading-tight">
                      Create issue
                    </Dialog.Title>
                  </>
                ) : (
                  <>
                    <IssueTypeIcon typeName={initialValues?.issueTypeName ?? 'Task'} />
                    <Dialog.Title className="text-lg font-semibold leading-tight">
                      Edit {initialValues?.issueKey}
                    </Dialog.Title>
                  </>
                )}
                <Dialog.Close
                  render={
                    <button
                      type="button"
                      className="ml-auto rounded p-1 hover:bg-accent"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  }
                />
              </div>

              <div className="flex min-h-0 flex-1 max-[720px]:flex-col max-[720px]:overflow-y-auto">
                <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 max-[720px]:overflow-visible">
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor="issue-summary"
                      className="text-xs font-semibold text-muted-foreground"
                    >
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
                      autoFocus={mode === 'create'}
                      disabled={isPending}
                    />
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Description
                      </span>
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
                    {/* biome-ignore lint/a11y/noStaticElementInteractions: focusout flushes the draft */}
                    <div onBlur={draft.flush} className="flex min-h-[240px] flex-1 flex-col">
                      <WikiEditorLazy
                        ref={editorRef}
                        value={state.description}
                        onChange={handleDescriptionChange}
                        onCancel={mode === 'edit' ? requestCancel : undefined}
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
                    </div>
                    {mode === 'edit' && (
                      <DraftNote
                        state={draft.state}
                        onDiscard={handleDiscardDraft}
                        onUseJira={handleUseJiraVersion}
                      />
                    )}
                  </div>

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

                  {state.apiError && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {state.apiError}
                    </p>
                  )}

                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-semibold text-muted-foreground">Links</h3>
                    <LinkRowsSection
                      linkRows={state.linkRows}
                      linkTypes={linkTypes}
                      linkTypesLoading={linkTypesLoading}
                      isPending={isPending}
                      dispatch={dispatch}
                    />
                  </div>
                </div>

                <aside className="w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 p-4 @max-[900px]:w-[240px] max-[720px]:w-full max-[720px]:overflow-visible max-[720px]:border-l-0 max-[720px]:border-t">
                  <ModalSidebar
                    mode={mode}
                    state={state}
                    dispatch={dispatch}
                    isSubtask={isSubtask}
                    isPending={isPending}
                    projectKey={projectKey}
                    jiraBaseUrl={jiraBaseUrl ?? ''}
                    defaultParentKey={defaultParentKey}
                    priorityOptions={priorityOptions}
                    creatmetaFields={creatmetaFields}
                    creatmetaLoading={creatmetaLoading}
                    customRequiredFields={customRequiredFields}
                    labelsRequired={labelsRequired}
                    fixVersionsOffered={fixVersionsOffered}
                    fixVersionsRequired={fixVersionsRequired}
                    open={open}
                    issueTypeName={initialValues?.issueTypeName}
                  />
                </aside>
              </div>

              <div className="flex items-center gap-2 border-t px-6 py-4">
                <div
                  data-testid="modal-footer-status"
                  className="flex min-w-0 flex-1 items-center gap-3"
                />
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="outline"
                        onClick={requestCancel}
                        disabled={isPending}
                      />
                    }
                  >
                    Cancel
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">Cancel</span>
                      <Keycap>Esc</Keycap>
                    </span>
                  </TooltipContent>
                </Tooltip>
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
                        ? 'Create Issue'
                        : 'Save Changes'}
                  </TooltipTrigger>
                  <TooltipContent>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">
                        {mode === 'create' ? 'Create Issue' : 'Save Changes'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Keycap>⌘</Keycap>
                        <Keycap>↵</Keycap>
                      </span>
                    </span>
                  </TooltipContent>
                </Tooltip>
              </div>
            </form>
            <DiscardChangesDialog
              open={discardOpen}
              onKeepEditing={() => {
                setDiscardOpen(false);
                editorRef.current?.focus({ toEnd: true });
              }}
              onDiscard={() => {
                setDiscardOpen(false);
                draft.discard();
                onClose();
              }}
            />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
