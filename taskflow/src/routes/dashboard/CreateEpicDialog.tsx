import { Dialog } from '@base-ui/react/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Paperclip } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DraftNote } from '@/components/ui/draft-note';
import { Keycap } from '@/components/ui/keycap';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TooltipBody } from '@/components/ui/tooltip-body';
import type { WikiEditorHandle, WikiEditorHost } from '@/components/wiki-editor/types';
import { WikiEditorLazy } from '@/components/wiki-editor/WikiEditorLazy';
import { useDraftStagedFiles } from '@/hooks/useDraftStagedFiles';
import { useIssueDraft } from '@/hooks/useIssueDraft';
import { removeDraftFiles } from '@/lib/issue-draft-files';
import { hasEpicContent } from '@/lib/issue-draft-snapshot';
import { uploadStagedFiles } from '@/lib/upload-staged-files';
import { createIssue } from '@/services/jira';
import { readSecret } from '@/services/stronghold';
import { useAuthStore } from '@/stores/auth.store';
import { useIssueDraftsHydrated, useIssueDraftsStore } from '@/stores/issue-drafts.store';
import { useSettingsStore } from '@/stores/settings.store';
import { StagedFilesStrip } from './StagedFilesStrip';

export interface CreateEpicDialogProps {
  open: boolean;
  onClose: () => void;
  /** Draft to restore on open (Phase 101) */
  resumeDraftId?: string | null;
}

export function CreateEpicDialog({ open, onClose, resumeDraftId = null }: CreateEpicDialogProps) {
  const { epicNameFieldKey } = useSettingsStore();
  const { jiraBaseUrl, activeJiraProject } = useAuthStore();

  const [epicName, setEpicName] = useState('');
  const [description, setDescription] = useState('');

  const editorRef = useRef<WikiEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editTick, setEditTick] = useState(0);
  const markEdited = useCallback(() => setEditTick((t) => t + 1), []);
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

  const revokePreviews = useCallback(() => {
    for (const url of previewUrlsRef.current) URL.revokeObjectURL(url);
    previewUrlsRef.current = [];
  }, []);

  // Once per open: restore the resumed draft, or start from a blank form (D-13).
  // biome-ignore lint/correctness/useExhaustiveDependencies: staged/epicDraft handles are stable callbacks
  useEffect(() => {
    if (!open) {
      openHandledRef.current = false;
      pendingPreviewsRef.current = false;
      revokePreviews();
      return;
    }
    if (openHandledRef.current) return;
    setStagedUploadError(null);
    setHasCreatedWithError(false);
    if (resumeDraftId) {
      if (!draftsHydrated) return;
      openHandledRef.current = true;
      const draft = useIssueDraftsStore.getState().drafts[resumeDraftId];
      if (draft && draft.kind === 'epic') {
        epicDraft.adopt(draft.id);
        setEpicName(draft.snapshot.epicName);
        setDescription(draft.snapshot.description);
        setEditTick(0);
        pendingPreviewsRef.current = true;
        void staged.restore(draft.files);
        return;
      }
    }
    openHandledRef.current = true;
    epicDraft.adopt(null);
    setEpicName('');
    setDescription('');
    setEditTick(0);
    staged.reset();
  }, [open, resumeDraftId, draftsHydrated]);

  // Restored images need a local preview URL so the editor can show them.
  useEffect(() => {
    if (!pendingPreviewsRef.current || staged.files.length === 0) return;
    pendingPreviewsRef.current = false;
    const images = staged.files.filter((f) => f.type.startsWith('image/'));
    let frames = 0;
    const apply = () => {
      const handle = editorRef.current;
      if (!handle) {
        if (frames++ < 60) requestAnimationFrame(apply);
        return;
      }
      for (const f of images) {
        const url = URL.createObjectURL(f);
        previewUrlsRef.current.push(url);
        handle.setLocalPreview(f.name, url);
      }
    };
    if (images.length > 0) apply();
  }, [staged.files]);

  // Autosave on user edits only, never from a state effect (avoids stale writes on reopen).
  const latestRef = useRef({ epicName, description, staged, activeJiraProject, open });
  latestRef.current = { epicName, description, staged, activeJiraProject, open };
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on user edits only
  useEffect(() => {
    if (editTick === 0) return;
    const cur = latestRef.current;
    if (!cur.open) return;
    epicDraft.schedule({
      projectKey: cur.activeJiraProject ?? '',
      snapshot: { epicName: cur.epicName, description: cur.description },
      files: cur.staged.refs,
      hasContent: hasEpicContent(cur.epicName, cur.description, cur.staged.files.length),
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
    setEpicName('');
    setDescription('');
    setEditTick(0);
    onClose();
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
      const newIssue = await createIssue(jiraBaseUrl, jiraToken, activeJiraProject, epicName, {
        issuetype: 'Epic',
        description: description || undefined,
        [epicNameFieldKey]: epicName,
      });
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
      setEpicName('');
      setDescription('');
      staged.reset();
      onClose();
    },
    onError: () => {
      epicDraft.flush();
    },
  });

  const canSubmit = !!epicName.trim() && !mutation.isPending && !hasCreatedWithError;

  const trySubmit = () => {
    if (!canSubmit) {
      nameInputRef.current?.focus();
      return;
    }
    formRef.current?.requestSubmit();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          epicDraft.flush();
          onClose();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/50 z-40" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background rounded-lg shadow-lg p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">Create Epic</Dialog.Title>
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
                e.preventDefault();
                trySubmit();
              }
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Epic Name *</span>
              <input
                ref={nameInputRef}
                aria-label="Epic Name"
                value={epicName}
                onChange={(e) => {
                  setEpicName(e.target.value);
                  markEdited();
                }}
                className="border rounded px-3 py-2 text-sm"
                required
              />
            </label>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span id="create-epic-description-label" className="text-sm font-medium">
                  Description
                </span>
                <button
                  type="button"
                  disabled={mutation.isPending}
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
                  data-testid="create-epic-file-input"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) editorRef.current?.insertFiles(files);
                    e.target.value = '';
                  }}
                />
              </div>
              <WikiEditorLazy
                ref={editorRef}
                value={description}
                onChange={(v) => {
                  setDescription(v);
                  markEdited();
                }}
                preset="full"
                placeholder="Optional description"
                aria-label="Description"
                host={host}
                onSubmit={(text) => {
                  flushSync(() => setDescription(text));
                  trySubmit();
                }}
              />
              <StagedFilesStrip
                files={staged.files}
                onRemove={staged.remove}
                missing={staged.missing}
                onRemoveMissing={staged.removeMissing}
                disabled={mutation.isPending}
              />
              {epicDraft.draftId && (
                <DraftNote state="draft" onDiscard={handleDiscard} onUseJira={() => {}} />
              )}
              {stagedUploadError && (
                <p role="alert" className="text-xs text-destructive">
                  {stagedUploadError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-2">
              <Dialog.Close
                render={
                  <button
                    type="button"
                    className="px-4 py-2 text-sm rounded border border-border hover:bg-muted"
                  >
                    Cancel
                  </button>
                }
              />
              <Tooltip>
                <TooltipTrigger
                  delay={300}
                  render={
                    <button
                      type="submit"
                      disabled={!canSubmit}
                      className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Create Epic"
                    />
                  }
                >
                  {mutation.isPending ? 'Creating...' : 'Create Epic'}
                </TooltipTrigger>
                <TooltipContent>
                  <TooltipBody>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Create Epic</span>
                      <span className="flex items-center gap-1">
                        <Keycap>⌘</Keycap>
                        <Keycap>↵</Keycap>
                      </span>
                    </div>
                  </TooltipBody>
                </TooltipContent>
              </Tooltip>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
