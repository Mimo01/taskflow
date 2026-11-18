import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Button } from '@/components/ui/button';
import { DiscardChangesDialog } from '@/components/ui/discard-changes-dialog';
import { DraftNote } from '@/components/ui/draft-note';
import { Input } from '@/components/ui/input';
import type { WikiEditorHandle, WikiEditorHost } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useDraftStagedFiles } from '@/hooks/useDraftStagedFiles';
import { useIssueDraft } from '@/hooks/useIssueDraft';
import { useProjectFixVersions } from '@/hooks/useProjectFixVersions';
import { removeDraftFiles } from '@/lib/issue-draft-files';
import {
  epicSnapshotToFormPatch,
  epicSnapshotToIssueSnapshot,
  hasEpicContent,
  type StaleNotes,
  toEpicSnapshot,
  validateSnapshot,
} from '@/lib/issue-draft-snapshot';
import { uploadStagedFiles } from '@/lib/upload-staged-files';
import { createIssue } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import {
  type EpicDraftSnapshot,
  useIssueDraftsHydrated,
  useIssueDraftsStore,
} from '@/stores/issue-drafts.store';
import { useSettingsStore } from '@/stores/settings.store';
import { buildEpicCreateFields } from './create-edit-issue/epic-create-fields';
import {
  ModalCancelButton,
  ModalField,
  ModalPrimaryButton,
  ModalShell,
} from './create-edit-issue/ModalShell';
import { ModalSidebar } from './create-edit-issue/ModalSidebar';
import {
  type FormAction,
  type FormState,
  useCreateEditForm,
} from './create-edit-issue/useCreateEditForm';
import { useCreateEditQueries } from './create-edit-issue/useCreateEditQueries';
import { usePriorityOptions } from './create-edit-issue/usePriorityOptions';
import { StagedFilesStrip } from './StagedFilesStrip';

export interface CreateEpicDialogProps {
  open: boolean;
  onClose: () => void;
  /** Draft to restore on open (Phase 101) */
  resumeDraftId?: string | null;
}

// A query that will never produce data (disabled) or already has: not worth waiting for.
function settled(q: { status: string; fetchStatus: string }): boolean {
  return q.status !== 'pending' || q.fetchStatus === 'idle';
}

export function CreateEpicDialog({ open, onClose, resumeDraftId = null }: CreateEpicDialogProps) {
  const { epicNameFieldKey, epicLinkFieldKey, storyPointsFieldKey } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();
  const projectKey = activeJiraProject ?? '';

  const { state, dispatch } = useCreateEditForm({
    open,
    mode: 'create',
    defaultIssueType: 'Epic',
  });

  const editorRef = useRef<WikiEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editTick, setEditTick] = useState(0);
  const markEdited = useCallback(() => setEditTick((t) => t + 1), []);
  const [staleNotes, setStaleNotes] = useState<StaleNotes | undefined>(undefined);
  const editDispatch = useCallback(
    (a: FormAction) => {
      dispatch(a);
      markEdited();
      // Editing a field retires its stale note (UI-SPEC).
      if (a.type === 'SET_FIELD' && a.field === 'fixVersions') {
        setStaleNotes((prev) => (prev?.fixVersions ? { ...prev, fixVersions: undefined } : prev));
      } else if (a.type === 'SET_CUSTOM_FIELD_VALUE' || a.type === 'SET_CUSTOM_FIELD_INPUT') {
        const id = a.fieldId;
        setStaleNotes((prev) => {
          if (!prev || !(id in prev.customFields)) return prev;
          const { [id]: _gone, ...rest } = prev.customFields;
          return { ...prev, customFields: rest };
        });
      }
    },
    [dispatch, markEdited],
  );
  const epicDraft = useIssueDraft({ kind: 'epic' });
  const staged = useDraftStagedFiles({ ensureDraftId: epicDraft.ensureId, onChange: markEdited });
  const draftsHydrated = useIssueDraftsHydrated();
  const openHandledRef = useRef(false);
  const pendingPreviewsRef = useRef(false);
  const previewUrlsRef = useRef<string[]>([]);
  const [stagedUploadError, setStagedUploadError] = useState<string | null>(null);
  // Set when create succeeded but a staged upload failed: the dialog stays open with the
  // error visible and the button is disabled so the form can't create a duplicate epic.
  const [hasCreatedWithError, setHasCreatedWithError] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // Resumed draft awaiting its one-time stale-field validation (101 D-15).
  const [resumedSnapshot, setResumedSnapshot] = useState<EpicDraftSnapshot | null>(null);
  const validatedRef = useRef(false);

  const {
    creatmetaFields,
    creatmetaLoading,
    issueTypesLoading,
    customRequiredFields,
    labelsRequired,
    labelsOffered,
    fixVersionsOffered,
    fixVersionsRequired,
  } = useCreateEditQueries({
    open,
    projectKey,
    jiraBaseUrl,
    selectedIssueType: 'Epic',
    epicLinkFieldKey,
    storyPointsFieldKey,
    epicNameFieldKey,
  });
  const priorityOptions = usePriorityOptions({
    mode: 'create',
    open,
    jiraBaseUrl,
    projectKey,
    selectedIssueType: 'Epic',
    creatmetaFields,
    creatmetaLoading,
    issueTypesLoading,
  });
  const storyPointsOffered =
    !!storyPointsFieldKey && (creatmetaFields ?? []).some((f) => f.fieldId === storyPointsFieldKey);

  const revokePreviews = useCallback(() => {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current = [];
  }, []);

  // Once per open: restore the resumed draft, or start from a blank form (D-13).
  // The form's own RESET (earlier effect in useCreateEditForm) lands before the HYDRATE here.
  // biome-ignore lint/correctness/useExhaustiveDependencies: staged/epicDraft handles are stable callbacks
  useEffect(() => {
    if (!open) {
      openHandledRef.current = false;
      pendingPreviewsRef.current = false;
      revokePreviews();
      setDiscardOpen(false);
      return;
    }
    if (openHandledRef.current) return;
    setStagedUploadError(null);
    setHasCreatedWithError(false);
    setStaleNotes(undefined);
    setResumedSnapshot(null);
    validatedRef.current = false;
    if (resumeDraftId) {
      if (!draftsHydrated) return;
      openHandledRef.current = true;
      const draft = useIssueDraftsStore.getState().drafts[resumeDraftId];
      if (draft && draft.kind === 'epic') {
        epicDraft.adopt(draft.id);
        dispatch({ type: 'HYDRATE', state: epicSnapshotToFormPatch(draft.snapshot) });
        setResumedSnapshot(draft.snapshot);
        setEditTick(0);
        pendingPreviewsRef.current = true;
        void staged.restore(draft.files);
        return;
      }
    }
    openHandledRef.current = true;
    epicDraft.adopt(null);
    setEditTick(0);
    staged.reset();
  }, [open, resumeDraftId, draftsHydrated]);

  // Validate the resumed sidebar values once against live Epic createmeta and fix versions.
  const hasFixVersions = (resumedSnapshot?.fixVersions?.length ?? 0) > 0;
  const fixVersionsQuery = useProjectFixVersions(open && hasFixVersions, activeJiraProject);
  useEffect(() => {
    if (!open || !resumedSnapshot || validatedRef.current) return;
    if (creatmetaLoading || issueTypesLoading) return;
    if (hasFixVersions && !settled(fixVersionsQuery)) return;
    validatedRef.current = true;
    const fixVersionIds = fixVersionsQuery.data
      ? new Set(fixVersionsQuery.data.map((v) => v.id))
      : null;
    const before = epicSnapshotToIssueSnapshot(resumedSnapshot);
    const result = validateSnapshot(before, {
      // Empty means the fetch failed or returned nothing: unknown, never "field removed".
      createmetaFields: creatmetaFields && creatmetaFields.length > 0 ? creatmetaFields : undefined,
      epicExists: null,
      parentExists: null,
      fixVersionIds,
    });
    // Dispatch only what changed so typing done in the meantime is not overwritten.
    const out = result.snapshot;
    const patch: Partial<FormState> = {};
    if (JSON.stringify(out.fixVersions) !== JSON.stringify(before.fixVersions))
      patch.fixVersions = out.fixVersions;
    if (JSON.stringify(out.customFieldValues) !== JSON.stringify(before.customFieldValues))
      patch.customFieldValues = out.customFieldValues;
    if (
      JSON.stringify(out.customFieldInputValues) !== JSON.stringify(before.customFieldInputValues)
    )
      patch.customFieldInputValues = out.customFieldInputValues;
    if (Object.keys(patch).length > 0) dispatch({ type: 'HYDRATE', state: patch });
    const n = result.notes;
    if (n.fixVersions || Object.keys(n.customFields).length > 0) setStaleNotes(n);
  }, [
    open,
    resumedSnapshot,
    creatmetaLoading,
    issueTypesLoading,
    creatmetaFields,
    fixVersionsQuery,
    hasFixVersions,
    dispatch,
  ]);

  // Restored images need a local preview URL so the editor can show them.
  useEffect(() => {
    if (!pendingPreviewsRef.current || staged.files.length === 0) return;
    pendingPreviewsRef.current = false;
    const images = staged.files.filter((f) => f.type.startsWith('image/'));
    for (const f of images) {
      const url = URL.createObjectURL(f);
      previewUrlsRef.current.push(url);
      let frames = 0;
      // The handle can be missing or briefly point at a destroyed editor; retry until one takes it.
      const apply = () => {
        if (editorRef.current?.setLocalPreview(f.name, url)) return;
        if (frames++ < 60) requestAnimationFrame(apply);
      };
      apply();
    }
  }, [staged.files]);

  // Autosave on user edits only, never from a state effect (avoids stale writes on reopen).
  const latestRef = useRef({ state, staged, activeJiraProject, creatmetaFields, open });
  latestRef.current = { state, staged, activeJiraProject, creatmetaFields, open };
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on user edits only
  useEffect(() => {
    if (editTick === 0) return;
    const cur = latestRef.current;
    if (!cur.open) return;
    const fieldNames: Record<string, string> = {};
    for (const f of cur.creatmetaFields ?? []) fieldNames[f.fieldId] = f.name;
    epicDraft.schedule({
      projectKey: cur.activeJiraProject ?? '',
      snapshot: toEpicSnapshot(cur.state, fieldNames),
      files: cur.staged.refs,
      hasContent: hasEpicContent(cur.state.summary, cur.state.description, cur.staged.files.length),
    });
  }, [editTick]);

  const finishDraft = () => {
    const id = epicDraft.draftId;
    epicDraft.discard();
    if (id) void removeDraftFiles(id);
  };

  const handleDiscard = () => {
    finishDraft();
    staged.reset();
    dispatch({ type: 'RESET', defaultIssueType: 'Epic' });
    setEditTick(0);
    onClose();
  };

  const closeSilently = () => {
    epicDraft.flush();
    onClose();
  };

  const requestCancel = () => {
    if (hasEpicContent(state.summary, state.description, staged.files.length)) {
      setDiscardOpen(true);
      return;
    }
    closeSilently();
  };

  const host = useMemo<WikiEditorHost>(
    () => ({
      projectKey: activeJiraProject,
      staged: true,
      stageFile: (f) => staged.stage(f),
    }),
    [activeJiraProject, staged.stage],
  );

  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const jiraToken = await readSecret('jira-pat').catch(() => null);
      if (!jiraBaseUrl || !jiraToken || !activeJiraProject || !epicNameFieldKey) {
        throw new Error('Not configured');
      }
      const newIssue = await createIssue(
        jiraBaseUrl,
        jiraToken,
        activeJiraProject,
        state.summary.trim(),
        buildEpicCreateFields({ state, epicNameFieldKey, storyPointsFieldKey, creatmetaFields }),
      );
      const failed =
        staged.files.length > 0
          ? await uploadStagedFiles(jiraBaseUrl, jiraToken, newIssue.key, staged.files)
          : [];
      return { newIssue, failed };
    },
    onSuccess: ({ failed }) => {
      queryClient.invalidateQueries({ queryKey: ['jira-epics-basic'] });
      finishDraft();
      if (failed.length > 0) {
        setStagedUploadError(
          `Issue created, but ${failed.length} file(s) failed to upload: ${failed.join(', ')}`,
        );
        staged.reset();
        setHasCreatedWithError(true);
        return;
      }
      dispatch({ type: 'RESET', defaultIssueType: 'Epic' });
      staged.reset();
      onClose();
    },
    onError: () => {
      epicDraft.flush();
    },
  });

  const requiredCustomFieldsFilled = customRequiredFields.every(
    (f) => (state.customFieldValues[f.fieldId] ?? '').trim() !== '',
  );
  const canSubmit =
    !!state.summary.trim() &&
    requiredCustomFieldsFilled &&
    (!labelsRequired || state.labels.length > 0) &&
    (!fixVersionsRequired || state.fixVersions.length > 0) &&
    !mutation.isPending &&
    !hasCreatedWithError;

  const trySubmit = () => {
    if (!state.summary.trim()) {
      nameInputRef.current?.focus();
      return;
    }
    if (!canSubmit) return;
    formRef.current?.requestSubmit();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  let footerStatus: React.ReactNode = null;
  if (mutation.isError) {
    footerStatus = (
      <p role="alert" className="text-xs text-destructive">
        Couldn't create the epic. Check your connection and try again.
      </p>
    );
  } else if (stagedUploadError) {
    footerStatus = (
      <p role="alert" className="text-xs text-destructive">
        {stagedUploadError}
      </p>
    );
  } else if (epicDraft.saveFailed || staged.copyFailed) {
    footerStatus = <p className="text-xs text-destructive">Couldn't save your draft</p>;
  } else if (epicDraft.draftId) {
    footerStatus = <DraftNote state="draft" onDiscard={handleDiscard} onUseJira={() => {}} />;
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={(o, details) => {
        if (o) return;
        if (details.reason === 'escape-key') {
          details.cancel();
          // The editor's own Esc already handled this keypress.
          if (details.event?.defaultPrevented) return;
          requestCancel();
          return;
        }
        // X and backdrop close silently; the draft stays stored (D-13).
        closeSilently();
      }}
      title="Create epic"
      onSubmit={handleSubmit}
      onSubmitShortcut={trySubmit}
      formRef={formRef}
      asideLabel="Epic fields"
      aside={
        <ModalSidebar
          variant="epic"
          mode="create"
          state={state}
          isSubtask={false}
          dispatch={editDispatch}
          isPending={mutation.isPending}
          projectKey={projectKey}
          jiraBaseUrl={jiraBaseUrl ?? ''}
          priorityOptions={priorityOptions}
          creatmetaFields={creatmetaFields}
          creatmetaLoading={creatmetaLoading}
          customRequiredFields={customRequiredFields}
          labelsRequired={labelsRequired}
          labelsOffered={labelsOffered}
          fixVersionsOffered={fixVersionsOffered}
          fixVersionsRequired={fixVersionsRequired}
          storyPointsOffered={storyPointsOffered}
          open={open}
          staleNotes={staleNotes}
        />
      }
      footerStatus={footerStatus}
      footerActions={
        <>
          <ModalCancelButton onClick={requestCancel} disabled={mutation.isPending} />
          <ModalPrimaryButton
            label="Create epic"
            pendingLabel="Creating…"
            pending={mutation.isPending}
            disabled={!canSubmit}
          />
        </>
      }
      afterContent={
        <DiscardChangesDialog
          open={discardOpen}
          onKeepEditing={() => {
            setDiscardOpen(false);
            editorRef.current?.focus({ toEnd: true });
          }}
          onDiscard={() => {
            setDiscardOpen(false);
            handleDiscard();
          }}
        />
      }
    >
      <ModalField htmlFor="epic-name" label="Epic name" required>
        <Input
          id="epic-name"
          ref={nameInputRef}
          aria-label="Epic name"
          placeholder="Epic name"
          autoFocus
          required
          value={state.summary}
          disabled={mutation.isPending}
          onChange={(e) =>
            editDispatch({ type: 'SET_FIELD', field: 'summary', value: e.target.value })
          }
        />
      </ModalField>
      <div className="flex min-h-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground">Description</span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={mutation.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip />
            Attach file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            data-testid="create-epic-file-input"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) editorRef.current?.insertFiles(files);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex min-h-[240px] flex-1 flex-col">
          <WikiEditorLazy
            ref={editorRef}
            value={state.description}
            onChange={(v) => editDispatch({ type: 'SET_FIELD', field: 'description', value: v })}
            preset="full"
            placeholder="Optional description"
            aria-label="Description"
            host={host}
            onSubmit={(text) => {
              flushSync(() =>
                editDispatch({ type: 'SET_FIELD', field: 'description', value: text }),
              );
              trySubmit();
            }}
          />
        </div>
      </div>
      <StagedFilesStrip
        files={staged.files}
        onRemove={staged.remove}
        missing={staged.missing}
        onRemoveMissing={staged.removeMissing}
        disabled={mutation.isPending}
      />
    </ModalShell>
  );
}
