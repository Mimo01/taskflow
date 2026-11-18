import { Dialog } from '@base-ui/react/dialog';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Paperclip, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDraftStagedFiles } from '@/hooks/useDraftStagedFiles';
import { useEditorDraft } from '@/hooks/useEditorDraft';
import { useIssueDraft } from '@/hooks/useIssueDraft';
import { useMentionUserMap } from '@/hooks/useMentionUserMap';
import { draftKey } from '@/lib/draft-keys';
import { removeDraftFiles } from '@/lib/issue-draft-files';
import { hasUserContent, keptFieldsAfterCreate, toIssueSnapshot } from '@/lib/issue-draft-snapshot';
import {
  fetchIssueDescription,
  fetchIssuePriorityOptions,
  fetchPriorities,
  fetchProjectPriorityOptions,
  type JiraPriority,
} from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useDraftsStore } from '@/stores/drafts.store';
import { useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { useSettingsStore } from '@/stores/settings.store';
import { useIssueEditorHost } from '../issue-detail/useIssueEditorHost';
import { StagedFilesStrip } from '../StagedFilesStrip';
import { LinkRowsSection } from './LinkRowsSection';
import { ModalSidebar } from './ModalSidebar';
import { type EditInitialValues, type FormAction, useCreateEditForm } from './useCreateEditForm';
import { useCreateEditQueries } from './useCreateEditQueries';
import { useDraftResume } from './useDraftResume';
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
  resumeDraftId,
  onOpenIssue,
}: CreateEditIssueModalProps) {
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const { epicLinkFieldKey, storyPointsFieldKey } = useSettingsStore();

  // Edit mode only: create/clone never read or write a description draft (Phase 101).
  const editIssueKey = mode === 'edit' ? initialValues?.issueKey : undefined;
  const descriptionKey = editIssueKey ? draftKey.description(editIssueKey) : null;

  // A resumed draft is created in its own project (D-14). Latched for the session so discarding
  // or creating the draft mid-session never flips the project underneath the open form.
  const storedDraftProject = useIssueDraftsStore((s) =>
    resumeDraftId ? s.drafts[resumeDraftId]?.projectKey : undefined,
  );
  const resumedProjectRef = useRef<string | null>(null);
  if (!open || mode !== 'create' || !resumeDraftId) resumedProjectRef.current = null;
  else if (storedDraftProject && resumedProjectRef.current === null)
    resumedProjectRef.current = storedDraftProject;
  const projectKey = resumedProjectRef.current ?? activeJiraProject ?? '';

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
  const issueDraft = useIssueDraft({ kind: 'issue' });
  const draftIdRef = useRef<string | null>(null);
  draftIdRef.current = issueDraft.draftId;
  const savedDraft = useIssueDraftsStore((s) =>
    issueDraft.draftId ? s.drafts[issueDraft.draftId] : undefined,
  );
  // Bumped only by user edits: autosave must never fire from a state effect alone, because
  // the reducer keeps the previous session's values until the open RESET lands.
  const [editTick, setEditTick] = useState(0);
  const markEdited = useCallback(() => setEditTick((t) => t + 1), []);
  const clearNoteRef = useRef<(key: string) => void>(() => {});
  const userDispatch = useCallback(
    (a: FormAction) => {
      dispatch(a);
      setEditTick((t) => t + 1);
      // Editing a field retires its stale note (UI-SPEC).
      if (a.type === 'SET_FIELD') {
        if (a.field === 'epicLinkKey') clearNoteRef.current('epic');
        else if (a.field === 'parentKey') clearNoteRef.current('parent');
        else if (a.field === 'fixVersions') clearNoteRef.current('fixVersions');
      } else if (a.type === 'SET_CUSTOM_FIELD_VALUE' || a.type === 'SET_CUSTOM_FIELD_INPUT') {
        clearNoteRef.current(a.fieldId);
      }
    },
    [dispatch],
  );
  const staged = useDraftStagedFiles({ ensureDraftId: issueDraft.ensureId, onChange: markEdited });
  const [createAnother, setCreateAnother] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [focusSummary, setFocusSummary] = useState(false);
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
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per open
  useEffect(() => {
    if (!open) return;
    staged.reset();
    setStagedUploadError(null);
    stagedUploadErrorRef.current = null;
    setHasCreatedWithError(false);
    setCreateAnother(false);
    setCreatedKey(null);
    setEditTick(0);
    if (mode === 'create' && !resumeDraftId) issueDraft.adopt(null);
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
    userDispatch({ type: 'SET_FIELD', field: 'description', value: v });
    draft.schedule(v);
  }

  function flushAll() {
    draft.flush();
    issueDraft.flush();
  }

  function handleDiscardIssueDraft() {
    const id = draftIdRef.current;
    issueDraft.discard();
    if (id) void removeDraftFiles(id);
    staged.reset();
    onClose();
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
    flushAll();
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
      stageFile: staged.stage,
    }),
    [projectKey, userMap, staged.stage],
  );
  const host = mode === 'edit' && editIssueKey ? liveHost : stagedHost;

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
    issueTypes,
    creatmetaFields,
    creatmetaLoading,
    issueTypesLoading,
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
  const issueTypeNames = issueTypes?.map((t) => t.name);

  const { staleNotes, clearNote } = useDraftResume({
    open: open && mode === 'create',
    resumeDraftId,
    dispatch,
    issueDraft,
    staged,
    editorRef,
    creatmetaFields,
    creatmetaLoading: creatmetaLoading || issueTypesLoading,
    selectedIssueType: state.selectedIssueType,
    jiraBaseUrl,
  });

  clearNoteRef.current = clearNote;

  // Autosave (Create only): fires on user edits alone, reading the latest values via a ref.
  const latestRef = useRef({ open, mode, state, projectKey, creatmetaFields, staged });
  latestRef.current = { open, mode, state, projectKey, creatmetaFields, staged };
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on user edits only (T-101-27)
  useEffect(() => {
    if (editTick === 0) return;
    const cur = latestRef.current;
    if (!cur.open || cur.mode !== 'create') return;
    const fieldNames: Record<string, string> = {};
    for (const f of cur.creatmetaFields ?? []) fieldNames[f.fieldId] = f.name;
    issueDraft.schedule({
      projectKey: cur.projectKey,
      snapshot: toIssueSnapshot(cur.state, fieldNames),
      files: cur.staged.refs,
      hasContent: hasUserContent(cur.state, cur.staged.files.length),
    });
  }, [editTick]);

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
    // Create mode gets its own key: the edit key ['jira-priorities', issueKey, base] is
    // shared with the issue-detail picker and must not hold a project-wide set.
    queryKey:
      mode === 'edit'
        ? ['jira-priorities', initialValues?.issueKey, jiraBaseUrl]
        : [
            'jira-create-priorities',
            projectKey,
            state.selectedIssueType,
            inheritFromKey,
            jiraBaseUrl,
          ],
    queryFn: async () => {
      const token = await readSecret('jira-pat').catch(() => null);
      if (!token || !jiraBaseUrl) return [];
      if (mode === 'edit' && initialValues?.issueKey) {
        const scoped = await fetchIssuePriorityOptions(jiraBaseUrl, token, initialValues.issueKey);
        if (scoped.length > 0) return scoped;
      } else if (mode === 'create' && projectKey) {
        // createmeta omits priority when it is not on the create screen; borrow the
        // scheme from a reference issue so only this project's priorities show.
        const scoped = await fetchProjectPriorityOptions(
          jiraBaseUrl,
          token,
          projectKey,
          state.selectedIssueType,
          inheritFromKey,
        );
        if (scoped.length > 0) return scoped;
      }
      return fetchPriorities(jiraBaseUrl, token);
    },
    // Skip the network query when createmeta already gives us the scoped create-mode set.
    // Create mode waits for createmeta, so the instance-wide list never flashes in first.
    enabled:
      open &&
      !!jiraBaseUrl &&
      (mode === 'edit' ||
        (!creatmetaLoading && !issueTypesLoading && createmetaPriorities.length === 0)),
    staleTime: 10 * 60 * 1000,
  });

  const priorityOptions =
    mode === 'create' && createmetaPriorities.length > 0
      ? createmetaPriorities
      : mode === 'create' && (creatmetaLoading || issueTypesLoading)
        ? []
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
    stagedFiles: staged.files,
    onStagedUploadError: (failedNames) => {
      const msg = `Issue created, but ${failedNames.length} file(s) failed to upload: ${failedNames.join(', ')}`;
      stagedUploadErrorRef.current = msg;
      setStagedUploadError(msg);
    },
    onSuccess: (created) => {
      dispatch({ type: 'SET_FIELD', field: 'apiError', value: null });
      if (mode === 'edit') draft.discard();
      if (mode === 'create') {
        // The issue exists now: its draft and the disk copies are done, including when a
        // staged upload failed below (the issue is created; the files stay in memory).
        const id = draftIdRef.current;
        issueDraft.discard();
        if (id) void removeDraftFiles(id);
      }
      // If a staged-file upload failed post-create, the issue was still created
      // successfully (locked decision: never roll back). Keep the modal open so the
      // failure message stays visible instead of auto-closing over it — there is no
      // toast/notification convention in this app to surface it after close.
      if (stagedUploadErrorRef.current) {
        staged.reset();
        stagedUploadErrorRef.current = null;
        setHasCreatedWithError(true);
        return;
      }
      if (mode === 'create' && createAnother) {
        dispatch({ type: 'RESET_KEEP', keep: keptFieldsAfterCreate(latestRef.current.state) });
        staged.reset();
        issueDraft.adopt(null);
        setEditTick(0);
        setCreatedKey(created?.key ?? null);
        setFocusSummary(true);
        return;
      }
      onClose();
    },
    onError: (msg) => {
      draft.flush();
      if (mode === 'create') issueDraft.flush();
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

  // Focus Summary once the post-create reset has rendered and the input is enabled again.
  useEffect(() => {
    if (!focusSummary || isPending) return;
    summaryRef.current?.focus();
    setFocusSummary(false);
  }, [focusSummary, isPending]);

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
                  <Dialog.Title className="text-lg font-semibold leading-tight">
                    Create issue
                  </Dialog.Title>
                ) : (
                  <>
                    <IssueTypeIcon
                      typeName={initialValues?.issueTypeName ?? 'Task'}
                      className="h-4 w-4 shrink-0"
                    />
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
                      onChange={(e) => {
                        userDispatch({
                          type: 'SET_FIELD',
                          field: 'summary',
                          value: e.target.value,
                        });
                        setCreatedKey(null);
                      }}
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
                    <div onBlur={flushAll} className="flex min-h-[240px] flex-1 flex-col">
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
                    files={staged.files}
                    onRemove={staged.remove}
                    missing={staged.missing}
                    onRemoveMissing={staged.removeMissing}
                    disabled={isPending}
                  />
                  {stagedUploadError && (
                    <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      {stagedUploadError}
                    </p>
                  )}

                  {state.apiError &&
                    (mode === 'create' ? (
                      <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        <p>Couldn't create the issue. Your draft is kept, try again.</p>
                        <p className="text-xs">{state.apiError}</p>
                      </div>
                    ) : (
                      <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                        {state.apiError}
                      </p>
                    ))}

                  <div className="flex flex-col gap-1">
                    <h3 className="text-xs font-semibold text-muted-foreground">Links</h3>
                    <LinkRowsSection
                      linkRows={state.linkRows}
                      linkTypes={linkTypes}
                      linkTypesLoading={linkTypesLoading}
                      isPending={isPending}
                      dispatch={userDispatch}
                    />
                  </div>
                </div>

                <aside
                  onBlur={flushAll}
                  className="w-[300px] shrink-0 overflow-y-auto border-l bg-muted/30 p-4 min-[721px]:@max-[900px]:w-[240px] max-[720px]:w-full max-[720px]:overflow-visible max-[720px]:border-l-0 max-[720px]:border-t"
                >
                  <ModalSidebar
                    mode={mode}
                    state={state}
                    dispatch={userDispatch}
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
                    staleNotes={staleNotes}
                    availableTypeNames={issueTypeNames}
                  />
                </aside>
              </div>

              <div className="flex items-center gap-2 border-t px-6 py-4">
                <div
                  data-testid="modal-footer-status"
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  {mode === 'create' && (
                    <>
                      <div className="flex h-8 shrink-0 items-center gap-2">
                        <input
                          type="checkbox"
                          id="create-another"
                          className="size-4 accent-primary focus-visible:ring-2 focus-visible:ring-ring"
                          checked={createAnother}
                          disabled={isPending}
                          onChange={(e) => setCreateAnother(e.target.checked)}
                        />
                        <label htmlFor="create-another" className="text-sm">
                          Create another
                        </label>
                      </div>
                      {createdKey ? (
                        <div className="flex min-h-6 min-w-0 items-center gap-1 text-xs text-muted-foreground">
                          <span className="truncate">✓ Created {createdKey}</span>
                          <span aria-hidden>·</span>
                          <button
                            type="button"
                            className="py-1 underline-offset-2 hover:text-foreground hover:underline"
                            onClick={() => onOpenIssue?.(createdKey)}
                          >
                            Open
                          </button>
                        </div>
                      ) : issueDraft.saveFailed || staged.copyFailed ? (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">
                          Couldn't save your draft
                        </span>
                      ) : savedDraft ? (
                        <DraftNote
                          state="draft"
                          onDiscard={handleDiscardIssueDraft}
                          onUseJira={() => {}}
                        />
                      ) : null}
                    </>
                  )}
                </div>
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
